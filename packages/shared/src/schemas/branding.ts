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

/** US-SET-10 — documents use Spine Blue until a colour is chosen. */
export const DEFAULT_DOCUMENT_COLOR = "#2954E5";
export const DOCUMENT_FOOTER_MAX = 300;
export const DOCUMENT_FOOTER_TOO_LONG = "Keep the footer under 300 characters.";
export const DOCUMENT_COLOR_FORMAT = "Enter a colour as # and six hex digits, e.g. #2954E5.";
/** Documents are printed on white; text in the document colour needs at least this much contrast (WCAG AA). */
export const DOCUMENT_COLOR_MIN_CONTRAST = 4.5;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** WCAG contrast ratio of a `#RRGGBB` colour against white. */
export function contrastOnWhite(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return 1.05 / (luminance + 0.05);
}

/** "6.0:1", rounded down so a colour never reads as passing when it doesn't. */
export function formatContrast(ratio: number): string {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`;
}

export function documentColorTooLight(ratio: number): string {
  return `Too light to read on white (${formatContrast(ratio)}). Pick a darker colour — documents need at least 4.5:1.`;
}

export const documentColorSchema = z.string().superRefine((value, ctx) => {
  if (!isHexColor(value)) {
    ctx.addIssue({ code: "custom", message: DOCUMENT_COLOR_FORMAT });
    return;
  }
  const ratio = contrastOnWhite(value);
  if (ratio < DOCUMENT_COLOR_MIN_CONTRAST) ctx.addIssue({ code: "custom", message: documentColorTooLight(ratio) });
});

/**
 * The `branding` setting. Loose on purpose (`passthrough`), like
 * `business_profile`: it guards the fields with rules and keeps the rest.
 */
export const brandingSchema = z
  .object({
    themePreset: themePresetSchema.optional(),
    documentColor: documentColorSchema.optional(),
    documentFooter: z.string().max(DOCUMENT_FOOTER_MAX, DOCUMENT_FOOTER_TOO_LONG).optional(),
  })
  .passthrough();

export type Branding = z.infer<typeof brandingSchema>;

/** The preset to apply for a stored value; anything unknown falls back to Spine Blue. */
export function resolveThemePreset(value: unknown): ThemePreset {
  const parsed = themePresetSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_THEME_PRESET;
}

/** What documents print: the saved colour when it is valid and readable, else Spine Blue; the footer trimmed. */
export function resolveDocumentBranding(value: unknown): { color: string; footer?: string } {
  const branding = (value ?? {}) as { documentColor?: unknown; documentFooter?: unknown };
  const color = typeof branding.documentColor === "string" && documentColorSchema.safeParse(branding.documentColor).success ? branding.documentColor.toUpperCase() : DEFAULT_DOCUMENT_COLOR;
  const footer = typeof branding.documentFooter === "string" ? branding.documentFooter.trim() : "";
  return footer ? { color, footer } : { color };
}
