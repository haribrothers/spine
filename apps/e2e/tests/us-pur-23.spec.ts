import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-PUR-23", () => {
  test("'Headcount × day rate' preselects Site labour, needs a job, totals the rows, and the drawer lists each row", async ({ page, seededOrg: _ }) => {
    const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as { id: string; name: string }[];
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Submit expense" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Submit an expense" });

    await expect(dialog.getByRole("radio", { name: "Amount" })).toHaveAttribute("aria-checked", "true");
    await dialog.getByRole("radio", { name: "Headcount × day rate" }).click();
    await expect(dialog.getByText("Preselected: posts to 5200 Direct Labour.")).toBeVisible();
    await expect(dialog.getByText("Labour is always for a job.")).toBeVisible();
    await expect(dialog.getByText("Only headcounts and day rates are recorded — no names, attendance or hours.")).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Amount", exact: true })).toHaveCount(0);

    const rows: [string, string, string][] = [
      ["Mason", "4", "950.00"],
      ["Carpenter", "3", "900.00"],
      ["Helper", "8", "650.00"],
    ];
    for (const [i, [trade, workers, rate]] of rows.entries()) {
      if (i > 0) await dialog.getByRole("button", { name: "Add trade" }).click();
      await dialog.getByRole("combobox", { name: `Trade ${i + 1}` }).fill(trade);
      await dialog.getByRole("textbox", { name: `Workers ${i + 1}` }).fill(workers);
      await dialog.getByRole("textbox", { name: `Day rate ${i + 1}` }).fill(rate);
    }
    await expect(dialog.getByText("Total for the day · 15 workers")).toBeVisible();
    await expect(dialog.getByText("$11,700.00")).toBeVisible();

    // Without a job it won't save.
    await dialog.getByRole("button", { name: "Save expense" }).click();
    await expect(dialog.getByText("Labour is always for a job — choose one.")).toBeVisible();

    await dialog.locator("div", { hasText: /^Job/ }).getByRole("combobox").first().click();
    await page.getByRole("option", { name: jobs[0]!.name }).click();
    await dialog.getByRole("button", { name: "Save expense" }).click();
    await expect(dialog).toHaveCount(0);

    const expenses = (await (await page.request.get(`${API_URL}/expenses?jobId=${jobs[0]!.id}`)).json()) as { id: string; amount: string; entryMode: string }[];
    const saved = expenses.find((e) => e.entryMode === "labour" && e.amount === "1170000");
    expect(saved).toBeTruthy();
    await page.reload();
    await page.getByRole("button", { name: new Date().toLocaleDateString() }).first().click();
    await expect(page.getByText("4 Mason × $950.00 = $3,800.00")).toBeVisible();
  });

  test("a trade used before is suggested with its last day rate", async ({ page, seededOrg: _ }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Submit expense" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Submit an expense" });
    await dialog.getByRole("radio", { name: "Headcount × day rate" }).click();
    await dialog.getByRole("combobox", { name: "Trade 1" }).fill("Mason");
    await expect(dialog.getByRole("textbox", { name: "Day rate 1" })).toHaveValue("950.00");
  });
});
