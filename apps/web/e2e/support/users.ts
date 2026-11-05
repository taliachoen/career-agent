import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

// The cleanup script deletes exactly the emails that match this pattern.
export const PASSWORD = "e2e-password-123";
export const API_URL = "http://localhost:3101";
export const SESSION_KEY = "career-agent.session";

export function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

/** Registers and logs in through the API; returns what the UI would have stored. */
export async function createUserViaApi(request: APIRequestContext, email = uniqueEmail()) {
  const registered = await request.post(`${API_URL}/auth/register`, {
    data: { email, password: PASSWORD },
  });
  expect(registered.status()).toBe(201);
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = (await login.json()) as { accessToken: string };
  return { email, token: accessToken };
}

export async function logInThroughUi(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("אימייל").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", { name: "התחברות" }).click();
}

/** Connects Gmail through the real OAuth endpoints; the API runs with the fake Google. */
export async function connectGmailViaApi(request: APIRequestContext, token: string) {
  const started = await request.post(`${API_URL}/gmail/connect`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(started.status()).toBe(200);
  const { authUrl } = (await started.json()) as { authUrl: string };
  // The fake consent screen is a link straight to the callback; follow it by hand.
  const done = await request.get(authUrl, { maxRedirects: 0 });
  expect(done.status()).toBe(302);
  expect(done.headers().location).toMatch(/\/profile\?gmail=connected$/);
}

/** A saved profile, so that scoring can run. */
export async function saveProfileViaApi(request: APIRequestContext, token: string) {
  const saved = await request.put(`${API_URL}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { cvText: "ניסיון בפיתוח Full Stack עם TypeScript, React ו-NestJS. ".repeat(6), lookingFor: "Full Stack" },
  });
  expect(saved.status()).toBe(200);
}
