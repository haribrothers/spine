/** Mirrors apps/api/src/db/schema/purchases.ts's `expenses`/`expenseCategories` row shapes — hand-written to match the API's JSON response, following vendor-bills/types.ts's own precedent. Every bigint money field is serialized as a string over JSON; parse with `BigInt(...)`, format with `formatMoney` (lib/money.ts). */
export type ExpenseStatus = "submitted" | "approved" | "rejected";
export type ExpensePaidBy = "company" | "employee";

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export const EXPENSE_PAID_BY_LABELS: Record<ExpensePaidBy, string> = {
  company: "Company",
  employee: "Employee (reimbursable)",
};

export interface Expense {
  id: string;
  orgId: string;
  /** Gapless, permanent — allocated at approval time via NumberingService's "expense" document type. Null while submitted/rejected. */
  number: string | null;
  categoryId: string;
  categoryName: string | null;
  jobId: string | null;
  date: string;
  currency: string;
  amount: string;
  taxAmount: string;
  taxRateId: string | null;
  description: string | null;
  paidBy: ExpensePaidBy;
  /** US-BANK-03 — the account it was (or will be) paid from. */
  moneyAccountId: string | null;
  moneyAccount?: { id: string; name: string } | null;
  receiptFileId: string | null;
  status: ExpenseStatus;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  rejectedByUserId: string | null;
  rejectedAt: string | null;
  /** Required on reject, optional on approve. Null while submitted. */
  reviewComment: string | null;
  isBillable: boolean;
  billedOnInvoiceLineId: string | null;
  journalEntryId: string | null;
  createdAt: string;
  updatedAt: string;
  /** US-PUR-23 — "labour" when entered as headcount × day rate. */
  entryMode?: "amount" | "labour";
  labourLines?: { id: string; trade: string; headcount: number; dayRateAmount: string; lineAmount: string }[];
}

export interface ExpenseCategory {
  id: string;
  orgId: string;
  name: string;
  accountId: string | null;
  /** US-PUR-23 — the posting account, e.g. "5200" / "Direct Labour". */
  accountCode?: string | null;
  accountName?: string | null;
  createdByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Minimal shape used by the job picker. */
export interface JobOption {
  id: string;
  name: string;
  status: string;
}

/** FEAT-08 — used by the expense form's single tax-rate picker (an expense has ONE tax rate, not a per-line breakdown like a vendor bill/invoice). */
export interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
  isCompound: boolean;
  archivedAt: string | null;
}

/** Mirrors apps/api/src/modules/org/accounts.service.ts's `listGroupedByType` response shape — used by the category-management dialog's account picker. */
export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export interface AccountOption {
  id: string;
  orgId: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isSystem: boolean;
}

export type AccountsByType = Record<AccountType, AccountOption[]>;

/** Mirrors contacts/types.ts's identical shape — the response of `apiClient.upload("/files", file)`. */
export interface SpineFile {
  id: string;
  orgId: string;
  key: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string | null;
  createdAt: string;
}
