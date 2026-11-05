import { expect, test, type Page } from "@playwright/test";
import {
  connectGmailViaApi,
  createUserViaApi,
  logInThroughUi,
  saveProfileViaApi,
} from "./support/users";

// The API runs with the fake Gmail (invented sample alert mail) and the fake model, see
// playwright.config.ts: nothing here reaches Google or OpenAI.

async function openPage(page: Page, email: string, path: string) {
  await logInThroughUi(page, email);
  await expect(page).toHaveURL(/\/jobs$/);
  if (path !== "/jobs") await page.goto(path);
}

const syncButton = (page: Page) => page.getByRole("button", { name: "סנכרני מיילים" });
const jobTitles = (page: Page) => page.getByRole("heading", { level: 2 });

test.describe("syncing mail", () => {
  test("without a Gmail connection there is a link to the profile, and no sync button", async ({
    page,
    request,
  }) => {
    const { email } = await createUserViaApi(request);
    await openPage(page, email, "/jobs");

    await expect(page.getByText("כדי לקלוט משרות מהמייל צריך לחבר את Gmail.")).toBeVisible();
    await page.getByRole("link", { name: "לחיבור Gmail" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(syncButton(page)).toBeHidden();
  });

  test("a connection that expired asks to reconnect instead of offering a sync", async ({
    page,
    request,
  }) => {
    const { email, token } = await createUserViaApi(request);
    await connectGmailViaApi(request, token);
    await page.route("**/gmail/status", (route) =>
      route.fulfill({ json: { state: "needs_reconnect", email: "fake.user@example.com" } }),
    );
    await openPage(page, email, "/jobs");

    await expect(page.getByText("החיבור ל-Gmail כבר לא תקף, ויש לחבר אותו מחדש.")).toBeVisible();
    await expect(syncButton(page)).toBeHidden();
  });

  test("sync brings the jobs in with scores, a summary and a note that the score rests on a snippet", async ({
    page,
    request,
  }) => {
    const { email, token } = await createUserViaApi(request);
    await connectGmailViaApi(request, token);
    await saveProfileViaApi(request, token);
    await openPage(page, email, "/jobs");

    // Empty list, but the sync is there.
    await expect(page.getByText("עדיין אין משרות")).toBeVisible();
    await syncButton(page).click();

    await expect(
      page.getByText("נבדקו 5 מיילים · משרות חדשות: 6 · צורפו למשרה קיימת: 2 · דורגו: 6"),
    ).toBeVisible();
    await expect(page.getByText(/1 מיילים לא נקראו כי Gmail לא אימתה/)).toBeVisible();

    await expect(jobTitles(page)).toHaveCount(6);
    await expect(page.locator("[data-band]")).toHaveCount(6);
    // Every score here is based on a snippet, and the row says so.
    await expect(page.getByText("הדירוג מבוסס על תקציר מהמייל", { exact: false })).toHaveCount(6);
    // The place from the mail is shown next to the company.
    await expect(page.getByText("Haifa", { exact: false }).first()).toBeVisible();

    // The same job found by two sites is one row with two site links.
    const initech = page.getByRole("listitem").filter({ hasText: "Initech" });
    await expect(initech).toHaveCount(1);
    await expect(initech.getByRole("link")).toHaveCount(2);
    const acmeTelAviv = page
      .getByRole("listitem")
      .filter({ hasText: "Acme Software" })
      .filter({ hasText: "Tel Aviv" });
    await expect(acmeTelAviv.getByRole("link")).toHaveCount(2);

    // The mail that failed Gmail's signature check never became a job.
    await expect(page.getByText("Totally Real Company")).toHaveCount(0);

    // A reload keeps everything; a second sync finds nothing new and adds nothing.
    await page.reload();
    await expect(jobTitles(page)).toHaveCount(6);
    await syncButton(page).click();
    await expect(
      page.getByText("נבדקו 1 מיילים · משרות חדשות: 0 · צורפו למשרה קיימת: 0 · דורגו: 0"),
    ).toBeVisible();
    await expect(jobTitles(page)).toHaveCount(6);
  });

  test("the button shows a loading state and is disabled while syncing", async ({
    page,
    request,
  }) => {
    const { email, token } = await createUserViaApi(request);
    await connectGmailViaApi(request, token);
    await openPage(page, email, "/jobs");

    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/gmail/sync", async (route) => {
      await gate;
      await route.continue();
    });

    await syncButton(page).click();
    await expect(page.getByRole("button", { name: "מסנכרנת..." })).toBeDisabled();
    release();
    await expect(page.getByText(/נבדקו 5 מיילים/)).toBeVisible();
    await expect(syncButton(page)).toBeEnabled();
  });

  test("jobs are kept when there is no profile, and the message says why they are not scored", async ({
    page,
    request,
  }) => {
    const { email, token } = await createUserViaApi(request);
    await connectGmailViaApi(request, token);
    await openPage(page, email, "/jobs");

    await syncButton(page).click();

    await expect(
      page.getByText("המשרות נשמרו. כדי לדרג אותן צריך קודם למלא את קורות החיים בפרופיל."),
    ).toBeVisible();
    await expect(jobTitles(page)).toHaveCount(6);
    await expect(page.locator("[data-band]")).toHaveCount(0);
  });

  test("a failed sync shows a message and keeps the page working", async ({ page, request }) => {
    const { email, token } = await createUserViaApi(request);
    await connectGmailViaApi(request, token);
    await openPage(page, email, "/jobs");

    let status = 409;
    await page.route("**/gmail/sync", async (route) => {
      if (status === 409) {
        status = 0;
        await route.fulfill({ status: 409, json: { message: "Sync is already in progress" } });
      } else {
        await route.continue();
      }
    });

    await syncButton(page).click();
    await expect(page.getByText("סנכרון כבר מתבצע. נסי שוב בעוד רגע.")).toBeVisible();
    await syncButton(page).click();
    await expect(page.getByText(/נבדקו 5 מיילים/)).toBeVisible();
  });

  test("a 401 on sync sends the user back to the login screen", async ({ page, request }) => {
    const { email, token } = await createUserViaApi(request);
    await connectGmailViaApi(request, token);
    await openPage(page, email, "/jobs");
    await page.route("**/gmail/sync", (route) =>
      route.fulfill({ status: 401, json: { message: "Unauthorized" } }),
    );
    await syncButton(page).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("senders", () => {
  test("shows the built-in senders read-only, and lets the user add and delete their own", async ({
    page,
    request,
  }) => {
    const { email, token } = await createUserViaApi(request);
    await connectGmailViaApi(request, token);
    await openPage(page, email, "/profile");

    const section = page.getByRole("heading", { name: "שולחים", level: 3 });
    await expect(section).toBeVisible();

    // Built-in list: read only. It does not offer delete buttons.
    await page.getByText(/שולחים מוכרים \(\d+\)/).click();
    const known = page.getByRole("list", { name: "שולחים מוכרים" });
    await expect(known.getByText("alljob.co.il", { exact: true })).toBeVisible();
    await expect(known.getByText("jobalerts-noreply@linkedin.com", { exact: true })).toBeVisible();
    await expect(known.getByRole("button")).toHaveCount(0);

    await expect(page.getByText("עוד לא הוספת שולחים.")).toBeVisible();

    const input = page.getByLabel("הוספת שולח");
    await input.fill("Jobs2Web.com");
    await page.getByRole("button", { name: "הוספה", exact: true }).click();
    await input.fill("thenextjob23@gmail.com");
    await page.getByRole("button", { name: "הוספה", exact: true }).click();

    const mine = page.getByRole("list", { name: "השולחים שלי" });
    await expect(mine.getByText("jobs2web.com", { exact: true })).toBeVisible();
    await expect(mine.getByText("thenextjob23@gmail.com", { exact: true })).toBeVisible();
    await expect(input).toHaveValue("");

    // They survive a reload.
    await page.reload();
    await expect(page.getByRole("list", { name: "השולחים שלי" }).getByRole("listitem")).toHaveCount(
      2,
    );

    await page.getByRole("button", { name: "מחיקת השולח jobs2web.com" }).click();
    await expect(page.getByRole("list", { name: "השולחים שלי" }).getByRole("listitem")).toHaveCount(
      1,
    );
    await expect(page.getByText("jobs2web.com", { exact: true })).toBeHidden();
  });

  test("rejects a whole general mail provider, a duplicate and a sender that is already built in", async ({
    page,
    request,
  }) => {
    const { email, token } = await createUserViaApi(request);
    await connectGmailViaApi(request, token);
    await openPage(page, email, "/profile");

    const input = page.getByLabel("הוספת שולח");
    const add = page.getByRole("button", { name: "הוספה", exact: true });

    await input.fill("gmail.com");
    await add.click();
    await expect(page.getByText(/הערך אינו תקין/)).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");

    await input.fill("");
    await add.click();
    await expect(page.getByText(/הערך אינו תקין/)).toBeVisible();

    await input.fill("jobs2web.com");
    await add.click();
    await expect(page.getByRole("list", { name: "השולחים שלי" })).toBeVisible();
    await input.fill("jobs2web.com");
    await add.click();
    await expect(page.getByText("השולח הזה כבר ברשימה.")).toBeVisible();

    await input.fill("drushim.co.il");
    await add.click();
    await expect(page.getByText("השולח הזה כבר ברשימה.")).toBeVisible();

    // Nothing was added by the rejected ones.
    await expect(page.getByRole("list", { name: "השולחים שלי" }).getByRole("listitem")).toHaveCount(
      1,
    );
  });

  test("mail from a sender the user added is read by the next sync", async ({ page, request }) => {
    // The sample mailbox has no mail from this sender: adding it must not break the sync.
    const { email, token } = await createUserViaApi(request);
    await connectGmailViaApi(request, token);
    await openPage(page, email, "/profile");
    await page.getByLabel("הוספת שולח").fill("jobs2web.com");
    await page.getByRole("button", { name: "הוספה", exact: true }).click();
    await expect(
      page.getByRole("list", { name: "השולחים שלי" }).getByText("jobs2web.com", { exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "משרות" }).click();
    await syncButton(page).click();
    await expect(page.getByText(/נבדקו 5 מיילים/)).toBeVisible();
  });

  test("is not shown while Gmail is not connected", async ({ page, request }) => {
    const { email } = await createUserViaApi(request);
    await openPage(page, email, "/profile");
    await expect(page.getByText("Gmail לא מחובר.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "שולחים", level: 3 })).toBeHidden();
  });
});
