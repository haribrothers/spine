import { filterRegisterRows, periodLabel, type AccountRegister, type RegisterType } from "@spine/shared";
import type { ReportDocument, ReportRow } from "../reports/export/report-document";

/** "hdfc-current" — the account's name as a filename. */
export function fileSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "account";
}

/**
 * US-BANK-14 (D-231) — the register as a file: the rows on screen (the
 * range, Unreconciled only, the Type and the search), oldest first with the
 * running balance, between the opening and closing balance. A card reads
 * "Paid off", "Spent" and "Owed".
 */
export function registerDocument(register: AccountRegister, filter: { type?: RegisterType; search?: string }): Omit<ReportDocument, "currency"> {
  const card = register.account.kind === "card";
  const rows = filterRegisterRows(register.rows, filter);
  const from = register.from ?? rows[0]?.date ?? null;
  const to = register.to ?? rows[rows.length - 1]?.date ?? null;
  const body: ReportRow[] = [
    { cells: [from, card ? "Owed at the start" : "Opening balance", null, null, null, null, register.openingBalance, null], style: "total" },
    ...rows.map((r): ReportRow => ({ cells: [r.date, r.what, r.contact?.name ?? null, r.reference, r.in === "0" ? null : r.in, r.out === "0" ? null : r.out, r.balance, r.reconciled ? "Reconciled" : null] })),
    { cells: [to, card ? "Owed at the end" : "Closing balance", null, null, null, null, register.closingBalance, null], style: "grand" },
  ];
  return {
    title: register.account.name,
    subtitle: from && to ? periodLabel(from, to) : "Every entry",
    filename: `${fileSlug(register.account.name)}-${from ?? "start"}-${to ?? "today"}`,
    columns: [
      { header: "Date", kind: "text" },
      { header: "What", kind: "text" },
      { header: "Contact", kind: "text" },
      { header: "Reference", kind: "text" },
      { header: card ? "Paid off" : "Money in", kind: "money" },
      { header: card ? "Spent" : "Money out", kind: "money" },
      { header: card ? "Owed" : "Balance", kind: "money" },
      { header: "Reconciled", kind: "text" },
    ],
    rows: body,
  };
}
