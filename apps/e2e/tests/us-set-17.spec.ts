import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-SET-17", () => {
  test("Settings › Documents sets paper size and columns per document type, beside a live preview", async ({ page }) => {
    await signUpNewOrg(page, { name: "Layout Owner", email: `e2e-set-17-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const previews: string[] = [];
    page.on("request", (r) => r.url().includes("/document_layout/preview") && previews.push(r.url()));

    await page.goto("/dashboard?settings=documents");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await expect(pane.getByText("Choose what each document shows. The preview updates as you change options.")).toBeVisible();
    const tabs = pane.getByRole("tablist", { name: "Document type" });
    for (const tab of ["Quotes", "Invoices", "Credit notes", "Receipts", "Statements"]) await expect(tabs.getByRole("tab", { name: tab })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "Invoices" })).toHaveAttribute("aria-selected", "true");
    await expect(pane.locator("iframe[title='Invoices preview']")).toBeVisible();
    // No HSN/SAC option without GST.
    await expect(pane.getByText("HSN/SAC")).toHaveCount(0);

    // Change the paper size and hide the discount column: the preview reloads with them.
    const before = previews.length;
    await pane.getByRole("combobox", { name: "Paper size" }).click();
    await page.getByRole("option", { name: "Letter" }).click();
    await pane.getByRole("checkbox", { name: "Discount" }).click();
    await expect.poll(() => previews.length).toBeGreaterThan(before);
    const last = new URL(previews[previews.length - 1]!);
    const sent = JSON.parse(Buffer.from(last.searchParams.get("layout")!, "base64url").toString()) as { invoice: { paperSize: string; columns: { discount: boolean } } };
    expect(sent.invoice).toMatchObject({ paperSize: "LETTER", columns: { discount: false } });
    await expect(pane.getByText("Hidden columns don't change any amounts. Issued PDFs never change.")).toBeVisible();

    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved").first()).toBeVisible();
    const saved = (await (await page.request.get(`${API_URL}/org/settings/document_layout`)).json()) as { value: { invoice: { paperSize: string; columns: { discount: boolean } } } };
    expect(saved.value.invoice).toMatchObject({ paperSize: "LETTER", columns: { discount: false } });

    // Receipts and statements have no lines, so no column options.
    await tabs.getByRole("tab", { name: "Receipts" }).click();
    await expect(pane.getByText("Columns", { exact: true })).toHaveCount(0);
    await expect(pane.locator("iframe[title='Receipts preview']")).toBeVisible();
  });
});
