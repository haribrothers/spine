import { describe, expect, it } from "vitest";
import { auditActionLabel, auditActionTone, auditDetails, auditEntityLabel } from "./schemas/audit-log.ts";

describe("US-SET-11 · how the audit log reads", () => {
  it("names actions and record types", () => {
    expect(auditActionLabel("accepted_in_person")).toBe("Accepted in person");
    expect(auditActionLabel("role_changed")).toBe("Role changed");
    expect(auditActionLabel("approve")).toBe("Approved");
    expect(auditEntityLabel("credit_note")).toBe("Credit note");
    expect(auditEntityLabel("user")).toBe("User");
    expect(auditEntityLabel("something_new")).toBe("Something new");
  });

  it("gives outcomes a tone that the text also says", () => {
    expect(auditActionTone("approved")).toBe("positive");
    expect(auditActionTone("voided")).toBe("negative");
    expect(auditActionTone("issued")).toBe("info");
    expect(auditActionTone("updated")).toBe("neutral");
  });

  it("summarises changes for the Details column", () => {
    expect(auditDetails({ action: "role_changed", changes: [{ field: "role", from: "Owner", to: "Staff" }] })).toBe("Owner → Staff");
    expect(auditDetails({ action: "issued", changes: [{ field: "status", from: "draft", to: "issued" }] })).toBe("Draft → Issued");
    expect(auditDetails({ action: "updated", changes: [{ field: "phone", from: "+1-555-0107", to: "+1-555-0177" }] })).toBe("Phone: +1-555-0107 → +1-555-0177");
    expect(auditDetails({ action: "created", changes: [{ field: "title", from: null, to: "Site walk" }] })).toBe("Title: Site walk");
    expect(
      auditDetails({
        action: "updated",
        changes: [
          { field: "name", from: "A", to: "B" },
          { field: "email", from: "a@x", to: "b@x" },
          { field: "phone", from: "1", to: "2" },
        ],
      }),
    ).toBe("Name: A → B · Email: a@x → b@x · and 1 more");
    expect(auditDetails({ action: "statement_sent", changes: { to: "ap@maple.example", openingBalance: 1200 } })).toBe("To: ap@maple.example · Opening balance: 1200");
    expect(auditDetails({ action: "deleted", changes: null })).toBe("");
  });
});
