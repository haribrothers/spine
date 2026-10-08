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

  /** US-OPS-32 (D-131) — warm page behind white surfaces. */
  background: "#F7F6F3",
  surface: "#FFFFFF",
  surfaceSunken: "#F9F9F9",
  onSurface: "#211F1A",
  onSurfaceMuted: "#726C5A",
  /** US-OPS-25 (D-099) — text on filled primary / danger controls. */
  onPrimary: "#FFFFFF",
  onDanger: "#FFFFFF",
  border: "#E7E5E0",
  borderStrong: "#D3D0C9",

  paid: "#177044",
  paidBg: "#E4F5EB",
  dueSoon: "#946000",
  dueSoonBg: "#FCF0D4",
  overdue: "#B3261E",
  overdueBg: "#FBE6E4",
  draft: "#726C5A",
  draftBg: "#F2F1EE",

  info: "#2954E5",
  infoBg: "#EAEFFD",

  /**
   * A same-hue 2-stop gradient per semantic tone, `to` a ~15-18%-darker
   * shade of `from` — for a bold single-hue gradient fill (a KPI card, a
   * gauge fill, etc.), never a new invented brand color. One entry per
   * tone this package already has a flat token for (`primary`/`paid`/
   * `dueSoon`/`overdue`) — extend this set only alongside its flat
   * `ColorToken` counterpart, never with a tone that has no flat token.
   */
  gradients: {
    primary: { from: "#2954E5", to: "#2144BB" },
    paid: { from: "#177044", to: "#125B37" },
    dueSoon: { from: "#946000", to: "#7E5100" },
    overdue: { from: "#B3261E", to: "#921F18" },
  },

  /** A subtle translucent scrim over `surface` — e.g. a gauge/progress track. */
  overlaySubtle: "rgba(33,31,26,0.12)",
  /** tokens.json `scrim` — dims what's behind a control laid over a photo or the camera. */
  scrim: "rgba(18,17,16,0.32)",
} as const;

export const darkColors = {
  primary: "#6B8AFF",
  primaryHover: "#88A1FF",

  neutral50: "#171613",
  neutral100: "#201F1B",
  neutral200: "#2C2B26",
  neutral300: "#3B392F",
  neutral500: "#9A9786",
  neutral700: "#C7C4B8",
  neutral900: "#F3F2EE",

  background: "#121110",
  surface: "#191815",
  surfaceSunken: "#2C2B26",
  onSurface: "#F3F2EE",
  onSurfaceMuted: "#9A9786",
  onPrimary: "#121110",
  onDanger: "#121110",
  border: "#2C2B26",
  borderStrong: "#3B392F",

  paid: "#4ADE94",
  paidBg: "#132A1E",
  dueSoon: "#F2B23D",
  dueSoonBg: "#332506",
  overdue: "#F17B72",
  overdueBg: "#3A1512",
  draft: "#9A9786",
  draftBg: "#201F1B",

  info: "#6B8AFF",
  infoBg: "#181F35",

  /** See `lightColors.gradients`'s own doc comment — the dark-mode pull is
   * a stronger ~25%-darker shade, since dark-mode base tones are already
   * light/vivid and need a stronger pull toward saturation rather than
   * lightening. */
  gradients: {
    primary: { from: "#6B8AFF", to: "#5067BF" },
    paid: { from: "#4ADE94", to: "#37A66F" },
    dueSoon: { from: "#F2B23D", to: "#B5852D" },
    overdue: { from: "#F17B72", to: "#B45C55" },
  },

  overlaySubtle: "rgba(243,242,238,0.16)",
  scrim: "rgba(0,0,0,0.62)",
} as const;

/** Flat colour tokens only — `gradients` is a nested object, not a colour string (see `GradientTone`). */
export type ColorToken = Exclude<keyof typeof lightColors, "gradients">;
export type GradientTone = keyof typeof lightColors.gradients;
