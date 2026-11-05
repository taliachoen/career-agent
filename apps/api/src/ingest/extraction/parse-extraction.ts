import { MAX_JOBS_PER_EMAIL } from "./prompt.js";

// Same limits as POST /jobs (see JOB_FIELD_MAX_LENGTHS), plus the snippet and the location.
export const TITLE_MAX = 300;
export const COMPANY_MAX = 200;
export const LOCATION_MAX = 200;
export const URL_MAX = 2_000;
export const SNIPPET_MAX = 2_000;

export interface ExtractedJob {
  title: string;
  company: string;
  location: string | null;
  url: string;
  snippet: string;
}

export interface ExtractionResult {
  jobs: ExtractedJob[];
  // Entries that were unusable, or beyond MAX_JOBS_PER_EMAIL.
  rejected: number;
}

/** The model's answer is not usable. The message names the problem, never the content. */
export class InvalidExtractionError extends Error {}

const ITEM_FIELDS = ["title", "company", "location", "url", "snippet"];

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > max || trimmed.includes("\u0000")) return null;
  return trimmed;
}

// One entry; null when it cannot be used. A bad entry costs only itself, not the whole email.
function parseItem(value: unknown): ExtractedJob | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => !ITEM_FIELDS.includes(key))) return null;

  const title = text(item.title, TITLE_MAX);
  const company = text(item.company, COMPANY_MAX);
  const url = text(item.url, URL_MAX);
  if (!title || !company || !url) return null;

  let location: string | null = null;
  if (item.location !== null && item.location !== undefined) {
    location = text(item.location, LOCATION_MAX);
    if (location === null) return null;
    if (location === "") location = null;
  }

  let snippet = text(item.snippet, SNIPPET_MAX);
  if (snippet === null) return null;
  // An email with no more detail gives the model nothing to put here: the title says it.
  if (snippet === "") snippet = `${title} – ${company}`;

  return { title, company, location, url, snippet };
}

// The model's answer is untrusted input, even with a JSON schema: it is checked here before
// anything is used. The URL is only checked for shape here; that it appears in the email is
// checked by the caller, which has the email.
export function parseExtractionResponse(responseText: string): ExtractionResult {
  let raw: unknown;
  try {
    raw = JSON.parse(responseText);
  } catch {
    // Not the parser's own message: it can quote part of the text.
    throw new InvalidExtractionError("answer is not valid JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new InvalidExtractionError("answer must be a JSON object");
  }
  const object = raw as Record<string, unknown>;
  if (Object.keys(object).some((key) => key !== "jobs")) {
    throw new InvalidExtractionError("unexpected fields");
  }
  if (!Array.isArray(object.jobs)) {
    throw new InvalidExtractionError("jobs must be an array");
  }

  const jobs: ExtractedJob[] = [];
  let rejected = 0;
  for (const entry of object.jobs) {
    const job = parseItem(entry);
    if (job === null || jobs.length >= MAX_JOBS_PER_EMAIL) {
      rejected += 1;
    } else {
      jobs.push(job);
    }
  }
  return { jobs, rejected };
}
