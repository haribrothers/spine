import { pgTable, uuid, text, boolean, bigint, date, timestamp, jsonb, pgEnum, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { accounts, journalEntries } from "./ledger";

export const moneyAccountKindEnum = pgEnum("money_account_kind", ["bank", "cash", "card"]);

/**
 * US-BANK-01 (D-140) — a bank account, cash box or business card. Each one
 * owns exactly one ledger account (bank and cash: asset, 1010–1099; card:
 * liability, 2300–2399); its balance is that account's journal lines, never
 * a stored figure. Exactly one per organisation is the default for new
 * payments (I13).
 */
export const moneyAccounts = pgTable(
  "money_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    kind: moneyAccountKindEnum("kind").notNull(),
    name: text("name").notNull(),
    bankName: text("bank_name"),
    last4: text("last4"),
    isDefault: boolean("is_default").notNull().default(false),
    /** D-157 — the CSV column mapping saved by the last statement import. */
    statementMapping: jsonb("statement_mapping"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("money_accounts_account_uidx").on(table.accountId),
    uniqueIndex("money_accounts_default_uidx").on(table.orgId).where(sql`${table.isDefault}`),
    uniqueIndex("money_accounts_active_name_uidx").on(table.orgId, sql`lower(${table.name})`).where(sql`${table.archivedAt} IS NULL`),
    index("money_accounts_org_idx").on(table.orgId),
  ],
);

/**
 * US-BANK-04 — money moved between two of the organisation's own accounts
 * (a deposit, a top-up, paying off a card). Posts P22: Dr the destination,
 * Cr the source. Deleting one posts a reversing entry and keeps the row.
 * References are NO ACTION, so deleting a whole organisation still cascades.
 */
export const bankTransfers = pgTable(
  "bank_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    fromMoneyAccountId: uuid("from_money_account_id")
      .notNull()
      .references(() => moneyAccounts.id),
    toMoneyAccountId: uuid("to_money_account_id")
      .notNull()
      .references(() => moneyAccounts.id),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    date: date("date").notNull(),
    reference: text("reference"),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id),
    reversalEntryId: uuid("reversal_entry_id").references(() => journalEntries.id),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("bank_transfers_different_accounts", sql`${table.fromMoneyAccountId} <> ${table.toMoneyAccountId}`),
    check("bank_transfers_positive_amount", sql`${table.amount} > 0`),
    index("bank_transfers_org_date_idx").on(table.orgId, table.date),
  ],
);
