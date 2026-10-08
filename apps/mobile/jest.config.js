/** @type {import('jest').Config} */
module.exports = {
  ...require("@spine/ui-native/jest-config-base"),
  // ui-native's stand-in for @expo/ui's native field state, then a fresh in-memory cache and outbox per test.
  setupFilesAfterEnv: ["<rootDir>/../../packages/ui-native/jest.setup.ts", "<rootDir>/src/test-utils/jest-setup.ts"],
};
