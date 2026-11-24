import { describe, expect, it } from "vitest";
import { brandingSchema, DEFAULT_THEME_PRESET, resolveThemePreset, THEME_PRESETS } from "./schemas/branding.ts";

/** US-SET-09 — the four built-in themes, Spine Blue by default. */
describe("US-SET-09 · theme presets", () => {
  it("offers Spine Blue, Harbour Teal, Plum and Graphite, with Spine Blue the default", () => {
    expect(THEME_PRESETS.map((p) => p.label)).toEqual(["Spine Blue", "Harbour Teal", "Plum", "Graphite"]);
    expect(DEFAULT_THEME_PRESET).toBe("spine-blue");
  });

  it("accepts each preset and keeps other branding fields", () => {
    for (const { id } of THEME_PRESETS) {
      expect(brandingSchema.safeParse({ themePreset: id, documentFooter: "Thanks" }).data).toEqual({ themePreset: id, documentFooter: "Thanks" });
    }
  });

  it("refuses anything else with 'Choose one of the listed themes.'", () => {
    const result = brandingSchema.safeParse({ themePreset: "neon" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Choose one of the listed themes.");
  });

  it("falls back to Spine Blue when nothing (or something unknown) is stored", () => {
    expect(resolveThemePreset(undefined)).toBe("spine-blue");
    expect(resolveThemePreset("neon")).toBe("spine-blue");
    expect(resolveThemePreset("plum")).toBe("plum");
  });
});
