import { appUrl, emailDate, emailMoney, firstName, type EmailContent } from "./email-layout";

/**
 * US-NTF-11 — the wording of every email Spine sends, one function each,
 * all rendered through `renderEmail` (US-NTF-10). Senders gather the data;
 * these decide what it says. Customer documents (invoice, reminder,
 * receipt, payment confirmation) have no button: customers have no page to
 * open them on, so the attached PDF is the record (D-121).
 */
export interface EmailTemplate {
  subject: string;
  content: EmailContent;
}

const REPLY_NOTE = "Questions? Reply to this email.";

export function quoteEmail(d: {
  businessName: string;
  contactName: string | null;
  number: string;
  total: bigint;
  currency: string;
  validUntil: Date | string | null;
  link: string | null;
}): EmailTemplate {
  return {
    subject: `${d.businessName} sent you a quote (${d.number})`,
    content: {
      preheader: `${d.businessName} sent you a quote (${d.number}).`,
      heading: "Your quote is ready",
      greeting: `Hi ${firstName(d.contactName)},`,
      paragraphs: [
        d.link ? "Here's our quote. You can read it, accept it or decline it online — no account needed." : "Here's our quote, attached as a PDF.",
      ],
      facts: [
        { label: "Quote", value: d.number },
        { label: "Total", value: emailMoney(d.total, d.currency) },
        ...(d.validUntil ? [{ label: "Valid until", value: emailDate(d.validUntil) }] : []),
      ],
      button: d.link ? { label: "View quote", url: d.link } : undefined,
      note: `The quote is also attached as a PDF. ${REPLY_NOTE}`,
    },
  };
}

export function invoiceEmail(d: {
  businessName: string;
  contactName: string | null;
  number: string;
  currency: string;
  total: bigint;
  /** Held back under the contract (US-JOB-21); not due now. */
  retention: bigint;
  balanceDue: bigint;
  dueDate: Date | string | null;
  reminder?: { daysOverdue: number | null };
  paymentInstructions?: string | null;
}): EmailTemplate {
  const overdue = d.reminder
    ? d.reminder.daysOverdue !== null
      ? `${d.reminder.daysOverdue} day${d.reminder.daysOverdue === 1 ? "" : "s"} overdue`
      : "overdue"
    : null;
  const paid = d.balanceDue <= 0n;
  const instructions = d.paymentInstructions?.trim();
  return {
    subject: overdue ? `Reminder: ${d.number} is now ${overdue}` : `${d.businessName} sent you an invoice (${d.number})`,
    content: {
      preheader: overdue ? `Invoice ${d.number} is ${overdue}.` : `${d.businessName} sent you an invoice (${d.number}).`,
      heading: overdue ? "Your invoice is overdue" : "Your invoice is ready",
      greeting: `Hi ${firstName(d.contactName)},`,
      paragraphs: [
        overdue
          ? `This is a friendly reminder that invoice ${d.number} from ${d.businessName} is now overdue.`
          : `Here's invoice ${d.number} from ${d.businessName}, attached as a PDF.`,
        ...(paid ? ["This invoice is already paid in full — nothing is owing."] : []),
      ],
      facts: [
        { label: "Invoice", value: d.number },
        { label: "Total", value: emailMoney(d.total, d.currency) },
        ...(d.retention > 0n ? [{ label: "Retention held", value: `-${emailMoney(d.retention, d.currency)}` }] : []),
        { label: "Balance due", value: emailMoney(paid ? 0n : d.balanceDue, d.currency) },
        ...(d.dueDate ? [{ label: "Due", value: emailDate(d.dueDate) }] : []),
      ],
      callout: instructions && !paid ? { title: "How to pay", body: instructions } : undefined,
      note: `The invoice is attached as a PDF. ${REPLY_NOTE}`,
    },
  };
}

export function paymentConfirmationEmail(d: {
  businessName: string;
  contactName: string;
  number: string | null;
  amount: bigint;
  applied: bigint;
  currency: string;
}): EmailTemplate {
  const credit = d.amount - d.applied;
  return {
    subject: `${d.businessName} received your payment${d.number ? ` (${d.number})` : ""}`,
    content: {
      heading: "Thanks — we've received your payment",
      greeting: `Hi ${firstName(d.contactName)},`,
      paragraphs: [`${d.businessName} has received your payment of ${emailMoney(d.amount, d.currency)}.`],
      facts: [
        ...(d.number ? [{ label: "Payment", value: d.number }] : []),
        { label: "Amount", value: emailMoney(d.amount, d.currency) },
        ...(d.applied > 0n ? [{ label: "Applied to invoices", value: emailMoney(d.applied, d.currency) }] : []),
        ...(credit > 0n ? [{ label: "Held as credit", value: emailMoney(credit, d.currency) }] : []),
      ],
      note: REPLY_NOTE,
    },
  };
}

export function receiptEmail(d: { businessName: string; contactName: string | null; number: string; amount: bigint; currency: string }): EmailTemplate {
  return {
    subject: `${d.businessName} sent you a receipt (${d.number})`,
    content: {
      heading: "Your receipt",
      greeting: `Hi ${firstName(d.contactName)},`,
      paragraphs: [`Here's your receipt for a payment of ${emailMoney(d.amount, d.currency)}, attached as a PDF.`],
      facts: [
        { label: "Receipt", value: d.number },
        { label: "Amount", value: emailMoney(d.amount, d.currency) },
      ],
      note: REPLY_NOTE,
    },
  };
}

const ROLE_LABELS: Record<string, string> = { owner: "an owner", staff: "staff", field: "field crew" };

export function invitationEmail(d: { businessName: string; inviterName: string; role: string; acceptUrl: string }): EmailTemplate {
  return {
    subject: `${d.inviterName} invited you to join ${d.businessName} on Spine`,
    content: {
      heading: `Join ${d.businessName} on Spine`,
      paragraphs: [`${d.inviterName} invited you to join ${d.businessName} as ${ROLE_LABELS[d.role] ?? d.role}.`],
      button: { label: "Accept invitation", url: d.acceptUrl },
      note: "If you weren't expecting this, you can ignore this email — nothing happens until you accept.",
    },
  };
}

export function passwordResetEmail(d: { name: string; url: string }): EmailTemplate {
  return {
    subject: "Reset your Spine password",
    content: {
      heading: "Reset your password",
      greeting: `Hi ${firstName(d.name)},`,
      paragraphs: ["Someone asked to reset the password for this Spine account. Choose a new one with the button below."],
      button: { label: "Choose a new password", url: d.url },
      note: "The link works once and expires in 1 hour. Choosing a new password signs you out on your other devices. If you didn't ask for this, you can ignore this email — your password stays the same.",
    },
  };
}

/** The button a notification gets, from where its in-app link points. */
function recordButton(link: string): string {
  const section = link.split(/[/?]/)[1] ?? "";
  const labels: Record<string, string> = {
    quotes: "View quote",
    invoices: "View invoice",
    payments: "View payment",
    expenses: "View expense",
    jobs: "View job",
    meetings: "View meeting",
    contacts: "View contact",
  };
  return labels[section] ?? "Open Spine";
}

/** Member notifications: payment received, meeting invites and reminders, milestones, expenses, quote activity. */
export function notificationEmail(d: { businessName: string; subject: string; text: string; link?: string | null }): EmailTemplate {
  return {
    subject: d.subject,
    content: {
      heading: d.subject,
      paragraphs: d.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      button: d.link ? { label: recordButton(d.link), url: appUrl(d.link) } : undefined,
      footerNote: `You're getting this because you're a member of ${d.businessName}.`,
    },
  };
}
