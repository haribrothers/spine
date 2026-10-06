import { pgTable, uuid, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { files } from "./files";

/** D-156 — the records that can carry attachments. */
export const attachmentEntityEnum = pgEnum("attachment_entity", [
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
]);

/**
 * US-OPS-33 (D-156) — a file kept with a record: the vendor's bill, the
 * signed contract, the bank slip. Up to 10 live rows per record (service
 * check). Reading follows the record's read rule through `GET /files/:id`
 * (D-117); a removed row keeps who removed it and why.
 */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    entityType: attachmentEntityEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedByUserId: text("removed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    removalReason: text("removal_reason"),
  },
  (table) => [index("attachments_record_idx").on(table.orgId, table.entityType, table.entityId), index("attachments_file_idx").on(table.fileId)],
);
