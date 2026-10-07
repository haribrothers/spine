import type { Database } from "../client";
import { accounts, moneyAccounts, type accountTypeEnum } from "../schema";

type AccountType = (typeof accountTypeEnum.enumValues)[number];

interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  isSystem: boolean;
}

/**
 * Default chart of accounts per docs/archive/spine-prd.md §14.2. System accounts
 * (AR, AP, tax, retention, advances, retained earnings) back the posting
 * rules in §7.2 and cannot be deleted by the user — everything else can be
 * renamed or extended.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: readonly SeedAccount[] = [
  { code: "1000", name: "Cash in Hand", type: "asset", isSystem: false },
  { code: "1010", name: "Bank Account", type: "asset", isSystem: false },
  { code: "1100", name: "Accounts Receivable", type: "asset", isSystem: true },
  { code: "1150", name: "Retention Receivable", type: "asset", isSystem: true },
  { code: "1200", name: "Input Tax Receivable", type: "asset", isSystem: true },
  { code: "1300", name: "Prepaid Expenses", type: "asset", isSystem: false },
  { code: "1500", name: "Fixed Assets", type: "asset", isSystem: false },
  { code: "1510", name: "Accumulated Depreciation", type: "asset", isSystem: false },
  { code: "2000", name: "Accounts Payable", type: "liability", isSystem: true },
  { code: "2100", name: "Output Tax Payable", type: "liability", isSystem: true },
  { code: "2200", name: "Customer Advances", type: "liability", isSystem: true },
  { code: "2400", name: "Wages Payable", type: "liability", isSystem: false },
  { code: "2500", name: "Loans Payable", type: "liability", isSystem: false },
  { code: "3000", name: "Owner's Capital", type: "equity", isSystem: false },
  { code: "3100", name: "Owner's Drawings", type: "equity", isSystem: false },
  { code: "3200", name: "Retained Earnings", type: "equity", isSystem: true },
  // US-RPT-16 (D-137): differences in the opening balances sit here.
  { code: "3900", name: "Opening Balance Adjustments", type: "equity", isSystem: true },
  { code: "4000", name: "Sales — Goods", type: "income", isSystem: false },
  { code: "4100", name: "Sales — Services", type: "income", isSystem: false },
  // US-BANK-05 (D-174): the "Interest received" shortcut for money in.
  { code: "4800", name: "Interest Received", type: "income", isSystem: false },
  { code: "4900", name: "Discounts Given", type: "income", isSystem: false },
  { code: "5000", name: "Cost of Materials", type: "expense", isSystem: false },
  { code: "5100", name: "Subcontractor Costs", type: "expense", isSystem: false },
  { code: "5200", name: "Direct Labour", type: "expense", isSystem: false },
  { code: "6000", name: "Rent", type: "expense", isSystem: false },
  { code: "6100", name: "Utilities", type: "expense", isSystem: false },
  { code: "6200", name: "Salaries", type: "expense", isSystem: false },
  { code: "6300", name: "Travel & Vehicle", type: "expense", isSystem: false },
  { code: "6400", name: "Professional Fees", type: "expense", isSystem: false },
  { code: "6500", name: "Depreciation", type: "expense", isSystem: false },
  { code: "6900", name: "Other Expenses", type: "expense", isSystem: false },
];

/** US-BANK-01 (D-140) — 1000 and 1010 are the organisation's first money accounts; 1010 is the default. */
const DEFAULT_MONEY_ACCOUNTS = [
  { code: "1000", kind: "cash", isDefault: false },
  { code: "1010", kind: "bank", isDefault: true },
] as const;

export async function seedChartOfAccounts(db: Database, orgId: string): Promise<void> {
  const rows = await db
    .insert(accounts)
    .values(
      DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
        orgId,
        code: account.code,
        name: account.name,
        type: account.type,
        isSystem: account.isSystem,
      })),
    )
    .returning({ id: accounts.id, code: accounts.code, name: accounts.name });
  const byCode = new Map(rows.map((row) => [row.code, row]));
  await db.insert(moneyAccounts).values(
    DEFAULT_MONEY_ACCOUNTS.map((money) => ({
      orgId,
      accountId: byCode.get(money.code)!.id,
      kind: money.kind,
      name: byCode.get(money.code)!.name,
      isDefault: money.isDefault,
    })),
  );
}
