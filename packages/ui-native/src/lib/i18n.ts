import { useTranslation } from "react-i18next";
import { i18n } from "@spine/shared/i18n";

export { formatLocale, i18n, setFormatLocale, t } from "@spine/shared/i18n";

/**
 * US-OPS-16 — in a component: `const t = useT();`. Outside one (a label
 * map, a helper, a toast message), import `t` from here. Both read the
 * shared English strings in `@spine/shared/i18n`.
 */
export function useT(): typeof i18n.t {
  // This package's TypeScript gets its own copy of i18next's types; the instance is the same one at runtime.
  return useTranslation(undefined, { i18n: i18n as never }).t as unknown as typeof i18n.t;
}
