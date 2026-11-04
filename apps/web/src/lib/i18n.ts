import { useTranslation } from "react-i18next";
import { i18n } from "@spine/shared/i18n";

export { i18n, t } from "@spine/shared/i18n";

/**
 * US-OPS-16 — in a component: `const t = useT();`. Outside one (a label
 * map, a helper, a toast message), import `t` from here. Both read the
 * shared English strings in `@spine/shared/i18n`.
 */
export function useT(): typeof i18n.t {
  return useTranslation(undefined, { i18n }).t;
}
