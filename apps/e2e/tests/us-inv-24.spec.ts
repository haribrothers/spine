import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

interface ListedInvoice {
  id: string;
  number: string | null;
  status: string;
}

async function tick(page: Page, label: string, search: string) {
  const box = page.getByPlaceholder("Search invoices");
  await box.fill(search);
  await page.getByRole("checkbox", { name: `Select ${label}` }).first().check();
  await box.fill("");
}

test.describe("US-INV-24", () => {
  test("'Download PDFs' downloads invoices-<date>.zip and says a draft was skipped", async ({ page, seededOrg: _ }) => {
    const invoices = (await (await page.request.get(`${API_URL}/invoices`)).json()) as (ListedInvoice & { contactName: string })[];
    const issued = invoices.find((i) => i.status === "issued" && i.number)!;
    const draft = invoices.find((i) => i.status === "draft")!;
    expect(issued && draft, "the demo data has an issued invoice and a draft").toBeTruthy();

    await page.goto("/invoices");
    await tick(page, issued.number!, issued.number!);
    await tick(page, "draft invoice", draft.contactName);

    const bar = page.getByRole("region", { name: "Selected invoices" });
    await expect(bar).toContainText("2 selected");
    const downloading = page.waitForEvent("download");
    await bar.getByRole("button", { name: "Download PDFs" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.zip$/);
    await expect(page.getByText("Downloaded 1 PDF").first()).toBeVisible();
    await expect(page.getByText(/Draft invoice: It's a draft — drafts have no PDF to download yet\./).first()).toBeVisible();
  });
});
