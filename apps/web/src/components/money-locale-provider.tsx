"use client";

import { setMoneyLocale } from "../lib/money";

/** Sets the organisation's locale for `formatMoney` during render, before its children format anything. */
export function MoneyLocaleProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  setMoneyLocale(locale);
  return <>{children}</>;
}
