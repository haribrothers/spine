import i18next from "eslint-plugin-i18next";

/**
 * US-OPS-16 (D-268) — every user-facing string comes from
 * `@spine/shared/i18n` (`t()` / `useT()`), never a literal in a component.
 * Checks JSX text and the attributes people see or hear. A string that
 * isn't copy (a code sample, a file name, a brand) can say so with an
 * eslint-disable comment and a reason.
 */
export default {
  plugins: { i18next },
  rules: {
    "i18next/no-literal-string": [
      "error",
      {
        mode: "jsx-only",
        message: "User-facing text comes from @spine/shared/i18n: use t() or useT() (US-OPS-16).",
        "jsx-attributes": {
          include: [
            "label", "title", "description", "placeholder", "aria-label", "aria-description", "aria-valuetext", "alt", "helperText", "hint",
            "confirmLabel", "cancelLabel", "dismissLabel", "saveLabel", "submitLabel", "menuLabel", "emptyMessage", "emptyText", "tooltip",
            "accessibilityLabel", "accessibilityHint", "headerTitle", "message", "caption", "heading", "subtitle", "error",
          ],
        },
        words: { exclude: ["[0-9!-/:-@[-`{-~\\s·•—–…×→←↗✓✕]+", "[A-Z_-]+", "Spine", "SPiNE"] },
      },
    ],
  },
};
