import { describe, expect, it } from "vitest";
import type { ReconciliationEntry, StatementLine } from "@spine/shared";
import { liveAiSuggestions } from "../../banking/reconciliations.service";
import { bankPrompt, candidatesFor, suggestionsFrom, unsettledLines } from "./bank-suggestions.service";

const line = (id: string, date: string, amount: string, description: string, status: StatementLine["status"] = "unmatched"): StatementLine => ({ id, date, description, reference: null, amount, runningBalance: null, status, excludeNote: null, fileName: "oct.csv" });
const entry = (journalLineId: string, date: string, amount: string, what: string, contact?: string): ReconciliationEntry => ({
  journalLineId,
  date,
  sourceType: "payment",
  sourceId: journalLineId,
  what,
  contact: contact ? { id: `c-${contact}`, name: contact } : null,
  reference: null,
  amount,
  statementLineId: null,
});

const view = {
  statementLines: [
    line("l-maple", "2026-10-07", "2360000", "UPI CR 98450XXXXX MAPLE RIDGE KITCHEN"),
    line("l-ruled", "2026-10-01", "-216000", "CHQ 214 COASTAL TIMBER"),
    line("l-fee", "2026-10-12", "-59000", "SMS ALERT CHGS 9988776655"),
    line("l-done", "2026-10-02", "100", "DONE", "matched"),
  ],
  suggestions: [{ statementLineId: "l-ruled", journalLineId: "j-timber" }],
  entries: [
    entry("j-rao", "2026-10-02", "2360000", "Payment PAY-0036", "Rao Constructions"),
    entry("j-ananya", "2026-10-07", "2360000", "Payment PAY-0040", "Ananya Rao"),
    entry("j-timber", "2026-10-01", "-216000", "Vendor payment VPY-0011", "Coastal Timber"),
    entry("j-far", "2026-08-01", "500", "Money in — Interest"),
  ],
};
const categories = [{ ref: "A1", id: "acc-bank-charges", name: "Bank charges", type: "expense" }];
const contactRefs = [
  { ref: "C1", id: "c-hdfc", name: "HDFC Bank", type: "vendor" },
  { ref: "C2", id: "c-maple", name: "Maple Ridge Developments", type: "customer" },
];

describe("US-AI-14 · AI's suggestions while reconciling (D-173)", () => {
  it("looks only at lines nobody has settled — not matched, not suggested by the rules", () => {
    expect(unsettledLines(view).map((l) => l.id)).toEqual(["l-maple", "l-fee"]);
  });

  it("offers each line its likeliest entries — same amount first, then the nearest dates — never one the rules gave another line", () => {
    const [maple, fee] = candidatesFor(unsettledLines(view), view);
    expect(maple!.entries.map((e) => e.entry.journalLineId)).toEqual(["j-ananya", "j-rao", "j-far"]);
    // Nothing has the fee's amount: by date gap — 5, 10 and 72 days.
    expect(fee!.entries.map((e) => e.entry.journalLineId)).toEqual(["j-ananya", "j-rao", "j-far"]);
    expect(maple!.entries.some((e) => e.entry.journalLineId === "j-timber")).toBe(false);
  });

  it("keeps a match only when its first entry has the line's amount, and only the line's own entries", () => {
    const lines = candidatesFor(unsettledLines(view), view);
    const ref = (id: string) => lines[0]!.entries.find((e) => e.entry.journalLineId === id)!.ref;
    const reply = JSON.stringify({
      suggestions: [
        { line: "L1", entries: [ref("j-ananya"), ref("j-rao"), "E99"], reason: "same amount; the description mentions Maple Ridge" },
        { line: "L2", entries: [ref("j-far")], reason: "interest", create: null },
      ],
    });
    expect(suggestionsFrom(reply, lines, categories, contactRefs)).toEqual([
      { statementLineId: "l-maple", rankedJournalLineIds: ["j-ananya", "j-rao"], reason: "same amount; the description mentions Maple Ridge", create: null },
    ]);
  });

  it("a create needs a category for money in/out, and a kind and contact that fit the direction", () => {
    const lines = candidatesFor(unsettledLines(view), view);
    const ask = (create: object) => suggestionsFrom(JSON.stringify({ suggestions: [{ line: "L2", entries: [], reason: "x", create: { reason: "like the bank charges in August", ...create } }] }), lines, categories, contactRefs);
    expect(ask({ kind: "money", account: "A1", contact: "C1" })).toEqual([
      { statementLineId: "l-fee", rankedJournalLineIds: [], reason: "like the bank charges in August", create: { kind: "money", accountId: "acc-bank-charges", accountName: "Bank charges", contactId: "c-hdfc", contactName: "HDFC Bank", reason: "like the bank charges in August" } },
    ]);
    expect(ask({ kind: "money", account: null })).toEqual([]);
    // Money out can't be a customer payment, nor a vendor payment to a customer.
    expect(ask({ kind: "payment", contact: "C2" })).toEqual([]);
    expect(ask({ kind: "vendor_payment", contact: "C2" })).toEqual([]);
    expect(ask({ kind: "vendor_payment", contact: "C1" })[0]!.create).toMatchObject({ kind: "vendor_payment", contactId: "c-hdfc", accountId: null });
  });

  it("the prompt has dates, signed amounts, descriptions and entries — redacted (D-165)", () => {
    const text = bankPrompt(candidatesFor(unsettledLines(view), view), [{ description: "SMS ALERT CHGS", direction: "out", account: "Bank charges", contact: "HDFC Bank" }], categories, contactRefs);
    expect(text).toContain("L1 · 2026-10-07 · +23,600.00 · UPI CR 98450XXXXX MAPLE RIDGE KITCHEN");
    expect(text).toContain("· 2026-10-07 · +23,600.00 · Payment PAY-0040 · Ananya Rao");
    expect(text).toContain("L2 · 2026-10-12 · -590.00 · SMS ALERT CHGS [account number]");
    expect(text).toContain('- "SMS ALERT CHGS" (money out) → Bank charges · HDFC Bank');
    expect(text).toContain("A1 · Bank charges (expense)");
    expect(text).toContain("C2 · Maple Ridge Developments (customer)");
  });

  it("kept suggestions stand only while their line is unmatched and their entry is free", () => {
    const saved = {
      at: "2026-10-19T10:00:00.000Z",
      looked: 2,
      suggestions: [
        { statementLineId: "l-maple", rankedJournalLineIds: ["j-ananya"], reason: "same amount", create: null },
        { statementLineId: "l-done", rankedJournalLineIds: ["j-far"], reason: "done", create: null },
      ],
    };
    const lines = view.statementLines.map((l) => ({ id: l.id, status: l.status, amount: BigInt(l.amount) }));
    expect(liveAiSuggestions(saved, lines, view.entries)!.suggestions.map((s) => s.statementLineId)).toEqual(["l-maple"]);
    // Ananya's payment matched elsewhere since: nothing left to suggest for the line.
    expect(liveAiSuggestions(saved, lines, view.entries.map((e) => (e.journalLineId === "j-ananya" ? { ...e, statementLineId: "l-other" } : e)))!.suggestions).toEqual([]);
    expect(liveAiSuggestions(null, lines, view.entries)).toBeNull();
  });
});
