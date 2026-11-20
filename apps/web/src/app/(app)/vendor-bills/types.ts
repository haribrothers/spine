import type { SupplyClass } from "@spine/shared";
import { t } from "../../../lib/i18n";
/** Mirrors apps/api/src/db/schema/purchases.ts's `vendorBills`/`vendorBillLines` row shapes — apps/web has no generated SDK yet (packages/sdk is still empty), so these are hand-written to match the API's JSON response shape, following invoices/types.ts's own precedent. Every bigint money field is serialized as a string over JSON; parse with `BigInt(...)`, format with `formatMoney` (lib/money.ts). */
export type VendorBillStatus = "draft" | "recorded" | "void";
export type VendorBillLineType = "item" | "heading" | "text";

export interface VendorBillLine {
  id: string;
  billId: string;
  sortOrder: number;
  type: VendorBillLineType;
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: string;
  unitPriceCurrency: string;
  accountId: string | null;
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
  supplyClass: SupplyClass | null;
  hsnSac: string | null;
  lineSubtotalAmount: string;
  lineTaxAmount: string;
  lineTotalAmount: string;
}

export interface VendorBill {
  id: string;
  /** US-OPS-33 — live attachments, on list rows. */
  attachmentCount?: number;
  orgId: string;
  contactId: string;
  /** US-TAX-13 — GST place of supply and the supply type it gave. */
  placeOfSupply: string | null;
  supplyType: "intra" | "inter" | "export" | null;
  contactName: string | null;
  jobId: string | null;
  /** US-PUR-32/34 — the job's name, when tagged to one. */
  jobName?: string | null;
  status: VendorBillStatus;
  /** Vendor-supplied identifier, never system-allocated — see vendorBills' own schema doc comment. */
  billNumber: string;
  /** US-RPT-18 — brought in from the old system: no lines; removed in Opening balances, never voided. */
  isOpening?: boolean;
  date: string;
  dueDate: string | null;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  /** Denormalized running total, kept in sync by VendorPaymentsService on every allocation — never client-computed. */
  amountPaid: string;
  notes: string | null;
  createdByUserId: string | null;
  recordedAt: string | null;
  voidedAt: string | null;
  voidedByUserId: string | null;
  voidReason: string | null;
  journalEntryId: string | null;
  voidJournalEntryId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Computed server-side — totalAmount - amountPaid. */
  balanceDue: string;
  /** US-PUR-25 — vendor credits applied to this bill. */
  creditedAmount?: string;
  creditsApplied?: { id: string; vendorCreditId: string; number: string | null; vendorReference: string | null; amount: string }[];
  lines?: VendorBillLine[];
}

/** Minimal shape used by the vendor-only contact picker — a subset of apps/web/src/app/contacts/types.ts's `Contact`. */
export interface ContactOption {
  id: string;
  name: string;
  archivedAt: string | null;
}

/** Minimal shape used by the catalog-item prefill combobox in the line editor. */
export interface CatalogItemOption {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  defaultPriceAmount: string;
  defaultPriceCurrency: string;
  defaultTaxRatePercentage: number;
  defaultTaxRateId: string | null;
  defaultTaxGroupId: string | null;
  /** US-TAX-13 — the inter-state counterpart of the default tax. */
  interTaxRateId?: string | null;
  interTaxGroupId?: string | null;
  hsnSac?: string | null;
  supplyClass: SupplyClass;
  expenseAccountId: string | null;
  archivedAt: string | null;
}

/** FEAT-08 — used by the line editor's tax picker. Mirrors invoices/types.ts's identical shape. */
export interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
  isCompound: boolean;
  /** D-182 — what a 0% rate means for its lines. */
  supplyClass?: SupplyClass | null;
  archivedAt: string | null;
}

export interface TaxGroupOption {
  id: string;
  name: string;
  archivedAt: string | null;
  taxRates: TaxRateOption[];
}

/** Mirrors apps/api/src/modules/org/accounts.service.ts's `listGroupedByType` response shape — used by the line editor's Expense/COGS account picker. */
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

/** Minimal shape used by the optional job picker in the builder. */
export interface JobOption {
  id: string;
  name: string;
  status: string;
}

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "upi" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: t("vendorBills.methods.cash"),
  bank_transfer: t("vendorBills.methods.bankTransfer"),
  cheque: t("vendorBills.methods.cheque"),
  card: t("vendorBills.methods.card"),
  upi: t("vendorBills.methods.upi"),
  other: t("vendorBills.methods.other"),
};

/** Mirrors GET /vendor-payments?billId=:id's response shape (VendorPaymentsService.listForBill) — a vendor payment row plus how much of it was allocated specifically to this bill, since one payment can span several bills (S-07.8). */
export interface BillVendorPaymentRow {
  id: string;
  number: string | null;
  date: string;
  method: PaymentMethod;
  reference: string | null;
  currency: string;
  amount: string;
  allocatedAmount: string;
  /** This payment's allocation specifically against the bill being viewed — not the payment's own total. */
  allocatedToThisBill: string;
}
