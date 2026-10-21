// The site a url belongs to: its lowercased hostname without a leading "www.".
// Throws a TypeError if the url cannot be parsed.
export function siteFromUrl(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}
