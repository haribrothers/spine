import { bigint, boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { files } from "./files";

/**
 * US-SET-15/16 (D-094) — one row per "Prepare export": what was asked for,
 * by whom, and the private ZIP once the `data-export` job has built it.
 * `status` is `preparing` → `ready` (or `failed`); after `expires_at` (7
 * days) the file is deleted from storage and the row becomes `expired`.
 * The ZIP is only ever served by `GET /org/exports/:id/download` to an
 * Owner — never through `/files/:id`.
 */
export const dataExports = pgTable(
  "data_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** `["csv"]`, `["json"]` or both. */
    formats: jsonb("formats").$type<("csv" | "json")[]>().notNull(),
    includeFiles: boolean("include_files").notNull().default(false),
    status: text("status").notNull().default("preparing"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    error: text("error"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("data_exports_org_idx").on(table.orgId, table.createdAt)],
);
