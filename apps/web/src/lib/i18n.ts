export { formatLocale, i18n, setFormatLocale, t } from "@spine/shared/i18n";
export { useT } from "./use-t";

/*
 * US-OPS-16 — in a component: `const t = useT();`. Outside one (a label
 * map, a helper, a toast message) and in server components, import `t`
 * from here. Both read the shared English strings in `@spine/shared/i18n`.
 */
