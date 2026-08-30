const { lightColors, darkColors, radius, spacing } = require("@spine/ui-native/tokens");

/**
 * NativeWind's `darkMode: "class"` is what makes `colorScheme.set(...)`
 * (see @spine/ui-native's theme-provider.tsx) actually switch which color
 * set applies — NativeWind toggles a `dark` class on the root view
 * internally when in "class" mode, the same mechanism Tailwind's own
 * `darkMode: "class"` uses on web, so `dark:bg-surface` etc. work exactly
 * like they do in packages/config/tailwind-preset.css's web equivalent.
 *
 * Colors are the light-mode values as the DEFAULT color, with a `dark:`
 * variant of each supplied via NativeWind's color-object convention
 * (`{ DEFAULT: light, dark: dark }`), avoiding a second, hand-duplicated
 * palette definition here — @spine/ui-native/tokens is the single source
 * for both.
 */
function withDark(light, dark) {
  const out = {};
  for (const key of Object.keys(light)) {
    out[key] = { DEFAULT: light[key], dark: dark[key] };
  }
  return out;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui-native/src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: withDark(lightColors, darkColors).primary,
        "primary-hover": withDark(lightColors, darkColors).primaryHover,
        "neutral-50": withDark(lightColors, darkColors).neutral50,
        "neutral-100": withDark(lightColors, darkColors).neutral100,
        "neutral-200": withDark(lightColors, darkColors).neutral200,
        "neutral-300": withDark(lightColors, darkColors).neutral300,
        "neutral-500": withDark(lightColors, darkColors).neutral500,
        "neutral-700": withDark(lightColors, darkColors).neutral700,
        "neutral-900": withDark(lightColors, darkColors).neutral900,
        background: withDark(lightColors, darkColors).background,
        surface: withDark(lightColors, darkColors).surface,
        "surface-sunken": withDark(lightColors, darkColors).surfaceSunken,
        "on-surface": withDark(lightColors, darkColors).onSurface,
        "on-surface-muted": withDark(lightColors, darkColors).onSurfaceMuted,
        border: withDark(lightColors, darkColors).border,
        "border-strong": withDark(lightColors, darkColors).borderStrong,
        paid: withDark(lightColors, darkColors).paid,
        "paid-bg": withDark(lightColors, darkColors).paidBg,
        "due-soon": withDark(lightColors, darkColors).dueSoon,
        "due-soon-bg": withDark(lightColors, darkColors).dueSoonBg,
        overdue: withDark(lightColors, darkColors).overdue,
        "overdue-bg": withDark(lightColors, darkColors).overdueBg,
        draft: withDark(lightColors, darkColors).draft,
        "draft-bg": withDark(lightColors, darkColors).draftBg,
        info: withDark(lightColors, darkColors).info,
        "info-bg": withDark(lightColors, darkColors).infoBg,
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
