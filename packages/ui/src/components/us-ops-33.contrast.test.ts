import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * US-OPS-33 — alert text (`AlertDescription`, `AlertTitle`) is full-contrast
 * `on-surface`, readable on every alert tint in both modes. Muted text was
 * not (4.37:1 on the light critical tint).
 */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const root = path.resolve(__dirname, "../../../..");
const tokens = JSON.parse(readFileSync(path.join(root, "docs/design/tokens.json"), "utf8")) as { color: Record<"light" | "dark", Record<string, string>> };
const source = readFileSync(path.join(__dirname, "alert.tsx"), "utf8");

describe("US-OPS-33 · alert text is readable on every alert tint", () => {
  it("AlertDescription uses on-surface, not muted text", () => {
    expect(source).toMatch(/AlertDescription[\s\S]*?"text-on-surface"/);
  });

  for (const mode of ["light", "dark"] as const) {
    for (const tint of ["info-bg", "due-soon-bg", "overdue-bg", "paid-bg"]) {
      it(`${mode}: on-surface on ${tint} is at least 4.5:1`, () => {
        expect(contrast(tokens.color[mode]["on-surface"]!, tokens.color[mode][tint]!)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("the muted text it replaces really was below AA on the light critical tint", () => {
    expect(contrast(tokens.color.light["on-surface-muted"]!, tokens.color.light["overdue-bg"]!)).toBeLessThan(4.5);
  });
});
