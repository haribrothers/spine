import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentContext } from "../mcp-context";
import { draftKey } from "./draft-tools";

const dir = join(process.cwd(), "src/modules/agents/tools");
const sources = readdirSync(dir)
  .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n");

/** Every route a tool writes to — `this.api.send(ctx, "POST", <path>, …)`. */
const writes = [...sources.matchAll(/this\.api\.send(?:<[^>]+>)?\(\s*ctx,\s*"(\w+)",\s*(`[^`]+`|"[^"]+")/g)].map((m) => `${m[1]} ${m[2]!.slice(1, -1).replace(/\$\{[^}]+\}/g, ":id")}`);
const ALLOWED = new Set(["POST /contacts", "POST /leads", "POST /activities", "POST /quotes", "POST /vendor-bills", "POST /jobs/:id/notes"]);

describe("US-MCP-07 · agents only create drafts and notes", () => {
  it("every route a tool writes to creates a contact, lead, note, draft quote or draft bill — nothing that issues, sends, records, approves, voids, matches, posts or deletes", () => {
    expect(writes.length).toBeGreaterThanOrEqual(7);
    for (const route of writes) expect(ALLOWED, route).toContain(route);
    // No API path string anywhere in the tools ends in an action route.
    expect(sources).not.toMatch(/["'`]\/[\w/${}.:-]*\/(issue|send|record|approve|reject|void|match|post|pay|refund|delete)(["'`?/])/);
    expect(sources).not.toMatch(/"(DELETE|PUT|PATCH)"/);
    expect(readFileSync(join(dir, "../agent-api.ts"), "utf8")).toMatch(/method: "POST", path: string/);
  });

  it("a retried call gets the same Idempotency-Key; a different call, or another connection, a different one", () => {
    const ctx = { connectionId: "c1" } as AgentContext;
    const key = draftKey(ctx, "draft_quote", 7, { contactId: "x" });
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(draftKey(ctx, "draft_quote", 7, { contactId: "x" })).toBe(key);
    expect(draftKey(ctx, "draft_quote", 8, { contactId: "x" })).not.toBe(key);
    expect(draftKey({ connectionId: "c2" } as AgentContext, "draft_quote", 7, { contactId: "x" })).not.toBe(key);
    expect(draftKey(ctx, "draft_quote", 7, { contactId: "x" }, "lead")).not.toBe(key);
  });
});
