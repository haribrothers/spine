/**
 * Ported from `docs/DESIGN.md` / `packages/config/tailwind-preset.css` —
 * the single source of truth for every color value in this file. Kept in
 * sync BY HAND whenever the web tokens change (documented explicitly,
 * since there is no automated cross-check between the two yet — see this
 * package's own README-equivalent doc comment in `theme/theme-provider.tsx`
 * for the light/dark/system resolution these feed).
 *
 * React Native has no CSS custom properties — NativeWind's Tailwind config
 * needs plain color values, not `var(--...)` references, so this is a
 * plain TS module (light and dark as two flat objects) rather than a CSS
 * file, unlike `packages/config/tailwind-preset.css`'s `:root`/
 * `[data-theme="dark"]` approach. `docs/DESIGN.md`'s `category-*` palette
 * and z-index scale are deliberately NOT ported here yet — no native
 * screen needs them (no Calendar-equivalent component planned for Phase 5
 * mobile); port them if/when a component actually needs them, per this
 * package's own "only what's needed" scoping (see Phase 5 plan).
 */
export const lightColors = {
  primary: "#2954E5",
  primaryHover: "#2044C4",

  neutral50: "#FAFAF9",
  neutral100: "#F2F1EE",
  neutral200: "#E7E5E0",
  neutral300: "#D3D0C9",
  neutral500: "#726C5A",
  neutral700: "#4B473E",
  neutral900: "#211F1A",

  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceSunken: "#F9F9F9",
  onSurface: "#211F1A",
  onSurfaceMuted: "#726C5A",
  border: "#E7E5E0",
  borderStrong: "#D3D0C9",

  paid: "#177044",
  paidBg: "#E4F5EB",
  dueSoon: "#9A6300",
  dueSoonBg: "#FCF0D4",
  overdue: "#B3261E",
  overdueBg: "#FBE6E4",
  draft: "#726C5A",
  draftBg: "#F2F1EE",

  info: "#2954E5",
  infoBg: "#EAEFFD",
} as const;

export const darkColors = {
  primary: "#6B8AFF",
  primaryHover: "#88A1FF",

  neutral50: "#171613",
  neutral100: "#201F1B",
  neutral200: "#2C2B26",
  neutral300: "#3B392F",
  neutral500: "#93907F",
  neutral700: "#C7C4B8",
  neutral900: "#F3F2EE",

  background: "#121110",
  surface: "#191815",
  surfaceSunken: "#2C2B26",
  onSurface: "#F3F2EE",
  onSurfaceMuted: "#93907F",
  border: "#2C2B26",
  borderStrong: "#3B392F",

  paid: "#4ADE94",
  paidBg: "#132A1E",
  dueSoon: "#F2B23D",
  dueSoonBg: "#332506",
  overdue: "#F17B72",
  overdueBg: "#3A1512",
  draft: "#93907F",
  draftBg: "#201F1B",

  info: "#6B8AFF",
  infoBg: "#181F35",
} as const;

export type ColorToken = keyof typeof lightColors;
