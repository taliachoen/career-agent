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
