import { orgLocaleTag } from "../../../lib/money";

/** Calendar dates as the API sends them ("2026-10-02"), kept in local time so a day never shifts. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** "Oct 2, 2026" — in the business's format (D-231: "2 Oct 2026" in India). */
export function formatDay(iso: string): string {
  return fromIsoDate(iso.slice(0, 10)).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" });
}
