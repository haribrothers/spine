import { isRegisterType, type RegisterType } from "@spine/shared";
import { t } from "../../../lib/i18n";
import { toIsoDate } from "./dates";

export const REGISTER_RANGES = ["this_month", "last_month", "this_quarter", "last_90", "this_year", "custom"] as const;
export type RegisterRange = (typeof REGISTER_RANGES)[number];

export const REGISTER_RANGE_LABELS: Record<RegisterRange, string> = {
  this_month: t("banking.register.ranges.thisMonth"),
  last_month: t("banking.register.ranges.lastMonth"),
  this_quarter: t("banking.register.ranges.thisQuarter"),
  last_90: t("banking.register.ranges.last90"),
  this_year: t("banking.register.ranges.thisYear"),
  custom: t("banking.register.ranges.custom"),
};

/** US-BANK-14 (D-210, D-231) — what an account's register shows, kept in the address. */
export interface RegisterState {
  range: RegisterRange;
  /** Only for a custom range (ISO dates). */
  from: string | null;
  to: string | null;
  type: RegisterType | null;
  unreconciled: boolean;
  q: string;
  page: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** `?range=last_month` (or `range=custom&from=&to=`), `?type=`, `?show=unreconciled`, `?q=`, `?page=`. */
export function parseRegisterState(params: URLSearchParams): RegisterState {
  const range = params.get("range");
  const from = params.get("from");
  const to = params.get("to");
  const type = params.get("type");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const custom = range === "custom" && from && to && ISO.test(from) && ISO.test(to);
  return {
    range: custom ? "custom" : range && (REGISTER_RANGES as readonly string[]).includes(range) && range !== "custom" ? (range as RegisterRange) : "this_month",
    from: custom ? from : null,
    to: custom ? to : null,
    type: type && isRegisterType(type) ? type : null,
    unreconciled: params.get("show") === "unreconciled",
    q: params.get("q") ?? "",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults (this month, every type, all entries) are left out. */
export function registerQuery(state: RegisterState): string {
  const params = new URLSearchParams();
  if (state.range !== "this_month") params.set("range", state.range);
  if (state.range === "custom" && state.from && state.to) {
    params.set("from", state.from);
    params.set("to", state.to);
  }
  if (state.type) params.set("type", state.type);
  if (state.unreconciled) params.set("show", "unreconciled");
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

/** The dates a range covers, as of today. */
export function rangeDates(state: Pick<RegisterState, "range" | "from" | "to">, today: Date): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = toIsoDate;
  switch (state.range) {
    case "last_month":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "this_quarter":
      return { from: iso(new Date(y, m - (m % 3), 1)), to: iso(today) };
    case "last_90":
      return { from: iso(new Date(y, m, today.getDate() - 89)), to: iso(today) };
    case "this_year":
      return { from: iso(new Date(y, 0, 1)), to: iso(today) };
    case "custom":
      return { from: state.from ?? iso(new Date(y, m, 1)), to: state.to ?? iso(today) };
    default:
      return { from: iso(new Date(y, m, 1)), to: iso(today) };
  }
}

/** Where a register row opens its document; money in and out and transfers open the drawer instead (null). */
export function sourceHref(row: { sourceType: string; sourceId: string }): string | null {
  switch (row.sourceType) {
    case "payment":
    case "payment_delete":
      return `/payments/${row.sourceId}`;
    case "vendor_payment":
    case "vendor_payment_delete":
      return `/vendor-payments/${row.sourceId}`;
    case "expense":
      return `/expenses/${row.sourceId}`;
    case "manual_journal":
    case "manual_journal_reversal":
      return `/journals/${row.sourceId}`;
    default:
      return null;
  }
}

/** A money in or out entry or a transfer: it has no page, so it opens the drawer. */
export function opensDrawer(sourceType: string): "bank_transaction" | "bank_transfer" | null {
  if (sourceType === "bank_transaction" || sourceType === "bank_transaction_delete") return "bank_transaction";
  if (sourceType === "bank_transfer" || sourceType === "bank_transfer_delete") return "bank_transfer";
  return null;
}
