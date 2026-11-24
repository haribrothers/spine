const { themeExtend } = require("@spine/ui-native/tailwind-preset");

/**
 * `themeExtend` (colors/radius/spacing) now comes entirely from
 * `@spine/ui-native/tailwind-preset` — see that file's own doc comment for
 * why it's a plain `theme.extend`-shaped object spread in here directly,
 * NOT a Tailwind `presets` array entry (a real, confirmed regression: a
 * second preset in that array reset `nativewind/preset`'s own RN-specific
 * `boxShadow` scale back to Tailwind's web defaults, in either order).
 * `content` and `darkMode` stay here, per-app, for the same reason.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui-native/src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: themeExtend,
  },
  plugins: [],
};
