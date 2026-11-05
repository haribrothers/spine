/**
 * US-OPS-16 — `t` for components without "use client" (they also render
 * inside Next.js server components). `./i18n` brings in react-i18next, which
 * calls `createContext` when it loads, and React's server build has no
 * `createContext`, so a server-rendered component can't import it. Same
 * i18next instance and strings as `./i18n`.
 */
export { t } from "@spine/shared/i18n";
