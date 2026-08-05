import type { Database } from "../client";
import { accounts, type accountTypeEnum } from "../schema";

type AccountType = (typeof accountTypeEnum.enumValues)[number];

interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  isSystem: boolean;
}

/**
 * Default chart of accounts per docs/spine-prd.md §14.2. System accounts
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
  { code: "4000", name: "Sales — Goods", type: "income", isSystem: false },
  { code: "4100", name: "Sales — Services", type: "income", isSystem: false },
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

export async function seedChartOfAccounts(db: Database, orgId: string): Promise<void> {
  await db.insert(accounts).values(
    DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
      orgId,
      code: account.code,
      name: account.name,
      type: account.type,
      isSystem: account.isSystem,
    })),
  );
}
