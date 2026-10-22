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

| Step | What | Done when |
|---|---|---|
| 1 | **Data model for the MVP** – ✅ *Jobs part done:* `Job` gets `createdAt` and is split from a new `JobPosting` (one job, many places it was seen: `url`, `site`, `source` MANUAL/EMAIL, `sourceMessageId`), with a unique `(userId, url)` on the posting for de-duplication. ⏳ *Still to do:* a `Profile` with CV text and a few basic preferences (role, location, work mode, keywords). | Migration applied, tests pass (jobs part: done) |
| 2 | **`LlmProvider` interface** – an OpenAI implementation and a fake for tests. Structured JSON output. | Unit tests with the fake |
| 3 | **Gmail connection** – OAuth with read-only scope, tokens stored encrypted. | User can connect and disconnect Gmail |
| 4 | **Ingestion** – `POST /sync`: fetch recent emails, pre-filter, extract jobs with the LLM, save new jobs, skip duplicates. | Real alert emails become jobs |
| 5 | **Scoring** – score 0–100, reasons, skill gaps, stored per job. Only new jobs are scored. | Every job has a stored score |
| 6 | **Dashboard** – login, jobs sorted by score with reasons and link, status per job (new / relevant / not relevant / applied). | Usable end to end in the browser |
| 7 | **Polish** – README with screenshots and architecture, demo data, known limitations. | Ready to show in an interview |

## Right after the MVP

- Digest email to the user: top matches with direct links, frequency daily / every 3 days / weekly.
- Scheduled sync instead of a manual button.
- Gmail labels for processed emails (needs a write scope).

## Later

- Outlook support.
- Searching job sites directly.
- AI-drafted application texts, always approved by the user.
- Work experience and education as structured data.
- CI, deployment, monitoring.

## Development-workflow track (alongside the MVP)

- [x] `CLAUDE.md`
- [ ] Hook: format + lint after every edit
- [ ] Hook: block edits to `.env*`
- [ ] Code-review subagent in `.claude/agents/`
- [ ] A skill for a repeated task (e.g. adding an endpoint)

## Decisions

| Decision | Why |
|---|---|
| Job-alert emails as the first job source | Sites already send filtered jobs; no scraping, no fragile parsers, no terms-of-service issues |
| Dashboard first, digest email second | The dashboard holds the data and the statuses; the digest points into it |
| OpenAI first, behind `LlmProvider` | A key already exists; the interface keeps the provider replaceable |
| Gmail read-only in the MVP | Least privilege; nothing in the MVP needs to change the mailbox |
| No auto-apply | An email to an employer can't be taken back; the user stays in control |
| CV as pasted/extracted text, no file storage | Enough for scoring; storage is not needed yet |
| `Job` split from `JobPosting` | The same job often arrives from several sites or alerts; one job with several postings keeps the ranked list free of duplicates. De-duplication is by `(userId, url)` on the posting. A composite foreign key `(jobId, userId)` guarantees a posting always has the same owner as its job |
| node:test, manual validation, 404 for other users' resources | Kept from the existing code (see `CLAUDE.md`) |

## Known gaps

- No rate limiting on login/register.
- `POST /auth/register` returns 409 for an existing email, which reveals that the email is registered.
- No refresh tokens: the access token lasts 1 hour, then the user logs in again.
- No CI yet.
