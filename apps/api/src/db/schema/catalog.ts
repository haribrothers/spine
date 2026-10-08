import { pgTable, uuid, text, bigint, boolean, timestamp, index, numeric, integer, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { accounts } from "./ledger";
import { taxRates, taxGroups, supplyClassEnum } from "./tax";

/**
 * PRD F2 — goods/services with a unit, default price and default tax rate,
 * so a future quote/invoice line can prefill from an item and then override
 * (S-02.1/S-02.2). Org-scoped, following contacts.ts's own pattern exactly.
 *
 * Soft-delete via nullable `archivedAt`, not hard delete — same rationale as
 * contacts.ts: once Quotes/Invoices exist, a catalog item will be
 * referenced by quote/invoice line items, and archiving keeps that history
 * intact instead of leaving a dangling reference or cascading destruction.
 * Today nothing references catalog_items yet (Quotes doesn't exist), so a
 * true hard `delete()` is still offered for defensive cleanup — see
 * CatalogService's own comment on that method.
 *
 * `defaultPriceAmount`/`defaultPriceCurrency` follow the exact Money shape
 * leads.ts uses (bigint minor units + a separate currency column) per
 * CLAUDE.md's non-negotiable money rule. This is only ever a *default* — it
 * is never coupled to a document; a quote/invoice line snapshots its own
 * price at the time it's added and can override it freely (S-02.2), which
 * this schema deliberately does nothing to prevent or entangle.
 *
 * `defaultTaxRatePercentage` is a plain decimal percentage (real, not
 * bigint) — a rate, not money — stored per-item rather than as an FK,
 * because there is no `tax_rates` table yet (full multi-rate tax-group CRUD
 * is FEAT-08, a later phase per CLAUDE.md's non-goals). It's pre-filled from
 * the org's single default tax rate (`GET /org/tax/default-rate`) when the
 * create form loads, then stored independently per item from that point on.
 *
 * `incomeAccountId`/`expenseAccountId` are nullable FKs to the existing
 * chart of accounts (`accounts` in ./ledger.ts) — SHOULD-level per PRD F2,
 * "default income and expense account" — so revenue/COGS reporting can
 * break down by item once documents post to the ledger (S-02.3).
 * `onDelete: "restrict"` matches `journal_lines.accountId`'s own FK
 * behavior: an account referenced by a catalog item's default mapping
 * shouldn't be silently deletable out from under it. (In practice
 * `accounts` rows are rarely hard-deleted at all — most are `isSystem`.)
 *
 * `category` is a free-text field, not a separate categories table — MAY-
 * level per PRD F2, matching contacts.ts's own free-text conventions (e.g.
 * no dedicated lookup table for a field this low-stakes).
 */
export const catalogItems = pgTable(
  "catalog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /**
     * Free-text unit label (e.g. "hour", "sq ft", "each", "kg") rather than
     * a fixed enum — service/fabrication businesses use wildly varied units
     * and PRD F2 doesn't call out a fixed list, matching this schema's own
     * "free text over lookup table for low-stakes fields" convention.
     */
    unit: text("unit").notNull(),
    category: text("category"),
    defaultPriceAmount: bigint("default_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    defaultPriceCurrency: text("default_price_currency").notNull(),
    /**
     * Legacy flat percentage, kept only as a fallback display value for
     * items created before FEAT-08's real tax_rates table existed. New
     * writes should set `defaultTaxRateId`/`defaultTaxGroupId` instead —
     * CatalogService keeps this column in sync (mirrors the chosen rate's
     * blended percentage) purely so nothing reading it directly breaks.
     */
    defaultTaxRatePercentage: numeric("default_tax_rate_percentage", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    /** At most one of these two is set — enforced at the service layer, same convention as quote_lines/invoice_lines. */
    defaultTaxRateId: uuid("default_tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    defaultTaxGroupId: uuid("default_tax_group_id").references(() => taxGroups.id, { onDelete: "set null" }),
    /** US-TAX-13 — the inter-state counterpart of the default (intra-state) tax; at most one. */
    interTaxRateId: uuid("inter_tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    interTaxGroupId: uuid("inter_tax_group_id").references(() => taxGroups.id, { onDelete: "set null" }),
    /** US-TAX-11 — copied to each line made from the item. */
    supplyClass: supplyClassEnum("supply_class").notNull().default("taxable"),
    /** US-TAX-14 — HSN (goods) or SAC (services) code, copied to each line. */
    hsnSac: text("hsn_sac"),
    incomeAccountId: uuid("income_account_id").references(() => accounts.id, { onDelete: "restrict" }),
    expenseAccountId: uuid("expense_account_id").references(() => accounts.id, { onDelete: "restrict" }),
    /** Same demo-data marker as contacts.isDemo — see that column's comment. */
    isDemo: boolean("is_demo").notNull().default(false),
    /** Same "own vs others" ownership marker as contacts.createdByUserId — see that column's comment for the full rationale (nullable = unowned, onDelete: "set null"). */
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("catalog_items_org_idx").on(table.orgId),
    index("catalog_items_org_category_idx").on(table.orgId, table.category),
    index("catalog_items_org_name_idx").on(table.orgId, table.name),
    index("catalog_items_income_account_idx").on(table.incomeAccountId),
    index("catalog_items_expense_account_idx").on(table.expenseAccountId),
    index("catalog_items_org_demo_idx").on(table.orgId, table.isDemo),
    index("catalog_items_created_by_idx").on(table.createdByUserId),
  ],
);

/** Same three kinds as quote and invoice lines. */
export const catalogBundleLineTypeEnum = pgEnum("catalog_bundle_line_type", ["item", "heading", "text"]);

/**
 * US-QUO-25 (D-096) — a saved group of lines ("Bathroom refit — standard")
 * that the line picker adds to a quote or invoice in one go (US-QUO-26).
 * Its lines are copied in when it's saved (from a quote) and copied out
 * when it's added, so a bundle never changes an existing document and a
 * document never changes a bundle. Own/others rules are the catalogue's
 * (`catalog.*`), keyed on `created_by_user_id`.
 */
export const catalogBundles = pgTable(
  "catalog_bundles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** The currency its prices are in; it's offered on documents in the same currency. */
    currency: text("currency").notNull(),
    /** Sum of its lines' totals when it was saved, shown in the picker; its lines are what's copied. */
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("catalog_bundles_org_idx").on(table.orgId), index("catalog_bundles_created_by_idx").on(table.createdByUserId)],
);

/** One line of a bundle, a snapshot of the line it was saved from. */
export const catalogBundleLines = pgTable(
  "catalog_bundle_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleId: uuid("bundle_id")
      .notNull()
      .references(() => catalogBundles.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    type: catalogBundleLineTypeEnum("type").notNull().default("item"),
    /** Provenance only; an archived or deleted item never stops the line being added (as a one-off). */
    catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    discountPercentage: numeric("discount_percentage", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    taxRatePercentage: numeric("tax_rate_percentage", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    /** US-TAX-11 — snapshot of why the line has (no) tax; null on heading and text lines. */
    supplyClass: supplyClassEnum("supply_class"),
    /** US-TAX-14 — HSN/SAC code, a snapshot from the item; null on heading and text lines. */
    hsnSac: text("hsn_sac"),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    taxGroupId: uuid("tax_group_id").references(() => taxGroups.id, { onDelete: "set null" }),
    isTaxInclusive: boolean("is_tax_inclusive").notNull().default(false),
  },
  (table) => [index("catalog_bundle_lines_bundle_idx").on(table.bundleId, table.sortOrder)],
);

