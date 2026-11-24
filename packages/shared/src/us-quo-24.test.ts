import { describe, expect, it } from "vitest";
import { describeHistoryEntry } from "./history-format.ts";

/** US-QUO-24 — a duplicated quote's history opens with where it came from. */
describe("US-QUO-24 · duplicated quote history", () => {
  it('reads "Duplicated from QUO-0004 by Sarah Mendes"', () => {
    const entry = { action: "duplicated", entityType: "quote", actorName: "Sarah Mendes", changes: [{ field: "duplicatedFrom", from: null, to: "QUO-0004" }] };
    expect(describeHistoryEntry(entry, "this quote")).toBe("Duplicated from QUO-0004 by Sarah Mendes");
  });
});
