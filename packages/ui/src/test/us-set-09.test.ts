import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * US-SET-09 (D-063) — every theme preset changes only the primary pair, in
 * light and dark mode, and stays readable: white text on the light fill,
 * dark on-primary text on the dark fill, and primary as text on the page.
 */
const root = path.resolve(__dirname, "../../../..");
const css = readFileSync(path.join(root, "packages/config/tailwind-preset.css"), "utf8");
const tokens = JSON.parse(readFileSync(path.join(root, "docs/design/tokens.json"), "utf8")) as {
  color: Record<"light" | "dark", Record<string, string>>;
  themePresets: Record<string, { light: Record<string, string>; dark: Record<string, string> }>;
};
const PRESETS = ["spine-blue", "harbour-teal", "plum", "graphite"];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The declarations of every CSS rule whose selector list ends with `[data-brand="<id>"]` (light) or includes a dark selector. */
function blocks(id: string, mode: "light" | "dark"): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1]!.trim();
    if (!selector.includes(`[data-brand="${id}"]`)) continue;
    const dark = selector.includes('data-theme="dark"') || selector.includes(':not([data-theme="light"])');
    if ((mode === "dark") !== dark) continue;
    out.push(Object.fromEntries([...m[2]!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((d) => [d[1]!, d[2]!.toUpperCase()])));
  }
  return out;
}

describe("US-SET-09 · theme presets stay readable and leave status colours alone", () => {
  for (const id of PRESETS) {
    it(`${id}: light and dark rules set only --color-primary and --color-primary-hover, matching tokens.json`, () => {
      for (const mode of ["light", "dark"] as const) {
        const found = blocks(id, mode);
        expect(found.length, `${id} ${mode} rules`).toBeGreaterThan(0);
        for (const decls of found) {
          expect(Object.keys(decls).sort()).toEqual(["color-primary", "color-primary-hover"]);
          expect(decls["color-primary"]).toBe(tokens.themePresets[id]![mode].primary);
          expect(decls["color-primary-hover"]).toBe(tokens.themePresets[id]![mode]["primary-hover"]);
        }
      }
    });

    it(`${id}: passes 4.5:1 for button text and as text on the page, in both modes`, () => {
      const { light, dark } = tokens.themePresets[id]!;
      for (const fill of [light.primary!, light["primary-hover"]!]) expect(contrast(tokens.color.light["on-primary"]!, fill)).toBeGreaterThanOrEqual(4.5);
      for (const fill of [dark.primary!, dark["primary-hover"]!]) expect(contrast(tokens.color.dark["on-primary"]!, fill)).toBeGreaterThanOrEqual(4.5);
      for (const bg of ["background", "surface"]) {
        expect(contrast(light.primary!, tokens.color.light[bg]!)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(dark.primary!, tokens.color.dark[bg]!)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("Spine Blue's preset is the same as the default primary", () => {
    expect(tokens.themePresets["spine-blue"]!.light.primary).toBe(tokens.color.light.primary);
    expect(tokens.themePresets["spine-blue"]!.dark.primary).toBe(tokens.color.dark.primary);
  });
});
