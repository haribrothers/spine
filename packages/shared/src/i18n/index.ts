import i18next, { type i18n as I18n } from "i18next";
import english from "./en.json";

/**
 * US-OPS-16 (D-268, D-069) — every user-facing string in the web app, the
 * field app and the component libraries, in English (the only language in
 * 1.0). Keys are `area.screen.thing`, e.g. `invoices.detail.issue`;
 * interpolation is `{{name}}`, plurals are `_one`/`_other` with `count`.
 * A translation is a sibling of `en` with the same keys.
 */
export const en = english;

export type EnglishStrings = typeof en;

declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: EnglishStrings };
    returnNull: false;
  }
}

/**
 * The one i18next instance the web app, the field app and the component
 * libraries read their strings from — ready on import (`initAsync: false`),
 * so module-level `t()` calls work too. React components read it through
 * each package's own `useT()` (`lib/i18n.ts`), built on that package's
 * `react-i18next`, so it always uses the package's own React.
 */
export const i18n: I18n = i18next.createInstance();
void i18n.init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

let locale = "en-US";

/**
 * US-OPS-16 — the business's locale (one business per install), for dates
 * and numbers anywhere, the component libraries included. Each app sets it
 * once it knows the business: the web app's server layout, the field app's
 * session.
 */
export function setFormatLocale(value: string | null | undefined): void {
  locale = value || "en-US";
}

export function formatLocale(): string {
  return locale;
}

/** Outside a component: a label map, a helper, a toast message. */
export const t: typeof i18n.t = i18n.t.bind(i18n);
