import { expect, test } from "@playwright/test";
import {
  PASSWORD,
  SESSION_KEY,
  createUserViaApi,
  logInThroughUi,
  uniqueEmail,
} from "./support/users";

test("register, land on the jobs list, and see the empty state", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/register");
  await page.getByLabel("אימייל").fill(email);
  await page.getByLabel("סיסמה").fill(PASSWORD);
  await page.getByRole("button", { name: "הרשמה" }).click();

  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole("heading", { name: "משרות" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("עדיין אין משרות")).toBeVisible();
});

test("invalid fields are reported next to the field, before any request", async ({ page }) => {
  let authRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/auth/")) authRequests += 1;
  });

  await page.goto("/register");
  await page.getByLabel("אימייל").fill("not-an-email");
  await page.getByLabel("סיסמה").fill("short");
  await page.getByRole("button", { name: "הרשמה" }).click();

  await expect(page.getByText("יש להזין כתובת אימייל תקינה")).toBeVisible();
  await expect(page.getByText("הסיסמה חייבת להכיל לפחות 8 תווים")).toBeVisible();
  expect(authRequests).toBe(0);
});

test("login with a wrong password shows an error and stays on the login screen", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await logInThroughUi(page, email, "wrong-password-1");

  await expect(page.getByText("האימייל או הסיסמה שגויים")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("registering an already registered email shows an error next to the email field", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await page.goto("/register");
  await page.getByLabel("אימייל").fill(email);
  await page.getByLabel("סיסמה").fill(PASSWORD);
  await page.getByRole("button", { name: "הרשמה" }).click();

  await expect(page.getByText("כתובת האימייל הזו כבר רשומה")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test("opening the jobs list without logging in goes to the login screen", async ({ page }) => {
  await page.goto("/jobs");
  await expect(page).toHaveURL(/\/login$/);
});

test("a logged-in user who opens login or register is sent to the jobs list", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await logInThroughUi(page, email);
  await expect(page).toHaveURL(/\/jobs$/);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/jobs$/);
  await page.goto("/register");
  await expect(page).toHaveURL(/\/jobs$/);
});

test("logout returns to the login screen and protects the jobs list again", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await logInThroughUi(page, email);
  await expect(page).toHaveURL(/\/jobs$/);

  await page.getByRole("button", { name: "התנתקות" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/jobs");
  await expect(page).toHaveURL(/\/login$/);
});

test("an expired token clears the session and explains on the login screen", async ({ page }) => {
  // The API really answers 401 to this token; nothing is mocked.
  await page.addInitScript(
    ([key]) => {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          token: "expired.or.invalid",
          user: { id: "x", email: "old@example.com", createdAt: "2026-01-01T00:00:00.000Z" },
        }),
      );
    },
    [SESSION_KEY],
  );

  await page.goto("/jobs");
  await expect(page).toHaveURL(/\/login\?reason=expired$/);
  await expect(page.getByText("פג תוקף ההתחברות, יש להתחבר שוב")).toBeVisible();
});
