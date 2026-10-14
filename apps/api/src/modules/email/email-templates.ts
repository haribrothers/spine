import { DEFAULT_EMAIL_TEMPLATES, emailBodyHtml, fillPlaceholders, type EmailPlaceholder, type EmailTemplateText, type EmailTemplateType } from "@spine/shared";
import { splitGreeting } from "./email-html";
import { appUrl, emailDate, emailMoney, escapeHtml, firstName, type EmailContent } from "./email-layout";

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
  /** US-SET-21 — what each placeholder reads in this email, for a "Send" dialog's draft. */
  values?: Partial<Record<EmailPlaceholder, string>>;
}

const REPLY_NOTE = "Questions? Reply to this email.";

/**
 * US-SET-21 (D-153) — an email's words from its template (the saved one,
 * one edited in a "Send" dialog, or Spine's default), placeholders filled.
 * A short first paragraph ending in a comma ("Hi Alan,") is the greeting.
 */
export function fromTemplate(type: EmailTemplateType, text: EmailTemplateText | undefined, values: Partial<Record<EmailPlaceholder, string>>) {
  const t = text ?? DEFAULT_EMAIL_TEMPLATES[type];
  const subject = fillPlaceholders(t.subject, values).replace(/\s+/g, " ").trim();
  // D-189: the message is the editor's HTML; values go in escaped.
  const escaped = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, escapeHtml(v ?? "")])) as Partial<Record<EmailPlaceholder, string>>;
  const { greeting, rest } = splitGreeting(fillPlaceholders(emailBodyHtml(t.body), escaped));
  return { subject, greeting, bodyHtml: rest, values };
}

export function quoteEmail(d: {
  locale?: string;
  businessName: string;
  contactName: string | null;
  number: string;
  total: bigint;
  currency: string;
  validUntil: Date | string | null;
  link: string | null;
  /** US-SET-21 — the saved or edited text; Spine's default when absent. */
  text?: EmailTemplateText;
}): EmailTemplate {
  const total = emailMoney(d.total, d.currency, d.locale);
  const words = fromTemplate("quote", d.text, {
    customer_name: firstName(d.contactName),
    document_number: d.number,
    amount: total,
    balance_due: total,
    due_date: d.validUntil ? emailDate(d.validUntil) : "",
    business_name: d.businessName,
    link: d.link ?? "",
  });
  // Without a page to open, Spine's default says the PDF is attached instead.
  const bodyHtml = !d.text && !d.link ? "<p>Here's our quote, attached as a PDF.</p>" : words.bodyHtml;
  return {
    subject: words.subject,
    values: words.values,
    content: {
      preheader: `${d.businessName} sent you a quote (${d.number}).`,
      heading: "Your quote is ready",
      greeting: words.greeting,
      bodyHtml,
      paragraphs: [],
      facts: [
        { label: "Quote", value: d.number },
        { label: "Total", value: total },
        ...(d.validUntil ? [{ label: "Valid until", value: emailDate(d.validUntil) }] : []),
      ],
      button: d.link ? { label: "View quote", url: d.link } : undefined,
      note: `The quote is also attached as a PDF. ${REPLY_NOTE}`,
    },
  };
}

export function invoiceEmail(d: {
  locale?: string;
  businessName: string;
  contactName: string | null;
  number: string;
  currency: string;
  total: bigint;
  /** Held back under the contract (US-JOB-21); not due now. */
  retention: bigint;
  balanceDue: bigint;
  dueDate: Date | string | null;
  /**
   * A reminder (manual S-05.10 or automatic US-INV-19). `daysOverdue` is
   * days past the due date: negative means due in that many days, 0 due today.
   */
  reminder?: { daysOverdue: number | null };
  paymentInstructions?: string | null;
  /** US-JOB-29 — "Progress claim 3 · JOB-002". */
  claimLabel?: string | null;
  /** US-INV-26 — what the attached PDF's UPI QR code asks for, if it has one. */
  upiQrAmount?: bigint | null;
  /** US-SET-21 — the saved or edited text (the invoice's, or the reminder's); Spine's default when absent. */
  text?: EmailTemplateText;
}): EmailTemplate {
  const paid = d.balanceDue <= 0n;
  const instructions = d.paymentInstructions?.trim();
  const days = d.reminder?.daysOverdue ?? null;
  // US-INV-19: "is 7 days overdue", "is due today", "is due in 3 days".
  const state = !d.reminder
    ? null
    : days === null
      ? "is overdue"
      : days > 0
        ? `is ${days} day${days === 1 ? "" : "s"} overdue`
        : days === 0
          ? "is due today"
          : `is due in ${-days} day${days === -1 ? "" : "s"}`;
  const words = fromTemplate(state ? "reminder" : "invoice", d.text, {
    customer_name: firstName(d.contactName),
    document_number: d.number,
    amount: emailMoney(d.total, d.currency, d.locale),
    balance_due: emailMoney(paid ? 0n : d.balanceDue, d.currency, d.locale),
    due_date: d.dueDate ? emailDate(d.dueDate) : "",
    business_name: d.businessName,
    due_status: state ?? "",
  });
  return {
    subject: words.subject,
    values: words.values,
    content: {
      preheader: state ? `Invoice ${d.number} ${state}.` : `${d.businessName} sent you an invoice (${d.number}).`,
      heading: state ? `Invoice ${d.number} ${state}` : "Your invoice is ready",
      greeting: words.greeting,
      bodyHtml: words.bodyHtml,
      paragraphs: [
        ...(paid ? ["This invoice is already paid in full — nothing is owing."] : []),
        // US-INV-26: the stored PDF's QR code keeps the amount at issue; say what clears it now.
        ...(state && !paid && d.upiQrAmount != null && d.upiQrAmount !== d.balanceDue
          ? [
              `The QR code on the attached invoice is for ${emailMoney(d.upiQrAmount, d.currency, d.locale)}; pay ${emailMoney(d.balanceDue, d.currency, d.locale)} to clear it.`,
            ]
          : []),
      ],
      facts: [
        { label: "Invoice", value: d.number },
        ...(d.claimLabel ? [{ label: "Claim", value: d.claimLabel }] : []),
        { label: "Total", value: emailMoney(d.total, d.currency, d.locale) },
        ...(d.retention > 0n ? [{ label: "Retention held", value: emailMoney(-d.retention, d.currency, d.locale) }] : []),
        { label: "Balance due", value: emailMoney(paid ? 0n : d.balanceDue, d.currency, d.locale) },
        ...(d.dueDate ? [{ label: "Due", value: emailDate(d.dueDate) }] : []),
      ],
      callout: instructions && !paid ? { title: "How to pay", body: instructions } : undefined,
      note: `The invoice is attached as a PDF. ${REPLY_NOTE}`,
    },
  };
}

export function paymentConfirmationEmail(d: {
  locale?: string;
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
      paragraphs: [`${d.businessName} has received your payment of ${emailMoney(d.amount, d.currency, d.locale)}.`],
      facts: [
        ...(d.number ? [{ label: "Payment", value: d.number }] : []),
        { label: "Amount", value: emailMoney(d.amount, d.currency, d.locale) },
        ...(d.applied > 0n ? [{ label: "Applied to invoices", value: emailMoney(d.applied, d.currency, d.locale) }] : []),
        ...(credit > 0n ? [{ label: "Held as credit", value: emailMoney(credit, d.currency, d.locale) }] : []),
      ],
      note: REPLY_NOTE,
    },
  };
}

/** US-PAY-17 — "We've refunded <amount>", receipt-style. */
export function refundEmail(d: { locale?: string; businessName: string; contactName: string | null; amount: bigint; currency: string; date: string; reference: string | null }): EmailTemplate {
  const amount = emailMoney(d.amount, d.currency, d.locale);
  return {
    subject: `${d.businessName} refunded ${amount}`,
    content: {
      heading: `We've refunded ${amount}`,
      greeting: `Hi ${firstName(d.contactName)},`,
      paragraphs: [`${d.businessName} has refunded ${amount} to you. It may take a few days to reach your account.`],
      facts: [{ label: "Amount", value: amount }, { label: "Date", value: d.date }, ...(d.reference ? [{ label: "Reference", value: d.reference }] : [])],
      note: REPLY_NOTE,
    },
  };
}

export function receiptEmail(d: {
  locale?: string;
  businessName: string;
  contactName: string | null;
  number: string;
  amount: bigint;
  currency: string;
  /** US-SET-21 — the saved or edited text; Spine's default when absent. */
  text?: EmailTemplateText;
}): EmailTemplate {
  const amount = emailMoney(d.amount, d.currency, d.locale);
  const words = fromTemplate("receipt", d.text, { customer_name: firstName(d.contactName), document_number: d.number, amount, business_name: d.businessName });
  return {
    subject: words.subject,
    values: words.values,
    content: {
      heading: "Your receipt",
      greeting: words.greeting,
      bodyHtml: words.bodyHtml,
      paragraphs: [],
      facts: [
        { label: "Receipt", value: d.number },
        { label: "Amount", value: amount },
      ],
      note: REPLY_NOTE,
    },
  };
}

/** US-SET-21 — a credit note emailed to the customer, with its PDF attached. */
export function creditNoteEmail(d: {
  locale?: string;
  businessName: string;
  contactName: string | null;
  number: string;
  invoiceNumber: string | null;
  amount: bigint;
  currency: string;
  text?: EmailTemplateText;
}): EmailTemplate {
  const amount = emailMoney(d.amount, d.currency, d.locale);
  const words = fromTemplate("credit_note", d.text, { customer_name: firstName(d.contactName), document_number: d.number, amount, business_name: d.businessName });
  return {
    subject: words.subject,
    values: words.values,
    content: {
      preheader: `${d.businessName} sent you a credit note (${d.number}).`,
      heading: "Your credit note",
      greeting: words.greeting,
      bodyHtml: words.bodyHtml,
      paragraphs: [],
      facts: [
        { label: "Credit note", value: d.number },
        ...(d.invoiceNumber ? [{ label: "Against invoice", value: d.invoiceNumber }] : []),
        { label: "Amount", value: amount },
      ],
      note: `The credit note is attached as a PDF. ${REPLY_NOTE}`,
    },
  };
}

/** US-PAY-14 — a customer statement, with the PDF attached. US-SET-21: in the template's words, or the sender's own. */
export function statementEmail(d: {
  locale?: string;
  businessName: string;
  contactName: string | null;
  period: string;
  balanceDue: bigint;
  currency: string;
  /** A message typed in the send dialog, used as the email's body. */
  message?: string | null;
  text?: EmailTemplateText;
}): EmailTemplate {
  const balance = emailMoney(d.balanceDue, d.currency, d.locale);
  const base = d.text ?? DEFAULT_EMAIL_TEMPLATES.statement;
  const words = fromTemplate("statement", d.message ? { subject: base.subject, body: d.message } : d.text, {
    customer_name: firstName(d.contactName),
    document_number: d.period,
    amount: balance,
    balance_due: balance,
    business_name: d.businessName,
  });
  return {
    subject: words.subject,
    values: words.values,
    content: {
      heading: "Your statement",
      greeting: words.greeting,
      bodyHtml: words.bodyHtml,
      paragraphs: [],
      facts: [
        { label: "Period", value: d.period },
        { label: "Balance due", value: balance },
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

/**
 * US-TEAM-24 (D-233) — an Owner set this person's password. Never carries the
 * password; says who did it, that they're signed out, and what happens next.
 */
export function passwordSetByOwnerEmail(d: { name: string; ownerName: string; businessName: string; signInUrl: string }): EmailTemplate {
  return {
    subject: `${d.ownerName} changed your ${d.businessName} password`,
    content: {
      heading: "Your password was changed",
      greeting: `Hi ${firstName(d.name)},`,
      paragraphs: [
        `${d.ownerName} set a new password for your ${d.businessName} account on Spine, and you've been signed out on every device.`,
        "They'll give you the new password themselves. When you next sign in with it, you'll choose one only you know.",
      ],
      button: { label: "Sign in", url: d.signInUrl },
      note: `If you weren't expecting this, talk to ${d.ownerName} or another owner at ${d.businessName}.`,
    },
  };
}

/** US-AUTH-18 — to the old address when someone changes their sign-in email. Says who to contact if it wasn't them. */
export function emailChangedEmail(d: { name: string; businessName: string; newEmail: string; when: string; device: string; ownerNames: string }): EmailTemplate {
  return {
    subject: "Your Spine sign-in email changed",
    content: {
      heading: "Your sign-in email changed",
      greeting: `Hi ${firstName(d.name)},`,
      paragraphs: [`The email you use to sign in to Spine for ${d.businessName} was changed.`],
      facts: [
        { label: "New sign-in email", value: d.newEmail },
        { label: "When", value: d.when },
        { label: "From", value: d.device },
      ],
      note: `If this was you, there's nothing to do. If it wasn't, contact an owner of ${d.businessName}${d.ownerNames ? ` — ${d.ownerNames} —` : ""} straight away so they can secure your account.`,
      footerNote: "You get this email because your sign-in details changed.",
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
