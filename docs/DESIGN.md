---
version: alpha
name: Spine
description: Visual identity for Spine, a self-hosted business management app for small service and project businesses — construction, fabrication, contracting, design studios — following the workflow enquiry to quote to job to invoice to payment to books.
colors:
  primary: "#2954E5"
  primary-hover: "#2044C4"
  neutral-50: "#FAFAF9"
  neutral-100: "#F2F1EE"
  neutral-200: "#E7E5E0"
  neutral-300: "#D3D0C9"
  neutral-500: "#8A8578"
  neutral-700: "#4B473E"
  neutral-900: "#211F1A"
  background: "#FFFFFF"
  surface: "#FFFFFF"
  surface-sunken: "{colors.neutral-50}"
  on-surface: "{colors.neutral-900}"
  on-surface-muted: "{colors.neutral-500}"
  border: "{colors.neutral-200}"
  border-strong: "{colors.neutral-300}"
  paid: "#1A7F4B"
  paid-bg: "#E4F5EB"
  due-soon: "#9A6300"
  due-soon-bg: "#FCF0D4"
  overdue: "#B3261E"
  overdue-bg: "#FBE6E4"
  draft: "{colors.neutral-500}"
  draft-bg: "{colors.neutral-100}"
  info: "#2954E5"
  info-bg: "#EAEFFD"
colors-dark:
  primary: "#6B8AFF"
  primary-hover: "#88A1FF"
  neutral-50: "#171613"
  neutral-100: "#201F1B"
  neutral-200: "#2C2B26"
  neutral-300: "#3B392F"
  neutral-500: "#93907F"
  neutral-700: "#C7C4B8"
  neutral-900: "#F3F2EE"
  background: "#121110"
  surface: "#191815"
  surface-sunken: "{colors.neutral-50}"
  on-surface: "{colors.neutral-900}"
  on-surface-muted: "{colors.neutral-500}"
  border: "{colors.neutral-200}"
  border-strong: "{colors.neutral-300}"
  paid: "#4ADE94"
  paid-bg: "#132A1E"
  due-soon: "#F2B23D"
  due-soon-bg: "#332506"
  overdue: "#F17B72"
  overdue-bg: "#3A1512"
  draft: "{colors.neutral-500}"
  draft-bg: "{colors.neutral-100}"
  info: "#6B8AFF"
  info-bg: "#181F35"
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: -0.015em
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  h3:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: 0.005em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0.01em
  mono-data:
    fontFamily: "IBM Plex Mono"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    fontFeatureSettings: "tnum"
rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 20px
  xl: 32px
  2xl: 48px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1200px
  touch-target-min: 44px
breakpoints:
  mobile: 0px
  tablet: 768px
  desktop: 1024px
  wide: 1280px
motion:
  duration-instant: 100ms
  duration-fast: 150ms
  duration-base: 180ms
  duration-slow: 260ms
  easing-standard: cubic-bezier(0.4, 0, 0.2, 1)
  easing-decelerate: cubic-bezier(0, 0, 0.2, 1)
  easing-accelerate: cubic-bezier(0.4, 0, 1, 1)
z-index:
  dropdown: 1000
  sticky-header: 1100
  overlay: 1200
  modal: 1300
  toast: 1400
  tooltip: 1500
icons:
  library: lucide
  size-sm: 16px
  size-md: 18px
  size-lg: 20px
  size-xl: 24px
  stroke-width: 1.75
focus-ring:
  color: "{colors.primary}"
  width: 2px
  offset: 2px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 10px 16px
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.border}"
    textColor: "{colors.on-surface-muted}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    borderColor: "{colors.border-strong}"
    rounded: "{rounded.md}"
    padding: 10px 16px
    typography: "{typography.label}"
  button-secondary-hover:
    backgroundColor: "{colors.surface-sunken}"
  button-danger:
    backgroundColor: "{colors.overdue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 10px 16px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.border-strong}"
    rounded: "{rounded.sm}"
    padding: 8px 10px
    typography: "{typography.body-md}"
    height: 40px
  input-focus:
    borderColor: "{colors.primary}"
  input-error:
    borderColor: "{colors.overdue}"
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: 20px
  chip-paid:
    backgroundColor: "{colors.paid-bg}"
    textColor: "{colors.paid}"
    rounded: "{rounded.full}"
    padding: 3px 10px
    typography: "{typography.caption}"
  chip-due-soon:
    backgroundColor: "{colors.due-soon-bg}"
    textColor: "{colors.due-soon}"
    rounded: "{rounded.full}"
    padding: 3px 10px
    typography: "{typography.caption}"
  chip-overdue:
    backgroundColor: "{colors.overdue-bg}"
    textColor: "{colors.overdue}"
    rounded: "{rounded.full}"
    padding: 3px 10px
    typography: "{typography.caption}"
  chip-draft:
    backgroundColor: "{colors.draft-bg}"
    textColor: "{colors.draft}"
    rounded: "{rounded.full}"
    padding: 3px 10px
    typography: "{typography.caption}"
  nav-item-active:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
  table-row-hover:
    backgroundColor: "{colors.surface-sunken}"
  toast:
    backgroundColor: "{colors.neutral-900}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 10px 14px
    shadow: "0 4px 14px rgba(33,31,26,0.16)"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 20px
    shadow: "0 10px 30px rgba(33,31,26,0.14)"
  popover:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
    shadow: "0 4px 14px rgba(33,31,26,0.10)"
  tooltip:
    backgroundColor: "{colors.neutral-900}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 4px 8px
    typography: "{typography.caption}"
  skeleton:
    backgroundColor: "{colors.border}"
    rounded: "{rounded.sm}"
  avatar:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
  stat-card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: 20px
---

# Spine — Design System

## Overview

Spine replaces the patchwork a small contractor or design studio already runs on — WhatsApp for contacts, Excel for quotes, a shoebox for receipts — with one tool that follows their actual workflow, while a correct double-entry ledger runs invisibly underneath. The design has one job: make that ledger's output — quotes, invoices, aging, job profitability — read as **immediately trustworthy**, to someone who is not an accountant and did not choose to think about debits and credits today. This is money software for people who did not sign up to learn bookkeeping; it earns trust the way a well-kept paper ledger does — legible, consistent, nothing hidden — not the way a flashy fintech dashboard does.

The personality is **calm, understated, quietly competent** — closer to the restraint of Linear or a well-run accounting firm's own internal tools than to a consumer SaaS trying to feel delightful. A single accent color is used sparingly for the one primary action per screen; everything else recedes so that the numbers — the actual content — carry the page. This matters doubly because Spine is used in two very different postures: an office session reviewing a dense AR aging table or a 40-line invoice, and a thirty-second phone check between jobs ("did that invoice get paid?"). Both must read at a glance, and neither should ever feel like a toy next to the real money and legal documents (quotes, invoices) the product produces.

Spine is also explicitly **self-hosted and white-labelable** (§S-10.4/S-10.5 of the PRD): a plumbing contractor and a fit-out studio both run this same codebase with their own logo and brand colour swapped in via theme tokens, never by editing component source. Every visual decision below has to survive a self-hoster overriding the primary color token with their own brand red or green — which is exactly why the financial-status palette (paid/due-soon/overdue) is treated as a reserved, separate semantic layer that a re-themed primary color must never collide with.

## Colors

- **Primary (`#2954E5` — "Spine Blue"):** the single accent for interactive elements — primary buttons, links, active nav state, focus rings. A blue with a slight indigo lean rather than a generic UI-kit blue, chosen to feel considered rather than default-Tailwind. Used for exactly one primary action per screen; every self-hoster's re-skin starts by swapping this one token.
- **Neutrals (`neutral-50` → `neutral-900`):** a warm-leaning, near-desaturated stone scale rather than a cool blue-grey — trades and design-studio businesses aren't tech companies, and a warm neutral keeps dense tables and forms from reading as clinical. `neutral-900` doubles as body text and the near-black `on-surface` color; `neutral-500` is muted/secondary text; `neutral-200`/`neutral-300` are the two border weights (hairline vs. emphasized, e.g. an input's resting vs. focus-adjacent border).
- **Background vs. surface:** `background` is the page canvas; `surface` is card/panel content, identical to background in light mode (flat, not tonal-layered) but distinct in dark mode (see below) so raised content still reads as a step up from the page.
- **Financial-status semantics (reserved, domain-critical):** Paid (`#1A7F4B` on `#E4F5EB`), Due soon (`#9A6300` on `#FCF0D4`), Overdue (`#B3261E` on `#FBE6E4`), Draft (neutral, no color meaning — it hasn't happened yet). These map directly to invoice/quote/job status across every surface — dashboard stat cards, AR aging, the invoice list, the PDF itself — and are **never** repurposed for anything else, exactly the way the PRD's own domain treats a paid invoice as a fact, not a design opinion. A self-hoster may recolor `primary`; they must never be given an easy way to recolor these three, since a red "paid" chip would actively mislead someone glancing at their own books.
- **Info (`#2954E5` on `#EAEFFD`):** neutral system messages only (e.g. "email queued for retry, SMTP is unreachable" per the PRD's graceful-degradation model) — intentionally the same hue as `primary` since both mean "the system, speaking calmly," but never used where a financial-status color would be the correct read.

### Dark mode

A real, independently-tuned dark palette (`colors-dark` above), required outright by the PRD (§F0: "MUST support light and dark mode... switchable at runtime with no page reload") for every app, not just the documentation site — unlike a purely field-constrained product, Spine's office use case (a desk, indoor lighting, long report-review sessions) is the primary dark-mode use case, alongside the general "comfortable in a dim site cabin" case from S-00.2.

- **Surfaces split apart in dark mode** (`background` #121110 vs. `surface` #191815) where they were identical in light mode — a raised card needs a genuine tonal step to read as elevated once there's no light-mode-style crisp white-on-white boundary to lean on.
- **Primary blue is lightened and warmed slightly** (`#2954E5` → `#6B8AFF`), not mechanically inverted — the light-mode value is too dark and desaturated-reading against a near-black surface; the dark-mode value stays recognizably the same hue rather than drifting toward a generic neon "dark mode blue."
- **Financial-status colors are re-derived per mode, each independently verified against its own dark background for 4.5:1 text contrast** — not inverted from their light-mode hex — the same discipline the PRD's own reserved-semantics principle demands: a status color that fails contrast in dark mode is a real bug (a barely-legible "overdue" chip), not a cosmetic one.
- **Scope:** dark mode is real infrastructure from day one across `apps/web` and `apps/design-system` (mobile via NativeWind shares the same tokens per §5) — this isn't a documentation-site-only trick the way it might be in a field-constrained product; Spine has no outdoor-glare constraint arguing against it anywhere in its actual usage.

## Typography

**Inter** is the only UI typeface — legible at the small sizes a dense invoice-line table or AR aging grid demands, and it's what most of this product's audience already reads all day in their OS and browser chrome, so nothing about Spine's type should call attention to itself. **IBM Plex Mono** is used narrowly, for exactly the values that benefit from fixed-width alignment: money amounts in tables (so a column of `$1,240.00` / `$89.50` aligns on the decimal), and document numbers (`INV-2026-0001`, `QUO-2026-0042`) — the tabular-figures feature is turned on (`font-feature-settings: "tnum"`) so a changing number never visually reflows its neighbors.

- **Display / H1:** Inter, 650/600 weight, used for page titles only (a quote's total, a dashboard's "Good morning" header) — restrained size (32px/24px) rather than a loud marketing-style display face, since this is a working tool, not a landing page.
- **H2–H3:** Inter Semi-bold, section headers within forms and dashboards (a quote's "Line items" section, a settings page's grouped fields).
- **Body:** Inter Regular at 15px (comfortable reading, e.g. quote terms text) and 14px/13px (dense, e.g. table cells, form helper text) — tuned so a 40-line invoice or a wide AR aging table doesn't force horizontal scroll on a laptop.
- **Label:** Inter Semi-bold 13px, used for form field labels, table column headers, and button text — the "this is a control, not prose" register.
- **Mono data:** IBM Plex Mono for money and document numbers, everywhere they appear — tables, PDFs, the ledger drill-down view.

## Layout

A **max-width grid (1200px)** governs the desktop app — dashboards, quote/invoice editors, and reports benefit from a stable canvas rather than stretching to fill an ultra-wide monitor, where a 40-line invoice table would become uncomfortably sparse. A **12px spacing scale** (with a 4px half-step for icon-to-label gaps) governs all spacing; related fields are grouped in cards with 20px internal padding (16px mobile). Margins are 32px desktop / 16px mobile. Every interactive control in the mobile field-companion app (§FEAT-11: photo capture, expense submission, milestone toggles) uses a minimum **44×44px touch target**, since a field user is frequently one-handed, sometimes gloved, on a job site — the same non-negotiable a desk-bound office screen doesn't need to enforce as strictly, though form controls stay consistent (40px height) across both for one shared component set.

## Elevation & Depth

Depth is conveyed primarily through **borders and a single tonal step (surface vs. background), not shadows** — a card is a bordered surface, not a floating shadowed box, consistent with the calm/understated brand personality: shadows read as "trying to look impressive," borders read as "organized." Reserve shadow for genuinely temporary, layered UI — dialogs, drawers, popovers, toasts — where a shadow correctly signals "this is above the page and will go away."

## Shapes

Moderately rounded and consistent: buttons, inputs, and chips use 6–8px radius; cards use 12px. Data tables use **no rounding (0px)** — a table is a precise instrument for financial data, and treating its container like a soft card would undercut that. Status chips (paid/due-soon/overdue/draft) are fully rounded (pill), the one shape reserved exclusively for status, so a chip is recognizable as a chip independent of its color — important since a self-hoster's re-theme must not be allowed to make a status chip visually indistinguishable from a badge or tag.

## Icons

**Lucide** (`lucide-react` on web, shared via NativeWind token layer on mobile per §5), one icon set everywhere, `currentColor` inherited — never a hardcoded icon color separate from the surrounding text. Stroke width 1.75 (very slightly lighter than Lucide's 2px default) for a cleaner read at the small sizes nav items and table-row actions use. Four sizes: 16px (inline/table-row icons), 18px (nav items, form field icons — the default), 20px (buttons, standalone actions), 24px (empty-state icons).

## Motion

Functional only — motion confirms a state changed, never decorates. Four durations: instant (100ms, hover/focus color shifts), fast (150ms, checkbox/switch toggles), base (180ms, the default for dialog/popover/toast enter-exit), slow (260ms, page-level transitions, used sparingly). Standard easing for most transitions, decelerate for things entering the screen, accelerate for things leaving. `prefers-reduced-motion` collapses all durations near-zero.

## Components

The full catalogue is the `@spine/ui` MUST-list from PRD §F0, organized here the same way it's organized in `apps/design-system`'s nav so the two never drift apart:

### Foundational primitives

- **Button:** one primary (filled blue) action per screen; secondary is outlined/neutral; destructive actions (void an invoice) use the overdue-red `button-danger` variant. 40px height on desktop controls, 44px minimum on any mobile/touch surface. Disabled state uses the neutral border color, never a dimmed fill.
- **Input / Textarea / Select / Combobox:** 40px height, 6px radius, label always above the field (never placeholder-only). `MoneyInput` is the currency/minor-unit-aware variant (§F0) — right-aligned, mono-data typography, respects the org's configured decimal places, and never lets a user type more precision than the currency supports.
- **DatePicker:** shares the same field chrome as Input/Select; opens a Popover-hosted calendar rather than relying on native `<input type=date>` chrome, which is inconsistent across browsers/OSes.
- **Checkbox / Radio / Switch:** 18px control, 44px tap target via padding on touch surfaces, primary-blue fill when checked/on.
- **Form field + validation message:** label above, `HelperText` below in `body-sm`, switching to the overdue-red color on a validation error — the one place `overdue` red is reused outside financial status, since form-error red and financial-overdue red are both universally read as "attention needed" without conflicting in practice (they never appear in the same view).

### Feedback & status

- **StatusChip:** the single component for paid/due-soon/overdue/draft — pill-shaped, color-coded per the reserved palette above, **always paired with a text label**, never color alone (this also protects colorblind users, per §10.8's WCAG AA target).
- **Toast:** dark chrome, bottom-right, auto-dismissing — confirms an action succeeded (invoice sent, payment recorded); never carries a validation error, which stays inline via HelperText.
- **EmptyState:** centered icon + short message + primary action, used for every zero-results list and the first-run dashboard (§FEAT-12's setup checklist) — Spine's onboarding principle is "never a blank screen with no next action," and EmptyState is the component that principle is built out of.
- **Skeleton:** border-colored pulsing block matching the shape of the loading content — used for genuinely slow loads (a report over a 12-month range), not every async state.

### Data display

- **Card:** the default container for grouped content — 12px radius, 1px border, no shadow, 20px padding.
- **StatCard:** a Card variant for a single dashboard KPI (cash position, receivables, overdue count) — `display`-weight number, `label`-weight caption above.
- **Table:** zero-radius, sortable/paginated (§F0), dense row height, alternating hover tint, sticky header — the primary vehicle for quote/invoice line items, the AR/AP aging report, and the ledger drill-down view.
- **DataList:** label-to-value rows for a single record's detail view (an invoice's metadata panel) — lighter-weight than a full Table for one record rather than a collection.
- **Avatar:** circular, initials-on-primary-fill by default.
- **Breadcrumb / Pagination:** `body-sm`/`label` typography respectively, muted-grey inactive state, primary-colored current/active state.

### Navigation

- **Tabs:** underline-indicator style, for switching views within one page (a job's Overview/Milestones/Photos tabs).
- **DropdownMenu:** click-triggered floating action list (a table row's overflow menu — void, credit, duplicate).
- **Dialog/Modal, Drawer/Sheet:** Dialog for a focused, centered task (confirm void); Drawer for a longer side-anchored flow (a quote's line-item editor) — same underlying primitive, different anchor and size.
- **Popover / Tooltip:** Popover hosts real interactive content (the DatePicker's calendar); Tooltip is supplementary hover/focus-only text, never the sole carrier of required information.

### Domain-specific

- **MoneyInput / MoneyDisplay:** the currency-aware pair — `MoneyInput` for editable amount fields, `MoneyDisplay` for read-only mono-data rendering (table cells, PDFs, the ledger view) — both share the same minor-unit/decimal-place logic from `@spine/shared`'s money module so a displayed total and its underlying `bigint` value can never silently drift apart.
- **StatusChip:** see Feedback & status above — also counts as the domain-specific "does this quote/invoice/job/expense need my attention" signal repeated across every list view in the product.

## Do's and Don'ts

- Do use the paid/due-soon/overdue/draft palette exclusively for financial document status — never repurpose any of the four for a generic badge or tag.
- Do pair every StatusChip with a text label, not color alone.
- Do maintain a minimum 44×44px touch target on every control in the mobile field-companion app.
- Do maintain WCAG 2.1 AA contrast (4.5:1 body text) per §10.8 — verify explicitly for text on tinted status backgrounds, in both light and dark mode.
- Do expose every token below as a CSS custom property a self-hoster can override — never let a component hardcode a color or radius that bypasses the token layer.
- Don't use more than one primary (filled blue) action per screen.
- Don't rely on drop shadows to convey page-level structural hierarchy — reserve shadow for dialogs, drawers, popovers, and toasts only.
- Don't mix the 0px (tables) and 12px (cards) radius conventions within the same visual grouping.
- Don't let dark-mode status colors be a mechanical inversion of their light-mode hex — each is independently contrast-checked against its own dark background.

## Logo & Brand Mark

Not yet designed — Spine does not currently have a logo or brand mark. `apps/design-system`'s `Logo` component placeholder should render the wordmark "Spine" in `display` typography until real mark artwork exists; this section will be filled in once one is commissioned or designed, following the same asset-variant pattern (full-color / white-knockout / mono, horizontal / square) as a future reference point, since self-hosters will eventually need the equivalent for their own org branding (§S-10.4) regardless of what Spine's own mark ends up being.
