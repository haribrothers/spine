import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyCompact } from "./money/index.ts";

describe("US-DASH-28 · the aging ring's short total", () => {
  it("uses the locale's compact form with one decimal", () => {
    expect(formatMoneyCompact(448868200n, "INR", "en-IN")).toBe("₹44.9L");
    expect(formatMoneyCompact(448868200n, "USD", "en-US")).toBe("$4.5M");
    expect(formatMoneyCompact("448868200", "GBP", "en-GB")).toBe("£4.5m");
  });

  it("keeps small amounts whole and negatives with a true minus sign", () => {
    expect(formatMoneyCompact(95000n, "USD", "en-US")).toBe("$950");
    expect(formatMoneyCompact(-16050000n, "INR", "en-IN")).toBe("−₹1.6L");
  });

  it("respects zero-decimal currencies and leaves formatMoney alone", () => {
    expect(formatMoneyCompact(4500000n, "JPY", "ja-JP")).toBe("￥450万");
    expect(formatMoney(448868200n, "INR", "en-IN")).toBe("₹44,88,682.00");
  });
});
