import { describe, expect, it } from "vitest";
import { add, isZero, money, roundHalfUp, subtract, sum } from "./money";

describe("money", () => {
  it("adds and subtracts same-currency amounts", () => {
    const a = money(1000n, "USD");
    const b = money(250n, "USD");
    expect(add(a, b)).toEqual(money(1250n, "USD"));
    expect(subtract(a, b)).toEqual(money(750n, "USD"));
  });

  it("throws on currency mismatch", () => {
    expect(() => add(money(100n, "USD"), money(100n, "EUR"))).toThrow();
  });

  it("sums a list of lines", () => {
    const lines = [money(100n, "USD"), money(200n, "USD"), money(300n, "USD")];
    expect(sum(lines, "USD")).toEqual(money(600n, "USD"));
  });

  it("detects zero", () => {
    expect(isZero(money(0n, "USD"))).toBe(true);
    expect(isZero(money(1n, "USD"))).toBe(false);
  });

  it("rounds half-up", () => {
    expect(roundHalfUp(0.5)).toBe(1n);
    expect(roundHalfUp(0.4)).toBe(0n);
    expect(roundHalfUp(2.5)).toBe(3n);
    expect(roundHalfUp(-0.5)).toBe(0n);
  });
});
