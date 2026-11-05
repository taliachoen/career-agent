import { GENERIC_MAIL_DOMAINS } from "./default-senders.js";

export const SENDER_MAX_LENGTH = 254;
export const MAX_USER_SENDERS = 50;

const LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
const DOMAIN_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`);
// The local part starts with a letter or digit: a leading "-" would be read as "not" in a Gmail search.
const ADDRESS_RE = new RegExp(`^[a-z0-9][a-z0-9._+-]*@${LABEL}(?:\\.${LABEL})+$`);

export type SenderParseResult = { ok: true; value: string } | { ok: false; error: string };

// A sender is an address or a domain, lowercase, with only characters that cannot change the
// meaning of a Gmail search query. The messages never contain the value that was sent.
export function parseSenderValue(input: unknown): SenderParseResult {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, error: "value must be a non-empty string" };
  }
  const value = input.trim().toLowerCase();
  if (value.length > SENDER_MAX_LENGTH) {
    return { ok: false, error: `value must be at most ${SENDER_MAX_LENGTH} characters` };
  }
  if (value.includes("@")) {
    return ADDRESS_RE.test(value)
      ? { ok: true, value }
      : { ok: false, error: "value must be a valid e-mail address or a domain" };
  }
  if (!DOMAIN_RE.test(value)) {
    return { ok: false, error: "value must be a valid e-mail address or a domain" };
  }
  if (GENERIC_MAIL_DOMAINS.some((generic) => value === generic || value.endsWith(`.${generic}`))) {
    return {
      ok: false,
      error: "a general mail provider cannot be added as a domain; add a full e-mail address",
    };
  }
  return { ok: true, value };
}

export interface FromAddress {
  address: string;
  domain: string;
}

// The address in a From header: `Name <a@b.com>` or a bare `a@b.com`. Null if there is none.
export function parseFromHeader(header: string): FromAddress | null {
  // A display name can be quoted and can contain "<address>" itself:
  //   "jobs <jobs@drushim.co.il>" <someone@evil.com>
  // so quoted strings are removed first, and the last bracketed address is the real one.
  const withoutQuoted = header.replace(/"(?:[^"\\]|\\.)*"/g, " ");
  const brackets = [...withoutQuoted.matchAll(/<([^<>\s]+)>/g)];
  const inBrackets = brackets.at(-1)?.[1];
  const candidate = (inBrackets ?? withoutQuoted.trim()).toLowerCase();
  if (!ADDRESS_RE.test(candidate)) return null;
  return { address: candidate, domain: candidate.slice(candidate.lastIndexOf("@") + 1) };
}

// An address entry matches that exact address. A domain entry matches the domain and its
// subdomains ("drushim.co.il" matches "mail.drushim.co.il", never "evildrushim.co.il").
export function senderAllowed(from: FromAddress, entries: readonly string[]): boolean {
  return entries.some((entry) =>
    entry.includes("@")
      ? from.address === entry
      : from.domain === entry || from.domain.endsWith(`.${entry}`),
  );
}

// The Gmail search for one sync: unread, recent, from an allowed sender. Entries are checked
// again here, so nothing but plain address/domain characters can ever reach the query.
export function buildGmailQuery(entries: readonly string[], days: number): string {
  const safe = entries.filter((entry) => ADDRESS_RE.test(entry) || DOMAIN_RE.test(entry));
  if (safe.length === 0) {
    throw new Error("No valid senders to search for");
  }
  const from = safe.map((entry) => `from:${entry}`).join(" OR ");
  return `is:unread newer_than:${Math.floor(days)}d (${from})`;
}
