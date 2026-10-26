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
| 3c   | **AI scoring** – the `LlmProvider` interface (OpenAI implementation, a fake for tests, structured JSON output). Scoring 0–100 with reasons and skill gaps against the profile, stored per job; only new jobs are scored. The list shows score and reasons, sorted by score, with a status per job (new / relevant / not relevant / applied). | Every job has a stored score; the list is ranked                                  |
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
| Web token in `sessionStorage`                                | A conscious MVP compromise: simple, and it disappears when the tab closes. See Known gaps                                                                                                                                                                                                 |

## Known gaps

- No rate limiting on login/register.
- `POST /auth/register` returns 409 for an existing email, which reveals that the email is registered.
- No refresh tokens: the access token lasts 1 hour, then the user logs in again.
- No CI yet.
- The Claude Code hook that blocks edits to applied migrations and real `.env` files covers only the Edit and Write tools. A Bash command (for example `Add-Content`) can still change them. Read access to `.env` files is denied separately in `.claude/settings.json`.
- **The web token lives in `sessionStorage`** – readable by any script on the page (XSS) and lost when the tab closes. **Revisit this decision before the Gmail step**, when the app starts holding access to real mailbox data (an httpOnly cookie is the likely alternative, and needs API changes).
- Page protection in the web app is client-side only (the token is not in a cookie, so there is no middleware). The protected data still comes from the API and needs the token, but the page shell is served without it.
- The web app has no way to renew a token: after 1 hour the next API call returns 401, the token is cleared, and the user is sent to the login screen with an explanation.
