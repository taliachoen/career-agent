import { htmlToText } from "./html-to-text.js";

// The most characters of one email that are sent to the model. It caps the cost of a sync.
export const MAX_EMAIL_CHARS = 15_000;

// The plain-text part is used when it is a real body: long enough and with a link in it.
// Many senders put only "view this email in your browser" there, and the jobs are in the HTML.
const MIN_PLAIN_CHARS = 200;

function cleanPlain(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The text of an email, cut to MAX_EMAIL_CHARS. Everything the model sees, and every URL that
// is later accepted, comes from this one string.
export function emailBodyText(message: { text: string | null; html: string | null }): string {
  const plain = message.text === null ? "" : cleanPlain(message.text);
  const plainIsUsable = plain.length >= MIN_PLAIN_CHARS && /https?:\/\//i.test(plain);
  const body = plainIsUsable || message.html === null ? plain : htmlToText(message.html) || plain;
  return body.length > MAX_EMAIL_CHARS ? body.slice(0, MAX_EMAIL_CHARS) : body;
}
