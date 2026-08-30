/**
 * Ported from docs/DESIGN.md's `typography` block. `fontFamily` values
 * reference the family names `@expo-google-fonts/inter` registers when
 * loaded via `expo-font` (consuming app's responsibility — this package
 * only names the tokens, it doesn't load the font itself, matching how
 * `packages/config/tailwind-preset.css` only names `--font-sans` without
 * owning the actual `@font-face`/webfont loading either). `fontWeight` is
 * coerced to RN's supported string-numeric set (RN only accepts
 * "100"–"900" plus "normal"/"bold", not arbitrary values like 650) —
 * rounded to the nearest RN-supported weight where docs/DESIGN.md's value
 * isn't already one.
 */
export const typography = {
  display: { fontFamily: "Inter_700Bold", fontSize: 32, fontWeight: "700", lineHeight: 32 * 1.2, letterSpacing: -0.015 * 32 },
  h1: { fontFamily: "Inter_700Bold", fontSize: 24, fontWeight: "700", lineHeight: 24 * 1.25, letterSpacing: -0.01 * 24 },
  h2: { fontFamily: "Inter_600SemiBold", fontSize: 18, fontWeight: "600", lineHeight: 18 * 1.3 },
  h3: { fontFamily: "Inter_600SemiBold", fontSize: 15, fontWeight: "600", lineHeight: 15 * 1.4 },
  bodyLg: { fontFamily: "Inter_400Regular", fontSize: 15, fontWeight: "400", lineHeight: 15 * 1.55 },
  bodyMd: { fontFamily: "Inter_400Regular", fontSize: 14, fontWeight: "400", lineHeight: 14 * 1.5 },
  bodySm: { fontFamily: "Inter_400Regular", fontSize: 13, fontWeight: "400", lineHeight: 13 * 1.45 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, fontWeight: "600", lineHeight: 13 * 1.3, letterSpacing: 0.005 * 13 },
  caption: { fontFamily: "Inter_500Medium", fontSize: 12, fontWeight: "500", lineHeight: 12 * 1.35, letterSpacing: 0.01 * 12 },
} as const;

export type TypographyToken = keyof typeof typography;
