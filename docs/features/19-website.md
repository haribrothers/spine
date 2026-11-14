# 19 · Website and help

A public website built with Astro and Starlight that holds everything people read about Spine — the home page at `spine.h4loom.com` (`apps/site`) and, under `/docs/` on the same site (`apps/docs`), a task-based user guide, a self-hosting guide, developer docs and a generated API reference. The same user guide is bundled into every Spine install, so the in-app Help menu works without internet and always matches the running version.

**Screens:** `SiteHome` (P1), `SiteHomeDark` (P2), `SiteUserGuide` (P1), `SiteUserGuideDark` (P2), `SiteSelfHosting` (P1), `SiteApiReference` (P2), `SiteSearch` (P2), `AppHelpMenu` (P1), `BundledGuide` (P1)
**Depends on:** 18 Self-hosting (install, backups, storage), 05-api (OpenAPI document), design tokens, `apps/e2e` (screenshot capture).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-SITE-01 | Site, home page and search | P1 | 10 | `SiteHome`, `SiteHomeDark`, `SiteSearch` |
| F-SITE-02 | User guide | P1 | 10 | `SiteUserGuide`, `SiteUserGuideDark` |
| F-SITE-03 | Self-hosting guide | P1 | 10 | `SiteSelfHosting` |
| F-SITE-04 | Developer docs and API reference | P2 | 10 | `SiteApiReference` |
| F-SITE-05 | In-app help | P1 | 10 | `AppHelpMenu`, `BundledGuide` |
| F-SITE-06 | Versions and publishing | P2 | 10 | `SiteUserGuide` |

## User stories

### US-SITE-01 · Set up the docs site in the monorepo
**Feature:** F-SITE-01 · **Priority:** P1 · **Phase:** 12 · **Screens:** `SiteUserGuide`, `SiteUserGuideDark`
**As** a maintainer, **I want** a home page and one docs site that look like Spine, **so that** guides, self-hosting and developer docs live in one place.

Decision: D-108

**Acceptance criteria**
- **Given** the monorepo, **when** I run `pnpm --filter @spine/docs dev`, **then** an Astro + Starlight site starts with the sections "Get started", "User guide", "Self-hosting" and "Developers" in its sidebar; `pnpm --filter @spine/site dev` starts the home page, whose links lead to the docs under `/docs/`.
- **Given** the site, **when** it renders, **then** its accent colour, fonts, radius and logo come from `docs/design/tokens.json` and the Spine wordmark, and it looks like the `SiteUserGuide` design.
- **Given** a reader's system or the theme menu ("Auto", "Light", "Dark"), **when** they change it, **then** the whole site switches, matching `SiteUserGuideDark` (D-100).
- **Given** the build, **when** it runs, **then** every internal link is checked and the build fails on a broken one.
- **Given** the site's folder structure, **when** a second language is added later, **then** it only needs a new locale folder (English only for 1.0, D-108).
- **Given** `pnpm verify` or the CI pipeline, **when** a change touches `apps/site/**` or `apps/docs/**`, **then** both are built and link-checked in the unit and integration job.

**Implementation notes**
- `apps/docs` (package `@spine/docs`): Astro 5, `@astrojs/starlight`, `starlight-links-validator`; Starlight's built-in Pagefind search. `apps/site` (package `@spine/site`): Astro 5, sharing the docs' theme tokens ([D-270](12-decisions.md)).
- Turbo task `build` for the site; no runtime server — the output is static HTML.
- Built: `apps/docs` (`@spine/docs`) and `apps/site` (`@spine/site`) on Astro 7.4 and Starlight 0.42. Those are the current lines: Starlight no longer supports Astro 5, which D-108's notes assumed. The theme is generated from `docs/design/tokens.json` by `scripts/site/tokens-css.mjs` before each build, so neither site holds a colour of its own. The logo comes from `docs/logos`. `starlight-links-validator` fails the docs' build on a broken link, and `scripts/site/build-pages.mjs` fails on a home-page link or anchor that goes nowhere. CI and `pnpm verify` (the `sites` step) build both. Since D-275 the home page is its own Astro page rather than Starlight's splash, on the same tokens and the same theme setting.

### US-SITE-02 · Show a home page for people discovering Spine
**Feature:** F-SITE-01 · **Priority:** P1 · **Phase:** 12 · **Screens:** `SiteHome`, `SiteHomeDark`
**As** someone evaluating Spine, **I want** a clear home page, **so that** I understand what it does and how to try it in a minute.

**Acceptance criteria**
- **Given** the site root, **when** it opens, **then** it shows "Run your service business from one place", the one-paragraph description, and the buttons "Install in 5 minutes" and "Read the user guide".
- **Given** the workflow strip, **when** it renders, **then** it reads "Enquiry → Quote → Job → Invoice → Payment → Books".
- **Given** the product view (the dashboard, rebuilt in HTML from one example job, [D-275](../prd/12-decisions.md)), **when** a reader uses dark mode, **then** it's shown in the dark theme.
- **Given** the feature cards, **when** they render, **then** they cover quotes accepted online, jobs with milestones and retention, invoices that post to the books, the offline field app, self-hosting, and a link to the developer docs.
- **Given** the footer, **when** it renders, **then** it names the licence (AGPL-3.0, [D-263](../prd/12-decisions.md)) and links to older doc versions.
- **Given** a wide, tall window, **when** the reader scrolls through "How it works", **then** the section stays in place and the example job moves through the six steps, ending in a journal entry whose debits equal its credits; a step's button jumps to it.
- **Given** a phone, a short window, the reader's reduced-motion setting or no JavaScript, **when** the page renders, **then** nothing moves or is hidden: "How it works" is a list of the six steps and each demo shows its last state.
- **Given** the theme switch ("Match my system", "Light", "Dark"), **when** the reader picks one, **then** the page switches and the docs open in the same theme (Starlight's setting, [D-100](../prd/12-decisions.md)).

**Implementation notes**
- Its own Astro page, not Starlight's splash ([D-275](../prd/12-decisions.md)): the design is the Claude Design project "Spine home page redesign" (`SiteHome`, `SiteHomeDark`), with references from Mobbin (Twenty, Beside, Mercury, FLORA, Function, Giga).
- Built: `apps/site/src/pages/index.astro` with `components/` (Header, Hero, Flow, Features, Install, Footer, Icon), `layouts/Page.astro`, `scripts/motion.ts` and `styles/home.css`; every word in `locales/en/home.ts`. The theme comes from `docs/design/tokens.json` (`scripts/site/tokens-css.mjs --home`); Inter and IBM Plex Mono are self-hosted (Fontsource); icons are Lucide, one import each (`@lucide/astro`). `src/pages/404.astro` is the site's missing-page answer outside `/docs/`. `scripts/us-site-02.test.mjs` builds the page and checks each criterion, that the source has no hex colours, and that the example job's figures add up.

### US-SITE-03 · Find any page with search
**Feature:** F-SITE-01 · **Priority:** P2 · **Phase:** 12 · **Screens:** `SiteSearch`
**As** a reader, **I want** to search the whole site, **so that** I find the answer without knowing where it lives.

**Acceptance criteria**
- **Given** any page, **when** I press Ctrl K (Cmd K on Mac) or click "Search", **then** a search dialog opens with focus in the field.
- **Given** I type "send", **when** results appear, **then** each shows its section path ("User guide › Quotes"), the page title with the match highlighted, and a short excerpt.
- **Given** the bundled guide on a server without internet, **when** I search, **then** it still works (search runs in the browser).
- **Given** the dialog, **when** I press Escape, **then** it closes and focus returns where it was.

**Implementation notes**
- Pagefind index built at build time; no external search service.
- Built: Starlight's Pagefind search (Ctrl K / ⌘K), built at build time; the bundled guide has its own index and works offline. Results show the page title, the matching headings and an excerpt with the match highlighted. Starlight's results don't print a section path such as "User guide › Quotes"; the page titles say what they are.

### US-SITE-04 · Read a task-based guide for every module
**Feature:** F-SITE-02 · **Priority:** P1 · **Phase:** 12 · **Screens:** `SiteUserGuide`
**As** an owner, office staff member or field user, **I want** step-by-step guides for the things I do, **so that** I can work without asking anyone.

Decision: D-113

**Acceptance criteria**
- **Given** the "User guide" section, **when** it opens, **then** it has a group for each module a user touches: setting up your business, contacts and pipeline, meetings, catalogue, quotes, jobs and milestones, invoices and credit notes, payments and receivables, purchases and expenses, tax, reports, dashboard, team and permissions, banking, notifications, settings and data export, the AI assistant, connected agents, and the field app.
- **Given** a guide page, **when** it renders, **then** it is titled as a task ("Send a quote to a customer"), says who can do it (role and capability), lists numbered steps, and shows a screenshot.
- **Given** a feature hidden behind a later phase or a capability, **when** its page renders, **then** it says which role or Team right is needed.
- **Given** every feature built in Phases 0–11, **when** Phase 12 is done, **then** each has at least one guide page.
- **Given** a page, **when** it renders, **then** it shows "Last updated with Spine <version>" and previous/next links.

**Implementation notes**
- Content in `apps/docs/src/content/docs/guide/<module>/*.mdx`; asides use Starlight's note/tip/caution/danger.
- Built: 268 pages in 20 module folders under `guide/`, written from the stories, `en.json` and the components by 10 parallel agents, then built and link-checked. Places where a ticked story and the app disagree were written as the app behaves; they're listed in the 2026-11-05 CHANGELOG entry.

### US-SITE-05 · Ship each story with its guide page
**Feature:** F-SITE-02 · **Priority:** P1 · **Phase:** 12 · **Screens:** `SiteUserGuide`
**As** a maintainer, **I want** guide pages updated in the same change as the feature, **so that** the guide never lags behind the app.

Decision: D-113

**Acceptance criteria**
- **Given** a story that changes what people see, **when** its PR is opened, **then** it includes the new or updated guide page under `apps/docs/src/content/docs/guide/`.
- **Given** the definition of done in 11-testing-release, **when** a story is ticked in `docs/progress.md`, **then** "guide page updated" is part of it.
- **Given** a guide page that names a button or field, **when** the app's copy changes, **then** the page is updated in the same change (the UI copy is the source of truth).

**Implementation notes**
- Rule recorded in CLAUDE.md and 11-testing-release; applies to stories from Phase 12 onward.
- Built: the rule is in CLAUDE.md, the definition of done (11-testing-release) and `.github/pull_request_template.md`.

### US-SITE-06 · Capture guide screenshots automatically
**Feature:** F-SITE-02 · **Priority:** P2 · **Phase:** 12 · **Screens:** `SiteUserGuide`, `SiteUserGuideDark`
**As** a maintainer, **I want** screenshots captured from a real install, **so that** the guide always shows the current screens in both themes.

**Acceptance criteria**
- **Given** `pnpm --filter @spine/e2e screenshots`, **when** it runs against a demo-seeded install, **then** it saves each listed screen in light and dark mode to `apps/docs/src/assets/screens/`.
- **Given** a guide page with a screenshot, **when** a reader uses dark mode, **then** the dark capture is shown.
- **Given** a screen's layout changes, **when** the command runs again, **then** the images update and the PR shows the diff.

**Implementation notes**
- Playwright, reusing `apps/e2e`'s `seededOrg` fixture; a manifest maps guide pages to routes.
- Built: `pnpm --filter @spine/e2e screenshots` (`playwright.screenshots.config.ts`, `screenshots/capture.spec.ts`) reads `apps/docs/screenshots/*.json` (183 screens: id, route with `{placeholder}` ids from the demo data, alt, optional click and wait text) and saves `<id>-light.png` and `<id>-dark.png`. `<Screenshot id alt />` shows the one matching the reader's theme, or the description until it's captured. (The run captured the home page's dashboard too until the home page rebuilt it in HTML, D-275.)

### US-SITE-07 · Install Spine from the self-hosting guide
**Feature:** F-SITE-03 · **Priority:** P1 · **Phase:** 12 · **Screens:** `SiteSelfHosting`
**As** a self-hoster, **I want** a complete install guide, **so that** I can go from a clean machine to a running Spine on my own.

**Acceptance criteria**
- **Given** "Self-hosting › Install", **when** I follow it on a clean machine with Docker, **then** I reach a running Spine and issue a first invoice in under 5 minutes (NFR-MNT-01).
- **Given** "Configuration", **when** it renders, **then** it lists every environment variable with its default, whether it's required, and what happens without it.
- **Given** "HTTPS and domains", **when** I follow it, **then** Caddy serves Spine on my domain with automatic HTTPS.
- **Given** "Troubleshooting", **when** it renders, **then** it covers the health check, logs, the email log (D-220) and the most common install errors with what to do.

**Implementation notes**
- The README's install section links here; the site is the long version (US-OPS-19).
- Built: `self-hosting/install`, `configuration` (every variable in `.env.example` and the Compose files), `email`, `https-and-domains`, `troubleshooting`, `coolify`.

### US-SITE-08 · Run, back up and upgrade from the self-hosting guide
**Feature:** F-SITE-03 · **Priority:** P1 · **Phase:** 12 · **Screens:** `SiteSelfHosting`
**As** a self-hoster, **I want** clear backup, restore, storage and upgrade pages, **so that** my business data is safe over the years.

**Acceptance criteria**
- **Given** "Backups and restore", **when** it renders, **then** it shows `./scripts/backup.sh --passphrase`, the `BACKUP_PASSPHRASE` / `BACKUP_REMOTE` settings, a nightly cron example and `./scripts/restore.sh`, with a danger note that a lost passphrase can't be recovered.
- **Given** the same page, **when** it renders, **then** a caution note warns that `docker compose down -v` deletes the database and files.
- **Given** "File storage", **when** it renders, **then** it explains the `local` and `s3` drivers, the optional `rustfs` profile and how to move files off MinIO (US-OPS-30).
- **Given** "Upgrades", **when** it renders, **then** it explains the pre-upgrade backup, automatic migrations and how to read the in-app update notice.

**Implementation notes**
- Content mirrors US-OPS-01/03/04/27/30; those stories update these pages when they change.
- Built: `self-hosting/backups`, `file-storage`, `upgrades`.

### US-SITE-09 · Learn the codebase from the developer docs
**Feature:** F-SITE-04 · **Priority:** P2 · **Phase:** 12 · **Screens:** `SiteApiReference`
**As** a contributor, **I want** an overview of how Spine is built, **so that** I can make a correct change without reading the whole spec.

**Acceptance criteria**
- **Given** "Developers", **when** it opens, **then** it has "Architecture", "Local setup", "How the ledger works", "Testing" and "Contributing".
- **Given** "How the ledger works", **when** it renders, **then** it explains derived postings, immutability and the posting rules table, linking to the spec for details.
- **Given** "Contributing", **when** it renders, **then** it describes the branch-per-phase workflow, story ids in commits, running checks locally, and the licence (Q-01).
- **Given** the component libraries, **when** they're mentioned, **then** the page links to `apps/design-system` and the native showcase rather than duplicating them.

**Implementation notes**
- The spec in `docs/` stays the source for Claude Code; developer docs are written for people and link to it.
- Built: `developers/architecture`, `local-setup`, `ledger`, `testing`, `contributing`, `api` (authentication, idempotency, errors).

### US-SITE-10 · Browse a generated API reference
**Feature:** F-SITE-04 · **Priority:** P2 · **Phase:** 12 · **Screens:** `SiteApiReference`
**As** a developer integrating with Spine, **I want** an API reference that matches the code, **so that** I can trust what I read.

**Acceptance criteria**
- **Given** the API's OpenAPI document, **when** the site builds, **then** "API reference" has a page per operation, grouped by module (e.g. "Invoices › Issue an invoice").
- **Given** an operation page, **when** it renders, **then** it shows the method and path, required capability, the `Idempotency-Key` header for mutations, parameters, every response status with its meaning, and a `curl` example.
- **Given** a route is added or changed in the API, **when** the site is rebuilt, **then** the reference changes with it — nobody edits it by hand.
- **Given** the "Authentication", "Idempotency" and "Errors" pages, **when** they render, **then** they match 05-api's conventions.

**Implementation notes**
- `starlight-openapi` reading the document exported by `apps/api` at build time.
- Built: `pnpm --filter @spine/api openapi <file>` writes the document without starting the API (NestJS preview mode) and adds, per operation, who may call it (role and Team right from the route's metadata), the `Idempotency-Key` header on writes, the error statuses and a `curl` example. `apps/docs/openapi.json` is that output, never edited by hand; CI fails when it's stale. `starlight-openapi` makes one page per operation under API reference.

### US-SITE-11 · Open help for the page I'm on
**Feature:** F-SITE-05 · **Priority:** P1 · **Phase:** 12 · **Screens:** `AppHelpMenu`
**As** a member using Spine, **I want** the Help button to open the right guide page, **so that** help is one click away.

Decision: D-110

**Acceptance criteria**
- **Given** any page in the app, **when** I press the Help (?) button in the sidebar footer, **then** a menu opens with "Help for this page", "User guide", "What's new in <version>", "Keyboard shortcuts" and "Online docs ↗".
- **Given** I'm on Invoices, **when** I choose "Help for this page", **then** the guide page for invoices opens in a new tab from this server (`/help/guide/invoices/`).
- **Given** a page with no specific guide, **when** I choose "Help for this page", **then** the user guide's start page opens.
- **Given** the menu footer, **when** it renders, **then** it reads "Spine <version> · the guide on this server matches your version".
- **Given** "Online docs ↗", **when** I choose it, **then** the public site opens at the version matching this install.

**Implementation notes**
- `HelpButton` (today a placeholder) becomes a `DropdownMenu`; a route → guide-page map lives in `apps/web/src/lib/help-links.ts`.
- Built: `apps/web/src/components/help-button.tsx` (DropdownMenu, icons from `MENU_ICONS`, D-222), `apps/web/src/lib/help-links.ts`. "What's new" opens the version's GitHub release notes; "Keyboard shortcuts" opens `guide/keyboard-shortcuts/`.

### US-SITE-12 · Read the guide without internet
**Feature:** F-SITE-05 · **Priority:** P1 · **Phase:** 12 · **Screens:** `BundledGuide`
**As** someone running Spine on a network with no internet, **I want** the guide served by my own server, **so that** help always works.

Decision: D-110

**Acceptance criteria**
- **Given** a Spine install, **when** I open `<APP_URL>/help/`, **then** the user guide for the installed version loads from the server itself, with no outside requests.
- **Given** the bundled guide, **when** it renders, **then** a banner reads "You're reading the guide for Spine <version>, served by your own server — it works without internet." with "See the latest online docs ↗".
- **Given** the bundled guide, **when** it renders, **then** it has no version switcher and contains the user guide and self-hosting sections (developer docs and API reference are online only).
- **Given** search in the bundled guide, **when** I use it offline, **then** it works.

**Implementation notes**
- The web image's build copies `apps/docs`' `guide` and `self-hosting` output into `/help`; served as static files by the web app (no API involvement, no login needed).
- Built: `pnpm --filter @spine/docs build:help` (`DOCS_BUNDLED=1`, base `/help`, no developer docs, a banner, no outside links but the banner's) writes into `apps/web/public/help`. `docker/Dockerfile.web` runs it before the web build, and the E2E web server does too. `next.config.ts` rewrites `/help/<page>` to its `index.html`.

### US-SITE-13 · Read docs for the version I run
**Feature:** F-SITE-06 · **Priority:** P2 · **Phase:** 12 · **Screens:** `SiteUserGuide`
**As** a self-hoster who hasn't upgraded yet, **I want** docs that match my version, **so that** instructions match what I see.

Decision: D-111

**Acceptance criteria**
- **Given** the header, **when** I open the version menu, **then** it lists the latest version and each earlier 1.x minor release ("v1.2 (latest)", "v1.1", "v1.0").
- **Given** I pick v1.1, **when** a page opens, **then** it shows that version's content, and pages that didn't exist then say so.
- **Given** a new minor release is tagged, **when** the site is published, **then** the previous minor is archived as its own version.

**Implementation notes**
- `starlight-versions` plugin; versions start at 1.0.
- Built: `starlight-versions`, driven by `apps/docs/src/versions.json` (empty at 1.0, so there's no menu yet; tested with an archived 1.0). The release steps are in docs/release.md. `/versions/` lists them.

### US-SITE-14 · Publish the site after each merge
**Feature:** F-SITE-06 · **Priority:** P2 · **Phase:** 12 · **Screens:** —
**As** a maintainer, **I want** the public site to update itself, **so that** published docs never fall behind `main`.

Decision: D-270

**Acceptance criteria**
- **Given** a merge to `main` that changes `apps/site/**`, `apps/docs/**` or the API's OpenAPI document, **when** Cloudflare's Git integration (Workers Builds) sees it, **then** the site is built and deployed: the home page at `spine.h4loom.com` and the docs under `/docs/` on it ([D-273](../prd/12-decisions.md)).
- **Given** the domain changes, **when** it's changed in `packages/shared/src/public-site.ts`, **then** both sites, the app's Help menu and the tests use the new addresses, and a test names any file that still spells out the old ones (the README, GitHub's issue template).
- **Given** a branch, **when** it's pushed, **then** it gets a preview address to check before merging.
- **Given** a merge that doesn't touch the site, **when** it lands, **then** the publish workflow doesn't run.
- **Given** the build fails (e.g. a broken link), **when** the workflow runs, **then** the live site is left unchanged and the run fails.
- **Given** the repo is private until the v1.0 tag ([D-262](../prd/12-decisions.md)), **when** the site publishes before then, **then** the site is still public.

**Implementation notes**
- Cloudflare's Git integration (Workers Builds, [D-274](../prd/12-decisions.md)), one Worker with static assets whose build (`pnpm site:build`) puts the docs into the home page's `docs/` folder, with build watch paths; no GitHub workflow and no Actions minutes ([D-270](12-decisions.md), [D-273](12-decisions.md)). Web analytics off.
- Built: the Worker's settings (build command, watch paths, branch previews, domain; `wrangler.jsonc` holds the assets folder, the 404 page and telemetry off) are in docs/release.md › The website and docs. The Owner connected it in the Cloudflare dashboard on 2026-11-14 and checked publishing from `main`, branch previews, skipped builds and failed builds.
- Built (D-273): `packages/shared/src/public-site.ts` holds the domain; `scripts/site/build-pages.mjs` builds both sites into `apps/site/dist` and checks the home page's links (into `/docs/`, to its own pages and their anchors); `scripts/us-site-14.test.mjs` checks the README and the issue template agree with it and that no code names the domain itself.
