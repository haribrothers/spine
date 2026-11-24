import { randomUUID } from "node:crypto";
import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-DASH-18", () => {
  test("a Field user's dashboard: header counts, my jobs, my expenses, my feed, and no money", async ({ page, seededOrg: _, browser }) => {
    // The Owner puts Marcus on an active job.
    const members = (await (await page.request.get(`${API_URL}/org/members`)).json()) as { userId: string; email: string }[];
    const marcus = members.find((m) => m.email === DEMO_FIELD_USER.email)!;
    const jobs = (await (await page.request.get(`${API_URL}/jobs?status=active`)).json()) as { id: string; name: string; siteAddress: string | null }[];
    const job = jobs.find((j) => j.siteAddress) ?? jobs[0]!;
    const assigned = await page.request.post(`${API_URL}/jobs/${job.id}/assignees`, { headers: { "Idempotency-Key": randomUUID() }, data: { userId: marcus.userId } });
    expect(assigned.ok()).toBe(true);

    const context = await browser.newContext();
    const fieldPage = await context.newPage();
    await logIn(fieldPage, DEMO_FIELD_USER);
    await fieldPage.goto("/dashboard");
    const main = fieldPage.getByRole("main");

    await expect(main.getByText(/\d+ jobs? on your list · (\d+ things? needs? you|nothing needs you right now)/)).toBeVisible({ timeout: 15_000 });
    await expect(main.getByTestId("attention-card")).toBeVisible();
    await expect(main.getByTestId("today-card")).toBeVisible();

    const myJobs = main.getByTestId("my-jobs");
    await expect(myJobs).toContainText("My jobs");
    const row = myJobs.locator(`li[data-job="${job.id}"]`);
    await expect(row).toContainText(job.name);
    if (job.siteAddress) await expect(row.getByRole("link", { name: "Directions" })).toHaveAttribute("href", /google\.com\/maps/);

    const myExpenses = main.getByTestId("my-expenses");
    await expect(myExpenses).toContainText("My expenses");
    await expect(myExpenses.getByRole("link", { name: "Submit expense" })).toBeVisible();
    expect(await myExpenses.locator("li").count()).toBeLessThanOrEqual(5);

    await expect(main.getByText("Recent activity on my jobs")).toBeVisible();

    // No business money anywhere (D-048, D-072).
    for (const text of ["Cash position", "Receivables", "Money in and out", "Pipeline by stage", "Job profitability", "Contract value"]) {
      await expect(main.getByText(text)).toHaveCount(0);
    }
    await expect(myJobs).not.toContainText("$");
    await context.close();
  });
});
