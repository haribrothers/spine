import { and, eq } from "drizzle-orm";
import { formatMoney } from "@spine/shared";
import type { Database } from "../db/client";
import { settings } from "../db/schema";

/** US-OPS-24 — the organisation's locale from Settings › Currency & locale; "en-US" when unset. */
export async function orgLocale(db: Database, orgId: string): Promise<string> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
  return (row?.value as { locale?: string } | undefined)?.locale || "en-US";
}

/** The organisation's currency and locale from Settings › Currency & locale (USD, "en-US" when unset), for amounts in messages. */
export async function orgMoneySettings(db: Database, orgId: string): Promise<{ currency: string; locale: string }> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
  const value = row?.value as { code?: string; locale?: string } | undefined;
  return { currency: value?.code || "USD", locale: value?.locale || "en-US" };
}

/**
 * Money on a PDF. The PDFs print in the bundled Noto fonts (D-151, which
 * replaced D-123's Helvetica), so this is `formatMoney` exactly: the
 * currency's own symbol ("₹1,20,247.50") and a true minus sign.
 */
export function formatMoneyForPdf(amount: bigint | string | number, currency: string, locale = "en-US"): string {
  return formatMoney(amount, currency, locale);
}

/** "Oct 4, 2026" in the organisation's locale, for messages (from a `YYYY-MM-DD` date). */
export function formatMessageDate(date: string, locale: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
