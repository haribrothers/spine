import { describe, expect, it } from "vitest";
import { isClientTooOld, parseVersion } from "./mobile.ts";

describe("US-MOB-10 · the app is told when it's too old", () => {
  it("parses X.Y.Z, ignoring a leading v and a pre-release suffix", () => {
    expect(parseVersion("1.4.2")).toEqual([1, 4, 2]);
    expect(parseVersion("v2.0.0-beta.3")).toEqual([2, 0, 0]);
    expect(parseVersion("latest")).toBeNull();
  });

  it("compares part by part, not as text", () => {
    expect(isClientTooOld("1.9.0", "1.10.0")).toBe(true);
    expect(isClientTooOld("1.10.0", "1.9.0")).toBe(false);
    expect(isClientTooOld("1.2.3", "1.2.3")).toBe(false);
    expect(isClientTooOld("1.2.2", "1.2.3")).toBe(true);
    expect(isClientTooOld("2.0.0", "1.99.99")).toBe(false);
  });

  it("never blocks on a value it can't read", () => {
    expect(isClientTooOld("garbage", "1.0.0")).toBe(false);
    expect(isClientTooOld("1.0.0", "")).toBe(false);
  });
});
