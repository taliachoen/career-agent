# CareerAgent

AI career assistant. **MVP goal:** read job-alert emails from the user's Gmail, extract the jobs with an LLM, score each job against the user's CV, and show the ranked results in a web dashboard. A periodic digest email comes right after the MVP.

This is also a portfolio project: the architecture must be real and explainable, without premature complexity. The full plan is in `docs/plan.md`.

## Repo layout

npm workspaces monorepo:

- `apps/api` – NestJS + Prisma + PostgreSQL, port 3001
- `apps/web` – Next.js, port 3000
- `packages/types` – types shared by api and web (declaration-only)
- `packages/config` – shared tsconfig

## Environment

- The developer works on **Windows with PowerShell**. Give PowerShell commands, not bash.
- Stop the dev servers before `prisma generate` or a migration (Windows locks the Prisma engine DLL → EPERM).
- Never read, print or ask for the contents of `.env` or `.env.test`.

## Commands (from the repo root)

- `npm run dev:api` / `npm run dev:web`
- `npm run typecheck`
- `npm test -w @career-agent/api` – unit + e2e (e2e uses `.env.test`; the DB name must end in `_test`)
- `npm run test:unit -w @career-agent/api`
- `npm run prisma:migrate:dev -w @career-agent/api -- --name <name>`
- `npm run test:db:migrate -w @career-agent/api` – apply migrations to the test DB

## Code conventions

- Pure ESM: relative imports end in `.js`.
- One folder per resource: `*.module.ts`, `*.controller.ts`, `*.service.ts`.
- Validation: manual `parse*` functions in the controller that throw `BadRequestException` with a list of errors. No Zod / class-validator.
- **Ownership:** the user id always comes from `request.user.id` (set by `JwtAuthGuard`), never from the body or query. Every query on user data filters by `userId`.
- Another user's resource returns **404**, not 403.
- Prisma model types are the source of truth for data shapes.
- Never select `passwordHash` unless the code really needs it.
- All LLM calls go through the `LlmProvider` interface. Feature code never calls an AI SDK directly.

## Tests

- API tests (unit and e2e) use Node's built-in `node:test` – not Jest or Vitest.
- Browser tests of the web app use Playwright (`@playwright/test`). They run against the test DB (name ends in `_test`), never the dev DB.
- New service logic → unit tests. New endpoint → e2e tests, including the unauthenticated case and the other-user case.
- Tests never call a real LLM or Gmail; use fakes.

## Rules

- **Ask before adding any dependency**, and explain why it's needed.
- Don't add queues, Redis, Docker, workers, RAG, embeddings or agent frameworks unless the current step needs them.
- Migrations: show me the generated SQL before applying it. Never edit an applied migration. Never run `prisma migrate reset` on the dev database.
- Stay in the scope of the task. If you notice another problem, mention it instead of fixing it.
- Gmail access is **read-only** in the MVP. The app never sends email except the user's own digest (post-MVP), and never applies to jobs on the user's behalf.

## Definition of done

`npm run typecheck`, the tests and the build all pass. Then give a short summary: what changed, why, and what I should review.

At the end of every step, before I commit, run the `code-reviewer` subagent on the branch, then handle its findings or report them in the summary. The reviewer has no Bash, so when invoking it, pass in the prompt: the `git diff` against `git merge-base main HEAD` (committed and uncommitted changes), and the list of new untracked files (`git status --short`).

## Git workflow

- Every step starts on a new branch from main: step-<number>-<short-name>, or chore-<short-name> for maintenance.
- Never commit to main directly.
- Don't commit or push unless I ask. I review the changes and commit myself.
