import { describe, expect, it } from "vitest";
import { STAT_TYPES, filterContacts, hasFilters, isTypeSet, listStateQuery, parseListState } from "../app/(app)/contacts/contacts-list-state";
import type { Contact } from "../app/(app)/contacts/types";

const contact = (over: Partial<Contact>): Contact => ({ id: over.name ?? "x", name: "x", type: "customer", email: null, phone: null, archivedAt: null, ...over }) as Contact;

const all = [
  contact({ name: "Apex Building Materials", type: "vendor", email: "sales@apex.example" }),
  contact({ name: "H2Z Facades", type: "both", phone: "+91 98450 12345" }),
  contact({ name: "Ananya Rao", type: "customer", email: "ananya@example.com" }),
  contact({ name: "Old Steel Co", type: "vendor", archivedAt: "2026-09-01T00:00:00Z" }),
];

describe("US-CRM-23 · the contacts list in the address", () => {
  it("reads type, status, search and page, and writes back only what isn't the default", () => {
    const state = parseListState(new URLSearchParams("type=vendor&type=both&status=active&status=archived&q=steel&page=2"));
    expect(state).toEqual({ types: ["vendor", "both"], status: ["active", "archived"], q: "steel", page: 2 });
    expect(listStateQuery(state)).toBe("type=vendor&type=both&status=active&status=archived&q=steel&page=2");
    expect(listStateQuery(parseListState(new URLSearchParams("")))).toBe("");
    expect(parseListState(new URLSearchParams("type=nonsense&page=-3"))).toEqual({ types: [], status: ["active"], q: "", page: 1 });
  });

  it("searches name, email and phone in every view, case-insensitive", () => {
    const base = parseListState(new URLSearchParams(""));
    expect(filterContacts(all, { ...base, q: "APEX" }).map((c) => c.name)).toEqual(["Apex Building Materials"]);
    expect(filterContacts(all, { ...base, q: "ananya@" }).map((c) => c.name)).toEqual(["Ananya Rao"]);
    expect(filterContacts(all, { ...base, q: "98450" }).map((c) => c.name)).toEqual(["H2Z Facades"]);
  });

  it("filters by type and status; active only by default", () => {
    const base = parseListState(new URLSearchParams(""));
    expect(filterContacts(all, base)).toHaveLength(3);
    expect(filterContacts(all, { ...base, types: STAT_TYPES.vendors }).map((c) => c.name)).toEqual(["Apex Building Materials", "H2Z Facades"]);
    expect(filterContacts(all, { ...base, status: ["archived"] }).map((c) => c.name)).toEqual(["Old Steel Co"]);
    expect(filterContacts(all, { ...base, status: ["active", "archived"] })).toHaveLength(4);
    expect(hasFilters(base)).toBe(false);
    expect(hasFilters({ ...base, types: ["vendor"] })).toBe(true);
  });

  it("shows a stat card as pressed only when the type filter is exactly its set", () => {
    expect(isTypeSet(["both", "customer"], STAT_TYPES.customers)).toBe(true);
    expect(isTypeSet(["customer"], STAT_TYPES.customers)).toBe(false);
    expect(STAT_TYPES.vendors).toEqual(["vendor", "both"]);
  });
});
