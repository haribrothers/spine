import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth";

/**
 * US-RPT-12 — the latest daily check that an organisation's ledger
 * balances (total debits = total credits across every journal line). One
 * row per organisation, replaced by each run. Kept out of `settings`, which
 * every member can read: this is for Owners only.
 */
export const ledgerIntegrityChecks = pgTable("ledger_integrity_checks", {
  orgId: text("org_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  /** Total debits minus total credits, in minor units; 0 when the books balance. */
  difference: bigint("difference", { mode: "bigint" }).notNull(),
  /** When a check last found the books balanced; null if none has. */
  lastBalancedAt: timestamp("last_balanced_at", { withTimezone: true }),
});
