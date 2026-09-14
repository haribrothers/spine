/** @type {import('jest').Config} */
module.exports = {
  ...require("./jest-config-base.js"),
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect", "<rootDir>/jest.setup.ts"],
};
