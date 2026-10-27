import { expect, test, type APIRequestContext } from "@playwright/test";
import { API_URL, createUserViaApi, logInThroughUi } from "./support/users";

// The API runs with the fake LLM provider (see playwright.config.ts). It reads
// [[fake:score=NN]], [[fake:fail]] from the job description.
const CV = "ניסיון בפיתוח Full Stack עם TypeScript, React ו-NestJS. ".repeat(6);

let counter = 0;
async function createJob(request: APIRequestContext, token: string, title: string, marker = "") {
  const response = await request.post(`${API_URL}/jobs`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      company: "Acme",
      description: `E2E job ${marker}`,
      url: `https://example.com/scoring-e2e/${Date.now()}-${++counter}`,
    },
  });
  expect(response.status()).toBe(201);
}

async function saveProfile(request: APIRequestContext, token: string) {
  const response = await request.put(`${API_URL}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { cvText: CV, lookingFor: "Full Stack" },
  });
  expect(response.status()).toBe(200);
}

const scoreButton = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "דרגי משרות" });

test("without a profile there is a message with a link to the profile, and no button", async ({
  page,
  request,
}) => {
  const { email, token } = await createUserViaApi(request);
  await createJob(request, token, "Some Job");
  await logInThroughUi(page, email);

  await expect(page.getByRole("heading", { level: 2, name: "Some Job" })).toBeVisible();
  await expect(
    page.getByText("כדי לדרג משרות צריך קודם למלא את קורות החיים בפרופיל."),
  ).toBeVisible();
  await expect(scoreButton(page)).toHaveCount(0);

  await page.getByRole("link", { name: "לעמוד הפרופיל" }).click();
  await expect(page).toHaveURL(/\/profile$/);
});

test("pressing the button shows score badges, a result message and a sorted list", async ({
  page,
  request,
}) => {
  const { email, token } = await createUserViaApi(request);
  await saveProfile(request, token);
  await createJob(request, token, "Weak Job", "[[fake:score=30]]");
  await createJob(request, token, "Strong Job", "[[fake:score=90]]");
  await createJob(request, token, "Medium Job", "[[fake:score=60]]");
  await logInThroughUi(page, email);

  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(3);
  await scoreButton(page).click();

  await expect(page.getByText("דורגו: 3 · נכשלו: 0 · נשארו: 0")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Strong Job",
    "Medium Job",
    "Weak Job",
  ]);

  const row = (title: string) => page.getByRole("listitem").filter({ hasText: title });
  await expect(row("Strong Job").locator("[data-band]")).toHaveAttribute("data-band", "high");
  await expect(row("Medium Job").locator("[data-band]")).toHaveAttribute("data-band", "mid");
  await expect(row("Weak Job").locator("[data-band]")).toHaveAttribute("data-band", "low");
  await expect(row("Strong Job").locator("[data-band]")).toHaveText(/90/);

  // Everything is scored: the button is gone.
  await expect(scoreButton(page)).toHaveCount(0);
});

test("a row shows its summary, and matches and gaps open on click", async ({ page, request }) => {
  const { email, token } = await createUserViaApi(request);
  await saveProfile(request, token);
  await createJob(request, token, "Detail Job", "[[fake:score=80]]");
  await logInThroughUi(page, email);
  await scoreButton(page).click();

  const row = page.getByRole("listitem").filter({ hasText: "Detail Job" });
  await expect(row.getByText("סיכום לדוגמה מהספק המדומה.")).toBeVisible();
  await expect(row.getByText("התאמה לדוגמה")).toBeHidden();

  const toggle = row.getByRole("button", { expanded: false });
  await toggle.click();
  await expect(row.getByRole("button", { expanded: true })).toBeVisible();
  await expect(row.getByRole("heading", { name: "התאמות" })).toBeVisible();
  await expect(row.getByText("התאמה לדוגמה")).toBeVisible();
  await expect(row.getByRole("heading", { name: "פערים" })).toBeVisible();
  await expect(row.getByText("פער לדוגמה")).toBeVisible();

  await row.getByRole("button", { expanded: true }).click();
  await expect(row.getByText("התאמה לדוגמה")).toBeHidden();
});

test("with more than 10 jobs the button can be pressed again for the rest", async ({
  page,
  request,
}) => {
  const { email, token } = await createUserViaApi(request);
  await saveProfile(request, token);
  for (let i = 1; i <= 12; i++) await createJob(request, token, `Bulk Job ${i}`);
  await logInThroughUi(page, email);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(12);

  await scoreButton(page).click();
  await expect(page.getByText("דורגו: 10 · נכשלו: 0 · נשארו: 2")).toBeVisible();
  await expect(page.getByText("אפשר ללחוץ שוב כדי להמשיך.")).toBeVisible();
  await expect(scoreButton(page)).toBeEnabled();

  await scoreButton(page).click();
  await expect(page.getByText("דורגו: 2 · נכשלו: 0 · נשארו: 0")).toBeVisible();
  await expect(scoreButton(page)).toHaveCount(0);
});

test("the button shows a loading state and is disabled while scoring", async ({
  page,
  request,
}) => {
  const { email, token } = await createUserViaApi(request);
  await saveProfile(request, token);
  await createJob(request, token, "Slow Job");
  await logInThroughUi(page, email);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);

  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/jobs/score", async (route) => {
    await gate;
    await route.continue();
  });

  await scoreButton(page).click();
  await expect(page.getByRole("button", { name: "מדרגת..." })).toBeDisabled();

  release();
  await expect(page.getByText("דורגו: 1 · נכשלו: 0 · נשארו: 0")).toBeVisible();
});

test("failed jobs are reported, stay unscored and can be retried", async ({ page, request }) => {
  const { email, token } = await createUserViaApi(request);
  await saveProfile(request, token);
  await createJob(request, token, "Fine Job", "[[fake:score=70]]");
  await createJob(request, token, "Broken Job", "[[fake:fail]]");
  await logInThroughUi(page, email);
  await scoreButton(page).click();

  await expect(page.getByText("דורגו: 1 · נכשלו: 1 · נשארו: 1")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Broken Job" }).locator("[data-band]"),
  ).toHaveCount(0);
  await expect(scoreButton(page)).toBeEnabled();
});

test("a score becomes marked as old after the profile is saved again", async ({
  page,
  request,
}) => {
  const { email, token } = await createUserViaApi(request);
  await saveProfile(request, token);
  await createJob(request, token, "Aging Job", "[[fake:score=70]]");
  await logInThroughUi(page, email);
  await scoreButton(page).click();
  await expect(page.getByText("דורגו: 1 · נכשלו: 0 · נשארו: 0")).toBeVisible();
  await expect(page.getByText("דירוג ישן: הפרופיל עודכן מאז")).toHaveCount(0);

  await page.waitForTimeout(50);
  await saveProfile(request, token);
  await page.reload();

  await expect(page.getByText("דירוג ישן: הפרופיל עודכן מאז")).toBeVisible();
  await expect(scoreButton(page)).toBeVisible();
});

test.describe("phone screen", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("scored rows do not scroll sideways, even when opened", async ({ page, request }) => {
    const { email, token } = await createUserViaApi(request);
    await saveProfile(request, token);
    await createJob(
      request,
      token,
      "Senior Full Stack Engineer (TypeScript) – Payments Platform",
      "[[fake:score=88]]",
    );
    await logInThroughUi(page, email);
    await scoreButton(page).click();
    await expect(page.getByText("דורגו: 1 · נכשלו: 0 · נשארו: 0")).toBeVisible();
    await page.getByRole("button", { expanded: false }).click();
    await expect(page.getByText("התאמה לדוגמה")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
