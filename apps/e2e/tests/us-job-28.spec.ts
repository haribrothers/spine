import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-JOB-28", () => {
  test("Percent complete is set in Edit job, refused outside 0–100, and compared with billing on the Costing tab", async ({ page, seededOrg: _ }) => {
    const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as { id: string }[];
    const job = jobs[0]!;
    const { billing } = (await (await page.request.get(`${API_URL}/jobs/${job.id}/costing`)).json()) as { billing: { billedPct: number } };
    // A value 15 points away from what's billed, on whichever side fits.
    const behind = billing.billedPct + 15 <= 100;
    const complete = behind ? billing.billedPct + 15 : billing.billedPct - 15;

    await page.goto(`/jobs/${job.id}`);
    await page.getByRole("button", { name: "Edit job" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit job" });
    await expect(dialog.getByText("Your estimate of how much of the work is done.")).toBeVisible();
    const field = dialog.getByRole("textbox", { name: "Percent complete" });
    await field.fill("120");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Enter a percentage from 0 to 100.")).toBeVisible();
    await field.fill(String(complete));
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("tab", { name: "Costing" }).click();
    await expect(page.getByRole("progressbar", { name: `Work complete ${complete}%` })).toBeVisible();
    await expect(
      page.getByText(behind ? "Billing is 15 points behind the work — check for a milestone to invoice." : "Billing is 15 points ahead of the work."),
    ).toBeVisible();
  });
});
