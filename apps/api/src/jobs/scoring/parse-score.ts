import { MAX_LIST_ITEM_CHARS, MAX_LIST_ITEMS, MAX_SUMMARY_CHARS } from "./prompt.js";

export interface ScoreResult {
  score: number;
  summary: string;
  matches: string[];
  gaps: string[];
}

/** The model's answer is not usable. The message names the problem, never the content. */
export class InvalidScoreError extends Error {}

const FIELDS = ["score", "summary", "matches", "gaps"];

// In right-to-left text a regular hyphen is a neutral character, so "ו-Node.js" is shown
// as "Node.js-ו". The Hebrew maqaf (U+05BE) is a Hebrew letter-like character and keeps
// the order. Only a hyphen that directly follows a Hebrew letter is replaced.
export function useHebrewMaqaf(text: string): string {
  return text.replace(/([א-ת])-/g, "$1־");
}

function parseText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidScoreError(`${field} must be a non-empty string`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new InvalidScoreError(`${field} is longer than ${maxLength} characters`);
  }
  // Postgres cannot store NUL in text.
  if (text.includes("\u0000")) {
    throw new InvalidScoreError(`${field} contains a null character`);
  }
  return useHebrewMaqaf(text);
}

function parseList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new InvalidScoreError(`${field} must be an array`);
  }
  if (value.length > MAX_LIST_ITEMS) {
    throw new InvalidScoreError(`${field} has more than ${MAX_LIST_ITEMS} items`);
  }
  return value.map((item, index) => parseText(item, `${field}[${index}]`, MAX_LIST_ITEM_CHARS));
}

// The model's answer is untrusted input, even with a JSON schema: it is checked here
// before anything is saved.
export function parseScoreResponse(text: string): ScoreResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Not the parser's own message: it can quote part of the text.
    throw new InvalidScoreError("answer is not valid JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new InvalidScoreError("answer must be a JSON object");
  }
  const object = raw as Record<string, unknown>;

  const unexpected = Object.keys(object).filter((key) => !FIELDS.includes(key));
  if (unexpected.length > 0) {
    throw new InvalidScoreError(`unexpected fields: ${unexpected.length}`);
  }

  const { score } = object;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100) {
    throw new InvalidScoreError("score must be an integer from 0 to 100");
  }

  return {
    score,
    summary: parseText(object.summary, "summary", MAX_SUMMARY_CHARS),
    matches: parseList(object.matches, "matches"),
    gaps: parseList(object.gaps, "gaps"),
  };
}
