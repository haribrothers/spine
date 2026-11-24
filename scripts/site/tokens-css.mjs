// US-SITE-01 — the docs site's theme, generated from packages/config/tokens.json
// (no colour values in the site's own source): Starlight's accent, grey
// scale, background, font and radius, light and dark. With --home, the home
// page's theme instead (US-SITE-02, D-275), which isn't a Starlight page.
// Run before `astro dev` / `astro build`:
//   node ../../scripts/site/tokens-css.mjs src/styles/tokens.css
//   node ../../scripts/site/tokens-css.mjs --home src/styles/tokens.css
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const tokens = JSON.parse(readFileSync(join(root, "packages/config/tokens.json"), "utf8"));
const home = process.argv.includes("--home");
const out = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!out) throw new Error("Pass the CSS file to write.");

/** Starlight's names for Spine's tokens: in dark mode the grey scale runs light to dark, in light mode dark to light. */
function vars(c) {
  return {
    "--sl-color-accent-low": c["info-bg"],
    "--sl-color-accent": c.primary,
    "--sl-color-accent-high": c["primary-hover"],
    "--sl-color-white": c["on-surface"],
    "--sl-color-gray-1": c["neutral-900"],
    "--sl-color-gray-2": c["neutral-700"],
    "--sl-color-gray-3": c["neutral-500"],
    "--sl-color-gray-4": c["neutral-300"],
    "--sl-color-gray-5": c["neutral-200"],
    "--sl-color-gray-6": c["neutral-100"],
    "--sl-color-gray-7": c["neutral-50"],
    "--sl-color-black": c.background,
    "--sl-color-bg-nav": c.surface,
    "--sl-color-bg-sidebar": c.surface,
    "--sl-color-hairline": c.border,
    "--sl-color-hairline-light": c.border,
    "--sl-color-hairline-shade": c["border-strong"],
    "--sl-color-text-accent": c.primary,
    "--sl-color-green-low": c["paid-bg"],
    "--sl-color-green": c.paid,
    "--sl-color-orange-low": c["due-soon-bg"],
    "--sl-color-orange": c["due-soon"],
    "--sl-color-red-low": c["overdue-bg"],
    "--sl-color-red": c.overdue,
    "--sl-color-blue-low": c["info-bg"],
    "--sl-color-blue": c.info,
    "--spine-on-primary": c["on-primary"],
    "--spine-surface": c.surface,
  };
}
/** The home page's names (apps/site/src/styles/home.css). The inverse panel is the install section. */
function homeVars(mode) {
  const c = tokens.color[mode];
  const dark = mode === "dark";
  return {
    "--bg": c.background,
    "--surface": c.surface,
    "--sunken": dark ? c["neutral-100"] : c["neutral-50"],
    "--n100": c["neutral-100"],
    "--ink": c["on-surface"],
    "--muted": c["on-surface-muted"],
    "--border": c.border,
    "--border-strong": c["border-strong"],
    "--primary": c.primary,
    "--primary-hover": c["primary-hover"],
    "--on-primary": c["on-primary"],
    "--info-bg": c["info-bg"],
    "--paid": c.paid,
    "--paid-bg": c["paid-bg"],
    "--due": c["due-soon"],
    "--due-bg": c["due-soon-bg"],
    "--over": c.overdue,
    "--over-bg": c["overdue-bg"],
    "--teal": c["category-teal"],
    "--teal-bg": c["category-teal-bg"],
    "--panel": dark ? c.surface : tokens.color.inverse.surface,
    "--on-panel": dark ? c["on-surface"] : tokens.color.inverse["on-surface"],
    "--on-panel-muted": dark ? c["neutral-700"] : tokens.color.inverse["on-surface-muted"],
    "--panel-line": dark ? c["border-strong"] : c["neutral-700"],
    "--raised": tokens.shadow[mode].raised,
    "--overlay": tokens.shadow[mode].overlay,
  };
}
/** What doesn't change with the theme: the terminal and code samples stay dark, like a terminal. */
function homeRoot() {
  const d = tokens.color.dark;
  return {
    "--font": `"${tokens.typography.web["body-md"].fontFamily} Variable", "${tokens.typography.web["body-md"].fontFamily}", ui-sans-serif, system-ui, sans-serif`,
    "--font-mono": `"${tokens.typography.web["mono-data"].fontFamily}", ui-monospace, monospace`,
    "--r-sm": tokens.radius.sm,
    "--r-md": tokens.radius.md,
    "--r-lg": tokens.radius.lg,
    "--r-full": tokens.radius.full,
    "--ease": tokens.motion["easing-standard"],
    "--decel": tokens.motion["easing-decelerate"],
    "--t-fast": tokens.motion["duration-fast"],
    "--t-base": tokens.motion["duration-base"],
    "--t-slow": tokens.motion["duration-slow"],
    "--brand-teal": tokens.color.brand.teal,
    "--brand-deep": tokens.color.brand.deep,
    "--term-bg": d.background,
    "--term-ink": d["on-surface"],
    "--term-soft": d["neutral-700"],
    "--term-muted": d["neutral-500"],
    "--term-line": d.border,
    "--term-line-strong": d["border-strong"],
    "--term-hover": d["neutral-100"],
    "--term-blue": d.primary,
    "--term-green": d.paid,
    "--term-amber": d["due-soon"],
    "--term-purple": d["category-purple"],
  };
}

const block = (selector, v) => `${selector} {\n${Object.entries(v).map(([k, val]) => `  ${k}: ${val};`).join("\n")}\n}\n`;
const font = tokens.typography.web["body-md"].fontFamily;
const header = "/* Generated by scripts/site/tokens-css.mjs from packages/config/tokens.json — don't edit. */";
const css = home
  ? [
      header,
      block(":root", homeRoot()),
      block(":root", homeVars("light")),
      block(":root[data-theme='dark']", homeVars("dark")),
      // Before the theme script runs, or without JavaScript, follow the system.
      `@media (prefers-color-scheme: dark) {\n${block(":root:not([data-theme])", homeVars("dark")).replace(/^/gm, "  ")}}\n`,
    ].join("\n")
  : [
      header,
      `:root {\n  --sl-font: "${font}", ui-sans-serif, system-ui, sans-serif;\n  --sl-font-mono: "IBM Plex Mono", ui-monospace, monospace;\n  --spine-radius-sm: ${tokens.radius.sm};\n  --spine-radius-md: ${tokens.radius.md};\n  --spine-radius-lg: ${tokens.radius.lg};\n  --spine-brand-teal: ${tokens.color.brand.teal};\n  --spine-brand-deep: ${tokens.color.brand.deep};\n}\n`,
      block(":root", vars(tokens.color.dark)),
      block(":root[data-theme='light']", vars(tokens.color.light)),
    ].join("\n");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, css);
