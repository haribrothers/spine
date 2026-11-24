"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../../../lib/api-client";

/** Null until the organisation's currency is known. */
const CurrencyContext = createContext<string | null>(null);

/**
 * US-DASH-27 (D-209) — the organisation's currency, read once for the whole
 * dashboard. Cards wait for it (showing their placeholder), so money is in
 * the right currency from the first frame: never "$" before "₹".
 */
export function DashboardCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<string | null>(null);
  useEffect(() => {
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code || "USD"))
      .catch(() => setCurrency("USD"));
  }, []);
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useDashboardCurrency(): string | null {
  return useContext(CurrencyContext);
}
