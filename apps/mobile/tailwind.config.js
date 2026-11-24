const { themeExtend } = require("@spine/ui-native/tailwind-preset");

/**
 * `themeExtend` (colors/radius/spacing) comes entirely from
 * `@spine/ui-native/tailwind-preset` — see that file's own doc comment for
 * why it's a plain `theme.extend`-shaped object spread in here directly,
 * NOT a Tailwind `presets` array entry. `content`/`darkMode` stay here,
 * per-app, since `content` is a real per-app file-scanning glob.
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
