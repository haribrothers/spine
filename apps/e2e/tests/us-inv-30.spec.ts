import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { invoice, issue, pay } from "./invoice-seed";

test.describe("US-INV-30", () => {
  test("the page leads with the number, where it stands and one next step", async ({ page }) => {
    await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-30-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const draft = await invoice(page, c.id, { issueDays: -10, dueDays: -4 });

    await page.goto(`/invoices/${draft.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Draft invoice");
    await expect(page.getByTestId("invoice-meta")).toContainText("Ananya Rao");
    const actions = page.getByTestId("invoice-actions");
    await expect(actions.getByRole("button", { name: "Issue invoice" })).toBeVisible();
    await expect(actions.getByRole("link", { name: "Edit" })).toBeVisible();
    await expect(page.getByText("Back to invoices")).toHaveCount(0);
    await expect(page.getByTestId("invoice-figures")).toHaveCount(0);

    // Issuing asks first, saying what will happen; Go back leaves it a draft (D-217).
    await actions.getByRole("button", { name: "Issue invoice" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Issue this invoice?" });
    await expect(confirm.getByTestId("confirm-issue")).toContainText("Ananya Rao will owe $1,000.00, due");
    await expect(confirm.getByTestId("confirm-issue")).toContainText("permanent number and posts it to your books");
    await confirm.getByRole("button", { name: "Go back" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Draft invoice");
    await actions.getByRole("button", { name: "Issue invoice" }).click();
    await confirm.getByRole("button", { name: "Issue invoice" }).click();
    await expect(page.getByText("Invoice issued", { exact: true }).first()).toBeVisible();
    const issued = { number: ((await (await page.request.get(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110"}/invoices/${draft.id}`)).json()) as { number: string }).number };
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(issued.number);
    await expect(page.getByTestId("invoice-state")).toHaveText("Overdue");
    await expect(page.getByTestId("invoice-due")).toContainText("Overdue 4 days");
    await expect(actions.getByRole("button", { name: "Send reminder" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Record payment" })).toBeVisible();
    await expect(page.getByTestId("fig-total")).toContainText("$1,000.00");
    await expect(page.getByTestId("fig-paid")).toContainText("Nothing yet");

    await pay(page, c.id, draft.id, "25000", -1);
    await page.reload();
    await expect(page.getByTestId("fig-paid")).toContainText("$250.00");
    await expect(page.getByTestId("fig-paid").getByRole("img", { name: "25% paid" })).toBeVisible();
    await expect(page.getByTestId("fig-balance")).toContainText("$750.00");

    await pay(page, c.id, draft.id, "75000");
    await page.reload();
    await expect(page.getByTestId("invoice-state")).toHaveText("Paid");
    await expect(actions.getByRole("link", { name: "Download PDF" })).toBeVisible();
    await actions.getByRole("button", { name: "More" }).click();
    for (const item of ["Issue credit note", "Duplicate as new draft", "View history", "Void invoice"]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
  });

  test("?action= from a row's menu opens that step", async ({ page }) => {
    await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-30b-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const inv = await issue(page, (await invoice(page, c.id)).id);
    await page.goto(`/invoices/${inv.id}?action=void`);
    await expect(page.getByRole("dialog", { name: "Void this invoice?" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/invoices/${inv.id}$`));
  });
});
