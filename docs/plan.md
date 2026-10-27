# CareerAgent – Plan

## Product direction

The user connects her Gmail once and uploads her CV. CareerAgent finds the job-alert emails from job sites, extracts the jobs, scores each one against the CV, and shows a ranked list – so instead of reading dozens of alert emails she reviews one prioritized list.

Job sites are **detected automatically**, not configured per site:

1. A cheap pre-filter (known job-site senders + keywords) – no AI.
2. An LLM only for emails that pass the filter, to extract the jobs.

The user always decides. The app never applies on her behalf.

## Already done (before this plan)

Monorepo, NestJS API, Next.js shell, PostgreSQL + Prisma, register/login with JWT, jobs API scoped to the user, unit and e2e tests with a test-DB guard.

## MVP (2–3 weeks)

| Step | What                                                                                                                                                                                                                                                                                                                                         | Done when                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1    | **Data model for the MVP, jobs part** – `Job` gets `createdAt` and is split from a new `JobPosting` (one job, many places it was seen: `url`, `site`, `source` MANUAL/EMAIL, `sourceMessageId`), with a unique `(userId, url)` on the posting for de-duplication. ✅ Done. (The `Profile` model moved to step 3b.)                           | Migration applied, tests pass                                                     |
| 2    | **Front-end** – Hebrew RTL web app with Tailwind: register, login, route protection, and a read-only jobs list (title, company, date added, sites as links). Dev data comes from a seed script. Browser E2E tests (Playwright) on the test DB.                                                                                               | Register → jobs list works in the browser, also on a phone screen; E2E tests pass |
| 3b   | **Profile** – one `Profile` per user with two free-text fields: `cvText` (the CV, 200–20,000 characters) and `lookingFor` (what she is looking for, up to 2,000), plus its screen (`GET`/`PUT /profile`). The length limits matter: in 3c this text is sent to the LLM on every scoring run.                                                 | A saved profile survives a reload; validation matches on server and client        |
| 3c   | **AI scoring** – the `LlmProvider` interface (OpenAI implementation `gpt-6-luna`, a fake for tests, structured JSON output). `POST /jobs/score` scores up to 10 unscored or stale jobs per call against the profile: 0–100 with a Hebrew summary, matches and gaps, one stored score per job. `GET /jobs` is sorted by score. The list shows a score badge and the summary, with matches and gaps on click. | Every job can be scored from the screen; the list is ranked |
| 3d   | **Job status** – a status per job (new / relevant / not relevant / applied), set by the user and shown in the list. Split out of 3c. | The user can mark a job and the list reflects it |
| 4    | **Gmail and ingestion** – OAuth with read-only scope, tokens stored encrypted (user can connect and disconnect). `POST /sync`: fetch recent emails, pre-filter, extract jobs with the LLM, save new jobs, skip duplicates.                                                                                                                   | Real alert emails become scored jobs                                              |
| 5    | **Polish** – README with screenshots and architecture, demo data, known limitations.                                                                                                                                                                                                                                                         | Ready to show in an interview                                                     |

## Right after the MVP

- Digest email to the user: top matches with direct links, frequency daily / every 3 days / weekly.
- Scheduled sync instead of a manual button.
- Gmail labels for processed emails (needs a write scope).

## Later

- Outlook support.
- Searching job sites directly.
- AI-drafted application texts, always approved by the user.
- PDF upload of the CV (text extraction).
- Structured profile preferences (role, location, work mode, salary, keywords).
- Work experience and education as structured data.
- CI, deployment, monitoring.

## Development-workflow track (alongside the MVP)

- [x] `CLAUDE.md`
- [ ] Hook: format + lint after every edit
- [ ] Hook: block edits to `.env*`
- [ ] Code-review subagent in `.claude/agents/`
- [ ] A skill for a repeated task (e.g. adding an endpoint)

## Decisions

| Decision                                                     | Why                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job-alert emails as the first job source                     | Sites already send filtered jobs; no scraping, no fragile parsers, no terms-of-service issues                                                                                                                                                                                             |
| Dashboard first, digest email second                         | The dashboard holds the data and the statuses; the digest points into it                                                                                                                                                                                                                  |
| OpenAI first, behind `LlmProvider`                           | A key already exists; the interface keeps the provider replaceable                                                                                                                                                                                                                        |
| Gmail read-only in the MVP                                   | Least privilege; nothing in the MVP needs to change the mailbox                                                                                                                                                                                                                           |
| No auto-apply                                                | An email to an employer can't be taken back; the user stays in control                                                                                                                                                                                                                    |
| CV as pasted/extracted text, no file storage                 | Enough for scoring; storage is not needed yet                                                                                                                                                                                                                                             |
| `Job` split from `JobPosting`                                | The same job often arrives from several sites or alerts; one job with several postings keeps the ranked list free of duplicates. De-duplication is by `(userId, url)` on the posting. A composite foreign key `(jobId, userId)` guarantees a posting always has the same owner as its job |
| node:test, manual validation, 404 for other users' resources | Kept from the existing code (see `CLAUDE.md`)                                                                                                                                                                                                                                             |
| No screen for adding a job by hand                           | Jobs will come from the emails (ingestion step). Until then, development data comes from a seed script. `POST /jobs` stays in the API but is not exposed in the UI                                                                                                                        |
| Profile screen is built together with the CV                 | A profile without a CV has nothing to show; both arrive in the same step (3b)                                                                                                                                                                                                             |
| Profile is deleted with its user (`onDelete: Cascade`)       | The CV is personal data and has no meaning without its owner; it must not outlive the account                                                                                                                                                                                             |
| CV and preferences text is never logged or put in errors     | Personal data. Validation errors name the field and the limit, never the value                                                                                                                                                                                                            |
| Hebrew UI, right-to-left, top navigation bar                 | One main screen today, a few later; a top bar works on a phone without a drawer. Layout uses logical CSS properties (`ms-`, `pe-`, `text-start`) so RTL needs no special cases                                                                                                            |
| Scoring: one `JobScore` per job, stale when the profile is saved later | Re-scoring is cheap to detect: `profile.updatedAt > score.scoredAt`, with no copy of the profile. `scoredAt` is stamped just before the profile is read, so a profile saved during a run also makes that run's scores stale. A failed re-score keeps the old score |
| Scoring is manual, 10 jobs per call, 3 model requests at a time, 30 s timeout and one retry each | Bounds cost and time of one HTTP request. A failed job stays pending and is retried on the next press. One run per user at a time (in memory, 409 otherwise) |
| The model is `gpt-6-luna` (`OPENAI_MODEL`), at low reasoning effort | Small and cheap ($0.10 / $0.50 per million tokens), supports Structured Outputs and Chat Completions. The `gpt-5-nano` / `gpt-5-mini` pages are marked deprecated. Checked against OpenAI's model page and the SDK types in October 2026 |
| **The CV, the looking-for text and job descriptions are sent to OpenAI** | Scoring needs them. They are sent on every scoring run, only for the jobs being scored. Nothing else about the user (email, id) is sent. The OpenAI account's data-retention terms apply |
| CV and job text are never logged | The scoring code logs only counts and token totals. Errors from the SDK are reduced to their kind and HTTP status, because the SDK's messages can quote the request |
| Web token in `sessionStorage`                                | A conscious MVP compromise: simple, and it disappears when the tab closes. See Known gaps                                                                                                                                                                                                 |

## Prompt injection in scoring

A job description is untrusted text (from step 4 it comes from emails). It is sent to the model as data.

**What protects us**

- The instructions live in the system message and contain no job or CV text. The job, the CV and the wishes are in the user message, each inside its own tag, and the instructions say that everything inside the tags is untrusted data.
- `<`, `>` and `&` in that text are escaped, so a description cannot close its tag and put text outside the data block.
- The answer is requested as JSON with a schema, then checked again in our code: integer score 0–100, bounded text, at most 5 items per list, no unexpected fields, no null characters. An invalid answer fails that job only.
- The model has no tools. Its output is only stored and shown as plain text. No code path takes an action based on it.
- Description length is capped (8,000 characters), which also caps the cost.

**What it does not cover**

- A job text can still push the score up or down ("rate this 100"). Nothing in code can tell an honest high score from a manipulated one.
- The summary, matches and gaps are text the model wrote after reading untrusted input, so they can be misleading. They are shown as text, never as links or HTML.
- Tags and escaping reduce the risk; they do not guarantee that a model never follows a hidden instruction.

## Known gaps

- No rate limiting on login/register.
- `POST /auth/register` returns 409 for an existing email, which reveals that the email is registered.
- No refresh tokens: the access token lasts 1 hour, then the user logs in again.
- No CI yet.
- The Claude Code hook that blocks edits to applied migrations and real `.env` files covers only the Edit and Write tools. A Bash command (for example `Add-Content`) can still change them. Read access to `.env` files is denied separately in `.claude/settings.json`.
- **The web token lives in `sessionStorage`** – readable by any script on the page (XSS) and lost when the tab closes. **Revisit this decision before the Gmail step**, when the app starts holding access to real mailbox data (an httpOnly cookie is the likely alternative, and needs API changes).
- Page protection in the web app is client-side only (the token is not in a cookie, so there is no middleware). The protected data still comes from the API and needs the token, but the page shell is served without it.
- The web app has no way to renew a token: after 1 hour the next API call returns 401, the token is cleared, and the user is sent to the login screen with an explanation.
- Scoring has no per-user budget or rate limit beyond 10 jobs per call. A user can press the button repeatedly and spend tokens.
- The "one scoring run per user" lock is in the memory of one API process; with several processes it would not hold.
- `POST /jobs` does not limit the length of the job description (title and company are not capped either). Fix this before step 4, when jobs start arriving from emails. Scoring already cuts the description at 8,000 characters before sending it, but the database stores whatever is posted.
- Scoring takes pending jobs newest first and a failed job stays pending. Ten or more jobs that always fail (for example a description the model refuses) would block older jobs from ever being scored. Nothing remembers a failure yet; fix it if it shows up in real use (for example by storing the last failed attempt and trying those last).
