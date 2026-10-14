import { describe, expect, it } from "vitest";
import { hasPipelineFilters, matchesPipeline, parsePipelineState, pipelineQuery } from "../app/(app)/leads/pipeline-state";
import { NOW, daysAgo, lead } from "./pipeline-fixtures";

const state = (query: string) => parsePipelineState(new URLSearchParams(query));

describe("US-CRM-28 · filters that stay in the address", () => {
  it("reads and writes the board's state, leaving defaults out", () => {
    expect(state("")).toEqual({ q: "", stages: [], owner: "", source: "", sort: "newest", overdue: false });
    const full = state("q=villa&stage=a&stage=b&owner=me&source=Referral&sort=value-desc&overdue=1");
    expect(full).toEqual({ q: "villa", stages: ["a", "b"], owner: "me", source: "Referral", sort: "value-desc", overdue: true });
    expect(pipelineQuery(full)).toBe("q=villa&stage=a&stage=b&owner=me&source=Referral&sort=value-desc&overdue=1");
    expect(pipelineQuery(state(""))).toBe("");
    expect(state("sort=nonsense").sort).toBe("newest");
    expect(hasPipelineFilters(state("sort=title"))).toBe(false);
    expect(hasPipelineFilters(state("owner=unassigned"))).toBe(true);
  });

  it("filters by owner (mine, someone's, unassigned), source, search and overdue, combined", () => {
    const mine = lead({ ownerUserId: "me-id", source: "Referral", title: "Villa extension" });
    const theirs = lead({ ownerUserId: "u2", source: "Website", title: "Office block" });
    const nobody = lead({ ownerUserId: null, source: "Referral", title: "Warehouse", nextFollowUp: { id: "f", type: "call", dueAt: daysAgo(1) } });
    const all = [mine, theirs, nobody];
    const pick = (query: string) => all.filter((l) => matchesPipeline(l, "Ananya Rao", state(query), "me-id", NOW));

    expect(pick("owner=me")).toEqual([mine]);
    expect(pick("owner=u2")).toEqual([theirs]);
    expect(pick("owner=unassigned")).toEqual([nobody]);
    expect(pick("source=Referral")).toEqual([mine, nobody]);
    expect(pick("source=Referral&owner=me")).toEqual([mine]);
    expect(pick("q=office")).toEqual([theirs]);
    expect(pick("q=ananya")).toEqual(all);
    expect(pick("overdue=1")).toEqual([nobody]);
  });
});
