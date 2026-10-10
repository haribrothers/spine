import type { Contact, ContactType } from "./types";

/** US-CRM-23 (D-210) — what the contacts list shows, kept in the address. */
export interface ContactsListState {
  types: ContactType[];
  /** "active" and/or "archived"; empty means active only. */
  status: string[];
  q: string;
  page: number;
}

const TYPES: ContactType[] = ["customer", "vendor", "both"];
const DEFAULT_STATUS = ["active"];

/** A stat card's type filter: customers and vendors both include "Customer & vendor". */
export const STAT_TYPES = {
  customers: ["customer", "both"] as ContactType[],
  vendors: ["vendor", "both"] as ContactType[],
};

export function parseListState(params: URLSearchParams): ContactsListState {
  const types = params.getAll("type").filter((t): t is ContactType => (TYPES as string[]).includes(t));
  const status = params.getAll("status").filter((s) => s === "active" || s === "archived");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return { types, status: status.length > 0 ? status : DEFAULT_STATUS, q: params.get("q") ?? "", page: Number.isFinite(page) && page > 1 ? page : 1 };
}

/** The query string for a state; defaults are left out (`/contacts` is the plain active list). */
export function listStateQuery(state: ContactsListState): string {
  const params = new URLSearchParams();
  for (const t of state.types) params.append("type", t);
  const isDefaultStatus = state.status.length === 1 && state.status[0] === "active";
  if (!isDefaultStatus) for (const s of state.status) params.append("status", s);
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

/** Any filter other than the plain active list (search aside). */
export function hasFilters(state: ContactsListState): boolean {
  return state.types.length > 0 || !(state.status.length === 1 && state.status[0] === "active");
}

/** Name, email or phone contain the search text (case-insensitive). */
export function matchesSearch(contact: Contact, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [contact.name, contact.email ?? "", contact.phone ?? ""].some((field) => field.toLowerCase().includes(needle));
}

/** The contacts the list shows: by type, status (active and/or archived) and search. */
export function filterContacts(all: Contact[], state: ContactsListState): Contact[] {
  const showActive = state.status.length === 0 || state.status.includes("active");
  const showArchived = state.status.includes("archived");
  return all.filter(
    (c) =>
      (state.types.length === 0 || state.types.includes(c.type)) &&
      (c.archivedAt ? showArchived : showActive) &&
      matchesSearch(c, state.q),
  );
}

/** Whether the type filter is exactly a stat card's set (it shows as pressed). */
export function isTypeSet(types: ContactType[], set: ContactType[]): boolean {
  return types.length === set.length && set.every((t) => types.includes(t));
}

/** US-CRM-22 — "Updated just now", "Updated 2 min ago", "Updated 3 h ago". */
export function updatedLabel(updatedAt: number, now: number): string {
  const minutes = Math.floor((now - updatedAt) / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  return `Updated ${Math.floor(minutes / 60)} h ago`;
}

/** A refresh when the tab is shown again needs this long away (D-210). */
export const REFRESH_ON_RETURN_MS = 30_000;
