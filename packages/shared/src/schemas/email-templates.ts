import { z } from "zod";

/**
 * US-SET-21 (D-153) — the customer emails whose words an Owner can change.
 * The branded layout around them (heading, facts, payment instructions,
 * button, footer) stays fixed (D-067).
 */
export const EMAIL_TEMPLATE_TYPES = ["quote", "invoice", "reminder", "receipt", "credit_note", "statement"] as const;
export type EmailTemplateType = (typeof EMAIL_TEMPLATE_TYPES)[number];

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateType, string> = {
  quote: "Quote",
  invoice: "Invoice",
  reminder: "Payment reminder",
  receipt: "Receipt",
  credit_note: "Credit note",
  statement: "Statement",
};

export const EMAIL_PLACEHOLDERS = ["customer_name", "document_number", "amount", "balance_due", "due_date", "business_name", "link", "due_status"] as const;
export type EmailPlaceholder = (typeof EMAIL_PLACEHOLDERS)[number];

const COMMON: readonly EmailPlaceholder[] = ["customer_name", "document_number", "amount", "balance_due", "due_date", "business_name"];

/**
 * The placeholders each email offers: the six every email has, `{link}`
 * where the email has one (a quote's page), and `{due_status}` on payment
 * reminders ("is 7 days overdue", "is due today").
 */
export const EMAIL_PLACEHOLDERS_BY_TYPE: Record<EmailTemplateType, readonly EmailPlaceholder[]> = {
  quote: [...COMMON, "link"],
  invoice: COMMON,
  reminder: [...COMMON, "due_status"],
  receipt: COMMON,
  credit_note: COMMON,
  statement: COMMON,
};

export interface EmailTemplateText {
  subject: string;
  /** D-189 — the message as HTML from the rich text editor (p, strong, em, lists, links). Plain text from before is read as paragraphs. */
  body: string;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plain text as the editor's HTML: blank lines start paragraphs, single line breaks stay. */
export function plainTextToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** A message as HTML, whether it was written in the editor or is plain text from before D-189. */
export function emailBodyHtml(body: string): string {
  return /^\s*</.test(body) ? body : plainTextToHtml(body);
}

/** A message's words without the HTML, e.g. to tell whether it's empty. */
export function emailBodyText(body: string): string {
  return body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Spine's own words: what an email says until an Owner changes it, and what "Reset to default" brings back. */
export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateType, EmailTemplateText> = {
  quote: {
    subject: "{business_name} sent you a quote ({document_number})",
    body: "<p>Hi {customer_name},</p><p>Here's our quote. You can read it, accept it or decline it online — no account needed.</p>",
  },
  invoice: {
    subject: "{business_name} sent you an invoice ({document_number})",
    body: "<p>Hi {customer_name},</p><p>Here's invoice {document_number} from {business_name}, attached as a PDF.</p>",
  },
  reminder: {
    subject: "Reminder: invoice {document_number} {due_status}",
    body: "<p>Hi {customer_name},</p><p>This is a friendly reminder that invoice {document_number} {due_status}. If you've already paid, thank you — please ignore this email.</p>",
  },
  receipt: {
    subject: "{business_name} sent you a receipt ({document_number})",
    body: "<p>Hi {customer_name},</p><p>Here's your receipt for a payment of {amount}, attached as a PDF.</p>",
  },
  credit_note: {
    subject: "{business_name} sent you a credit note ({document_number})",
    body: "<p>Hi {customer_name},</p><p>Here's credit note {document_number} for {amount}, attached as a PDF.</p>",
  },
  statement: {
    subject: "Your statement from {business_name} ({document_number})",
    body: "<p>Hi {customer_name},</p><p>Here's your statement for {document_number}, attached as a PDF. It lists every invoice, payment and credit in that time.</p>",
  },
};

const PLACEHOLDER = /\{([^{}\s]*)\}/g;

/** The message for a placeholder Spine doesn't know (or this email doesn't have). */
export const unknownPlaceholderMessage = (name: string) => `{${name}} isn't a placeholder Spine knows. Use one from the list.`;

/** The first placeholder in the text this email can't fill, or null. */
export function unknownPlaceholder(text: string, type: EmailTemplateType): string | null {
  const allowed = EMAIL_PLACEHOLDERS_BY_TYPE[type] as readonly string[];
  for (const match of text.matchAll(PLACEHOLDER)) if (!allowed.includes(match[1]!)) return match[1]!;
  return null;
}

/** Fills the placeholders; one with no value for this document becomes empty. */
export function fillPlaceholders(text: string, values: Partial<Record<EmailPlaceholder, string>>): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => ((EMAIL_PLACEHOLDERS as readonly string[]).includes(name) ? (values[name as EmailPlaceholder] ?? "") : whole));
}

const textSchema = (type: EmailTemplateType) =>
  z
    .object({
      subject: z.string().trim().min(1, "Enter a subject.").max(200, "Keep the subject under 200 characters."),
      body: z.string().trim().max(20000, "Keep the message shorter."),
    })
    .superRefine((value, ctx) => {
      if (!emailBodyText(value.body)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["body"], message: "Enter a message." });
      for (const field of ["subject", "body"] as const) {
        const name = unknownPlaceholder(value[field], type);
        if (name !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: unknownPlaceholderMessage(name) });
      }
    });

/** `settings.email_templates`: the emails someone has changed; an absent one uses Spine's default. */
export const emailTemplatesSchema = z
  .object(Object.fromEntries(EMAIL_TEMPLATE_TYPES.map((t) => [t, textSchema(t).optional()])) as Record<EmailTemplateType, z.ZodOptional<ReturnType<typeof textSchema>>>)
  .strict();
export type EmailTemplates = z.infer<typeof emailTemplatesSchema>;

export const emailTemplateTypeSchema = z.enum(EMAIL_TEMPLATE_TYPES);

/** The text an email uses: the saved one, else Spine's default. */
export function resolveEmailTemplate(saved: Partial<Record<EmailTemplateType, EmailTemplateText | undefined>> | null | undefined, type: EmailTemplateType): EmailTemplateText {
  return saved?.[type] ?? DEFAULT_EMAIL_TEMPLATES[type];
}

/**
 * US-SET-21 — what a "Send" dialog may change for one email: the address,
 * the subject and message (placeholders allowed), and whether the PDF goes
 * with it.
 */
export const emailOverrideSchema = z.object({
  to: z.string().trim().email("Enter an email address like name@example.com.").optional(),
  subject: z.string().trim().min(1, "Enter a subject.").max(200, "Keep the subject under 200 characters.").optional(),
  message: z
    .string()
    .trim()
    .max(20000, "Keep the message shorter.")
    .refine((m) => Boolean(emailBodyText(m)), "Enter a message.")
    .optional(),
  attachPdf: z.boolean().optional(),
});
export type EmailOverride = z.infer<typeof emailOverrideSchema>;

/** An email as the "Send" dialog starts it: placeholders filled for this document. */
export interface EmailDraft {
  type: EmailTemplateType;
  to: string | null;
  subject: string;
  message: string;
  /** Whether the email can carry the document's PDF. */
  hasPdf: boolean;
  /** US-AI-11 (D-254) — the details Spine filled in, longest first, for the editor to highlight. */
  values: string[];
}

const KEPT_PLACEHOLDER = /^\{[^{}\s]*\}$/;

/**
 * US-AI-11 (D-254) — the details Spine filled into an email, longest first
 * so a longer one wins where they overlap. One still waiting for the send
 * (`{link}`, an unsent quote's `{document_number}`) isn't one.
 */
export function filledValues(values: Partial<Record<EmailPlaceholder, string>>): string[] {
  const filled = Object.values(values)
    .map((v) => (v ?? "").trim())
    .filter((v) => v.length > 1 && !KEPT_PLACEHOLDER.test(v));
  return [...new Set(filled)].sort((a, b) => b.length - a.length);
}
