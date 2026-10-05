import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_STAGES, MAX_LEAD_STAGES, putLeadStagesSchema } from "./schemas/lead-stages.ts";

const base = () => DEFAULT_LEAD_STAGES.map((s) => ({ name: s.name, kind: s.kind }));
const message = (stages: { name: string; kind: "open" | "won" | "lost" }[]) => putLeadStagesSchema.safeParse({ stages }).error?.issues[0]?.message;

/** US-CRM-19 — the rules a set of pipeline stages must follow. */
describe("US-CRM-19 · pipeline stage rules", () => {
  it("starts every organisation with New, Qualified, Proposal, Won and Lost", () => {
    expect(DEFAULT_LEAD_STAGES.map((s) => `${s.name}:${s.kind}`)).toEqual(["New:open", "Qualified:open", "Proposal:open", "Won:won", "Lost:lost"]);
  });

  it("accepts a renamed, reordered set with a new stage before Won", () => {
    const stages = [{ name: "New", kind: "open" as const }, { name: "Site visit booked", kind: "open" as const }, { name: "Quote sent", kind: "open" as const }, ...base().slice(3)];
    expect(putLeadStagesSchema.safeParse({ stages }).success).toBe(true);
  });

  it("allows up to 12 stages", () => {
    const opens = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Stage ${i}`, kind: "open" as const }));
    expect(message([...opens(MAX_LEAD_STAGES - 2), ...base().slice(3)])).toBeUndefined();
    expect(message([...opens(MAX_LEAD_STAGES - 1), ...base().slice(3)])).toBe("Up to 12 stages.");
  });

  it("keeps Won and Lost last, exactly once each", () => {
    expect(message([...base().slice(3), ...base().slice(0, 3)])).toBe("Won and Lost stay last, with at least one open stage before them.");
    expect(message(base().filter((s) => s.kind !== "lost"))).toBe("Keep exactly one Won and one Lost stage.");
  });

  it("needs a name for every stage, each different", () => {
    expect(message([{ name: "  ", kind: "open" }, ...base().slice(3)])).toBe("Every stage needs a name.");
    expect(message([{ name: "New", kind: "open" }, { name: "new", kind: "open" }, ...base().slice(3)])).toBe("Give each stage a different name.");
  });
});
