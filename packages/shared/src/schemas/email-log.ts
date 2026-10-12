/**
 * US-SET-27–29 (D-220) — the email log: every email Spine sends, queued or
 * sent straight away, with what happened to it. Owner only.
 */

export const EMAIL_KINDS = [
  "quote",
  "invoice",
  "invoice_reminder",
  "credit_note",
  "receipt",
  "refund",
  "statement",
  // US-PUR-54: a remittance advice to a vendor.
  "remittance",
  "notification",
  "digest",
  "invitation",
  "password_reset",
  "verification",
  "data_export",
  "test",
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const EMAIL_KIND_LABELS: Record<EmailKind, string> = {
  quote: "Quote",
  invoice: "Invoice",
  invoice_reminder: "Reminder",
  credit_note: "Credit note",
  receipt: "Receipt",
  refund: "Refund",
  statement: "Statement",
  remittance: "Remittance advice",
  notification: "Notification",
  digest: "Daily digest",
  invitation: "Invitation",
  password_reset: "Password reset",
  verification: "Verification",
  data_export: "Data export",
  test: "Test",
};

export const EMAIL_LOG_STATUSES = ["queued", "retrying", "sending", "sent", "failed", "cancelled"] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

export const EMAIL_LOG_STATUS_LABELS: Record<EmailLogStatus, string> = {
  queued: "Queued",
  retrying: "Retrying",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** How long the log keeps an email (D-220). */
export const EMAIL_LOG_RETENTION_DAYS = 180;

/** `GET /emails` — one email. */
export interface EmailLogEntry {
  id: string;
  kind: EmailKind;
  toAddress: string;
  /** Who the address belongs to: the contact or the team member, when known. */
  toName: string | null;
  subject: string;
  entityType: string | null;
  entityId: string | null;
  /** The record's number or name ("QUO-0031", a contact for a statement), when it still exists. */
  recordLabel: string | null;
  status: EmailLogStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  /** A queued email: retried from the log. One sent straight away is sent again from its record. */
  canRetry: boolean;
  canCancel: boolean;
  /** Retrying: when the next attempt is due. */
  nextAttemptAt: string | null;
  /** Queued while email isn't set up: it goes out once it is (US-SET-29). */
  waitingForSetup: boolean;
  queuedAt: string;
  sentAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
}

/** `GET /emails/status` (US-SET-29). */
export interface EmailLogStatusSummary {
  smtpConfigured: boolean;
  /** Queued, retrying or sending. */
  waiting: number;
  /** Failed in the last 7 days, not retried or cancelled. */
  failedRecently: number;
  /** Sent since midnight (organisation time). */
  sentToday: number;
  /** When the last 3 queued emails in a row failed: the latest error. */
  lastError: string | null;
}

/** Where a record of an email opens in the web app. */
export function emailRecordHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "quote":
      return `/quotes/${entityId}`;
    case "invoice":
      return `/invoices/${entityId}`;
    case "credit_note":
      return `/credit-notes/${entityId}`;
    case "payment":
      return `/payments/${entityId}`;
    case "contact":
      return `/contacts/${entityId}`;
    case "job":
      return `/jobs/${entityId}`;
    case "vendor_bill":
      return `/vendor-bills/${entityId}`;
    case "expense":
      return `/expenses/${entityId}`;
    case "vendor_payment":
      return `/vendor-payments/${entityId}`;
    case "meeting":
      return `/meetings/${entityId}`;
    default:
      return null;
  }
}
