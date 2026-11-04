import { expect, test, type Page } from "@playwright/test";
import { API_URL, createUserViaApi, logInThroughUi } from "./support/users";

// The API runs with the fake Google (see playwright.config.ts): "Google's consent screen" is
// a redirect straight back to the API callback, so no real Google is ever involved.

async function openProfile(page: Page, email: string) {
  await logInThroughUi(page, email);
  await expect(page).toHaveURL(/\/jobs$/);
  await page.goto("/profile");
}

const connectButton = (page: Page) => page.getByRole("button", { name: "חברי Gmail", exact: true });
const disconnectButton = (page: Page) => page.getByRole("button", { name: "נתקי", exact: true });

test("a new user sees Gmail as not connected, with a connect button", async ({ page, request }) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  await expect(page.getByRole("heading", { name: "חיבור Gmail", level: 2 })).toBeVisible();
  await expect(page.getByText("Gmail לא מחובר.")).toBeVisible();
  await expect(connectButton(page)).toBeEnabled();
  await expect(disconnectButton(page)).toBeHidden();
});

test("connecting shows the success message and the address; it survives a reload; disconnecting undoes it", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  await connectButton(page).click();

  await expect(page.getByText("Gmail חובר בהצלחה.")).toBeVisible();
  await expect(page.getByText("fake.user@example.com")).toBeVisible();
  // The one-time result is removed from the address bar.
  await expect(page).toHaveURL(/\/profile$/);
  await expect(disconnectButton(page)).toBeVisible();
  await expect(connectButton(page)).toBeHidden();

  // Still logged in (sessionStorage survived the trip to "Google") and still connected.
  await page.reload();
  await expect(page.getByText("fake.user@example.com")).toBeVisible();
  await expect(page.getByText("Gmail חובר בהצלחה.")).toBeHidden();

  await disconnectButton(page).click();
  await expect(page.getByText("Gmail נותק והגישה בוטלה.")).toBeVisible();
  await expect(page.getByText("Gmail לא מחובר.")).toBeVisible();
  await expect(connectButton(page)).toBeVisible();

  await page.reload();
  await expect(page.getByText("Gmail לא מחובר.")).toBeVisible();
});

test("cancelling on Google's screen returns with a clear message and stays disconnected", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  // Turn the fake "approval" into a cancellation, keeping the real state from the API.
  await page.route("**/gmail/connect", async (route) => {
    const response = await route.fetch();
    const { authUrl } = (await response.json()) as { authUrl: string };
    const state = new URL(authUrl).searchParams.get("state")!;
    const cancelled = `${API_URL}/gmail/oauth/callback?error=access_denied&state=${encodeURIComponent(state)}`;
    await route.fulfill({ response, json: { authUrl: cancelled } });
  });

  await connectButton(page).click();

  await expect(page.getByText(/החיבור בוטל ולא ניתנה הרשאה/)).toBeVisible();
  await expect(page.getByText("Gmail לא מחובר.")).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
});

test("a callback with a bad state shows a failure message", async ({ page, request }) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  await page.goto(`${API_URL}/gmail/oauth/callback?code=fake-ok&state=garbage`);

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("החיבור נכשל. נסי שוב.")).toBeVisible();
  await expect(page.getByText("Gmail לא מחובר.")).toBeVisible();
});

test("a connection Google no longer accepts asks to reconnect", async ({ page, request }) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);
  await connectButton(page).click();
  await expect(page.getByText("fake.user@example.com")).toBeVisible();

  await page.route("**/gmail/status", (route) =>
    route.fulfill({ json: { state: "needs_reconnect", email: "fake.user@example.com" } }),
  );
  await page.reload();

  await expect(page.getByText("צריך לחבר את Gmail מחדש")).toBeVisible();
  await expect(page.getByRole("button", { name: "חברי מחדש" })).toBeEnabled();
  await expect(disconnectButton(page)).toBeVisible();
});

test("failing to check the status shows a retry that works once the server recovers", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await logInThroughUi(page, email);
  await expect(page).toHaveURL(/\/jobs$/);

  let failNext = true;
  await page.route("**/gmail/status", async (route) => {
    if (failNext) {
      failNext = false;
      await route.fulfill({ status: 500, json: { message: "Internal server error" } });
    } else {
      await route.continue();
    }
  });
  await page.goto("/profile");

  await expect(page.getByText("לא הצלחנו לבדוק את מצב החיבור.")).toBeVisible();
  await page.getByRole("button", { name: "נסו שוב" }).click();
  await expect(page.getByText("Gmail לא מחובר.")).toBeVisible();
});
