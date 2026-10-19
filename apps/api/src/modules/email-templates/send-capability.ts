import type { Capability, EmailTemplateType } from "@spine/shared";

/** Who may send each customer email, and so see its draft (US-SET-21) or have AI draft it (US-AI-11). Statements go with the receivables report. */
export const SEND_CAPABILITY: Record<EmailTemplateType, Capability> = {
  quote: "quotes.send",
  invoice: "invoices.send",
  reminder: "invoices.send_reminder",
  receipt: "payments.send_receipt",
  credit_note: "invoices.send",
  statement: "reports.view_receivables",
};
