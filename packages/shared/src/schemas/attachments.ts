import { z } from "zod";

/** D-156 — the records that can carry attachments. */
export const ATTACHMENT_ENTITY_TYPES = [
  "quote",
  "invoice",
  "credit_note",
  "payment",
  "customer_refund",
  "vendor_bill",
  "vendor_credit",
  "vendor_payment",
  "expense",
  "manual_journal",
  "bank_transaction",
  "contact",
] as const;
export const attachmentEntityTypeSchema = z.enum(ATTACHMENT_ENTITY_TYPES);
export type AttachmentEntityType = z.infer<typeof attachmentEntityTypeSchema>;

export const MAX_ATTACHMENTS_PER_RECORD = 10;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const TOO_MANY_ATTACHMENTS = "A record can hold up to 10 files. Remove one first.";
export const FILE_TOO_LARGE = "This file is over 10 MB. Upload a smaller copy, or split the PDF.";

export const attachmentQuerySchema = z.object({
  entityType: attachmentEntityTypeSchema,
  entityId: z.string().uuid("That record doesn't exist."),
});

export const createAttachmentSchema = attachmentQuerySchema.extend({
  fileId: z.string().uuid("Upload the file first."),
});
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

export const removeAttachmentSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

/** `GET /attachments` row. */
export interface Attachment {
  id: string;
  file: { id: string; name: string; size: number; contentType: string };
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

/** `GET /attachments` response: the files plus what this person may do with them. */
export interface AttachmentList {
  attachments: Attachment[];
  canAdd: boolean;
  /** Remove without a reason (an editable record). */
  canRemove: boolean;
  /** Remove with a reason: an Owner on a locked (issued or recorded) record. */
  canRemoveWithReason: boolean;
  locked: boolean;
}

/** "184 KB", "1.2 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
