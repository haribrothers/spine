import { describe, expect, it } from "vitest";
import { describeHistoryEntry } from "./history-format.ts";
import { updateContactSchema } from "./schemas/contacts.ts";

/** US-INV-19 — the reminder run's history line and the per-contact pause. */
describe("US-INV-19 · scheduled reminders", () => {
  it("history shows 'Automatic reminder sent', with no actor", () => {
    const entry = { action: "automatic_reminder_sent", entityType: "invoice", actorName: null, changes: [] };
    expect(describeHistoryEntry(entry, "this invoice", "invoice")).toBe("Automatic reminder sent");
  });

  it("a contact update accepts 'Pause automatic reminders'", () => {
    expect(updateContactSchema.parse({ remindersPaused: true })).toMatchObject({ remindersPaused: true });
  });
});
