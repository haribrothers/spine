import { describe, expect, it } from "vitest";
import { filterQuotes, hasQuoteFilters, matchesQuoteSearch, parseQuotesState, quoteContacts, quotesQuery } from "../app/(app)/quotes/quotes-list-state";
import { quote } from "./quote-fixtures";

const now = new Date(2026, 9, 10, 12);

describe("US-QUO-28 · the quotes list in the address", () => {
  it("reads and writes search, status, contact, card, sort and page, leaving out the defaults", () => {
    const query = "q=villa&status=sent&status=expired&contact=c1&card=expiring&sort=total.desc&page=2";
    const state = parseQuotesState(new URLSearchParams(query));
    expect(state).toEqual({ q: "villa", status: ["sent", "expired"], contact: "c1", card: "expiring", sort: { key: "total", direction: "desc" }, page: 2 });
    expect(quotesQuery(state)).toBe(query);
    expect(quotesQuery(parseQuotesState(new URLSearchParams("")))).toBe("");
    // The dashboard's "Quotes won this month" link.
    expect(parseQuotesState(new URLSearchParams("status=accepted")).status).toEqual(["accepted"]);
    expect(parseQuotesState(new URLSearchParams("card=nope&status=bogus")).card).toBe("");
    expect(hasQuoteFilters(parseQuotesState(new URLSearchParams("sort=total.asc")))).toBe(false);
  });

  it("searches number, title, contact and line names", () => {
    const q = quote({ number: "QUO-0046", title: "Bathroom refit", contactName: "Ananya Rao", lineNames: ["Floor & wall tiling"] });
    for (const term of ["0046", "bathroom", "ANANYA", "tiling"]) expect(matchesQuoteSearch(q, term)).toBe(true);
    expect(matchesQuoteSearch(q, "kitchen")).toBe(false);
  });

  it("filters by the newest version and keeps every version of a quote that matches, and lists only contacts with a quote", () => {
    const quotes = [
      quote({ id: "a1", rootQuoteId: "a", status: "rejected", version: 1, isSuperseded: true }),
      quote({ id: "a2", rootQuoteId: "a", status: "sent", version: 2, validUntil: "2026-10-12" }),
      quote({ id: "b", status: "draft", contactId: "c2", contactName: "Halcyon Tech Parks" }),
    ];
    const base = parseQuotesState(new URLSearchParams(""));
    expect(filterQuotes(quotes, { ...base, card: "expiring" }, now).map((q) => q.id)).toEqual(["a1", "a2"]);
    expect(filterQuotes(quotes, { ...base, status: ["rejected"] }, now)).toEqual([]);
    expect(filterQuotes(quotes, { ...base, contact: "c2" }, now).map((q) => q.id)).toEqual(["b"]);
    expect(quoteContacts(quotes)).toEqual([
      { value: "c1", label: "Ananya Rao" },
      { value: "c2", label: "Halcyon Tech Parks" },
    ]);
  });
});
