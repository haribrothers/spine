import { useCachedQuery } from "./use-cached-query";

/** An expense category (`GET /expense-categories`, any member). */
export interface ExpenseCategory {
  id: string;
  name: string;
  archivedAt: string | null;
  /** The posting account's code: "5200" is Direct Labour (D-199 preselects it for labour). */
  accountCode: string | null;
  accountName: string | null;
}

export function useExpenseCategories() {
  return useCachedQuery<ExpenseCategory[]>("expense-categories", "/expense-categories");
}

export const DIRECT_LABOUR_CODE = "5200";

/** Past trades with their last day rate, the caller's own for Field (`GET /expenses/labour-trades`). */
export interface LabourTrade {
  trade: string;
  lastDayRateAmount: string;
}

export function useLabourTrades() {
  return useCachedQuery<LabourTrade[]>("labour-trades", "/expenses/labour-trades");
}
