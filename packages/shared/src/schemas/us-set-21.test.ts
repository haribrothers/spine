import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_PLACEHOLDERS_BY_TYPE, EMAIL_TEMPLATE_TYPES, emailTemplatesSchema, fillPlaceholders, resolveEmailTemplate, unknownPlaceholder } from "./email-templates.ts";

describe("US-SET-21", () => {
  it("offers the six placeholders everywhere, {link} on quotes and {due_status} on reminders", () => {
    for (const type of EMAIL_TEMPLATE_TYPES) {
      for (const p of ["customer_name", "document_number", "amount", "balance_due", "due_date", "business_name"]) expect(EMAIL_PLACEHOLDERS_BY_TYPE[type]).toContain(p);
    }
    expect(EMAIL_PLACEHOLDERS_BY_TYPE.quote).toContain("link");
    expect(EMAIL_PLACEHOLDERS_BY_TYPE.invoice).not.toContain("link");
    expect(EMAIL_PLACEHOLDERS_BY_TYPE.reminder).toContain("due_status");
  });

  it("finds a placeholder the email can't fill, and fills the ones it can", () => {
    expect(unknownPlaceholder("Invoice {invoice_no}", "invoice")).toBe("invoice_no");
    expect(unknownPlaceholder("Open {link}", "invoice")).toBe("link");
    expect(unknownPlaceholder("Open {link}", "quote")).toBeNull();
    expect(unknownPlaceholder("A plain {} brace", "invoice")).toBe("");
    expect(fillPlaceholders("Hi {customer_name}, {amount} is due {due_date}.", { customer_name: "Alan", amount: "$10.00" })).toBe("Hi Alan, $10.00 is due .");
  });

  it("refuses an unknown placeholder on save, saying which", () => {
    const parsed = emailTemplatesSchema.safeParse({ invoice: { subject: "Invoice {invoice_no}", body: "Hi" } });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("{invoice_no} isn't a placeholder Spine knows. Use one from the list.");
    expect(emailTemplatesSchema.safeParse({ newsletter: { subject: "Hi", body: "Hi" } }).success).toBe(false);
  });

  it("Spine's defaults are valid templates, used until one is saved", () => {
    expect(emailTemplatesSchema.safeParse(DEFAULT_EMAIL_TEMPLATES).success).toBe(true);
    expect(resolveEmailTemplate({}, "receipt")).toEqual(DEFAULT_EMAIL_TEMPLATES.receipt);
    expect(resolveEmailTemplate({ receipt: { subject: "Thanks", body: "Hi" } }, "receipt").subject).toBe("Thanks");
  });
});
