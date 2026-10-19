# 19 · Website and help

A public website built with Astro and Starlight (`apps/site`) that holds everything people read about Spine: a home page, a task-based user guide, a self-hosting guide, developer docs and a generated API reference. The same user guide is bundled into every Spine install, so the in-app Help menu works without internet and always matches the running version.

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
**As** a maintainer, **I want** one docs site that looks like Spine, **so that** guides, self-hosting and developer docs live in one place.

Decision: D-108

**Acceptance criteria**
- **Given** the monorepo, **when** I run `pnpm --filter @spine/site dev`, **then** an Astro + Starlight site starts with the sections "Get started", "User guide", "Self-hosting" and "Developers" in its sidebar.
- **Given** the site, **when** it renders, **then** its accent colour, fonts, radius and logo come from `docs/design/tokens.json` and the Spine wordmark, and it looks like the `SiteUserGuide` design.
- **Given** a reader's system or the theme menu ("Auto", "Light", "Dark"), **when** they change it, **then** the whole site switches, matching `SiteUserGuideDark` (D-100).
- **Given** the build, **when** it runs, **then** every internal link is checked and the build fails on a broken one.
- **Given** the site's folder structure, **when** a second language is added later, **then** it only needs a new locale folder (English only for 1.0, D-108).
- **Given** the CI pipeline, **when** a PR changes `apps/site/**`, **then** the site is built and link-checked in the unit and integration job.

**Implementation notes**
- `apps/site` (package `@spine/site`): Astro 5, `@astrojs/starlight`, `starlight-links-validator`; Starlight's built-in Pagefind search.
- Turbo task `build` for the site; no runtime server — the output is static HTML.

### US-SITE-02 · Show a home page for people discovering Spine
**Feature:** F-SITE-01 · **Priority:** P1 · **Phase:** 12 · **Screens:** `SiteHome`, `SiteHomeDark`
**As** someone evaluating Spine, **I want** a clear home page, **so that** I understand what it does and how to try it in a minute.

**Acceptance criteria**
- **Given** the site root, **when** it opens, **then** it shows "Run your service business from one place", the one-paragraph description, and the buttons "Install in 5 minutes" and "Read the user guide".
- **Given** the workflow strip, **when** it renders, **then** it reads "Enquiry → Quote → Job → Invoice → Payment → Books".
- **Given** the product screenshot, **when** a reader uses dark mode, **then** the dark version of the dashboard screenshot is shown.
- **Given** the feature cards, **when** they render, **then** they cover quotes accepted online, jobs with milestones and retention, invoices that post to the books, the offline field app, self-hosting, and a link to the developer docs.
- **Given** the footer, **when** it renders, **then** it names the licence (once Q-01 is decided) and links to older doc versions.

**Implementation notes**
- Starlight `splash` template; screenshots from US-SITE-06.

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

### US-SITE-04 · Read a task-based guide for every module
**Feature:** F-SITE-02 · **Priority:** P1 · **Phase:** 12 · **Screens:** `SiteUserGuide`
**As** an owner, office staff member or field user, **I want** step-by-step guides for the things I do, **so that** I can work without asking anyone.

Decision: D-113

**Acceptance criteria**
- **Given** the "User guide" section, **when** it opens, **then** it has a group for each module a user touches: setting up your business, contacts and pipeline, meetings, catalogue, quotes, jobs and milestones, invoices and credit notes, payments and receivables, purchases and expenses, tax, reports, dashboard, team and permissions, and the field app.
- **Given** a guide page, **when** it renders, **then** it is titled as a task ("Send a quote to a customer"), says who can do it (role and capability), lists numbered steps, and shows a screenshot.
- **Given** a feature hidden behind a later phase or a capability, **when** its page renders, **then** it says which role or Team right is needed.
- **Given** every feature built in Phases 0–11, **when** Phase 12 is done, **then** each has at least one guide page.
- **Given** a page, **when** it renders, **then** it shows "Last updated with Spine <version>" and previous/next links.

**Implementation notes**
- Content in `apps/site/src/content/docs/guide/<module>/*.mdx`; asides use Starlight's note/tip/caution/danger.

### US-SITE-05 · Ship each story with its guide page
**Feature:** F-SITE-02 · **Priority:** P1 · **Phase:** 12 · **Screens:** `SiteUserGuide`
**As** a maintainer, **I want** guide pages updated in the same change as the feature, **so that** the guide never lags behind the app.

Decision: D-113

**Acceptance criteria**
- **Given** a story that changes what people see, **when** its PR is opened, **then** it includes the new or updated guide page under `apps/site/src/content/docs/guide/`.
- **Given** the definition of done in 11-testing-release, **when** a story is ticked in `docs/progress.md`, **then** "guide page updated" is part of it.
- **Given** a guide page that names a button or field, **when** the app's copy changes, **then** the page is updated in the same change (the UI copy is the source of truth).

**Implementation notes**
- Rule recorded in CLAUDE.md and 11-testing-release; applies to stories from Phase 12 onward.

### US-SITE-06 · Capture guide screenshots automatically
**Feature:** F-SITE-02 · **Priority:** P2 · **Phase:** 12 · **Screens:** `SiteUserGuide`, `SiteUserGuideDark`
**As** a maintainer, **I want** screenshots captured from a real install, **so that** the guide always shows the current screens in both themes.

**Acceptance criteria**
- **Given** `pnpm --filter @spine/e2e screenshots`, **when** it runs against a demo-seeded install, **then** it saves each listed screen in light and dark mode to `apps/site/src/assets/screens/`.
- **Given** a guide page with a screenshot, **when** a reader uses dark mode, **then** the dark capture is shown.
- **Given** a screen's layout changes, **when** the command runs again, **then** the images update and the PR shows the diff.

**Implementation notes**
- Playwright, reusing `apps/e2e`'s `seededOrg` fixture; a manifest maps guide pages to routes.

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
- The web image's build copies the site's `guide` and `self-hosting` output into `/help`; served as static files by the web app (no API involvement, no login needed).

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

### US-SITE-14 · Publish the site after each merge
**Feature:** F-SITE-06 · **Priority:** P2 · **Phase:** 12 · **Screens:** —
**As** a maintainer, **I want** the public site to update itself, **so that** published docs never fall behind `main`.

Decision: D-112

**Acceptance criteria**
- **Given** a merge to `main` that changes `apps/site/**` or the API's OpenAPI document, **when** the publish workflow runs, **then** the site is built and deployed to GitHub Pages at `docs.[DOMAIN]` (placeholder until Q-15 is answered).
- **Given** a merge that doesn't touch the site, **when** it lands, **then** the publish workflow doesn't run.
- **Given** the build fails (e.g. a broken link), **when** the workflow runs, **then** the live site is left unchanged and the run fails.
- **Given** the repo stays private, **when** the site publishes, **then** the site is public (GitHub Pages from a private repo on the Pro plan).

**Implementation notes**
- `.github/workflows/site.yml`: `on: push: branches: [main], paths: [apps/site/**, apps/api/openapi.json]`, `actions/deploy-pages`; minutes are small because it only runs when the site changes.
