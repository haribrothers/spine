import type { SupplyClass } from "@spine/shared";
/** Mirrors apps/api/src/db/schema/catalog.ts's row shape — apps/web has no generated SDK yet (packages/sdk is still empty), so this is hand-written to match the API's JSON response shape, following contacts/types.ts's own precedent. */
export interface CatalogItem {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  unit: string;
  category: string | null;
  /** Minor units, serialized as a string over JSON — see MoneyInput's `value: bigint` contract; parse with `BigInt(...)`. */
  defaultPriceAmount: string;
  defaultPriceCurrency: string;
  defaultTaxRatePercentage: number;
  defaultTaxRateId: string | null;
  defaultTaxGroupId: string | null;
  /** US-TAX-13 — the inter-state counterpart of the default tax. */
  interTaxRateId: string | null;
  interTaxGroupId: string | null;
  /** US-TAX-14 — HSN/SAC code, copied to each line. */
  hsnSac: string | null;
  /** US-TAX-11 — copied to each line made from the item. */
  supplyClass: SupplyClass;
  incomeAccountId: string | null;
  expenseAccountId: string | null;
  createdByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** FEAT-08 — used by CatalogForm's tax picker. Mirrors quotes/invoices' identical shapes. */
export interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
  isCompound: boolean;
  /** US-TAX-10 — CGST, SGST, IGST… */
  taxType?: string;
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

/** Mirrors apps/api/src/modules/org/accounts.service.ts's `listGroupedByType` response shape. */
export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export interface Account {
  id: string;
  orgId: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isSystem: boolean;
}

export type AccountsByType = Record<AccountType, Account[]>;
