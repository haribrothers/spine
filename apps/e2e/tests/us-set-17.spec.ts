import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-SET-17", () => {
  test("Settings › Documents sets paper size and columns per document type, beside a live preview", async ({ page }) => {
    await signUpNewOrg(page, { name: "Layout Owner", email: `e2e-set-17-${randomUUID()}@example.com`, password: "e2e-test-password-1" });

    await page.goto("/dashboard?settings=documents");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await expect(pane.getByText("Choose what each document shows. The preview updates as you change options.")).toBeVisible();
    const tabs = pane.getByRole("tablist", { name: "Document type" });
    for (const tab of ["Quotes", "Invoices", "Credit notes", "Receipts", "Statements"]) await expect(tabs.getByRole("tab", { name: tab })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "Invoices" })).toHaveAttribute("aria-selected", "true");
    // D-237: an HTML sample of the document, drawn from the options on screen.
    const sample = pane.getByTestId("document-sample");
    await expect(sample.getByTestId("document-sample-title")).toHaveText("Invoice");
    await expect(sample.getByTestId("document-sample-lines").getByRole("columnheader")).toHaveText(["Item", "Qty", "Rate", "Disc.", "Tax", "Amount"]);
    // No HSN/SAC option without GST.
    await expect(pane.getByText("HSN/SAC")).toHaveCount(0);

    // Change the paper size, hide the discount column and add amount in words: the sample follows at once.
    const ratio = async () => {
      const box = (await sample.getByRole("img").boundingBox())!;
      return box.height / box.width;
    };
    expect((await ratio()).toFixed(2)).toBe("1.41");
    await pane.getByRole("combobox", { name: "Paper size" }).click();
    await page.getByRole("option", { name: "Letter" }).click();
    await expect.poll(async () => (await ratio()).toFixed(2)).toBe("1.29");
    await pane.getByRole("checkbox", { name: "Discount" }).click();
    await expect(sample.getByTestId("document-sample-lines").getByRole("columnheader")).toHaveText(["Item", "Qty", "Rate", "Tax", "Amount"]);
    await pane.getByRole("checkbox", { name: "Amount in words" }).click();
    await expect(sample.getByTestId("document-sample-words")).toBeVisible();
    await pane.getByRole("checkbox", { name: "Amount in words" }).click();
    await pane.getByLabel("Title").fill("Bill");
    await expect(sample.getByTestId("document-sample-title")).toHaveText("Bill");
    await pane.getByLabel("Title").fill("Invoice");
    await expect(pane.getByText("Hidden columns don't change any amounts. Issued PDFs never change.")).toBeVisible();

    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
    const saved = (await (await page.request.get(`${API_URL}/org/settings/document_layout`)).json()) as { value: { invoice: { paperSize: string; columns: { discount: boolean } } } };
    expect(saved.value.invoice).toMatchObject({ paperSize: "LETTER", columns: { discount: false } });

    // Receipts and statements have no lines, so no column options.
    await tabs.getByRole("tab", { name: "Receipts" }).click();
    await expect(pane.getByText("Columns", { exact: true })).toHaveCount(0);
    await expect(sample.getByTestId("document-sample-title")).toHaveText("Receipt");
    await expect(sample).toContainText("Payment received");
  });
});
