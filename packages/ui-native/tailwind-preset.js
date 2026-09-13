const { lightColors, darkColors, radius, spacing } = require("./src/tokens");

/**
 * `themeExtend` — the shared `theme.extend` fragment every app rendering
 * `packages/ui-native` components spreads into its own `tailwind.config.js`
 * (`theme: { extend: { ...require("@spine/ui-native/tailwind-preset").themeExtend } }`).
 * The theming half of making this package feel like a real component +
 * theming library, not just a components folder each app happens to
 * import — every color/radius/spacing value used by any themed component
 * in this package now lives in exactly one place.
 *
 * **Deliberately NOT a Tailwind `preset` (a full `{darkMode, theme,
 * plugins}` config object dropped into `tailwind.config.js`'s `presets`
 * array) — a real, confirmed regression found while building this.**
 * `nativewind/preset` establishes its OWN base `theme.boxShadow` scale
 * (RN-appropriate values like `"0px 1px 4px rgba(0,0,0,0.35)"`, confirmed
 * by reading its `dist/tailwind/shadows.js`/preset export directly) — but
 * adding ANY second entry to the `presets` array, in EITHER order, reset
 * that scale back to Tailwind's stock WEB defaults (`"0 1px 3px 0 rgb(0 0
 * 0 / 0.1), ..."`, a multi-layer CSS `box-shadow` string RN's own
 * `shadow-*` utility parser isn't designed for) — confirmed live via
 * `resolveConfig()` with both preset orderings, both broke it the same
 * way. Exporting a plain `theme.extend`-shaped OBJECT instead of a full
 * preset means it never enters Tailwind's preset-resolution algorithm at
 * all — the consuming app spreads it directly into its own single
 * `theme.extend`, the exact same shape (and safety) as the value literals
 * `apps/showcase-native/tailwind.config.js` used to hand-write inline.
 *
 * **`content` and `darkMode` still belong to each app's own
 * `tailwind.config.js`, not here** — `content` is a real per-app
 * file-scanning glob (Tailwind resolves it relative to wherever
 * `tailwind.config.js` lives, so a path baked in here would scan the wrong
 * directory from a different app's working directory); `darkMode: "class"`
 * is a top-level config key, not a `theme.extend` value, so it has nowhere
 * to live in a plain extend-fragment export like this one.
 *
 * **Why colors are flattened with a `-dark` suffix (`surface`/
 * `surface-dark`), not a `{ DEFAULT, dark }` shape** — confirmed, at
 * length, in CLAUDE.md's own `packages/ui-native` section: Tailwind's
 * color flattening has no special meaning for a nested `dark` key, so that
 * shape silently compiles to one fixed light-mode value with ZERO real
 * `.dark`-scoped CSS rules generated — a real, previously-shipped bug.
 * Every themed `packages/ui-native` component's `className` is written
 * with this exact paired convention (`bg-surface dark:bg-surface-dark`),
 * so an app's own compiled theme MUST use it too, or those components
 * render unstyled/wrong in dark mode.
 */
function flattenColors(colors, suffix) {
  const out = {};
  for (const [key, value] of Object.entries(colors)) {
    out[suffix ? `${key}-dark` : key] = value;
  }
  return out;
}

// The token objects' own keys are camelCase (`primaryHover`, `neutral50`,
// `dueSoonBg`, ...) — real Tailwind class names use kebab-case
// (`primary-hover`, `neutral-50`, `due-soon-bg`). This maps ColorToken's
// exact keys (see `tokens/colors.ts`) to their Tailwind class-name form
// once, so both `lightColors`/`darkColors` (identical key sets, per
// `ColorToken`'s own type) are renamed consistently.
function toTailwindClassNames(colors) {
  const KEY_TO_CLASS_NAME = {
    primary: "primary",
    primaryHover: "primary-hover",
    neutral50: "neutral-50",
    neutral100: "neutral-100",
    neutral200: "neutral-200",
    neutral300: "neutral-300",
    neutral500: "neutral-500",
    neutral700: "neutral-700",
    neutral900: "neutral-900",
    background: "background",
    surface: "surface",
    surfaceSunken: "surface-sunken",
    onSurface: "on-surface",
    onSurfaceMuted: "on-surface-muted",
    border: "border",
    borderStrong: "border-strong",
    paid: "paid",
    paidBg: "paid-bg",
    dueSoon: "due-soon",
    dueSoonBg: "due-soon-bg",
    overdue: "overdue",
    overdueBg: "overdue-bg",
    draft: "draft",
    draftBg: "draft-bg",
    info: "info",
    infoBg: "info-bg",
  };
  const out = {};
  for (const [key, value] of Object.entries(colors)) {
    out[KEY_TO_CLASS_NAME[key] ?? key] = value;
  }
  return out;
}

const themeExtend = {
  colors: {
    ...flattenColors(toTailwindClassNames(lightColors)),
    ...flattenColors(toTailwindClassNames(darkColors), "dark"),
  },
  borderRadius: {
    none: `${radius.none}px`,
    sm: `${radius.sm}px`,
    md: `${radius.md}px`,
    lg: `${radius.lg}px`,
    full: `${radius.full}px`,
  },
  spacing: {
    xs: `${spacing.xs}px`,
    sm: `${spacing.sm}px`,
    md: `${spacing.md}px`,
    lg: `${spacing.lg}px`,
    xl: `${spacing.xl}px`,
    "2xl": `${spacing["2xl"]}px`,
  },
};

module.exports = { themeExtend };
