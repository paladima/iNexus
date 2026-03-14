/**
 * Contact Ingest Service (v19)
 *
 * AI-powered contact ingestion: paste anything → detect type → LLM extract → dedupe → preview/save.
 * Replaces manual form with intelligent "paste anything" input.
 */
import { z } from "zod";
import { callLLM } from "./llm.service";
import { matchPerson } from "../utils/personMatcher";
import * as repo from "../repositories";

// ─── Types ──────────────────────────────────────────────────
export type InputType = "linkedin_url" | "email" | "phone" | "free_text";

export interface ExtractedContact {
  fullName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  location?: string;
  websiteUrl?: string;
  confidence: number; // 0-100
  fieldConfidence: Record<string, number>; // per-field confidence
  inputType: InputType;
  rawInput: string;
}

export interface IngestResult {
  extracted: ExtractedContact;
  duplicateMatch: DuplicateInfo | null;
  isDuplicate: boolean;
}

// ─── Zod schema for LLM response ───────────────────────────
const extractedContactSchema = z.object({
  fullName: z.string().default("Unknown"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().optional(),
  confidence: z.number().min(0).max(100).default(50),
  fieldConfidence: z.record(z.string(), z.number()).default({}),
});

// ─── Input Type Detection ───────────────────────────────────
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s\-().]{7,20}$/;

export function detectInputType(input: string): InputType {
  const trimmed = input.trim();

  if (LINKEDIN_REGEX.test(trimmed)) return "linkedin_url";
  if (EMAIL_REGEX.test(trimmed)) return "email";
  if (PHONE_REGEX.test(trimmed)) return "phone";
  return "free_text";
}

// ─── Extract Contact via LLM ────────────────────────────────
export async function extractContact(
  rawInput: string,
  userId?: number
): Promise<ExtractedContact> {
  const inputType = detectInputType(rawInput);
  const trimmed = rawInput.trim();

  // For LinkedIn URLs, pre-fill the URL field
  const linkedinHint = inputType === "linkedin_url" ? trimmed : undefined;
  // For emails, pre-fill the email field
  const emailHint = inputType === "email" ? trimmed : undefined;
  // For phones, pre-fill the phone field
  const phoneHint = inputType === "phone" ? trimmed : undefined;

  const { data } = await callLLM<z.infer<typeof extractedContactSchema>>({
    promptModule: "contact_ingest",
    params: {
      messages: [
        {
          role: "system",
          content: `You are a contact extraction AI. Given any text input about a person, extract structured contact information.
Return JSON with these fields:
- fullName (required, best guess from context)
- firstName, lastName (split from fullName if possible)
- title (job title)
- company (organization)
- email
- phone
- linkedinUrl
- location (city, state, or country)
- websiteUrl
- confidence (0-100, how confident you are overall)
- fieldConfidence (object mapping field names to 0-100 confidence for each extracted field)

Rules:
- If input is a LinkedIn URL, extract the person's name from the URL slug (e.g., "john-doe" → "John Doe")
- If input is an email, try to extract name from the email prefix (e.g., "john.doe@acme.com" → "John Doe") and company from domain
- If input is a phone number, set fullName to "Unknown" and confidence to 20
- For free text, extract all available fields
- Always provide fieldConfidence for every non-empty field you extract
- Be conservative with confidence scores — only high confidence for explicitly stated info`,
        },
        {
          role: "user",
          content: `Extract contact info from this input:\n\n${trimmed}`,
        },
      ],
      response_format: { type: "json_object" as const },
    },
    schema: extractedContactSchema,
    fallback: {
      fullName: "Unknown",
      confidence: 10,
      fieldConfidence: {},
    },
    userId,
    entityType: "contact_ingest",
  });

  return {
    ...data,
    // Override with detected values if available
    linkedinUrl: data.linkedinUrl || linkedinHint,
    email: data.email || emailHint,
    phone: data.phone || phoneHint,
    inputType,
    rawInput: trimmed,
  };
}

// ─── Dedupe Check ───────────────────────────────────────────
export interface DuplicateInfo {
  matched: boolean;
  existingId?: number;
  matchType?: string;
  existingPerson?: { id: number; fullName: string; company?: string | null };
}

export async function checkDuplicate(
  userId: number,
  extracted: ExtractedContact
): Promise<DuplicateInfo | null> {
  // Search by name, email, or LinkedIn
  const searchTerms = [extracted.fullName, extracted.email, extracted.linkedinUrl].filter(Boolean);
  if (searchTerms.length === 0) return null;

  const { items: candidates } = await repo.getPeople(userId, {
    search: extracted.fullName || extracted.email || "",
    limit: 20,
  });

  if (candidates.length === 0) return null;

  const personCandidates = candidates.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    linkedinUrl: c.linkedinUrl ?? undefined,
    company: c.company ?? undefined,
    websiteUrl: c.websiteUrl ?? undefined,
  }));

  // Use PersonMatcher for fuzzy matching
  const match = matchPerson(
    {
      fullName: extracted.fullName,
      linkedinUrl: extracted.linkedinUrl,
      company: extracted.company,
      websiteUrl: extracted.websiteUrl,
    },
    personCandidates
  );

  if (!match.matched) return null;

  const existing = candidates.find((c) => c.id === match.existingId);
  return {
    ...match,
    existingPerson: existing ? { id: existing.id, fullName: existing.fullName, company: existing.company } : undefined,
  };
}

// ─── Full Ingest Pipeline ───────────────────────────────────
export async function ingestContact(
  userId: number,
  rawInput: string
): Promise<IngestResult> {
  // Step 1: Extract via LLM
  const extracted = await extractContact(rawInput, userId);

  // Step 2: Dedupe check
  const duplicateMatch = await checkDuplicate(userId, extracted);

  return {
    extracted,
    duplicateMatch,
    isDuplicate: duplicateMatch !== null,
  };
}
