import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_TEMPLATES, type EmailPlaceholder } from "@spine/shared";
import { draftPrompt, finishDraft } from "./draft-email.service";

/** What Spine filled into an overdue invoice's reminder — the same values the dialog's template draft shows. */
const REMINDER: Partial<Record<EmailPlaceholder, string>> = {
  customer_name: "Alan",
  document_number: "INV-0042",
  amount: "$1,000.00",
  balance_due: "$800.00",
  due_date: "15 Aug 2026",
  business_name: "Riverstone & Sons",
  due_status: "is 35 days overdue",
};
const reply = (subject: string, message: string) => JSON.stringify({ subject, message });
const template = DEFAULT_EMAIL_TEMPLATES.reminder;

describe("US-AI-11 · the draft keeps the document's own details (D-254)", () => {
  it("fills the model's placeholders with Spine's values, as the editor's HTML, and lists them for the highlight", () => {
    const draft = finishDraft(
      "reminder",
      template,
      REMINDER,
      reply("Invoice {document_number} {due_status}", "Hi {customer_name},\n\nInvoice {document_number} for {amount} was due on {due_date}, and {balance_due} is still outstanding.\n\nRegards,\n{business_name}"),
    );
    expect(draft).toEqual({
      subject: "Invoice INV-0042 is 35 days overdue",
      message: "<p>Hi Alan,</p><p>Invoice INV-0042 for $1,000.00 was due on 15 Aug 2026, and $800.00 is still outstanding.</p><p>Regards,<br>Riverstone &amp; Sons</p>",
      values: ["is 35 days overdue", "Riverstone & Sons", "15 Aug 2026", "$1,000.00", "INV-0042", "$800.00", "Alan"],
    });
  });

  it("a detail the model wrote out is Spine's value all the same; a word that only contains it is left alone", () => {
    const draft = finishDraft("reminder", template, { ...REMINDER, customer_name: "Al" }, reply("INV-0042 is overdue", "Hi Al,\n\nAlso: $800.00 is still due on INV-0042."));
    expect(draft?.subject).toBe("INV-0042 is overdue");
    expect(draft?.message).toBe("<p>Hi Al,</p><p>Also: $800.00 is still due on INV-0042.</p>");
  });

  it("refuses a draft with a number that isn't the document's — a wrong amount, a made-up deadline", () => {
    expect(finishDraft("reminder", template, REMINDER, reply("Invoice {document_number}", "Please pay $8,000.00 now."))).toBeNull();
    expect(finishDraft("reminder", template, REMINDER, reply("Invoice {document_number}", "Please pay {balance_due} within 7 days."))).toBeNull();
    expect(finishDraft("reminder", template, REMINDER, reply("Invoice {document_number}", "It is 36 days late."))).toBeNull();
  });

  it("a number the business's own template has is fine", () => {
    const own = { subject: "Invoice {document_number}", body: "<p>Please pay within 30 days of {due_date}.</p>" };
    expect(finishDraft("reminder", own, REMINDER, reply("Invoice {document_number}", "Kindly pay within 30 days."))?.message).toBe("<p>Kindly pay within 30 days.</p>");
  });

  it("refuses a placeholder the email doesn't have; a quote keeps {link} and an unsent number for the send", () => {
    expect(finishDraft("reminder", template, REMINDER, reply("Invoice {invoice_no}", "Hi {customer_name}"))).toBeNull();
    expect(finishDraft("invoice", DEFAULT_EMAIL_TEMPLATES.invoice, REMINDER, reply("Invoice {document_number}", "Pay at {link}"))).toBeNull();
    const quote = { customer_name: "Alan", document_number: "{document_number}", amount: "$500.00", balance_due: "$500.00", business_name: "Riverstone", link: "{link}" };
    const draft = finishDraft("quote", DEFAULT_EMAIL_TEMPLATES.quote, quote, reply("Quote {document_number}", "Hi {customer_name},\n\nOpen it here: {link}"));
    expect(draft).toMatchObject({ subject: "Quote {document_number}", message: "<p>Hi Alan,</p><p>Open it here: {link}</p>" });
    expect(draft?.values).toEqual(["Riverstone", "$500.00", "Alan"]);
  });

  it("escapes what the model wrote; refuses a reply that isn't a draft, or a subject too long once filled", () => {
    expect(finishDraft("reminder", template, REMINDER, reply("Hi", "<script>alert('x')</script> {customer_name}"))?.message).toBe("<p>&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; Alan</p>");
    expect(finishDraft("reminder", template, REMINDER, "Sure! Here's a draft.")).toBeNull();
    expect(finishDraft("reminder", template, REMINDER, JSON.stringify({ subject: "Hi" }))).toBeNull();
    expect(finishDraft("reminder", template, { ...REMINDER, business_name: "B".repeat(190) }, reply("{business_name}: {document_number} {due_status}", "Hi"))).toBeNull();
  });

  it("the prompt has the template and what each placeholder stands for, redacted (D-165)", () => {
    const own = { subject: "Reminder {document_number}", body: "<p>Hi {customer_name}, our GSTIN is 29AAACK0000A1ZK.</p>" };
    const text = draftPrompt("quote", own, { customer_name: "Alan", document_number: "{document_number}", amount: "$500.00", link: "{link}" });
    expect(text).toContain("Template subject: Reminder {document_number}");
    expect(text).toContain("our GSTIN is [GSTIN].");
    expect(text).toContain("{amount} = $500.00");
    expect(text).toContain("{link} = the link to the quote online (Spine adds it when it sends)");
    expect(text).toContain("{document_number} = the quote's number (given when it's sent)");
    expect(text).not.toContain("{due_date} =");
  });
});
