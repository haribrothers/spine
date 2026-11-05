// @ts-check
import { readFileSync } from "node:fs";
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";
import starlightVersions from "starlight-versions";
import starlightOpenAPI, { openAPISidebarGroups } from "starlight-openapi";

/** The Spine version these docs describe, shown on every page ("Last updated with Spine 1.0"). */
const version = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;
const minor = version.split(".").slice(0, 2).join(".");

/**
 * US-SITE-13 (D-111) — earlier 1.x minors, newest first, e.g. [{ "slug": "1.0" }].
 * Before publishing a new minor, add the previous one here: the plugin then
 * archives the current docs as that version (docs/release.md). The version
 * menu appears once there is one.
 */
/** @type {{ slug: string }[]} */
const archived = JSON.parse(readFileSync(new URL("./src/versions.json", import.meta.url), "utf8")).archived;

/** The user guide's modules, in the order work flows through Spine (US-SITE-04). */
const GUIDE = [
  ["setup", "Setting up your business"],
  ["contacts", "Contacts and pipeline"],
  ["meetings", "Meetings"],
  ["catalogue", "Catalogue"],
  ["quotes", "Quotes"],
  ["jobs", "Jobs and milestones"],
  ["invoices", "Invoices and credit notes"],
  ["payments", "Payments and receivables"],
  ["purchases", "Purchases and expenses"],
  ["banking", "Banking"],
  ["tax", "Tax"],
  ["reports", "Reports"],
  ["dashboard", "Dashboard"],
  ["team", "Team and permissions"],
  ["notifications", "Notifications"],
  ["settings", "Settings and data export"],
  ["accounts", "Chart of accounts and opening balances"],
  ["ai-assistant", "The AI assistant"],
  ["connected-agents", "Connected agents"],
  ["field-app", "The field app"],
];

/**
 * US-SITE-01 (D-108, D-270) — the docs at docs.h4loom.com: Get started, the
 * user guide, self-hosting and developer docs. English only for 1.0; a
 * second language is a new folder under src/content/docs/ plus a `locales`
 * entry here. DOCS_BASE serves the same build under /help on an install
 * (US-SITE-12).
 */
/**
 * US-SITE-12 (D-110) — `DOCS_BUNDLED=1` builds the copy every install serves
 * at /help: the user guide, Get started and self-hosting for this version,
 * with a banner saying so, no developer docs and no outside requests. Its
 * links were checked by the public build.
 */
const bundled = process.env.DOCS_BUNDLED === "1";

export default defineConfig({
  site: bundled ? undefined : "https://docs.h4loom.com",
  base: bundled ? "/help" : "/",
  trailingSlash: "always",
  vite: { define: { "import.meta.env.SPINE_VERSION": JSON.stringify(version), "import.meta.env.DOCS_BUNDLED": JSON.stringify(bundled) } },
  integrations: [
    starlight({
      title: "Spine Docs",
      description: "How to use, install, run and develop Spine, the self-hosted business app for service and project businesses.",
      logo: { light: "./src/assets/logo-light.svg", dark: "./src/assets/logo-dark.svg", replacesTitle: true, alt: "Spine" },
      favicon: "/favicon.svg",
      customCss: ["./src/styles/tokens.css", "./src/styles/theme.css"],
      social: bundled ? [] : [{ icon: "github", label: "GitHub", href: "https://github.com/haribrothers/spine" }],
      lastUpdated: false,
      pagination: true,
      components: { Footer: "./src/components/Footer.astro", ...(bundled ? { Banner: "./src/components/BundledBanner.astro" } : {}) },
      sidebar: [
        { label: "Get started", items: [{ autogenerate: { directory: "get-started" } }] },
        {
          label: "User guide",
          items: [
            { label: "Overview", slug: "guide" },
            ...GUIDE.map(([directory, label]) => ({ label, collapsed: true, items: [{ autogenerate: { directory: `guide/${directory}` } }] })),
            { label: "Keyboard shortcuts", slug: "guide/keyboard-shortcuts" },
          ],
        },
        { label: "Self-hosting", items: [{ autogenerate: { directory: "self-hosting" } }] },
        ...(bundled ? [] : [{ label: "Developers", items: [{ autogenerate: { directory: "developers" } }, ...openAPISidebarGroups] }]),
      ],
      plugins: bundled
        ? []
        : [
            starlightLinksValidator({ errorOnRelativeLinks: false, errorOnLocalLinks: true, exclude: ["/api/**"] }),
            // US-SITE-10: generated from openapi.json, which `pnpm --filter @spine/api openapi ../docs/openapi.json` writes; never edited by hand.
            starlightOpenAPI([{ base: "api", schema: "./openapi.json", sidebar: { label: "API reference", collapsed: true, tags: { sort: "alphabetical" } } }]),
            ...(archived.length ? [starlightVersions({ current: { label: `v${minor} (latest)` }, versions: archived.map((v) => ({ ...v, label: `v${v.slug}` })) })] : []),
          ],
    }),
  ],
});
