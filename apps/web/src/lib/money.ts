import { formatMoney as formatWithLocale, formatMoneyCompact as formatCompactWithLocale } from "@spine/shared";

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

/** US-QUO-29 — the organisation's locale, for dates shown beside money ("12 Oct" vs "Oct 12"). */
export function orgLocaleTag(): string {
  return orgLocale;
}

export function formatMoney(amount: bigint | string | number, currency: string, locale: string = orgLocale): string {
  return formatWithLocale(amount, currency, locale);
}

/** US-DASH-28 — the short form ("₹44.9L") for the aging ring's centre only. */
export function formatMoneyCompact(amount: bigint | string | number, currency: string, locale: string = orgLocale): string {
  return formatCompactWithLocale(amount, currency, locale);
}
