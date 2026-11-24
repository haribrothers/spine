import { describe, expect, it } from "vitest";
import { viewForWidth } from "../app/(app)/meetings/meetings-state";

describe("US-MTG-17 · every screen size", () => {
  it("offers no Week on a phone: an address asking for it shows Day", () => {
    expect(viewForWidth("week", true)).toBe("day");
    expect(viewForWidth("agenda", true)).toBe("agenda");
    expect(viewForWidth("week", false)).toBe("week");
  });
});
