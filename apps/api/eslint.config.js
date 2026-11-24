import base from "@spine/config/eslint";
import money from "@spine/config/eslint/money";

export default [
  ...base,
  // US-OPS-24: what customers read (PDFs, emails) shows money only through formatMoney.
  { files: ["src/modules/pdf/**/*.{ts,tsx}", "src/modules/email/**/*.{ts,tsx}"], ...money },
];
