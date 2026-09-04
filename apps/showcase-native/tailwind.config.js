const { lightColors, darkColors, radius, spacing } = require("@spine/ui-native/tokens");

/**
 * Same token wiring as apps/design-system-native/tailwind.config.js — this
 * app renders real @spine/ui-native components (including the ones that
 * stay NativeWind-styled, e.g. Card/Badge/TextField), so it must resolve
 * the exact same `bg-surface`/`text-on-surface`/etc. classNames those
 * components use, or they show up unstyled. See that file's own comment
 * for why colors are flattened with a `-dark` suffix rather than a
 * `{ DEFAULT, dark }` shape (the latter silently does nothing in Tailwind).
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
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui-native/src/**/*.{js,jsx,ts,tsx}"],
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
