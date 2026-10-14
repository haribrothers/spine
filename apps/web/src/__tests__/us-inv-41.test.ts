import { describe, expect, it } from "vitest";
import { creditNotesQuery, filterCreditNotes, hasCreditNoteFilters, matchesCreditNoteSearch, parseCreditNotesState } from "../app/(app)/credit-notes/credit-notes-list-state";
import { creditNote } from "./credit-note-fixtures";

describe("US-INV-41 · search, filter and come back to the same credit notes list", () => {
  it("keeps the search, where it went, contact, card, sort and page in the address, leaving defaults out", () => {
    const state = parseCreditNotesState(new URLSearchParams("q=canopy&where=left&where=refunded&contact=c1&card=left&sort=total.desc&page=2"));
    expect(state).toEqual({ q: "canopy", where: ["left", "refunded"], contact: "c1", card: "left", sort: { key: "total", direction: "desc" }, page: 2 });
    expect(parseCreditNotesState(new URLSearchParams(creditNotesQuery(state)))).toEqual(state);
    expect(creditNotesQuery(parseCreditNotesState(new URLSearchParams("where=nope&card=nope")))).toBe("");
    expect(hasCreditNoteFilters(parseCreditNotesState(new URLSearchParams("sort=total.desc")))).toBe(false);
  });

  it("matches the number, customer, invoice, reason or a line's name", () => {
    const note = creditNote({ number: "CRN-0007", reason: "Canopy reduced", lineNames: ["Loading bay canopy"] });
    for (const q of ["crn-0007", "sahyadri", "inv-0041", "reduced", "LOADING"]) expect(matchesCreditNoteSearch(note, q)).toBe(true);
    expect(matchesCreditNoteSearch(note, "roofing")).toBe(false);
  });

  it("filters by where it went, the Credit to use card and contact together", () => {
    const list = [creditNote({ number: "A" }), creditNote({ number: "B", creditRemainingAmount: "100" }), creditNote({ number: "C", contactId: "c2", creditRemainingAmount: "100" })];
    expect(filterCreditNotes(list, parseCreditNotesState(new URLSearchParams("card=left"))).map((n) => n.number)).toEqual(["B", "C"]);
    expect(filterCreditNotes(list, parseCreditNotesState(new URLSearchParams("where=left&contact=c1"))).map((n) => n.number)).toEqual(["B"]);
    expect(filterCreditNotes(list, parseCreditNotesState(new URLSearchParams("where=off"))).map((n) => n.number)).toEqual(["A", "B", "C"]);
  });
});
