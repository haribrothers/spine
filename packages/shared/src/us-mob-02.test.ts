import { describe, expect, it } from "vitest";
import { accessRemovedMessage } from "./mobile.ts";

describe("US-MOB-02 · a removed member is told why", () => {
  it("names the business", () => {
    expect(accessRemovedMessage("Riverstone Builders")).toBe("Your access to Riverstone Builders was removed.");
  });
});
