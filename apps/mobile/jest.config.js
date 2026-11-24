/** @type {import('jest').Config} */
module.exports = {
  ...require("@spine/ui-native/jest-config-base"),
  // ui-native's stand-in for @expo/ui's native field state, then a fresh in-memory cache and outbox per test.
  setupFilesAfterEnv: ["<rootDir>/../../packages/ui-native/jest.setup.ts", "<rootDir>/src/test-utils/jest-setup.ts"],
  // `pnpm verify` and CI run every package's unit tests at once; a screen test can then take longer than Jest's 5 s default.
  testTimeout: 20_000,
};
