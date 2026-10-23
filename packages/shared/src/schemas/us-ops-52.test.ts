import { describe, expect, it } from "vitest";
import { isPrerelease } from "./version.ts";

describe("US-OPS-52 · a beta shows as a beta", () => {
  it("a pre-release is labelled; a release isn't", () => {
    expect(isPrerelease("1.0.0-beta.1")).toBe(true);
    expect(isPrerelease("1.0.0-rc.2")).toBe(true);
    expect(isPrerelease("1.0.0")).toBe(false);
    expect(isPrerelease(null)).toBe(false);
  });
});
