import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg, waitForEmail } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

async function openEmails(page: Page) {
  await page.getByRole("button", { name: /Owner/ }).last().click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Emails" }).click();
  return dialog;
}

test.describe("US-SET-21", () => {
  test("an Owner changes the invoice email; the Send dialog starts from it and can change one email", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-set-21-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const post = async (path: string, data: unknown) => {
      const res = await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
      expect(res.ok(), await res.text()).toBe(true);
      return res.json();
    };
    await page.request.put(`${API_URL}/org/settings/business_profile`, { headers: { "Idempotency-Key": randomUUID() }, data: { value: { name: "Riverstone Builders" } } });
    const customerEmail = `alan-${randomUUID()}@example.com`;
    const contact = await post("/contacts", { type: "customer", name: "Alan Brooks", email: customerEmail });
    const draft = await post("/invoices", { contactId: contact.id, currency: "USD", lines: [{ name: "Kitchen", quantity: 1, unitPriceAmount: "100000" }] });
    const invoice = await post(`/invoices/${draft.id}/issue`, {});

    let dialog = await openEmails(page);
    await expect(dialog).toContainText("Your own words in the emails customers get. The branded layout around them stays the same.");
    const list = dialog.getByTestId("email-template-list");
    for (const name of ["Quote", "Invoice", "Payment reminder", "Receipt", "Credit note", "Statement"]) await expect(list).toContainText(name);
    // Each with its subject and the first line of its message.
    await expect(list).toContainText("{business_name} sent you an invoice ({document_number})");
    await list.getByRole("button", { name: /^Invoice/ }).click();

    const editor = dialog.getByTestId("email-template-editor");
    const subject = editor.getByLabel("Subject");
    await subject.fill("Invoice ");
    await editor.getByRole("button", { name: "{document_number}" }).click();
    await subject.press("End");
    await subject.pressSequentially(" from ");
    await editor.getByRole("button", { name: "{business_name}" }).click();
    await expect(subject).toHaveValue("Invoice {document_number} from {business_name}");
    await expect(editor.getByRole("button", { name: "{link}" })).toHaveCount(0);

    // D-189: the message is a rich text editor.
    const body = editor.getByRole("textbox", { name: "Message" });
    await body.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Your invoice {invoice_no} is attached.");
    await expect(editor).toContainText("{invoice_no} isn't a placeholder Spine knows. Use one from the list.");
    await expectNoAxeViolations(page);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Hi ");
    await editor.getByRole("button", { name: "{customer_name}" }).click();
    await page.keyboard.type(",");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Your invoice {document_number} for {amount} is ");
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type("attached");
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type(".");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Thanks for choosing us, {business_name}");
    await expect(body).toContainText("Hi {customer_name},");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Your changes have been saved.").first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(`/invoices/${invoice.id}`);
    await page.getByRole("button", { name: "Email invoice" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: `Email invoice ${invoice.number}` })).toBeVisible();
    await expect(dialog.getByLabel("To")).toHaveValue(customerEmail);
    await expect(dialog.getByLabel("Subject")).toHaveValue(`Invoice ${invoice.number} from Riverstone Builders`);
    await expect(dialog.getByRole("textbox", { name: "Message" })).toContainText(/Your invoice INV-\d+ for \$1,000\.00 is attached\./);
    await expect(dialog.getByRole("checkbox", { name: "Attach the invoice PDF" })).toBeChecked();
    // Let the dialog finish fading in before checking contrast.
    await dialog.evaluate((el) => Promise.all((el as unknown as { getAnimations(o: { subtree: boolean }): { finished: Promise<unknown> }[] }).getAnimations({ subtree: true }).map((a) => a.finished)));
    await expectNoAxeViolations(page);
    await dialog.getByLabel("Subject").fill(`Your kitchen invoice ${invoice.number}`);
    await dialog.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByText("Emailing invoice").first()).toBeVisible();
    const sent = await waitForEmail((e) => e.to.some((t) => t.address === customerEmail));
    expect(sent.subject).toBe(`Your kitchen invoice ${invoice.number}`);
    expect(sent.html).toContain("Hi Alan,");
    expect(sent.html).toContain("for $1,000.00 is <strong>attached</strong>.");
    expect(sent.html).toContain("Thanks for choosing us, Riverstone Builders");
  });
});
