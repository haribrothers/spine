"use client";

import { useTranslation } from "react-i18next";
import { i18n } from "@spine/shared/i18n";

/**
 * US-OPS-16 — in a component: `const t = useT();`. A client module of its
 * own: react-i18next creates a React context when it loads, which React's
 * server build can't, so server components import only `t` (lib/i18n.ts).
 */
export function useT(): typeof i18n.t {
  return useTranslation(undefined, { i18n }).t;
}
