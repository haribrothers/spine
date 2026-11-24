import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-JOB-21", () => {
  test("a progress invoice shows its job, milestone, retention held and amount due", async ({ page, seededOrg }) => {
    void seededOrg;
    const list = (await (await page.request.get(`${API_URL}/invoices`)).json()) as { id: string; status: string; retentionAmount: string }[];
    const progress = list.find((i) => i.status === "issued" && BigInt(i.retentionAmount) > 0n)!;

    await page.goto(`/invoices/${progress.id}`);
    const jobCard = page.getByTestId("invoice-job-card");
    // US-INV-30: the job and milestone are a line in the page's header.
    await expect(jobCard).toContainText(/ · .+ \(\d+%\)$/);
    // US-JOB-22: the job is named with its number (a demo job's, US-ONB-17).
    await expect(jobCard.getByRole("link").first()).toHaveText(/^DEMO-JOB-\d{3} · /);
    await expect(jobCard.getByRole("link").first()).toHaveAttribute("href", /\/jobs\//);

    await expect(page.getByText(/^Retention held \(\d+(\.\d+)?%\)$/)).toBeVisible();
    // US-INV-31: retention comes off the total, then Balance due.
    await expect(page.getByTestId("invoice-totals")).toContainText("Balance due");
    await expect(page.getByTestId("fig-retention")).toBeVisible();
    await expect(page.getByTestId("retention-note")).toContainText(
      "Retention is held in Retention Receivable until you release it from the job. Held on this job so far:",
    );
  });
});
