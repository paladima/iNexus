/**
 * Voice Service (#18)
 * Full voice workflow: upload → transcribe → parse → confirm → edit → save.
 * Provider-first: uses VoiceParserProvider, no direct invokeLLM calls.
 */
import { transcribeAudio } from "../_core/voiceTranscription";
import { storagePut } from "../storage";
import * as repo from "../repositories";
import { getProviderWithFallback } from "../providers/registry";
import { isFuzzyNameMatch, nameSimilarity } from "../utils/fuzzyMatch";
import type { VoiceParserProvider, VoiceParseResult } from "../providers/types";

// ─── Upload Audio ───────────────────────────────────────────────
export async function uploadAudio(userId: number, audioBase64: string, mimeType: string) {
  const buffer = Buffer.from(audioBase64, "base64");
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("wav") ? "wav" : "mp3";
  const key = `voice/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { url } = await storagePut(key, buffer, mimeType);
  return { url, key };
}

// ─── Transcribe ─────────────────────────────────────────────────
export async function transcribeAudioFile(audioUrl: string, language?: string) {
  const result = await transcribeAudio({ audioUrl, language });
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result;
}

// ─── Parse Transcript (provider-first) ──────────────────────────
export async function parseVoiceIntent(userId: number, transcript: string): Promise<{ id: number | null } & VoiceParseResult> {
  const provider = getProviderWithFallback("voiceParser") as VoiceParserProvider | undefined;
  if (!provider) throw new Error("VoiceParserProvider not registered");

  const parsed = await provider.parseTranscript(transcript);

  const captureId = await repo.createVoiceCapture(userId, {
    transcript,
    parsedJson: parsed as unknown as Record<string, unknown>,
    status: "parsed",
  });

  await repo.logActivity(userId, {
    activityType: "voice_capture",
    title: "Voice note captured and parsed",
    entityType: "voice_capture",
    entityId: captureId ?? undefined,
    metadataJson: {
      peopleCount: parsed.people.length,
      taskCount: parsed.tasks.length,
      noteCount: parsed.notes.length,
      reminderCount: parsed.reminders.length,
    },
  });

  return { id: captureId, ...parsed };
}

// ─── Edit Parsed Actions (before confirm) ───────────────────────
export async function editVoiceCapture(
  userId: number,
  captureId: number,
  updatedParsed: VoiceParseResult
) {
  await repo.updateVoiceCapture(userId, captureId, {
    parsedJson: updatedParsed as unknown as Record<string, unknown>,
    status: "edited",
  });
  return { captureId, status: "edited" };
}

// ─── Confirm and Save Voice Actions ─────────────────────────────
export async function confirmVoiceActions(
  userId: number,
  captureId: number,
  people: Array<{ name: string; role?: string; company?: string; action?: string; save: boolean }>,
  tasks: Array<{ title: string; priority: string; dueDate?: string; save: boolean }>,
  notes: Array<{ personName?: string; content: string; save: boolean }>
) {
  const results = { savedPeople: 0, savedTasks: 0, savedNotes: 0, errors: [] as string[] };

  // Save people
  for (const p of people.filter((p) => p.save)) {
    try {
      // Dedup check with fuzzy matching (#10)
      const { items: existing } = await repo.getPeople(userId, { search: p.name, limit: 10 });
      const duplicate = existing.some(
        (e) => isFuzzyNameMatch(e.fullName, p.name)
      );
      if (duplicate) continue;

      const names = p.name.split(" ");
      await repo.createPerson(userId, {
        fullName: p.name,
        firstName: names[0],
        lastName: names.slice(1).join(" "),
        title: p.role,
        company: p.company,
        status: "saved",
        sourceType: "voice",
      });
      results.savedPeople++;
    } catch (err) {
      results.errors.push(`Failed to save person ${p.name}: ${(err as Error).message}`);
    }
  }

  // Save tasks
  for (const t of tasks.filter((t) => t.save)) {
    try {
      const dueAt = t.dueDate ? new Date(t.dueDate) : undefined;
      await repo.createTask(userId, {
        title: t.title,
        priority: t.priority,
        dueAt,
        source: "voice",
      });
      results.savedTasks++;
    } catch (err) {
      results.errors.push(`Failed to save task ${t.title}: ${(err as Error).message}`);
    }
  }

  // Save notes (linked to person if found, or as unlinked activity note) (#14)
  for (const n of notes.filter((n) => n.save)) {
    try {
      let linked = false;
      if (n.personName) {
        const { items } = await repo.getPeople(userId, { search: n.personName, limit: 10 });
        // Use fuzzy matching to find the right person
        const match = items.find((e) => isFuzzyNameMatch(e.fullName, n.personName!));
        if (match) {
          await repo.addPersonNote(userId, match.id, n.content, "voice", "ai");
          linked = true;
        }
      }
      // If no person found or no personName, save to unlinked_notes table (#13 v11)
      if (!linked) {
        await repo.createUnlinkedNote(userId, {
          content: n.content,
          source: "voice",
          personNameHint: n.personName ?? undefined,
          captureId,
        });
        await repo.logActivity(userId, {
          activityType: "voice_note_unlinked",
          title: n.personName
            ? `Voice note saved (unlinked — "${n.personName}" not found)`
            : `Voice note saved (unlinked)`,
          metadataJson: {
            personNameHint: n.personName ?? null,
            source: "voice",
            captureId,
          },
        });
      }
      results.savedNotes++;
    } catch (err) {
      results.errors.push(`Failed to save note: ${(err as Error).message}`);
    }
  }

  // Update capture status
  await repo.updateVoiceCapture(userId, captureId, { status: "confirmed" });

  // Activity log
  await repo.logActivity(userId, {
    activityType: "voice_actions_confirmed",
    title: `Confirmed voice actions: ${results.savedPeople} people, ${results.savedTasks} tasks, ${results.savedNotes} notes`,
    entityType: "voice_capture",
    entityId: captureId,
    metadataJson: results,
  });

  return results;
}

// ─── Resolve Person Candidates (#23 v15) ───────────────────────
/**
 * Given a name from voice input, find all matching contacts.
 * Returns ranked candidates so the UI can show a selection list
 * when multiple fuzzy matches are found (ambiguity resolution).
 */
export async function resolvePersonCandidates(
  userId: number,
  name: string
): Promise<Array<{ id: number; fullName: string; company: string | null; title: string | null; similarity: number }>> {
  if (!name || name.trim().length === 0) return [];

  const { items } = await repo.getPeople(userId, { search: name, limit: 20 });
  if (items.length === 0) return [];

  // Score each candidate by name similarity
  const scored = items
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      company: (p as any).company ?? null,
      title: (p as any).title ?? null,
      similarity: nameSimilarity(name, p.fullName),
    }))
    .filter((c) => c.similarity >= 0.5) // only plausible matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  return scored;
}

// ─── Get Voice Capture by ID ────────────────────────────────────
export async function getVoiceCapture(userId: number, captureId: number) {
  return repo.getVoiceCaptureById(userId, captureId);
}
