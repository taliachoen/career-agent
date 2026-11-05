// Turns the many URLs one job can have (tracking parameters, redirect paths) into one, so the
// same job is recognised again. Used for the URL that is saved and for the check that the
// model's URL really is in the email: both sides go through this, so they compare equal.
//
// A site rule only applies when the URL clearly has that site's shape. A URL no rule knows gets
// the generic cleanup, which removes only known tracking parameters. The worst outcome is a
// duplicate that is not recognised, never two different jobs merged into one.

// Parameters that identify the click or the email, never the page.
const TRACKING_PARAMS = new Set([
  "gclid",
  "gclsrc",
  "fbclid",
  "msclkid",
  "dclid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "trk",
  "trkemail",
  "trackingid",
  "tracking_id",
  "refid",
  "ref",
  "midtoken",
  "midsig",
  "otptoken",
  "lipi",
  "licu",
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower);
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function param(url: URL, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const [key, value] of url.searchParams) {
    if (key.toLowerCase() === wanted && value !== "") return value;
  }
  return null;
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
}

// The rule for a site whose job URLs are known; null when this URL is not one of them.
function siteRule(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");

  if (hostMatches(host, "linkedin.com")) {
    const id = /\/jobs\/view\/(?:[^/?#]*-)?(\d{5,})/.exec(url.pathname)?.[1];
    return id ? `https://www.linkedin.com/jobs/view/${id}/` : null;
  }

  if (/(^|\.)indeed\.[a-z.]+$/.test(host)) {
    const id = param(url, "jk") ?? param(url, "vjk");
    return id && /^[\w-]+$/.test(id) ? `https://${url.hostname}/viewjob?jk=${id}` : null;
  }

  if (/(^|\.)glassdoor\.[a-z.]+$/.test(host)) {
    const id = param(url, "jl");
    return id && /^\d+$/.test(id)
      ? `https://${url.hostname}/partner/jobListing.htm?jl=${id}`
      : null;
  }

  if (hostMatches(host, "alljobs.co.il") || hostMatches(host, "alljob.co.il")) {
    const id = param(url, "JobID");
    return id && /^\d+$/.test(id)
      ? `https://${url.hostname}${stripTrailingSlash(url.pathname)}?JobID=${id}`
      : null;
  }

  if (hostMatches(host, "drushim.co.il")) {
    return /^\/job\/\d+/.test(url.pathname)
      ? `https://${url.hostname}${stripTrailingSlash(url.pathname)}`
      : null;
  }

  return null;
}

// The normalized form of an http(s) URL, or null if it is not one.
export function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.protocol = "https:";
  if (url.port === "80" || url.port === "443") url.port = "";
  url.username = "";
  url.password = "";
  url.hash = "";

  const bySite = siteRule(url);
  if (bySite) return bySite;

  const kept = [...url.searchParams].filter(([name]) => !isTrackingParam(name));
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const search = new URLSearchParams(kept).toString();
  return `https://${url.host}${stripTrailingSlash(url.pathname)}${search ? `?${search}` : ""}`;
}

// Links a job alert has but that are never a job: unsubscribe, preferences, account pages. The
// model is told to skip them; this makes sure, because such a link often carries a personal token.
const NON_JOB_LINK =
  /unsubscri|opt-?out|preference|manage[-_ ]?(subscri|alert|notif)|email[-_ ]?settings|account[-_ ]?settings|\/settings\b|view[-_ ]?in[-_ ]?browser|\/login\b|\/signin\b/i;

export function looksLikeNonJobLink(url: string): boolean {
  return NON_JOB_LINK.test(url);
}

// Every http(s) URL written in a text (a link's `(url)` form included), normalized. The model
// may only return a URL that is in this set.
export function extractNormalizedUrls(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'()[\]]+/gi)) {
    const candidate = match[0].replace(/[.,;:!?]+$/, "");
    const normalized = normalizeUrl(candidate);
    if (normalized) found.add(normalized);
  }
  return found;
}
