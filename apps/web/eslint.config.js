import base from "@spine/config/eslint";
import money from "@spine/config/eslint/money";
import i18n from "@spine/config/eslint/i18n";

export default [
  // public/sw.js runs in the ServiceWorker global scope, not the browser/
  // node globals this config assumes — it's a static asset served as-is,
  // not app source, so it's excluded the same way build output already is.
  { ignores: ["public/**"] },
  ...base,
  // US-OPS-24: money only through formatMoney.
  { files: ["src/**/*.{ts,tsx}"], ignores: ["src/lib/money.ts"], ...money },
  // US-OPS-16: copy comes from @spine/shared/i18n.
  { files: ["src/**/*.tsx"], ignores: ["src/**/__tests__/**", "src/**/*.test.tsx", "src/test/**"], ...i18n },
];
