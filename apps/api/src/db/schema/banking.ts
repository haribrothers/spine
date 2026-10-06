import { pgTable, uuid, text, boolean, timestamp, jsonb, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization } from "./auth";
import { accounts } from "./ledger";

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
