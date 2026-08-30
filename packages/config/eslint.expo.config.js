import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

/**
 * `eslint-config-expo`'s own flat config is built with `eslint/config`'s
 * `defineConfig` helper (not a plain array spread) — composing it via
 * `defineConfig` here too, rather than a raw `[...expoConfig, {...}]`
 * array spread (tried first), is what correctly threads its internal
 * named-config/plugin wiring through.
 *
 * The rule override below is scoped to `files: ["**\/*.ts", "**\/*.tsx"]`
 * ONLY — `eslint-config-expo` registers `@typescript-eslint` scoped to TS
 * file globs too, and an unscoped rule override applies to every file
 * ESLint lints, including plain `.js`/`.mjs` config files
 * (babel.config.js, metro.config.js, jest.config.js, coverage-check
 * scripts) where that plugin was never registered — a real failure
 * ("could not find plugin '@typescript-eslint'") hit and fixed while
 * wiring this up, not a hypothetical.
 */
export default defineConfig([
  expoConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  { ignores: [".expo/**", "android/**", "ios/**"] },
]);
