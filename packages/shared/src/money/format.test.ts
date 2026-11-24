import { describe, expect, it } from "vitest";
import { money } from "./money";
import { formatMoney, fromDecimalString, minorUnitExponent, toDecimalString } from "./format";

describe("minorUnitExponent", () => {
  it("returns 2 for the common case", () => {
    expect(minorUnitExponent("USD")).toBe(2);
  });

  it("returns 0 for zero-decimal currencies", () => {
    expect(minorUnitExponent("JPY")).toBe(0);
  });

  it("returns 3 for three-decimal currencies", () => {
    expect(minorUnitExponent("KWD")).toBe(3);
  });
});

describe("toDecimalString", () => {
  it("formats a two-decimal amount", () => {
    expect(toDecimalString(money(124000n, "USD"))).toBe("1240.00");
  });

  it("formats a zero-decimal currency without a decimal point", () => {
    expect(toDecimalString(money(1500n, "JPY"))).toBe("1500");
  });

  it("formats a negative amount", () => {
    expect(toDecimalString(money(-500n, "USD"))).toBe("-5.00");
  });

  it("pads small fractions correctly", () => {
    expect(toDecimalString(money(5n, "USD"))).toBe("0.05");
  });
});

describe("fromDecimalString", () => {
  it("parses a whole-and-fraction amount", () => {
    expect(fromDecimalString("1240.00", "USD")).toBe(124000n);
  });

  it("parses a whole number with no fraction", () => {
    expect(fromDecimalString("1240", "USD")).toBe(124000n);
  });

  it("parses a zero-decimal currency", () => {
    expect(fromDecimalString("1500", "JPY")).toBe(1500n);
  });

  it("rejects a fraction with too many digits", () => {
    expect(fromDecimalString("1.001", "USD")).toBeNull();
  });

  it("rejects negative input", () => {
    expect(fromDecimalString("-5.00", "USD")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(fromDecimalString("abc", "USD")).toBeNull();
  });

  it("round-trips through toDecimalString", () => {
    const amount = fromDecimalString("1240.00", "USD");
    expect(amount).not.toBeNull();
    expect(toDecimalString(money(amount!, "USD"))).toBe("1240.00");
  });
});

describe("formatMoney on an engine without formatToParts (the field app's Hermes, US-MOB-03)", () => {
  it("formats the same way, with a true minus sign", () => {
    const original = Intl.NumberFormat.prototype.formatToParts;
    try {
      // @ts-expect-error — simulating an engine that lacks it
      delete Intl.NumberFormat.prototype.formatToParts;
      expect(formatMoney(10620n, "USD", "en-US")).toBe("$106.20");
      expect(formatMoney("-433500", "USD", "en-US")).toBe("\u2212$4,335.00");
      expect(formatMoney("12024750", "INR", "en-IN")).toBe("₹1,20,247.50");
    } finally {
      Intl.NumberFormat.prototype.formatToParts = original;
    }
  });
});
