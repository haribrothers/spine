import { describe, expect, it } from "vitest";
import { auditActionLabel, auditDetails, auditEntityLabel } from "./index.ts";

describe("US-MCP-08 · an agent's requests read as sentences in the audit log", () => {
  it("names the record type and what the agent did", () => {
    expect(auditEntityLabel("agent_request")).toBe("Agent request");
    expect(auditActionLabel("searched")).toBe("Searched");
    expect(auditActionLabel("read_quote")).toBe("Read a quote");
    expect(auditActionLabel("read_invoice")).toBe("Read an invoice");
    expect(auditActionLabel("read_receivables")).toBe("Read receivables");
    expect(auditActionLabel("listed_invoices")).toBe("Listed invoices");
    expect(auditActionLabel("listed_catalog_items")).toBe("Listed catalogue items");
    expect(auditActionLabel("drafted_quote")).toBe("Drafted a quote");
    expect(auditActionLabel("drafted_vendor_bill")).toBe("Drafted a vendor bill");
    expect(auditActionLabel("created_lead")).toBe("Created a lead");
    expect(auditActionLabel("added_note")).toBe("Added a note");
  });

  it("leaves other actions as they were", () => {
    expect(auditActionLabel("read_document")).toBe("Read a document");
    expect(auditActionLabel("draft_quote_lines")).toBe("Drafted quote lines");
    expect(auditActionLabel("accepted_in_person")).toBe("Accepted in person");
  });

  it("shows the agent and how the call ended in Details", () => {
    expect(auditDetails({ action: "read_quote", changes: { summary: "Claude · Refused — No quote Q-9999 that you can open.", agent: "Claude", tool: "get_record", outcome: "refused", durationMs: 12 } })).toBe("Claude · Refused — No quote Q-9999 that you can open.");
  });
});
