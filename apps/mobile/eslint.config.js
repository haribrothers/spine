import base from "@spine/config/eslint/expo";
import i18n from "@spine/config/eslint/i18n";

export default [
  ...base,
  // US-OPS-16: copy comes from @spine/shared/i18n.
  { files: ["app/**/*.tsx", "src/**/*.tsx"], ignores: ["src/**/__tests__/**", "src/test-utils/**", "src/**/*.test.tsx"], ...i18n },
];
