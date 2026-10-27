import { defineConfig, devices } from "@playwright/test";

// Ports differ from the dev servers (3000/3001) so both can run side by side.
// The API runs on the test database only (apps/api/.env.test); the first command
// aborts if its name does not end in "_test". `reuseExistingServer` is off on
// purpose: a dev API that happens to sit on one of these ports must never be reused.
const WEB_PORT = 3100;
const API_PORT = 3101;
const API_ENV = `--env-file=../api/.env.test`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // Generous: register/login run bcrypt (cost 12) on a possibly slow machine.
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: "he-IL",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node ${API_ENV} e2e/support/require-test-db.mjs && node ${API_ENV} ../api/dist/main.js`,
      url: `http://localhost:${API_PORT}/health`,
      env: {
        PORT: String(API_PORT),
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
        // Browser tests never reach OpenAI: the fake provider, and no key even if the
        // developer's shell has one.
        LLM_PROVIDER: "fake",
        OPENAI_API_KEY: "",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // A production build, not `next dev`: no compile-on-first-visit delays, so the
      // tests do not depend on how fast the dev server is. NEXT_PUBLIC_API_URL is
      // inlined at build time, so it has to be set for the build too.
      command: `npx next build && npx next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        NEXT_DIST_DIR: ".next-e2e",
      },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
