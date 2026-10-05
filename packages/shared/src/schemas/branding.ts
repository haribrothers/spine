import { z } from "zod";

/**
 * US-SET-09 (D-063) — the built-in app themes. Each one replaces only
 * `--color-primary` and `--color-primary-hover` (light and dark values live
 * in `packages/config/tailwind-preset.css` under `[data-brand="<id>"]`);
 * status colours are never themeable.
 */
export const THEME_PRESETS = [
  { id: "spine-blue", label: "Spine Blue" },
  { id: "harbour-teal", label: "Harbour Teal" },
  { id: "plum", label: "Plum" },
  { id: "graphite", label: "Graphite" },
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number]["id"];
export const DEFAULT_THEME_PRESET: ThemePreset = "spine-blue";

export const themePresetSchema = z.enum(THEME_PRESETS.map((p) => p.id) as [ThemePreset, ...ThemePreset[]], {
  message: "Choose one of the listed themes.",
});

/**
 * The `branding` setting. Loose on purpose (`passthrough`), like
 * `business_profile`: it guards the fields with rules and keeps the rest.
 */
export const brandingSchema = z
  .object({
    themePreset: themePresetSchema.optional(),
  })
  .passthrough();

export type Branding = z.infer<typeof brandingSchema>;

/** The preset to apply for a stored value; anything unknown falls back to Spine Blue. */
export function resolveThemePreset(value: unknown): ThemePreset {
  const parsed = themePresetSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_THEME_PRESET;
}
