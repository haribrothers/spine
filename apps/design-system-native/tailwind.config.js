const { lightColors, darkColors, radius, spacing } = require("@spine/ui-native/tokens");

/**
 * Same token wiring as apps/mobile/tailwind.config.js — this app renders
 * real @spine/ui-native components, so it must resolve the exact same
 * `bg-surface`/`text-on-surface`/etc. classNames those components use, or
 * everything shows up unstyled.
 *
 * IMPORTANT — this is NOT the previous `{ DEFAULT, dark }` color-object
 * shape. That shape silently did nothing: Tailwind's color flattening has
 * no special meaning for a `dark` sub-key (it's not a real Tailwind
 * convention — DEFAULT/50/100/.../900 are the only recognized shapes), so
 * every themed color compiled to a single fixed light-mode value and the
 * light/dark/system toggle never visibly changed anything (confirmed by
 * inspecting a real `expo export --platform web` bundle: zero `.dark`
 * selectors existed anywhere in the compiled CSS). React Native has no CSS
 * custom properties (see tokens/colors.ts's own comment), so unlike web's
 * `packages/config/tailwind-preset.css` (one variable name, redefined
 * under `[data-theme="dark"]`), NativeWind's real, documented mechanism is:
 * every dark-mode color gets its OWN plain Tailwind color name (e.g.
 * `surface-dark`), and every themed utility class in every component is
 * paired with an explicit `dark:` variant of the SAME base name (e.g.
 * `className="bg-surface dark:bg-surface-dark"`). NativeWind's Tailwind
 * compiler then emits a real `.dark` (scoped by `darkMode: "class"` below)
 * rule it can toggle at runtime via `colorScheme.set(...)`, exactly like
 * a standard Tailwind project's own `dark:` classes.
 */
function flatColors(colors) {
  const out = {};
  for (const [key, value] of Object.entries(colors)) {
    out[key] = value;
  }
  return out;
}

function flatDarkColors(colors) {
  const out = {};
  for (const [key, value] of Object.entries(colors)) {
    out[`${key}-dark`] = value;
  }
  return out;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui-native/src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ...flatColors({
          primary: lightColors.primary,
          "primary-hover": lightColors.primaryHover,
          "neutral-50": lightColors.neutral50,
          "neutral-100": lightColors.neutral100,
          "neutral-200": lightColors.neutral200,
          "neutral-300": lightColors.neutral300,
          "neutral-500": lightColors.neutral500,
          "neutral-700": lightColors.neutral700,
          "neutral-900": lightColors.neutral900,
          background: lightColors.background,
          surface: lightColors.surface,
          "surface-sunken": lightColors.surfaceSunken,
          "on-surface": lightColors.onSurface,
          "on-surface-muted": lightColors.onSurfaceMuted,
          border: lightColors.border,
          "border-strong": lightColors.borderStrong,
          paid: lightColors.paid,
          "paid-bg": lightColors.paidBg,
          "due-soon": lightColors.dueSoon,
          "due-soon-bg": lightColors.dueSoonBg,
          overdue: lightColors.overdue,
          "overdue-bg": lightColors.overdueBg,
          draft: lightColors.draft,
          "draft-bg": lightColors.draftBg,
          info: lightColors.info,
          "info-bg": lightColors.infoBg,
        }),
        ...flatDarkColors({
          primary: darkColors.primary,
          "primary-hover": darkColors.primaryHover,
          "neutral-50": darkColors.neutral50,
          "neutral-100": darkColors.neutral100,
          "neutral-200": darkColors.neutral200,
          "neutral-300": darkColors.neutral300,
          "neutral-500": darkColors.neutral500,
          "neutral-700": darkColors.neutral700,
          "neutral-900": darkColors.neutral900,
          background: darkColors.background,
          surface: darkColors.surface,
          "surface-sunken": darkColors.surfaceSunken,
          "on-surface": darkColors.onSurface,
          "on-surface-muted": darkColors.onSurfaceMuted,
          border: darkColors.border,
          "border-strong": darkColors.borderStrong,
          paid: darkColors.paid,
          "paid-bg": darkColors.paidBg,
          "due-soon": darkColors.dueSoon,
          "due-soon-bg": darkColors.dueSoonBg,
          overdue: darkColors.overdue,
          "overdue-bg": darkColors.overdueBg,
          draft: darkColors.draft,
          "draft-bg": darkColors.draftBg,
          info: darkColors.info,
          "info-bg": darkColors.infoBg,
        }),
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
    },
  },
  plugins: [],
};
