import base from "@spine/config/eslint";
import i18n from "@spine/config/eslint/i18n";

export default [
  ...base,
  // US-OPS-16: copy comes from @spine/shared/i18n.
  { files: ["src/**/*.tsx"], ignores: ["src/**/*.test.tsx", "src/test/**"], ...i18n },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        URL: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
  },
];
