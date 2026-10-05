import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

type Billing = { contractValue: string; billedToDate: string; billedPct: number | null; leftToBill: string };

const money = (minor: string) => `$${(Number(minor) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

test.describe("US-JOB-27", () => {
  test("the Billing card shows contract value, billed to date with %, and left to bill; the Jobs list shows Billed %", async ({ page, seededOrg: _ }) => {
    const jobs = (await (await page.request.get(`${API_URL}/jobs?include=costing`)).json()) as { id: string; name: string; billedPct: number | null }[];
    const job = jobs[0]!;
    const { billing } = (await (await page.request.get(`${API_URL}/jobs/${job.id}/costing`)).json()) as { billing: Billing };

    await page.goto(`/jobs/${job.id}`);
    await page.getByRole("tab", { name: "Costing" }).click();
    const card = page.getByRole("heading", { name: "Billing" }).locator("..");
    await expect(card).toContainText(`Contract value${money(billing.contractValue)}`);
    await expect(card).toContainText(`Billed to date${money(billing.billedToDate)}${billing.billedPct}% of contract`);
    await expect(card).toContainText(`Left to bill${money(billing.leftToBill)}`);
    await expect(card.getByRole("progressbar", { name: `Billed ${billing.billedPct}% of the contract` })).toBeVisible();

    await page.goto("/jobs");
    await expect(page.getByRole("columnheader", { name: /Billed/ })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: job.name }).first()).toContainText(`${job.billedPct ?? "—"}%`.replace("—%", "—"));
  });
});
