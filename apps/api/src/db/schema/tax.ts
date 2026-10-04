import { pgTable, uuid, text, boolean, timestamp, index, unique, numeric } from "drizzle-orm/pg-core";
import { organization } from "./auth";

/**
 * PRD FEAT-08 — a named, org-defined tax rate (S-08.1), e.g. "GST" at 15%
 * or "State Tax" at 6.5%. Replaces the earlier Phase 0/1 placeholder (a
 * single `default_tax_rate` row in the generic `settings` table, still read
 * by `tax.controller.ts` for onboarding) now that a real table exists.
 *
 * `rate` is a plain decimal percentage (real, not bigint) — a rate, not
 * money — matching `catalogItems.defaultTaxRatePercentage`'s existing
 * convention exactly. `isCompound` feeds `computeLineTax` (packages/shared)
 * directly: a compound rate taxes the running total including prior
 * non-compound tax on the same line, not just the pre-tax base.
 *
 * Quote/invoice lines snapshot `name`/`rate`/`isCompound` at the time a
 * line is created (never re-read this table), per CLAUDE.md's "documents
 * snapshot their data" rule — editing or archiving a rate here must never
 * alter an existing quote/invoice line.
 */
export const taxRates = pgTable(
  "tax_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** e.g. 15 for 15%. */
    rate: numeric("rate", { precision: 18, scale: 4, mode: "number" }).notNull(),
    isCompound: boolean("is_compound").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tax_rates_org_idx").on(table.orgId),
    index("tax_rates_org_archived_idx").on(table.orgId, table.archivedAt),
  ],
);

/**
 * A named bundle of tax rates applied together on one line (S-08.3, e.g.
 * "CGST + SGST"). A quote/invoice line references at most one of
 * `taxRateId` OR `taxGroupId`, never both — enforced at the service layer,
 * not the DB, matching the rest of this codebase's convention of
 * server-computed validation over DB-level XOR constraints.
 */
export const taxGroups = pgTable(
  "tax_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("tax_groups_org_idx").on(table.orgId)],
);

export const taxGroupRates = pgTable(
  "tax_group_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taxGroupId: uuid("tax_group_id")
      .notNull()
      .references(() => taxGroups.id, { onDelete: "cascade" }),
    taxRateId: uuid("tax_rate_id")
      .notNull()
      .references(() => taxRates.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("tax_group_rates_group_idx").on(table.taxGroupId),
    unique("tax_group_rates_group_rate_unique").on(table.taxGroupId, table.taxRateId),
  ],
);
