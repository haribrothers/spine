import { z } from "zod";

/**
 * US-RPT-39 (D-149) — Tally's predefined groups, the ones a ledger can sit
 * under in TallyPrime and Tally.ERP 9. Customers always go under Sundry
 * Debtors and vendors under Sundry Creditors.
 */
export const TALLY_GROUPS = [
  "Bank Accounts",
  "Bank OD A/c",
  "Capital Account",
  "Cash-in-Hand",
  "Current Assets",
  "Current Liabilities",
  "Deposits (Asset)",
  "Direct Expenses",
  "Direct Incomes",
  "Duties & Taxes",
  "Fixed Assets",
  "Indirect Expenses",
  "Indirect Incomes",
  "Investments",
  "Loans & Advances (Asset)",
  "Loans (Liability)",
  "Misc. Expenses (ASSET)",
  "Provisions",
  "Purchase Accounts",
  "Reserves & Surplus",
  "Sales Accounts",
  "Secured Loans",
  "Stock-in-Hand",
  "Sundry Creditors",
  "Sundry Debtors",
  "Suspense A/c",
  "Unsecured Loans",
] as const;
export type TallyGroup = (typeof TALLY_GROUPS)[number];

export const TALLY_GROUP_MESSAGE = "Choose one of Tally's groups.";

/** The account as the default rule reads it; `moneyAccountKind` when it's a bank, cash or card account (US-BANK-01). */
export interface TallyMappableAccount {
  code: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  moneyAccountKind?: "bank" | "cash" | "card" | null;
}

/**
 * The group an account lands in until someone changes it: by money-account
 * kind, then by code (Spine's chart, `chart-of-accounts.ts`), then by type.
 */
export function defaultTallyGroup(account: TallyMappableAccount): TallyGroup {
  if (account.moneyAccountKind === "bank") return "Bank Accounts";
  if (account.moneyAccountKind === "cash") return "Cash-in-Hand";
  if (account.moneyAccountKind === "card") return "Bank OD A/c";
  const code = Number(account.code);
  const byCode: Record<string, TallyGroup> = {
    "1000": "Cash-in-Hand",
    "1100": "Sundry Debtors",
    "1200": "Duties & Taxes",
    "1300": "Loans & Advances (Asset)",
    "2000": "Sundry Creditors",
    "2100": "Duties & Taxes",
    "2500": "Loans (Liability)",
    "3200": "Reserves & Surplus",
  };
  if (byCode[account.code]) return byCode[account.code]!;
  switch (account.type) {
    case "asset":
      return code >= 1500 && code < 1600 ? "Fixed Assets" : "Current Assets";
    case "liability":
      return "Current Liabilities";
    case "equity":
      return "Capital Account";
    case "income":
      return code >= 4000 && code < 4800 ? "Sales Accounts" : "Indirect Incomes";
    case "expense":
      return code >= 5000 && code < 6000 ? "Direct Expenses" : "Indirect Expenses";
  }
}

/** One account's row on "Account mapping". */
export interface TallyMappingRow {
  accountId: string;
  code: string;
  name: string;
  type: TallyMappableAccount["type"];
  tallyGroup: TallyGroup;
  /** Still on the default for its type and code: nobody has saved a group for it. */
  isDefault: boolean;
}

/** `PUT /exports/tally/mapping`: the groups to keep, merged into what's saved. */
export const putTallyMappingSchema = z.object({
  mappings: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        tallyGroup: z.enum(TALLY_GROUPS, { message: TALLY_GROUP_MESSAGE }),
      }),
    )
    .max(1000),
});
export type PutTallyMapping = z.infer<typeof putTallyMappingSchema>;
