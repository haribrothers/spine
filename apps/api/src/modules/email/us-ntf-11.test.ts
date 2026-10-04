import { afterAll, describe, expect, it } from "vitest";
import { renderEmail, type EmailBrand } from "./email-layout";
import {
  invitationEmail,
  invoiceEmail,
  notificationEmail,
  passwordResetEmail,
  paymentConfirmationEmail,
  quoteEmail,
  receiptEmail,
  type EmailTemplate,
} from "./email-templates";

const brand: EmailBrand = { name: "Riverstone Builders", color: "#2954E5", footer: "Riverstone Builders · 14 Harbour Road, Marina District" };
// Set before the templates are built (at collection time) so snapshots don't depend on the machine.
const savedAppUrl = process.env.APP_URL;
process.env.APP_URL = "https://spine.example";

afterAll(() => {
  process.env.APP_URL = savedAppUrl;
});

const due = new Date("2026-10-17T00:00:00Z");

/** Every email Spine sends, with representative data. */
function allTemplates(): Record<string, EmailTemplate> {
  const notify = (subject: string, text: string, link: string) => notificationEmail({ businessName: brand.name, subject, text, link });
  return {
    invitation: invitationEmail({ businessName: brand.name, inviterName: "Alex Morgan", role: "staff", acceptUrl: "https://spine.example/accept-invite/inv1" }),
    passwordReset: passwordResetEmail({ name: "Sam Lee", url: "https://spine.example/reset-password?token=t" }),
    quote: quoteEmail({ businessName: brand.name, contactName: "Alan Brooks", number: "QUO-0004", total: 51000n, currency: "USD", validUntil: due, link: "https://spine.example/quote/tok" }),
    invoice: invoiceEmail({ businessName: brand.name, contactName: "Alan Brooks", number: "INV-0007", currency: "USD", total: 220000n, retention: 0n, balanceDue: 220000n, dueDate: due }),
    reminder: invoiceEmail({ businessName: brand.name, contactName: "Alan Brooks", number: "INV-0007", currency: "USD", total: 220000n, retention: 0n, balanceDue: 220000n, dueDate: due, reminder: { daysOverdue: 3 } }),
    receipt: receiptEmail({ businessName: brand.name, contactName: "Alan Brooks", number: "PAY-0002", amount: 220000n, currency: "USD" }),
    paymentNotice: paymentConfirmationEmail({ businessName: brand.name, contactName: "Alan Brooks", number: "PAY-0002", amount: 250000n, applied: 220000n, currency: "USD" }),
    meetingInvite: notify("You've been invited: Site walk", `You've been invited to "Site walk".`, "/meetings?id=m1"),
    meetingReminder: notify("Starting soon: Site walk", `"Site walk" starts at 17 Oct 2026, 09:00 UTC.`, "/meetings?id=m1"),
    milestone: notify("Milestone completed — Excavation & footings", `Milestone "Excavation & footings" on job "Phase 2 townhomes - foundations" was marked completed.`, "/jobs/j1"),
    expense: notify("Expense approved — Fuel & Vehicle", "Expense BXP-0001 (Fuel & Vehicle, $85.00) was approved.", "/expenses/e1"),
    paymentReceived: notify("Payment received from Alan Brooks", "Alan Brooks paid $2,500.00 (PAY-0002).", "/payments/p1"),
  };
}

/** Customer documents carry the PDF instead of a button (D-121). */
const CUSTOMER_DOCUMENTS = ["invoice", "reminder", "receipt", "paymentNotice"];

describe("US-NTF-11 · every email type uses the branded layout", () => {
  for (const [name, template] of Object.entries(allTemplates())) {
    it(`${name}: matches its snapshot`, () => {
      const email = renderEmail(brand, template.content);
      expect({ subject: template.subject, text: email.text }).toMatchSnapshot();
      expect(email.html).toMatchSnapshot();
    });

    it(`${name}: has the layout, a heading${CUSTOMER_DOCUMENTS.includes(name) ? "" : " and a button to the record"}`, () => {
      const { html } = renderEmail(brand, template.content);
      expect(html).toContain("border-top:6px solid #2954E5");
      expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
      expect(html).toContain(brand.footer);
      expect((html.match(/<a /g) ?? []).length).toBe(CUSTOMER_DOCUMENTS.includes(name) ? 0 : 1);
    });
  }

  it("the invitation names the business from the business profile", () => {
    const { subject, content } = allTemplates().invitation!;
    expect(subject).toBe("Alex Morgan invited you to join Riverstone Builders on Spine");
    expect(content.paragraphs[0]).toBe("Alex Morgan invited you to join Riverstone Builders as staff.");
  });

  it("notification footers say why the member gets them", () => {
    for (const name of ["meetingInvite", "meetingReminder", "milestone", "expense", "paymentReceived"]) {
      const { html, text } = renderEmail(brand, allTemplates()[name]!.content);
      expect(html).toContain("You&#39;re getting this because you&#39;re a member of Riverstone Builders.");
      expect(text).toContain("You're getting this because you're a member of Riverstone Builders.");
    }
  });

  it("notification buttons open the record in Spine", () => {
    expect(allTemplates().milestone!.content.button).toEqual({ label: "View job", url: "https://spine.example/jobs/j1" });
    expect(allTemplates().expense!.content.button).toEqual({ label: "View expense", url: "https://spine.example/expenses/e1" });
    expect(allTemplates().meetingInvite!.content.button).toEqual({ label: "View meeting", url: "https://spine.example/meetings?id=m1" });
  });
});
