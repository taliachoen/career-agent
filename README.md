# CareerAgent

> 🚧 **Work in progress** – actively developed.

An AI-powered career assistant that will help job seekers find relevant openings, score how well each job matches their CV, and prepare tailored applications – with the user always approving before anything is sent.

## Tech Stack

- **Backend:** NestJS · TypeScript · Prisma · PostgreSQL · JWT authentication (bcrypt)
- **Frontend:** Next.js · React · TypeScript
- **Monorepo:** npm workspaces with shared types and TypeScript config
- **Testing:** Node.js test runner – unit tests and end-to-end tests against an isolated test database

## Project Structure

```
apps/
  api/        NestJS REST API
    src/auth      Register, login, JWT guard, current user
    src/jobs      Jobs and their postings, scoped to the authenticated user
    src/health    Health-check endpoint
    prisma/       Database schema and migrations
    test/         Unit and e2e tests
  web/        Next.js frontend
packages/
  types/      Types shared between API and web
  config/     Shared TypeScript configuration
```

## Current Status

**Done**
- [x] Monorepo setup (API, web, shared packages)
- [x] PostgreSQL schema with Prisma migrations (`User`, `Job`, `JobPosting`)
- [x] User registration and login with hashed passwords and JWT
- [x] Protected jobs API – each user sees and creates only their own jobs
- [x] Input validation on all endpoints
- [x] Unit and end-to-end tests, with a guard that refuses to run e2e tests against a non-test database
- [x] Frontend connected to the API (health check)

**Next**
- [ ] Frontend: login/register and a jobs dashboard
- [ ] CV upload and parsing
- [ ] AI job-to-CV match scoring
- [ ] Collecting jobs from external sources
- [ ] AI-assisted cover letters, sent only after user approval

## API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | Service health check |
| POST | `/auth/register` | – | Create an account |
| POST | `/auth/login` | – | Log in, returns a JWT |
| GET | `/auth/me` | JWT | Current user |
| GET | `/jobs` | JWT | List the user's jobs, newest first, each with its postings |
| GET | `/jobs/:id` | JWT | Get one job with its postings |
| POST | `/jobs` | JWT | Add a job with its first posting (`url`); 409 if the user already has that URL |

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
cp apps/api/.env.example apps/api/.env          # set DATABASE_URL and JWT_SECRET
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
npm test -w @career-agent/api
```

## Author

**Talia Cohen** – Full Stack Developer
[GitHub](https://github.com/taliachoen) · taliachoen1@gmail.com
