import { pgTable, uuid, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "./auth";

/**
 * One row per (org, document type). Allocating the next number requires a
 * row lock (`SELECT ... FOR UPDATE`) inside the issuing transaction so
 * numbers stay gapless — see §6.5. Drafts never touch this table.
 */
export const numberSequences = pgTable(
  "number_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    prefix: text("prefix").notNull(),
    padding: integer("padding").notNull().default(4),
    /** Resets when the year token rolls over on financial-year start, per §14.3. */
    yearToken: text("year_token"),
    nextValue: integer("next_value").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("number_sequences_org_doctype_unique").on(table.orgId, table.documentType)],
);
