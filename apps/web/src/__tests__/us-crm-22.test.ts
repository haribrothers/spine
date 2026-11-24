import { describe, expect, it } from "vitest";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../app/(app)/contacts/contacts-list-state";

describe("US-CRM-22 · how fresh the list is", () => {
  it("says when the list was last loaded", () => {
    const t = Date.UTC(2026, 9, 10, 10, 0, 0);
    expect(updatedLabel(t, t + 20_000)).toBe("Updated just now");
    expect(updatedLabel(t, t + 2 * 60_000)).toBe("Updated 2 min ago");
    expect(updatedLabel(t, t + 3 * 3_600_000)).toBe("Updated 3 h ago");
  });

  it("refreshes on return to the tab after 30 seconds away", () => {
    expect(REFRESH_ON_RETURN_MS).toBe(30_000);
  });
});
