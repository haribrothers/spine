/** @type {import('jest').Config} */
module.exports = {
  ...require("@spine/ui-native/jest-config-base"),
  // A fresh in-memory read cache per test (the app's is SQLite).
  setupFilesAfterEnv: ["<rootDir>/src/test-utils/jest-setup.ts"],
};
