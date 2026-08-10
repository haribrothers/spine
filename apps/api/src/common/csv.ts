/**
 * S-09.7 — "export any report to CSV, so my accountant can work with it."
 * One tiny shared writer rather than a dependency: quoting is RFC 4180
 * (wrap in double quotes and escape `"` as `""` whenever a field contains a
 * comma, quote, or newline), which is all any spreadsheet import needs.
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined): string => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  return lines.join("\r\n");
}
