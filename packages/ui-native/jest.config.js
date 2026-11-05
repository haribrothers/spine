/** @type {import('jest').Config} */
module.exports = {
  ...require("./jest-config-base.js"),
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect", "<rootDir>/jest.setup.ts"],
  // `pnpm verify` and CI run every package's unit tests at once; a component test can then take longer than Jest's 5 s default.
  testTimeout: 20_000,
};
