/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect", "<rootDir>/jest.setup.ts"],
  // `@react-native/jest-preset`'s test environment sets
  // customExportConditions = ['require', 'react-native'] — both conditions
  // match lucide-react-native's package.json `exports` map, and its
  // "react-native" condition (an ESM-only .mjs build) wins over "require"
  // (its CJS build), which Jest's CJS-based runtime can't load
  // ("SyntaxError: Unexpected token 'export'"). Dropping 'react-native'
  // here forces Jest to resolve the CJS build instead — this only affects
  // module resolution INSIDE Jest; Metro (the real app bundler) has its
  // own resolver and correctly picks the "react-native" condition for
  // actual builds, unaffected by this test-only override.
  testEnvironmentOptions: {
    customExportConditions: ["require"],
  },
};
