import { formatMoney as formatWithLocale } from "@spine/shared";

/**
 * US-OPS-24 (D-089) — every amount in the web app goes through
 * `formatMoney`. The organisation's locale is set once by
 * `MoneyLocaleProvider` (from the server layout) before anything renders,
 * so callers only pass the amount and currency. Spine is one organisation
 * per install, so a module-level locale is safe.
 */
let orgLocale = "en-US";

export function setMoneyLocale(locale: string | null | undefined): void {
  orgLocale = locale || "en-US";
}

export function formatMoney(amount: bigint | string | number, currency: string, locale: string = orgLocale): string {
  return formatWithLocale(amount, currency, locale);
}
