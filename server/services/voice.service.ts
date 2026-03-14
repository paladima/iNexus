/**
 * Voice Service (#2)
 * Business logic extracted from voice.router.ts
 */
import { invokeLLM } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { storagePut } from "../storage";
import * as repo from "../repositories";
import { getProvider } from "../providers/registry";
import { parseLLMWithSchema, voiceIntentSchema } from "../llmHelpers";

export async function uploadAudio(userId: number, audioBase64: string, mimeType: string) {
  const buffer = Buffer.from(audioBase64, "base64");
  const ext = mimeType.includes("webm") ? "webm" : "mp3";
  const key = `voice/${userId}/${Date.now()}.${ext}`;
  const { url } = await storagePut(key, buffer, mimeType);
  return { url };
}

export async function transcribeAudioFile(audioUrl: string, language?: string) {
  const result = await transcribeAudio({ audioUrl, language });
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result;
}

export async function parseVoiceIntent(userId: number, transcript: string) {
  // Try provider first
  const voiceProvider = getProvider("voiceParser");
  if (voiceProvider) {
    try {
      const parsed = await voiceProvider.parseTranscript(transcript);
      const captureId = await repo.createVoiceCapture(userId, {
        transcript,
        parsedJson: parsed as unknown as Record<string, unknown>,
        status: "parsed",
      });
      await repo.logActivity(userId, {
        activityType: "voice_capture",
        title: "Voice note captured",
        entityType: "voice_capture",
        entityId: captureId ?? undefined,
      });
      return { id: captureId, ...parsed };
    } catch {
      // Fall through to direct LLM
    }
  }

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Parse this voice transcript into structured networking actions. Return JSON: { "people": [{ "name": "...", "context": "..." }], "tasks": [{ "title": "...", "dueHint": "..." }], "notes": [{ "personName": "...", "content": "..." }], "reminders": [{ "text": "...", "when": "..." }] }`,
      },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseLLMWithSchema(response, voiceIntentSchema, "voice.parseIntent", {
    people: [],
    tasks: [],
    notes: [],
    reminders: [],
  });

  const captureId = await repo.createVoiceCapture(userId, {
    transcript,
    parsedJson: parsed,
    status: "parsed",
  });

  await repo.logActivity(userId, {
    activityType: "voice_capture",
    title: "Voice note captured",
    entityType: "voice_capture",
    entityId: captureId ?? undefined,
  });

  return { id: captureId, ...parsed };
}

export async function confirmVoiceActions(
  userId: number,
  captureId: number,
  people: Array<{ name: string; role?: string; company?: string; action?: string; save: boolean }>,
  tasks: Array<{ title: string; priority: string; dueDate?: string; save: boolean }>,
  notes: Array<{ personName?: string; content: string; save: boolean }>
) {
  const results = { savedPeople: 0, savedTasks: 0, savedNotes: 0 };

  for (const p of people.filter((p) => p.save)) {
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
  }

  for (const t of tasks.filter((t) => t.save)) {
    const dueAt = t.dueDate ? new Date(t.dueDate) : undefined;
    await repo.createTask(userId, {
      title: t.title,
      priority: t.priority,
      dueAt,
      source: "voice",
    });
    results.savedTasks++;
  }

  for (const n of notes.filter((n) => n.save)) {
    if (n.personName) {
      const { items } = await repo.getPeople(userId, { search: n.personName, limit: 1 });
      if (items.length > 0) {
        await repo.addPersonNote(userId, items[0].id, n.content, "voice", "ai");
      }
    }
    results.savedNotes++;
  }

  await repo.updateVoiceCapture(userId, captureId, { status: "confirmed" });

  await repo.logActivity(userId, {
    activityType: "voice_actions_confirmed",
    title: `Confirmed voice actions: ${results.savedPeople} people, ${results.savedTasks} tasks, ${results.savedNotes} notes`,
    entityType: "voice_capture",
    entityId: captureId,
  });

  return results;
}
