import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

type Job = { id: string; name: string; number: string | null };

test.describe("US-PUR-22", () => {
  test("Vendor Bills filters by job, keeps it in the URL, and links to the same filter on Expenses", async ({ page, seededOrg: _ }) => {
    const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as Job[];
    const bills = (await (await page.request.get(`${API_URL}/vendor-bills`)).json()) as { jobId: string | null }[];
    const job = jobs.find((j) => bills.some((b) => b.jobId === j.id))!;
    const label = `${job.number} · ${job.name}`;
    const onJob = bills.filter((b) => b.jobId === job.id).length;

    await page.goto("/vendor-bills");
    await page.getByRole("combobox", { name: "Filter by job" }).click();
    await expect(page.getByRole("option", { name: "All jobs" })).toBeVisible();
    await page.getByRole("option", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`jobId=${job.id}`));
    await expect(page.getByText(`Showing vendor bills on ${label}.`)).toBeVisible();
    // US-PUR-34: the list shows only that job's bills (heading row + one per bill).
    await expect(page.getByRole("row")).toHaveCount(onJob + 1);

    await page.reload();
    await expect(page.getByText(`Showing vendor bills on ${label}.`)).toBeVisible();
    await page.getByRole("link", { name: "See expenses on this job" }).click();
    await expect(page).toHaveURL(new RegExp(`/expenses\\?jobId=${job.id}`));
    await expect(page.getByText(`Showing expenses on ${label}.`)).toBeVisible();
  });

  test("a job with nothing tagged says so, with Clear filter; the Costing tab opens the filtered list", async ({ page, seededOrg: _ }) => {
    const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as Job[];
    const expenses = (await (await page.request.get(`${API_URL}/expenses`)).json()) as { jobId: string | null }[];
    const empty = jobs.find((j) => !expenses.some((e) => e.jobId === j.id))!;

    await page.goto(`/expenses?jobId=${empty.id}`);
    await expect(page.getByText("No expenses on this job")).toBeVisible();
    await page.getByRole("button", { name: "Clear filter" }).click();
    await expect(page).not.toHaveURL(/jobId=/);

    await page.goto(`/jobs/${jobs[0]!.id}?tab=costing`);
    await page.getByRole("link", { name: "View bills and expenses" }).click();
    await expect(page).toHaveURL(new RegExp(`/vendor-bills\\?jobId=${jobs[0]!.id}`));
  });
});
