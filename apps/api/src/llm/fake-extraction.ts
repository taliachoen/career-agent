import { LlmError } from "./llm-provider.js";

// The fake model's answer to a job-extraction request (schema "job_extraction"). It reads the
// email layout the invented sample mail uses, so tests need no real model:
//   "Title (url)" then company, then place        (the HTML mails, after conversion to text)
//   Title / "Company - place" / url on its own line   (the plain-text mail)
// A link is a job link only if its URL says "job" and not "unsubscribe".
// Markers in the email steer it, like the scoring markers:
//   [[fake:fail]]     throw, like a timeout or an API error
//   [[fake:badjson]]  answer with text that is not JSON
//   [[fake:bad-url]]  also list a job whose URL is not in the email (an invented one)
export function fakeExtractionAnswer(user: string): string {
  if (user.includes("[[fake:fail]]")) {
    throw new LlmError("Fake provider: simulated failure");
  }
  if (user.includes("[[fake:badjson]]")) {
    return "this is not json";
  }

  // The prompt escapes <, > and &; undo that to read the email as it was.
  const body = (/<body>\n([\s\S]*?)\n<\/body>/.exec(user)?.[1] ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const isJobUrl = (url: string) => /job/i.test(url) && !/unsubscribe/i.test(url);

  const jobs: {
    title: string;
    company: string;
    location: string | null;
    url: string;
    snippet: string;
  }[] = [];
  const add = (title: string, company: string, location: string | null, url: string) =>
    jobs.push({
      title,
      company,
      location,
      url,
      snippet: `${title} – ${company}${location ? `, ${location}` : ""}`,
    });

  lines.forEach((line, index) => {
    const inline = /^(.+?)\s*\((https?:\/\/[^\s)]+)\)$/.exec(line);
    if (inline && isJobUrl(inline[2]!)) {
      add(inline[1]!, lines[index + 1] ?? "", lines[index + 2] ?? null, inline[2]!);
    } else if (/^https?:\/\/\S+$/.test(line) && isJobUrl(line) && index >= 2) {
      const [company = "", location = null] = (lines[index - 1] ?? "").split(/\s+[-·]\s+/);
      add(lines[index - 2]!, company, location, line);
    }
  });

  if (user.includes("[[fake:bad-url]]")) {
    add("Invented Job", "Nowhere Ltd", null, "https://evil.example/jobs/not-in-the-email");
  }
  return JSON.stringify({ jobs });
}
