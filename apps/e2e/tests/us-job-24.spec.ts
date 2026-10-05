import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-JOB-24", () => {
  test("'Edit job' takes a cost budget, refuses a negative one, and can be cleared", async ({ page, seededOrg: _ }) => {
    const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as { id: string; name: string }[];
    const job = jobs[jobs.length - 1]!;
    await page.goto(`/jobs/${job.id}`);

    const openEdit = async () => {
      await page.getByRole("button", { name: "Edit job" }).click();
      return page.getByRole("dialog", { name: "Edit job" });
    };
    let dialog = await openEdit();
    await expect(dialog.getByText("What you expect this job to cost. Leave blank if you don't budget it.")).toBeVisible();
    const budget = dialog.getByRole("textbox", { name: "Cost budget" });

    await budget.fill("-5");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Enter a budget of zero or more.")).toBeVisible();

    await budget.fill("32,000.00");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    const saved = (await (await page.request.get(`${API_URL}/jobs/${job.id}`)).json()) as { costBudgetAmount: string | null };
    expect(saved.costBudgetAmount).toBe("3200000");

    dialog = await openEdit();
    await expect(dialog.getByRole("textbox", { name: "Cost budget" })).toHaveValue("32000.00");
    await dialog.getByRole("textbox", { name: "Cost budget" }).fill("");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    const cleared = (await (await page.request.get(`${API_URL}/jobs/${job.id}`)).json()) as { costBudgetAmount: string | null };
    expect(cleared.costBudgetAmount).toBeNull();
  });
});
