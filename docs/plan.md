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

| Step | What                                                                                                                                                                                                                                                                                                                                                                                                        | Done when                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1    | **Data model for the MVP, jobs part** – `Job` gets `createdAt` and is split from a new `JobPosting` (one job, many places it was seen: `url`, `site`, `source` MANUAL/EMAIL, `sourceMessageId`), with a unique `(userId, url)` on the posting for de-duplication. ✅ Done. (The `Profile` model moved to step 3b.)                                                                                          | Migration applied, tests pass                                                     |
| 2    | **Front-end** – Hebrew RTL web app with Tailwind: register, login, route protection, and a read-only jobs list (title, company, date added, sites as links). Dev data comes from a seed script. Browser E2E tests (Playwright) on the test DB.                                                                                                                                                              | Register → jobs list works in the browser, also on a phone screen; E2E tests pass |
| 3b   | **Profile** – one `Profile` per user with two free-text fields: `cvText` (the CV, 200–20,000 characters) and `lookingFor` (what she is looking for, up to 2,000), plus its screen (`GET`/`PUT /profile`). The length limits matter: in 3c this text is sent to the LLM on every scoring run.                                                                                                                | A saved profile survives a reload; validation matches on server and client        |
| 3c   | **AI scoring** – the `LlmProvider` interface (OpenAI implementation `gpt-6-luna`, a fake for tests, structured JSON output). `POST /jobs/score` scores up to 10 unscored or stale jobs per call against the profile: 0–100 with a Hebrew summary, matches and gaps, one stored score per job. `GET /jobs` is sorted by score. The list shows a score badge and the summary, with matches and gaps on click. | Every job can be scored from the screen; the list is ranked                       |
| 3d   | **Job status** – a status per job (new / relevant / not relevant / applied), set by the user and shown in the list. Split out of 3c.                                                                                                                                                                                                                                                                        | The user can mark a job and the list reflects it                                  |
| 4b   | **Gmail connection** – OAuth with the read-only scope (`gmail.readonly`), PKCE and a signed `state`; the refresh token is stored encrypted. The profile page shows the state and lets the user connect and disconnect (`GET /gmail/status`, `POST /gmail/connect`, `GET /gmail/oauth/callback`, `DELETE /gmail/connection`). No mail is read yet.                                                           | A user can connect and disconnect; tests never reach the real Google              |
| 4c   | **Mail ingestion** – `POST /gmail/sync`: unread mail from the last 14 days from allowed senders (a built-in list of job sites plus the user's own), up to 50 mails per sync. Only mail whose DKIM signature Gmail verified for the sender's own domain is read. The LLM extracts jobs (title, company, location, URL, snippet); a URL must appear in the mail. Duplicates are skipped by normalized URL; the same company and role (same place, or one has none) gets a new posting instead of a new job. New jobs are scored. Senders are managed on the profile page; the jobs page has a sync button. Built and tested with fakes; the check against a real mailbox is still to do. | Real alert mail becomes scored jobs |
| 5    | **Polish** – README with screenshots and architecture, demo data, known limitations.                                                                                                                                                                                                                                                                                                                        | Ready to show in an interview                                                     |

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
- **Sender suggestions**: a one-time scan of sender addresses only (never content) to spot job sites the built-in list misses, shown to the user to approve.
- **Application confirmations** (for example `indeedapply@indeed.com` and similar) to mark a job as "applied" in step 3d.
- Work experience and education as structured data.
- CI, deployment, monitoring.

## Development-workflow track (alongside the MVP)

- [x] `CLAUDE.md`
- [ ] Hook: format + lint after every edit
- [ ] Hook: block edits to `.env*`
- [ ] Code-review subagent in `.claude/agents/`
- [ ] A skill for a repeated task (e.g. adding an endpoint)

## Decisions

| Decision                                                                                         | Why                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job-alert emails as the first job source                                                         | Sites already send filtered jobs; no scraping, no fragile parsers, no terms-of-service issues                                                                                                                                                                                             |
| Dashboard first, digest email second                                                             | The dashboard holds the data and the statuses; the digest points into it                                                                                                                                                                                                                  |
| OpenAI first, behind `LlmProvider`                                                               | A key already exists; the interface keeps the provider replaceable                                                                                                                                                                                                                        |
| Gmail read-only in the MVP                                                                       | Least privilege; nothing in the MVP needs to change the mailbox                                                                                                                                                                                                                           |
| No auto-apply                                                                                    | An email to an employer can't be taken back; the user stays in control                                                                                                                                                                                                                    |
| CV as pasted/extracted text, no file storage                                                     | Enough for scoring; storage is not needed yet                                                                                                                                                                                                                                             |
| `Job` split from `JobPosting`                                                                    | The same job often arrives from several sites or alerts; one job with several postings keeps the ranked list free of duplicates. De-duplication is by `(userId, url)` on the posting. A composite foreign key `(jobId, userId)` guarantees a posting always has the same owner as its job |
| node:test, manual validation, 404 for other users' resources                                     | Kept from the existing code (see `CLAUDE.md`)                                                                                                                                                                                                                                             |
| No screen for adding a job by hand                                                               | Jobs will come from the emails (ingestion step). Until then, development data comes from a seed script. `POST /jobs` stays in the API but is not exposed in the UI                                                                                                                        |
| Profile screen is built together with the CV                                                     | A profile without a CV has nothing to show; both arrive in the same step (3b)                                                                                                                                                                                                             |
| Profile is deleted with its user (`onDelete: Cascade`)                                           | The CV is personal data and has no meaning without its owner; it must not outlive the account                                                                                                                                                                                             |
| CV and preferences text is never logged or put in errors                                         | Personal data. Validation errors name the field and the limit, never the value                                                                                                                                                                                                            |
| Hebrew UI, right-to-left, top navigation bar                                                     | One main screen today, a few later; a top bar works on a phone without a drawer. Layout uses logical CSS properties (`ms-`, `pe-`, `text-start`) so RTL needs no special cases                                                                                                            |
| Scoring: one `JobScore` per job, stale when the profile is saved later                           | Re-scoring is cheap to detect: `profile.updatedAt > score.scoredAt`, with no copy of the profile. `scoredAt` is stamped just before the profile is read, so a profile saved during a run also makes that run's scores stale. A failed re-score keeps the old score                        |
| Scoring is manual, 10 jobs per call, 3 model requests at a time, 30 s timeout and one retry each | Bounds cost and time of one HTTP request. A failed job stays pending and is retried on the next press. One run per user at a time (in memory, 409 otherwise)                                                                                                                              |
| The model is `gpt-6-luna` (`OPENAI_MODEL`), at low reasoning effort                              | Small and cheap ($0.10 / $0.50 per million tokens), supports Structured Outputs and Chat Completions. The `gpt-5-nano` / `gpt-5-mini` pages are marked deprecated. Checked against OpenAI's model page and the SDK types in October 2026                                                  |
| **The CV, the looking-for text and job descriptions are sent to OpenAI**                         | Scoring needs them. They are sent on every scoring run, only for the jobs being scored. Nothing else about the user (email, id) is sent. The OpenAI account's data-retention terms apply                                                                                                  |
| CV and job text are never logged                                                                 | The scoring code logs only counts and token totals. Errors from the SDK are reduced to their kind and HTTP status, because the SDK's messages can quote the request                                                                                                                       |
| Web token in `sessionStorage`                                                                    | A conscious MVP compromise: simple, and it disappears when the tab closes. See Known gaps                                                                                                                                                                                                 |
| Gmail OAuth starts with an authenticated `POST /gmail/connect` that returns the Google URL | The callback is a browser redirect from Google and cannot carry our bearer token, so the token never has to leave `sessionStorage`. The callback is public and identifies the user only by the signed `state` |
| `state` is HMAC-signed with a key derived from `JWT_SECRET`, not a JWT | A JWT signed with the real secret would be a valid access token (the guard only checks `sub`). The state holds the user id, a nonce and an expiry (10 minutes) |
| The OAuth nonce and PKCE `code_verifier` live on the user's `GmailConnection` row and are cleared when the callback runs | Makes the state single-use (a replay finds the nonce gone) and a new attempt replaces the old one. The verifier is stored encrypted like the token. PKCE (S256) is used although the client has a secret |
| Refresh token encrypted with AES-256-GCM; the user id is authenticated data; key in `TOKEN_ENCRYPTION_KEY` | A database copy alone is not enough, and a ciphertext copied to another user's row does not decrypt. The access token is never stored; later steps refresh it when needed |
| The granted scope must be exactly `gmail.readonly` | Google can grant more than requested. If it does, the grant is revoked at Google and nothing is saved |
| Errors from `google-auth-library` are reduced to a fixed code | Its errors carry the request (client secret, code, tokens). The original error is never rethrown or logged |
| Disconnect always deletes the tokens here; revoking at Google is best effort | A network failure must not leave a token behind. If revoking failed the API says `revoked: false` and the screen tells the user to remove the app in their Google account |
| `GET /gmail/status` checks the refresh token against Google at most once an hour | A dead token (Testing mode expires them after 7 days) is noticed without a call on every page load |
| Mail is read only from allowed senders: a built-in list plus the user's own | Only that mail is read and sent to OpenAI. The built-in list has the dedicated job-site domains seen in a real mailbox (a domain also matches its subdomains). Sites that also send personal mail are listed by exact address (LinkedIn: `jobalerts-noreply@` and `jobs-noreply@`), because the whole domain would send private messages to OpenAI. Indeed is not listed: its mail in a real mailbox is application confirmations |
| A user's own sender is an address or a domain; a general mail provider is accepted only as a full address | A whole `gmail.com` would allow anyone's mail. Values are lowercase and limited to letters, digits and `. @ _ + -`, so they cannot add operators to the Gmail search. At most 50 per user |
| Only mail with `dkim=pass` for the sender's own domain (or a subdomain) is processed | The From header is easy to forge. Gmail writes an `Authentication-Results` header; only the FIRST `Authentication-Results` header is trusted, and only if it starts with Gmail's own `mx.google.com`: Gmail puts its header on top, and a sender can add headers below it, even one that copies Gmail's server id. A mail that fails is counted in the sync summary (`unauthenticated`) and is not sent to the model. It is recorded like a failed mail and given up on after 3 syncs. The From address is the last bracketed address after quoted display names are removed, so a display name that looks like an allowed address does not count |
| Processed mail is remembered by Gmail message id (table `GmailProcessedMessage`) | Read-only access cannot mark mail as read. Only the id is kept: no sender, subject or content. A mail that failed is tried again, and given up on after 3 failures, so one broken mail cannot take a place in every sync. Mail with no jobs is recorded too |
| One model request per mail, text/plain unless it is only a stub; HTML converted by our own small converter | The plain part is used when it has at least 200 characters and a link; many senders put "view in browser" there. A link becomes `text (url)`, which is what the URL check reads. No HTML library: the text is only sent to the model and checked, never shown. Cut to 15,000 characters per mail, at most 30 jobs per mail |
| A job's URL from the model must appear in the text the model was given | Stops invented URLs and URLs planted by a mail's text. Both sides are normalized the same way before comparing. A job that fails is dropped and counted (`rejected`), the rest of the mail is kept |
| URLs are normalized before saving: tracking parameters removed, site rules for LinkedIn, Indeed, Glassdoor, AllJobs/alljob, Drushim | `JobPosting.url` is the normalized URL, so the existing `(userId, url)` unique constraint is the duplicate check. A site rule applies only when the URL clearly has that site's shape; otherwise only known tracking parameters are removed. The worst case is a duplicate that is not recognised, never two jobs merged. The rules come from known URL shapes and should be checked against real mail |
| The same company and role is one job only if the place also matches, or one of them has no place | The same role in two cities is two jobs. Company, title and city are compared after normalizing (case, punctuation, niqqud, legal suffixes like Ltd and בע"מ, gender markers like /ת, the city before the first comma, Yafo dropped). Done in memory per sync, with no extra column |
| `Job.descriptionSource` (`FULL` or `EMAIL_SNIPPET`) and `Job.location` | A job found in an email has only the snippet from the mail (job pages are not fetched), so its score rests on less. An explicit field is clearer than guessing from the postings, and the list shows a note on those scores. The scoring prompt is told the text is a partial snippet and to avoid extreme scores |
| Sync scores the new jobs with the existing scoring service, up to 3 rounds of 10 | Same code and limits as the button. What is left shows as "waiting for scoring" and the button scores it. Without a profile the jobs are still saved. A sync is one HTTP request, one per user at a time (409) |
| **Subject and body of mail from allowed, DKIM-verified senders are sent to OpenAI** | Extraction needs them. Not the sender address, and nothing from other mail. Logs hold only numbers and error kinds, never subjects, senders or content. The API never returns mail content, only the jobs extracted from it |

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

## Prompt injection in mail extraction

A mail is untrusted text written by a third party, even from a known site. It is sent to the model as data, with the same protections as scoring.

**What protects us**

- Only mail from allowed senders, with a DKIM signature that Gmail verified for the sender's own domain, reaches the model at all.
- The instructions are in the system message and contain no mail text. The subject and body are in the user message inside `<email>` tags, with `<`, `>` and `&` escaped, and the instructions say that everything inside is untrusted data.
- The answer is a JSON schema, checked again in our code: bounded text, a URL of at most 2,000 characters, no unexpected fields, no null characters, at most 30 jobs. An unusable entry is dropped alone; an unusable answer fails that mail only.
- **A URL must be in the mail.** It is normalized and must equal one of the URLs found in the text that was sent. So the model cannot be talked into adding a link the mail does not contain.
- A link that looks like unsubscribe, preferences, settings, login or "view in browser" is dropped even if it is in the mail, because such links often carry a personal token.
- The model has no tools. Its output is saved as plain text. The extracted snippet goes on to scoring, which escapes and caps it as before.
- The mail length is capped (15,000 characters) and so is the number of mails (50) and jobs (30 per mail).

**What it does not cover**

- A mail can still list a job that is not real, with a real-looking link from the mail. The user sees the site name and clicks the link themselves.
- Text hidden in the HTML (for example `display:none`) is read like any other text.
- A forged mail that really is signed by the sender's domain (an attacker who controls a sender, or a site that lets users write text into its alerts) passes every check above.

## Known gaps

- No rate limiting on login/register.
- `POST /auth/register` returns 409 for an existing email, which reveals that the email is registered.
- No refresh tokens: the access token lasts 1 hour, then the user logs in again.
- No CI yet.
- The Claude Code hook that blocks edits to applied migrations and real `.env` files covers only the Edit and Write tools. A Bash command (for example `Add-Content`) can still change them. Read access to `.env` files is denied separately in `.claude/settings.json`.
- **The web token lives in `sessionStorage`** – readable by any script on the page (XSS) and lost when the tab closes. The API never returns mail content, so an XSS cannot read the mailbox through it. It can still start a sync (which spends tokens), change the senders list and disconnect Gmail. Kept as it is for the MVP, with the httpOnly cookie as the likely alternative (it needs API changes).
- **Google's Testing mode expires the authorization after 7 days.** The refresh token then stops working: the connection is marked "needs reconnect", the token is deleted, and the profile page asks the user to connect again. This is noticed when the status is read (at most once an hour) and, from 4c, when a sync runs. It goes away only by publishing the OAuth app, which needs Google's verification for this scope.
- The public `GET /gmail/oauth/callback` has no rate limiting. Without a valid signed state it does no database write and calls nothing at Google.
- No rotation of `TOKEN_ENCRYPTION_KEY`: changing it makes every stored refresh token unreadable, and users have to connect again. The `v1:` prefix of the stored value leaves room for a versioned scheme.
- Connecting again does not revoke the previous refresh token at Google. It is no longer stored here, but Google keeps it valid until the user removes the app in their account.
- Leftovers of unfinished attempts (a pending `GmailConnection` row with an expired nonce) are not cleaned up; they hold no token.
- Page protection in the web app is client-side only (the token is not in a cookie, so there is no middleware). The protected data still comes from the API and needs the token, but the page shell is served without it.
- The web app has no way to renew a token: after 1 hour the next API call returns 401, the token is cleared, and the user is sent to the login screen with an explanation.
- Scoring has no per-user budget or rate limit beyond 10 jobs per call. A user can press the button repeatedly and spend tokens.
- The "one scoring run per user" lock is in the memory of one API process; with several processes it would not hold.
- Scoring takes pending jobs newest first and a failed job stays pending. Ten or more jobs that always fail (for example a description the model refuses) would block older jobs from ever being scored. Nothing remembers a failure yet; fix it if it shows up in real use (for example by storing the last failed attempt and trying those last).
- Sync reads at most 50 mails and scores at most 30 jobs per click; the rest needs another click (the summary says so). It is one long HTTP request.
- The "one sync per user" lock is in the memory of one API process, like the scoring lock.
- Mail that fails Gmail's DKIM check (some sites sign with a third party's domain) is skipped and counted in each of the first 3 syncs, then given up on, so it cannot take a place in every sync. If the rule is changed later, those rows (status FAILED, 3 attempts, in `GmailProcessedMessage`) have to be deleted for the mail to be read again. A flood of forged mail can still fill the places of the first 3 syncs. The rule is strict on purpose; real use will show which senders it blocks.
- Manual jobs added before 4c are not normalized. A mail URL is compared with both its normalized and its original form, but a manual URL with tracking parameters can still be saved twice.
- Site URL rules (LinkedIn, Indeed, Glassdoor, AllJobs, Drushim) and the default sender list were written from known formats and one mailbox, and need checking against real mail. A site that changes its URLs will produce duplicates until the rule is updated.
- Matching the same job on two sites depends on the company, the title and the city being written alike. "Tel Aviv" and "תל אביב", or a differently worded title, give two jobs.
- A score based on a snippet is not redone when the job later gets a full description. There is no way to add one yet.
- Mail with no HTML and no plain text, or only attachments, is recorded as done with no jobs.
