/** Calendar dates as the API sends them ("2026-10-02"), kept in local time so a day never shifts. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** "Oct 2, 2026". */
export function formatDay(iso: string): string {
  return fromIsoDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
