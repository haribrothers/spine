import { pgTable, uuid, text, bigint, timestamp, index } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * A generic, org-scoped uploaded-file record — the S3/MinIO object key plus
 * enough metadata to serve and label it. Deliberately NOT a polymorphic
 * `attachableType`/`attachableId` association: nothing in this codebase
 * uses that pattern (checked `journal_lines.contact_id`/`job_id`, both
 * plain nullable FKs to a single specific table, not a generic pointer),
 * and Contacts only needs one relationship today — a contact's optional
 * logo — which is a plain nullable FK living on `contacts` itself
 * (`contacts.logo_file_id` -> `files.id`), not a field here. When
 * quotes/invoices need attachments later, they get their own nullable FK
 * column(s) pointing at `files.id`, following this same precedent, rather
 * than this table growing a speculative "what points to me" association.
 *
 * `key` is the S3 object key (not a full URL — endpoint/bucket vary by
 * environment and object storage is optional, see s3-client.ts), scoped
 * per-org in its path (`{orgId}/{id}/{filename}`) purely for readability
 * in a bucket browser; org isolation is enforced by the `orgId` column and
 * every query filtering on it, not by the key shape.
 */
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    uploadedByUserId: text("uploaded_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("files_org_idx").on(table.orgId)],
);
