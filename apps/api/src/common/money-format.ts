import { and, eq } from "drizzle-orm";
import { formatMoney, MINUS_SIGN } from "@spine/shared";
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

/** Characters the PDFs' built-in Helvetica can draw (Windows-1252). */
const PDF_SAFE = new Set(new TextDecoder("windows-1252").decode(Uint8Array.from({ length: 256 }, (_, i) => i)));

/**
 * Money on a PDF (D-123). The PDFs use the built-in Helvetica, which only
 * has Windows-1252 characters, so the minus is an en dash ("–$4,335.00")
 * and a currency whose symbol it lacks prints its code ("INR 1,20,247.50").
 * Otherwise identical to `formatMoney`.
 */
export function formatMoneyForPdf(amount: bigint | string | number, currency: string, locale = "en-US"): string {
  const pdfSafe = (text: string) => text.replace(new RegExp(MINUS_SIGN, "g"), "\u2013").replace(/\u202f/g, "\u00a0");
  const withSymbol = pdfSafe(formatMoney(amount, currency, locale));
  if ([...withSymbol].every((c) => PDF_SAFE.has(c))) return withSymbol;
  return pdfSafe(formatMoney(amount, currency, locale, { currencyDisplay: "code" }));
}
