/**
 * Shared Jest base for any app or package rendering `packages/ui-native`
 * components — extend via `module.exports = { ...require("@spine/ui-native/jest-config-base"), ...myOverrides }`.
 *
 * `@react-native/jest-preset`'s test environment sets
 * customExportConditions = ['require', 'react-native'] — both conditions
 * match lucide-react-native's package.json `exports` map, and its
 * "react-native" condition (an ESM-only .mjs build) wins over "require"
 * (its CJS build), which Jest's CJS-based runtime can't load
 * ("SyntaxError: Unexpected token 'export'"). Dropping 'react-native' here
 * forces Jest to resolve the CJS build instead — this only affects module
 * resolution INSIDE Jest; Metro (the real app bundler) has its own resolver
 * and correctly picks the "react-native" condition for actual builds,
 * unaffected by this test-only override. This bug isn't specific to
 * `packages/ui-native`'s own test suite — any consumer app that renders a
 * `lucide-react-native` icon (directly or via a `packages/ui-native`
 * component) and runs Jest hits it the same way, hence extracting the fix
 * here instead of leaving it duplicated per app the first time one adds
 * tests.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testEnvironmentOptions: {
    customExportConditions: ["require"],
  },
};
