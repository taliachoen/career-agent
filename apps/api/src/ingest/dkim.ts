// Gmail adds an Authentication-Results header to every message it receives, with the result of
// checking the sender's DKIM signature. The sender can write any header it likes, including one
// that starts with Gmail's own server id. Gmail puts its header at the very top, above anything
// that came with the message, so only the FIRST Authentication-Results header is trusted, and
// only if it names Gmail's server. Any later one is the sender's, whatever it says.
const GMAIL_AUTHSERV_ID = /^mx\.google\.com\s*;/i;

// Domains that signed the message with a DKIM signature Gmail verified (dkim=pass).
export function dkimPassDomains(authResults: readonly string[]): string[] {
  const domains: string[] = [];
  for (const header of authResults.slice(0, 1)) {
    const value = header.trim();
    if (!GMAIL_AUTHSERV_ID.test(value)) continue;
    for (const segment of value.split(";")) {
      const result = segment.trim();
      if (!/^dkim\s*=\s*pass\b/i.test(result)) continue;
      const signer =
        /\bheader\.d\s*=\s*([^\s;]+)/i.exec(result)?.[1] ??
        /\bheader\.i\s*=\s*([^\s;]+)/i.exec(result)?.[1];
      if (!signer) continue;
      // header.i is an identity like "@example.com" or "user@example.com".
      const domain = signer.slice(signer.lastIndexOf("@") + 1).toLowerCase();
      if (domain !== "") domains.push(domain);
    }
  }
  return domains;
}

// True when a verified signature was made by the sender's own domain or one of its
// subdomains. A message signed only by a third party (or not at all) does not count.
export function isDkimAligned(authResults: readonly string[], senderDomain: string): boolean {
  const sender = senderDomain.toLowerCase();
  return dkimPassDomains(authResults).some(
    (signer) => signer === sender || signer.endsWith(`.${sender}`),
  );
}
