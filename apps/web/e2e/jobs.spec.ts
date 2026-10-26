import { expect, test } from "@playwright/test";
import { API_URL, createUserViaApi, logInThroughUi } from "./support/users";

async function createJob(
  request: Parameters<typeof createUserViaApi>[0],
  token: string,
  job: { title: string; company: string; url: string },
) {
  const response = await request.post(`${API_URL}/jobs`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { ...job, description: "E2E job" },
  });
  expect(response.status()).toBe(201);
}

test("a job row shows title, company, date and a site link that opens in a new tab", async ({
  page,
  request,
}) => {
  const { email, token } = await createUserViaApi(request);
  await createJob(request, token, {
    title: "Full Stack Developer",
    company: "Nimbus Labs",
    url: "https://www.linkedin.com/jobs/view/e2e-1",
  });

  await logInThroughUi(page, email);

  const row = page.getByRole("listitem").filter({ hasText: "Full Stack Developer" });
  await expect(row).toBeVisible();
  await expect(row.getByText("Nimbus Labs")).toBeVisible();
  await expect(row.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);

  const link = row.getByRole("link", { name: /linkedin\.com/ });
  await expect(link).toHaveAttribute("href", "https://www.linkedin.com/jobs/view/e2e-1");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

test("the newest job is listed first", async ({ page, request }) => {
  const { email, token } = await createUserViaApi(request);
  await createJob(request, token, {
    title: "Older Job",
    company: "A",
    url: "https://example.com/e2e-old",
  });
  await createJob(request, token, {
    title: "Newer Job",
    company: "B",
    url: "https://example.com/e2e-new",
  });

  await logInThroughUi(page, email);

  const titles = page.getByRole("heading", { level: 2 });
  await expect(titles.first()).toHaveText("Newer Job");
  await expect(titles.last()).toHaveText("Older Job");
});

test.describe("phone screen", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("the jobs list does not scroll sideways", async ({ page, request }) => {
    const { email, token } = await createUserViaApi(request);
    await createJob(request, token, {
      title: "Senior Full Stack Engineer (TypeScript) – Payments Platform",
      company: "A Company With A Really Long Name Ltd",
      url: "https://www.some-very-long-careers-site-name.example/jobs/12345",
    });

    await logInThroughUi(page, email);
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
