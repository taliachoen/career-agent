# CareerAgent

> 🚧 **Work in progress** – actively developed.

An AI-powered career assistant for job seekers. The user saves her CV and what she is looking for, and CareerAgent scores every job against them with an LLM and shows one ranked list – instead of reading dozens of job-alert emails. Next, it will read those alert emails from the user's Gmail (read-only) and extract the jobs automatically.

The user always decides: the app never applies on her behalf.

## Tech Stack

- **Backend:** NestJS · TypeScript · Prisma · PostgreSQL · JWT authentication (bcrypt)
- **Frontend:** Next.js · React · TypeScript · Tailwind CSS (Hebrew, right-to-left)
- **AI:** OpenAI API with Structured Outputs, behind a provider interface (`LlmProvider`) with a fake for tests
- **Integrations:** Gmail via Google OAuth 2.0 (read-only scope, PKCE)
- **Monorepo:** npm workspaces with shared types and TypeScript config
- **Testing:** Node.js test runner (API unit and e2e tests) and Playwright (browser tests), all against an isolated test database; no real LLM or Gmail calls in tests

## Project Structure

```
apps/
  api/        NestJS REST API
    src/auth      Register, login, JWT guard, current user
    src/jobs      Jobs and their postings, scoped to the user, and AI scoring
    src/profile   The user's CV text and what she is looking for
    src/llm       LlmProvider interface: OpenAI implementation and a fake
    src/gmail     Gmail OAuth connection (read-only), encrypted token storage
    src/health    Health-check endpoint
    prisma/       Database schema and migrations
    test/         Unit and e2e tests
  web/        Next.js frontend: login, register, ranked jobs list, profile
    e2e/          Browser tests
packages/
  types/      Types shared between API and web
  config/     Shared TypeScript configuration
```

## Current Status

**Done**

- [x] Monorepo setup (API, web, shared packages)
- [x] PostgreSQL schema with Prisma migrations
- [x] User registration and login with hashed passwords and JWT
- [x] Protected API – each user sees only her own data (another user's resource returns 404)
- [x] Hebrew RTL web app: register, login, protected pages, jobs list
- [x] Profile: the user's CV and what she is looking for, validated on server and client
- [x] **AI job-to-CV match scoring** – a score of 0–100 with a summary, matches and gaps for every job; the list is ranked by score
- [x] **Gmail connection** – connect and disconnect with Google OAuth (read-only scope, PKCE, signed `state`); the refresh token is stored encrypted (AES-256-GCM)
- [x] Unit, API end-to-end and browser tests, with a guard that refuses to run against a non-test database

**Next**

- [ ] Job status: new / relevant / not relevant / applied
- [ ] Reading job-alert emails from Gmail and extracting the jobs with the LLM
- [ ] Digest email with the top matches
- [ ] AI-drafted application texts, always approved by the user

The full plan and design decisions are in [`docs/plan.md`](docs/plan.md).

## How AI scoring works

`POST /jobs/score` scores up to 10 unscored or outdated jobs per call (a score becomes outdated when the user saves her profile again).

- Each job and the user's profile are sent to the model, which must answer in a fixed JSON schema. The answer is validated again in code: an integer score 0–100, bounded texts, at most 5 matches and 5 gaps. An invalid answer fails that job only, and it is retried on the next run.
- Up to 3 model requests run at the same time, each with a 30-second timeout and one retry.
- **Prompt injection:** a job description is untrusted text. The instructions are kept in the system message, the job and CV text are sent as escaped data inside their own tags, and the model has no tools – its answer is only stored and shown as plain text.
- **Privacy:** CV and job text are never logged. Logs contain only counts and token totals.

## API

| Method | Endpoint                | Auth | Description                                                                            |
| ------ | ----------------------- | ---- | -------------------------------------------------------------------------------------- |
| GET    | `/health`               | –    | Service health check                                                                   |
| POST   | `/auth/register`        | –    | Create an account                                                                      |
| POST   | `/auth/login`           | –    | Log in, returns a JWT                                                                  |
| GET    | `/auth/me`              | JWT  | Current user                                                                           |
| GET    | `/jobs`                 | JWT  | List the user's jobs ranked by score (unscored last), each with its postings and score |
| GET    | `/jobs/:id`             | JWT  | Get one job with its postings and score                                                |
| POST   | `/jobs`                 | JWT  | Add a job with its first posting (`url`); 409 if the user already has that URL         |
| POST   | `/jobs/score`           | JWT  | Score up to 10 pending jobs against the profile with the LLM                           |
| GET    | `/profile`              | JWT  | Get the user's profile (CV and what she is looking for)                                |
| PUT    | `/profile`              | JWT  | Save the profile                                                                       |
| GET    | `/gmail/status`         | JWT  | Gmail connection state                                                                 |
| POST   | `/gmail/connect`        | JWT  | Start the Google OAuth flow, returns the Google URL                                    |
| DELETE | `/gmail/connection`     | JWT  | Disconnect Gmail and delete the stored token                                           |
| GET    | `/gmail/oauth/callback` | –    | Google redirects here; the user is identified by the signed `state`                    |

## Getting Started

### Prerequisites

- Node.js 24+
- PostgreSQL

### Setup

```bash
git clone https://github.com/taliachoen/career-agent.git
cd career-agent
npm install

# API environment
cp apps/api/.env.example apps/api/.env          # set DATABASE_URL and JWT_SECRET; optional: OPENAI_API_KEY, Google OAuth settings
cp apps/web/.env.example apps/web/.env.local

# Database
npm run prisma:migrate:dev -w @career-agent/api
```

### Run

```bash
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
```

### Demo data

One command creates a demo user and 10 sample Full Stack jobs (some posted on several sites) in the development database:

```bash
npm run seed -w @career-agent/api
```

Log in with **demo@example.com** / **demo-password-123**.

It is safe to run again: it deletes and recreates only the demo user's jobs and never touches other users. The job links are made up, so most of them open a 404.

### Tests

```bash
cp apps/api/.env.test.example apps/api/.env.test   # database name must end in _test
npm run test:db:migrate -w @career-agent/api
npm test -w @career-agent/api          # API unit + e2e tests
npm run test:e2e -w @career-agent/web  # browser tests
```

Tests use fake LLM and Gmail providers and never call OpenAI or Google.

## Author

**Talia Cohen** – Full Stack Developer
[GitHub](https://github.com/taliachoen) · taliachoen1@gmail.com
