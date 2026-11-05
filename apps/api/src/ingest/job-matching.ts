// Decides whether two jobs found in different emails are the same job.

const COMPANY_SUFFIXES = /\s(ltd|inc|llc|corp|co|gmbh|בע מ|בעמ)$/;

// Lowercase, no niqqud, no punctuation, single spaces. Letters of any script and digits stay.
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'`׳״’”“]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCompany(company: string): string {
  let text = normalizeText(company);
  for (let i = 0; i < 3; i++) {
    const next = text.replace(COMPANY_SUFFIXES, "");
    if (next === text) break;
    text = next;
  }
  return text;
}

// "מפתח/ת Full Stack (m/f/d)" and "מפתחת Full Stack" differ only in how the gender is written.
export function normalizeTitle(title: string): string {
  return normalizeText(
    title
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b[mfdx]\s*\/\s*[mfdx](?:\s*\/\s*[mfdx])*\b/gi, " ")
      .replace(/\/\s*(?:ה|ת|ית|ות|ן|ים)(?=\s|$)/g, " "),
  );
}

// Only the city: the part before the first comma. Null when there is nothing to compare.
export function normalizeLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  // "Tel Aviv-Yafo" and "Tel Aviv" (תל אביב-יפו and תל אביב) are the same place.
  const city = normalizeText(location.split(",")[0] ?? "").replace(/\s(yafo|jaffa|יפו)$/, "");
  return city === "" ? null : city;
}

// Null when the company or the title is empty after normalizing: such a job never matches.
export function jobKey(company: string, title: string): string | null {
  const normalizedCompany = normalizeCompany(company);
  const normalizedTitle = normalizeTitle(title);
  return normalizedCompany === "" || normalizedTitle === ""
    ? null
    : `${normalizedCompany}|${normalizedTitle}`;
}

// The same role in two cities is two jobs. A job with no known location can be the same job as
// any of them.
export function locationsCompatible(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}
