import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * US-OPS-25 (D-099) — text on filled controls is at least 4.5:1 in both
 * modes, in every place the colours are defined: the design tokens, the
 * web CSS and the native token map.
 */
const root = path.resolve(__dirname, "../../../..");

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** [text token, fill token] */
const PAIRS: [string, string][] = [
  ["on-primary", "primary"],
  ["on-danger", "overdue"],
];

const tokens = JSON.parse(readFileSync(path.join(root, "packages/config/tokens.json"), "utf8")) as { color: Record<"light" | "dark", Record<string, string>> };
const css = readFileSync(path.join(root, "packages/config/tailwind-preset.css"), "utf8");

/** The hex value a CSS block assigns to `--color-<name>`. */
function cssValue(block: string, name: string): string {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  if (!m) throw new Error(`--color-${name} not set to a hex value`);
  return m[1]!.toUpperCase();
}
const cssLight = css.slice(css.indexOf(":root {"), css.indexOf(':root[data-theme="dark"]'));
const cssDark = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf("@media (prefers-color-scheme: dark)"));
const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** packages/ui-native's colour maps, read as text (it's another package, built for React Native). */
const nativeSource = readFileSync(path.join(root, "packages/ui-native/src/tokens/colors.ts"), "utf8");
function nativeColors(exportName: "lightColors" | "darkColors"): Record<string, string> {
  const start = nativeSource.indexOf(`export const ${exportName}`);
  const end = nativeSource.indexOf("export const", start + 1);
  const block = nativeSource.slice(start, end === -1 ? undefined : end);
  return Object.fromEntries([...block.matchAll(/^\s{2}(\w+): "(#[0-9A-Fa-f]{6})"/gm)].map((m) => [m[1]!, m[2]!.toUpperCase()]));
}
const lightColors = nativeColors("lightColors");
const darkColors = nativeColors("darkColors");

describe("US-OPS-25 · text on filled controls stays readable", () => {
  for (const mode of ["light", "dark"] as const) {
    for (const [text, fill] of PAIRS) {
      it(`${mode}: ${text} on ${fill} is at least 4.5:1 in tokens, web CSS and native`, () => {
        const sources = {
          tokens: [tokens.color[mode][text]!, tokens.color[mode][fill]!],
          css: [cssValue(mode === "light" ? cssLight : cssDark, text), cssValue(mode === "light" ? cssLight : cssDark, fill)],
          native: [(mode === "light" ? lightColors : darkColors)[camel(text)]!, (mode === "light" ? lightColors : darkColors)[camel(fill)]!],
        };
        for (const [source, [fg, bg]] of Object.entries(sources)) {
          expect(contrast(fg!, bg!), `${source}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }

  it("light mode keeps white text on the fills", () => {
    expect(tokens.color.light["on-primary"]).toBe("#FFFFFF");
    expect(tokens.color.light["on-danger"]).toBe("#FFFFFF");
  });

  it("the old white-on-dark-primary pairing really was below AA", () => {
    expect(contrast("#FFFFFF", tokens.color.dark.primary!)).toBeLessThan(4.5);
  });

  it("the native placeholder uses the mode's muted text, readable on the dark surface", () => {
    expect(darkColors.onSurfaceMuted).toBe(tokens.color.dark["on-surface-muted"]);
    expect(contrast(darkColors.onSurfaceMuted!, darkColors.surface!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#726C5A", darkColors.surface!)).toBeLessThan(4.5);
  });
});
