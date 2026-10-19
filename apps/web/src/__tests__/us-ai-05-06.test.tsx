import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CAPABILITY_LABELS, DEFAULT_MODULES, DEFAULT_TEAM_GRANTS, auditActionLabel, auditDetails, auditEntityLabel, describeHistoryEntry } from "@spine/shared";
import { permissionGroups } from "../app/(app)/team/teams/teams-state";
import { AiFilledMark } from "../components/ai-filled-mark";

describe("US-AI-05", () => {
  it("a Team's permissions gain an \"AI assistant\" group with \"Use AI features\" while AI is on, off for General Staff", () => {
    const groups = permissionGroups({ ...DEFAULT_MODULES, ai: true });
    expect(groups.at(-1)).toEqual({ label: "AI assistant", capabilities: ["ai.use"] });
    expect(CAPABILITY_LABELS["ai.use"].label).toBe("Use AI features");
    expect(DEFAULT_TEAM_GRANTS["ai.use"]).toBe(false);
  });

  it("hides the group while AI is off", () => {
    expect(permissionGroups(DEFAULT_MODULES).map((g) => g.label)).not.toContain("AI assistant");
  });
});

describe("US-AI-06", () => {
  it("names AI requests and their actions in the audit log, and gives the details in one line", () => {
    expect(auditEntityLabel("ai_request")).toBe("AI request");
    expect(["read_document", "draft_email", "draft_quote_lines", "bank_suggestions"].map(auditActionLabel)).toEqual(["Read a document", "Drafted an email", "Drafted quote lines", "Suggested bank matches"]);
    const changes = { summary: "api.anthropic.com · claude-sonnet-5-5 · 3,412 tokens · Worked", provider: "api.anthropic.com", model: "claude-sonnet-5-5", inputTokens: 3000, outputTokens: 412, outcome: "ok" };
    expect(auditDetails({ action: "read_document", changes })).toBe("api.anthropic.com · claude-sonnet-5-5 · 3,412 tokens · Worked");
  });

  it("an Activity entry saved from AI ends \" · filled in with AI\"", () => {
    render(
      <p>
        <span>Created as a draft</span>
        <AiFilledMark />
      </p>,
    );
    expect(screen.getByText("Created as a draft").parentElement!.textContent).toBe("Created as a draft · filled in with AI");
  });

  it("a record's History says it was filled in with AI", () => {
    const sentence = describeHistoryEntry({ action: "created", entityType: "vendor_bill", actorName: "Kavya Iyer", changes: [{ field: "status", from: null, to: "draft" }, { field: "aiAssisted", from: null, to: true }] } as never, "this bill", "vendor_bill");
    expect(sentence).toContain("filled it in with AI");
  });
});
