import type { GmailMessage } from "./gmail-provider.js";

// The part of Gmail's `messages.get?format=full` answer that is read here.
interface Payload {
  mimeType?: unknown;
  filename?: unknown;
  headers?: unknown;
  body?: { data?: unknown; size?: unknown } | null;
  parts?: unknown;
}

// A body larger than this is ignored. Alert emails are far smaller, and this bounds memory.
const MAX_BODY_BYTES = 2_000_000;
const MAX_DEPTH = 10;

function headerValues(payload: Payload, name: string): string[] {
  if (!Array.isArray(payload.headers)) return [];
  const wanted = name.toLowerCase();
  const values: string[] = [];
  for (const header of payload.headers as { name?: unknown; value?: unknown }[]) {
    if (
      typeof header?.name === "string" &&
      typeof header.value === "string" &&
      header.name.toLowerCase() === wanted
    ) {
      values.push(header.value);
    }
  }
  return values;
}

// Gmail returns the body bytes as the sender encoded them, so the part's charset matters:
// Israeli senders still use windows-1255. An unknown charset falls back to UTF-8.
function decodeBody(data: string, contentType: string | undefined): string {
  const bytes = Buffer.from(data, "base64url");
  const charset = /charset\s*=\s*"?([\w.:-]+)"?/i.exec(contentType ?? "")?.[1];
  try {
    return new TextDecoder(charset ?? "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function collect(
  payload: Payload,
  found: { text: string | null; html: string | null },
  depth: number,
) {
  if (depth > MAX_DEPTH || typeof payload !== "object" || payload === null) return;
  // An attachment, even a text one, is not the message body.
  if (typeof payload.filename === "string" && payload.filename !== "") return;

  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.toLowerCase() : "";
  const data = payload.body?.data;
  const size = typeof payload.body?.size === "number" ? payload.body.size : 0;
  if (typeof data === "string" && data !== "" && size <= MAX_BODY_BYTES) {
    const contentType = headerValues(payload, "Content-Type")[0];
    if (mimeType === "text/plain" && found.text === null) {
      found.text = decodeBody(data, contentType);
    } else if (mimeType === "text/html" && found.html === null) {
      found.html = decodeBody(data, contentType);
    }
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts as Payload[]) {
      collect(part, found, depth + 1);
    }
  }
}

// Reads a Gmail API message. Anything missing becomes an empty value: the sync then skips the
// message, it never throws on an odd one.
export function parseGmailMessage(id: string, data: unknown): GmailMessage {
  const payload = ((data as { payload?: Payload } | null)?.payload ?? {}) as Payload;
  const found: { text: string | null; html: string | null } = { text: null, html: null };
  collect(payload, found, 0);
  return {
    id,
    from: headerValues(payload, "From")[0] ?? "",
    subject: headerValues(payload, "Subject")[0] ?? "",
    authResults: headerValues(payload, "Authentication-Results"),
    text: found.text,
    html: found.html,
  };
}
