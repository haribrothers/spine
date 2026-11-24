import type { ProfitAndLossComparison } from "@spine/shared";

export interface ReportAccountLine {
  accountId?: string;
  code: string;
  name: string;
  amount: string;
}

export interface ProfitAndLossReport {
  from: string;
  to: string;
  income: ReportAccountLine[];
  expenses: ReportAccountLine[];
  totalIncome: string;
  totalExpenses: string;
  netProfit: string;
  /** US-RPT-27 — with `?compare=`. */
  comparison?: ProfitAndLossComparison;
  /** US-RPT-35 (D-138). */
  basis?: "accrual" | "cash";
  /** On the cash basis: the accrual net profit for the same range. */
  accrualNetProfit?: string;
  /** On the cash basis: payments on documents from before the cutover, which aren't counted. */
  openingExcluded?: { cutoverDate: string; invoices: string; bills: string } | null;
}

export interface BalanceSheetReport {
  asOf: string;
  assets: ReportAccountLine[];
  liabilities: ReportAccountLine[];
  equity: ReportAccountLine[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  /** US-RPT-27 — the same statement on `?compareAsOf=`. */
  comparison?: BalanceSheetReport;
}

export interface AccountDrilldownEntry {
  journalEntryId: string;
  date: string;
  narration: string | null;
  sourceType: string;
  sourceId: string;
  debit: string;
  credit: string;
}

export interface AccountDrilldownReport {
  accountId: string;
  accountCode: string;
  accountName: string;
  from: string;
  to: string;
  entries: AccountDrilldownEntry[];
}

export interface JobProfitabilityRow {
  jobId: string;
  name: string;
  status: string;
  currency: string;
  contractValueAmount: string;
  revenue: string;
  cost: string;
  margin: string;
  marginPct: number | null;
  /** US-RPT-15 — the same figures as the job's Costing tab. */
  billedToDate: string;
  billedPct: number | null;
  costBudget: string | null;
  budgetUsedPct: number | null;
  budgetState: "none" | "ok" | "near" | "over";
}

export interface JobProfitabilityReport {
  jobs: JobProfitabilityRow[];
}

export interface DashboardSummaryReport {
  cashPosition: string;
  totalReceivables: string;
  overdueInvoiceCount: number;
  monthRevenue: string;
}

/** Routes the web client knows how to build a real link for — everything else falls back to the entry's own narration text. */
export const SOURCE_TYPE_ROUTES: Record<string, (sourceId: string) => string> = {
  invoice: (id) => `/invoices/${id}`,
  invoice_void: (id) => `/invoices/${id}`,
  payment: (id) => `/payments/${id}`,
  payment_credit_applied: (id) => `/payments/${id}`,
  payment_delete: (id) => `/payments/${id}`,
  vendor_bill: (id) => `/vendor-bills/${id}`,
  vendor_bill_void: (id) => `/vendor-bills/${id}`,
  vendor_payment: (id) => `/vendor-payments/${id}`,
  vendor_payment_delete: (id) => `/vendor-payments/${id}`,
  expense: (id) => `/expenses/${id}`,
  // US-RPT-20/21
  manual_journal: (id) => `/journals/${id}`,
  manual_journal_reversal: (id) => `/journals/${id}`,
  // US-INV-38 (D-219): credit notes have their own page now.
  credit_note: (id) => `/credit-notes/${id}`,
  credit_note_credit_applied: (id) => `/credit-notes/${id}`,
};

/** US-RPT-13 — `GET /reports/trial-balance`. */
export interface TrialBalanceReport {
  asOf: string;
  lines: { accountId: string; code: string; name: string; debit: string; credit: string }[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

/** US-RPT-14 — `GET /org/tax/summary`. */
export interface TaxSummaryReport {
  from: string;
  to: string;
  taxCollected: string;
  taxPaid: string;
  netTaxPayable: string;
  collectedByRate: { name: string; percentage: number; taxableAmount: string; amount: string }[];
  adjustments: { taxableAmount: string; amount: string } | null;
  totalTaxable: string;
  /** US-RPT-37 */
  paidByRate: { name: string; percentage: number; taxableAmount: string; amount: string }[];
  paidAdjustments: { amount: string } | null;
  totalPaidTaxable: string;
  byTaxType: { rows: { taxType: string; label: string; collected: string; paid: string; net: string }[]; total: { collected: string; paid: string; net: string } };
  bySupplyClass: { supplyClass: "zero_rated" | "exempt" | "non_taxable"; label: string; sales: string; purchases: string }[];
  payments: { paid: string; refunded: string; stillToPay: string };
}
