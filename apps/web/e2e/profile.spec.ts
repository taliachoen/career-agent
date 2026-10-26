import { expect, test, type Page } from "@playwright/test";
import { createUserViaApi, logInThroughUi } from "./support/users";

// Logging in navigates to /jobs; wait for that, or a following goto() can race the login.
async function openProfile(page: Page, email: string) {
  await logInThroughUi(page, email);
  await expect(page).toHaveURL(/\/jobs$/);
  await page.goto("/profile");
}

const CV = "ניסיון בפיתוח Full Stack עם TypeScript, React ו-NestJS. ".repeat(6);
const LOOKING_FOR = "Full Stack ג'וניור, מרכז, היברידי";

const cvField = (page: Page) =>
  page.getByLabel("קורות חיים", { exact: true });
const lookingForField = (page: Page) =>
  page.getByLabel("מה את מחפשת", { exact: true });
const saveButton = (page: Page) =>
  page.getByRole("button", { name: "שמירה" });

test("the top bar link leads to the profile page", async ({ page, request }) => {
  const { email } = await createUserViaApi(request);
  await logInThroughUi(page, email);

  await page.getByRole("link", { name: "פרופיל" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "פרופיל", level: 1 })).toBeVisible();
});

test("first visit explains why the profile matters; it disappears after saving", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  await expect(page.getByText("למה הפרופיל חשוב?")).toBeVisible();
  await cvField(page).fill(CV);
  await saveButton(page).click();
  await expect(page.getByText("הפרופיל נשמר")).toBeVisible();
  await expect(page.getByText("למה הפרופיל חשוב?")).toBeHidden();
});

test("a saved profile survives a page reload, with its update date", async ({ page, request }) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  await cvField(page).fill(CV);
  await lookingForField(page).fill(LOOKING_FOR);
  await saveButton(page).click();
  await expect(page.getByText("הפרופיל נשמר")).toBeVisible();
  await expect(page.getByText(/עודכן לאחרונה:/)).toBeVisible();

  await page.reload();
  await expect(cvField(page)).toHaveValue(CV.trim());
  await expect(lookingForField(page)).toHaveValue(LOOKING_FOR);
  await expect(page.getByText(/עודכן לאחרונה:/)).toBeVisible();
});

test("a validation error appears next to the field and sends no request", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  let puts = 0;
  page.on("request", (req) => {
    if (req.method() === "PUT" && req.url().endsWith("/profile")) puts += 1;
  });

  await cvField(page).fill("קצר מדי");
  await saveButton(page).click();
  await expect(page.getByText("קורות החיים קצרים מדי (לפחות 200 תווים)")).toBeVisible();
  await expect(cvField(page)).toHaveAttribute("aria-invalid", "true");

  await cvField(page).fill(CV);
  await lookingForField(page).fill("x".repeat(2_001));
  await saveButton(page).click();
  await expect(page.getByText("הטקסט ארוך מדי (עד 2,000 תווים)")).toBeVisible();

  expect(puts).toBe(0);
});

test("the counter shows the remaining characters", async ({ page, request }) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  await lookingForField(page).fill("x".repeat(100));
  await expect(page.getByText("נותרו 1,900 תווים")).toBeVisible();
  await lookingForField(page).fill("x".repeat(2_005));
  await expect(page.getByText("חריגה של 5 תווים")).toBeVisible();
});

test("the save button is disabled while saving", async ({ page, request }) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/profile", async (route) => {
    if (route.request().method() === "PUT") await gate;
    await route.continue();
  });

  await cvField(page).fill(CV);
  await saveButton(page).click();
  await expect(page.getByRole("button", { name: "שולח..." })).toBeDisabled();

  release();
  await expect(page.getByText("הפרופיל נשמר")).toBeVisible();
  await expect(saveButton(page)).toBeEnabled();
});

test("a server error shows a retry that succeeds once the server recovers", async ({
  page,
  request,
}) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  let failNext = true;
  await page.route("**/profile", async (route) => {
    if (route.request().method() === "PUT" && failNext) {
      failNext = false;
      await route.fulfill({ status: 500, json: { message: "Internal server error" } });
    } else {
      await route.continue();
    }
  });

  await cvField(page).fill(CV);
  await saveButton(page).click();
  await expect(page.getByText(/נסו שוב בעוד רגע/)).toBeVisible();

  await page.getByRole("button", { name: "נסו שוב" }).click();
  await expect(page.getByText("הפרופיל נשמר")).toBeVisible();
});

test("a 401 on save sends the user back to the login screen", async ({ page, request }) => {
  const { email } = await createUserViaApi(request);
  await openProfile(page, email);

  await page.route("**/profile", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 401, json: { message: "Unauthorized" } });
    } else {
      await route.continue();
    }
  });

  await cvField(page).fill(CV);
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/login/);
});
