import { calendarDay } from "../../lib/format";
import { t } from "../../lib/i18n";

/** "17 Oct 2026" — the quote's valid-until day, in the business locale. */
export function validUntilLabel(value: string, locale: string): string {
  return calendarDay(value.slice(0, 10)).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/** "6", "2.5" — a line's quantity without trailing zeros. */
export function quantityLabel(quantity: number, locale: string): string {
  return Number(quantity).toLocaleString(locale, { maximumFractionDigits: 4 });
}

/** "10:42 AM" — when the customer signed, by the phone's clock. */
export function timeLabel(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** "Riverstone Builders'" / "Acme's" — for "<Business>'s office is told straight away." */
export function possessive(name: string): string {
  return /s$/i.test(name) ? t("mobileWork.common.possessiveEndingInS", { name }) : t("mobileWork.common.possessive", { name });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** A quote's notes are rich text (HTML from the editor); the phone shows them as plain paragraphs. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, (match, entity: string) => ENTITIES[entity] ?? match)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
