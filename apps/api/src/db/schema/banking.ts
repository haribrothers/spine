import { type AnyPgColumn, pgTable, uuid, text, boolean, bigint, date, timestamp, jsonb, pgEnum, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { accounts, journalEntries, journalLines } from "./ledger";
import { contacts } from "./contacts";
import { taxGroups, taxRates } from "./tax";

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

export const bankTransactionDirectionEnum = pgEnum("bank_transaction_direction", ["in", "out"]);

/**
 * US-BANK-05 — money in or out that no invoice, bill or payment covers:
 * owner capital and drawings, loans, interest, bank charges. Posts P22
 * against the chosen category account (never a control account). `amount`
 * is what moved through the money account; on money out it includes
 * `tax_amount`, which goes to 1200 Input Tax Receivable.
 */
export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    moneyAccountId: uuid("money_account_id")
      .notNull()
      .references(() => moneyAccounts.id),
    direction: bankTransactionDirectionEnum("direction").notNull(),
    /** The category: the other side of the entry. */
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    contactId: uuid("contact_id").references(() => contacts.id),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    taxGroupId: uuid("tax_group_id").references(() => taxGroups.id, { onDelete: "set null" }),
    taxAmount: bigint("tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    date: date("date").notNull(),
    description: text("description"),
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
    check("bank_transactions_positive_amount", sql`${table.amount} > 0`),
    check("bank_transactions_tax_within_amount", sql`${table.taxAmount} >= 0 AND ${table.taxAmount} < ${table.amount}`),
    index("bank_transactions_org_date_idx").on(table.orgId, table.date),
  ],
);

export const statementLineStatusEnum = pgEnum("statement_line_status", ["unmatched", "matched", "excluded"]);

/** US-BANK-07 (D-157) — one CSV statement imported to a money account. The file itself isn't kept. */
export const bankStatementImports = pgTable(
  "bank_statement_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    moneyAccountId: uuid("money_account_id")
      .notNull()
      .references(() => moneyAccounts.id),
    fileName: text("file_name").notNull(),
    importedCount: bigint("imported_count", { mode: "number" }).notNull(),
    skippedCount: bigint("skipped_count", { mode: "number" }).notNull(),
    failedRows: jsonb("failed_rows").notNull().default(sql`'[]'::jsonb`),
    importedByUserId: text("imported_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bank_statement_imports_account_idx").on(table.moneyAccountId)],
);

/**
 * US-BANK-07 — one line of a bank statement. `amount` is signed in the
 * account's own sense (money in > 0, like a debit). `dedupe_key` (date +
 * amount + normalised description) is unique per account, so importing an
 * overlapping statement skips lines already there.
 */
export const bankStatementLines = pgTable(
  "bank_statement_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    moneyAccountId: uuid("money_account_id")
      .notNull()
      .references(() => moneyAccounts.id),
    importId: uuid("import_id")
      .notNull()
      .references(() => bankStatementImports.id),
    date: date("date").notNull(),
    description: text("description").notNull(),
    reference: text("reference"),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    runningBalance: bigint("running_balance", { mode: "bigint" }),
    dedupeKey: text("dedupe_key").notNull(),
    /** The line's row in its file, so lines on the same day keep the statement's order. */
    rowNumber: bigint("row_number", { mode: "number" }).notNull().default(0),
    status: statementLineStatusEnum("status").notNull().default("unmatched"),
    excludeNote: text("exclude_note"),
    /** US-BANK-08 — the reconciliation that matched or excluded it. */
    reconciliationId: uuid("reconciliation_id").references((): AnyPgColumn => bankReconciliations.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("bank_statement_lines_dedupe_uidx").on(table.moneyAccountId, table.dedupeKey),
    index("bank_statement_lines_account_date_idx").on(table.moneyAccountId, table.date),
  ],
);

export const reconciliationStatusEnum = pgEnum("reconciliation_status", ["in_progress", "finished", "undone"]);

/**
 * US-BANK-08–US-BANK-11 (D-158, D-176) — one reconciliation of a money
 * account to a statement's end date and closing balance. At most one is in
 * progress per account. `opening_balance` and `brought_forward_before` are
 * fixed when it finishes: the first reconciliation brings forward Spine's
 * balance before its earliest statement line.
 */
export const bankReconciliations = pgTable(
  "bank_reconciliations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    moneyAccountId: uuid("money_account_id")
      .notNull()
      .references(() => moneyAccounts.id),
    statementEndDate: date("statement_end_date").notNull(),
    statementClosingBalance: bigint("statement_closing_balance", { mode: "bigint" }).notNull(),
    status: reconciliationStatusEnum("status").notNull().default("in_progress"),
    openingBalance: bigint("opening_balance", { mode: "bigint" }),
    broughtForwardBefore: date("brought_forward_before"),
    startedByUserId: text("started_by_user_id").references(() => user.id, { onDelete: "set null" }),
    finishedByUserId: text("finished_by_user_id").references(() => user.id, { onDelete: "set null" }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    undoneByUserId: text("undone_by_user_id").references(() => user.id, { onDelete: "set null" }),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("bank_reconciliations_one_in_progress_uidx").on(table.moneyAccountId).where(sql`${table.status} = 'in_progress'`),
    index("bank_reconciliations_account_idx").on(table.moneyAccountId, table.statementEndDate),
  ],
);

/** US-BANK-08 — a statement line matched to one or more journal lines on the account; a journal line matches at most one statement line. */
export const bankStatementLineMatches = pgTable(
  "bank_statement_line_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    statementLineId: uuid("statement_line_id")
      .notNull()
      .references(() => bankStatementLines.id, { onDelete: "cascade" }),
    journalLineId: uuid("journal_line_id")
      .notNull()
      .references(() => journalLines.id),
    reconciliationId: uuid("reconciliation_id")
      .notNull()
      .references(() => bankReconciliations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("bank_statement_line_matches_journal_line_uidx").on(table.journalLineId), index("bank_statement_line_matches_line_idx").on(table.statementLineId)],
);
