# Changelog

What landed, newest first. Add an entry with every change, in the format at the bottom of this file. Each release's notes are in [`.github/release-notes/`](.github/release-notes/) and on the [releases page](https://github.com/haribrothers/spine/releases), and what's planned next is in [`ROADMAP.md`](ROADMAP.md).

## Status

**1.0.0-beta.7**, released 2026-11-24. Phases 0–11 are built. Every Phase 12 (Packaging & 1.0) story is done except US-MOB-29, which comes after the 1.0 tag. The security review was signed off on 2026-11-15.

## Next up

- The accountant's review of the books. Its findings ship as further betas, and its sign-off is the last step before the `v1.0.0` tag.
- After the tag: US-MOB-29, the field app in the App Store and Play Store. Later work is planned in [`ROADMAP.md`](ROADMAP.md).

## Completed

### 2026-11-24 — Version 1.0.0-beta.7

- **Version 1.0.0-beta.7**, the first release from the fresh repository: the cleanup below, with release notes in `.github/release-notes/v1.0.0-beta.7.md`. The version, the download commands, the three Compose files' default image tag and the API reference's version say `1.0.0-beta.7`.
- **Earlier betas** (1.0.0-beta.1 to beta.6) are no longer listed on GitHub; their images stay on `ghcr.io`, so their installs keep running and upgrade as before.

### 2026-11-24 — Cleanup: the repository holds the product; the specification moves out

- **Design tokens** move from `docs/design/tokens.json` to `packages/config/tokens.json`. The apps, the docs site's theme (`scripts/site/tokens-css.mjs`), the web image and the tests read them there, and `.dockerignore` no longer needs an exception for them.
- **Release notes** move to `.github/release-notes/`, where the release workflow reads them. The Tally import samples sit beside their test.
- **`ROADMAP.md`** (new): what's planned after 1.0 and what stays out of scope. The README, `CONTRIBUTING.md`, `SECURITY.md`, the issue and pull request templates and the docs site's developer pages point at it and at the docs site instead of the specification.
- **Fix:** the subtitle on the invoice and vendor bill edit pages named an internal file. It now says an issued invoice "can't be changed, only voided or credited", and a recorded bill "can't be changed, only voided", as the confirm dialogs do.
- **Code comments** that cited the rules file now state the rule itself.
- **Tests:** `us-site-12`, `us-site-02`, `us-ops-19` and the token tests read the new paths. `pnpm verify` passed with no `docs/` folder in the checkout (integration 1,358 tests, E2E 520).

### 2026-11-20 — Cleanup: a shorter changelog, dead code and unused dependencies removed

- **Changelog:** August to October move unchanged to `docs/changelog/<yyyy-mm>.md`, and the old Status and Next up notes (still describing Phase 4) to `docs/changelog/early-status-notes.md`. This file keeps a current Status, Next up and this month (1.3 MB → 82 KB). `docs/progress.md`'s headline now says where Phase 12 stands.
- **Dead files:** `scripts/seed.ts` (a one-line re-export; seeding runs `apps/api/src/db/seed/index.ts`), the field app's `PlannedTab` (its last tab was filled on 2026-10-09) and `apps/api/src/db/verify-primary-owners.ts` (a one-off check after the August backfill migration).
- **Dead code:** five unused calendar helpers in `@spine/ui`, four status-label maps in the web app that the badges no longer read (with their 11 `en.json` keys), `MoneyAccountLine`, `memberLabel`, `NOT_FOUND_TITLE`, and the `OutboxKind` and `MeetingMutationScope` types. Nothing that runs changes.
- **Dependencies stay for now.** About ten are unused (among them `recharts` in the web app and `clsx`, `class-variance-authority` and `tailwind-merge` in the design-system app), but any change to `pnpm-lock.yaml` makes pnpm resolve React 19.2.8 next to the native packages' 19.2.3, and every `@spine/ui-native` and field-app test then fails with "Invalid hook call". The lockfile as committed works; pinning one React for the native packages comes first.
- **`.gitignore`** lists `.env.backup` itself rather than relying on a global ignore.

### 2026-11-19 — Fix: the release's E2E on CI (1.0.0-beta.6)

- **Phone rows:** a row's title and status badge stay on one line again, and the title truncates if it must. Letting badges wrap under the title put the invoice list's status on a second line with CI's fonts, by a few pixels. The quotes list shows just the status on a phone (without "Viewed"), so the number isn't squeezed. Titles still never wrap.
- **US-OPS-54:** the More sheet's swipe-to-close check waits for the sheet to finish rising before swiping; CI started the swipe mid-animation.

### 2026-11-19 — Version 1.0.0-beta.6

- The web app's phone layout (D-283: US-OPS-54 to US-OPS-62, US-MTG-18, US-RPT-41, US-DASH-31) and the fixes from the Owner's review on a phone, below, with release notes in `docs/releases/v1.0.0-beta.6.md`. The download commands and the three Compose files' default image tags name the new version.

### 2026-11-19 — Fix: on a phone, the area's row shows the page you're on

- On Reports (and Banking or Payables, at the end of the Money row) the row of the area's pages under the title now scrolls so the page you're on is in view and underlined (`AppShellAreaNav`). Before, only the Money tab looked selected, because the page's own link was off-screen to the right. Reports stays under Money, the Owner's choice. US-OPS-54 checks it on Reports and Banking.

### 2026-11-19 — Search on a phone gets room to breathe (the Owner chose the layout)

- **Roomy top bar:** on a phone the search screen leaves 16px above the field (below the notch) and 12px under it. The field is filled and rounded, 44px tall, with the icon inside and Cancel beside it (`CommandPalette`). The scopes (All, Sales, Jobs, Billing, Purchases) are pills that scroll sideways, and Include archived is a pill with them instead of a footer of its own. Results are 60px rows. From 768px up, search is unchanged.
- **Tests:** US-OPS-60's search test checks the room above the field, the field's height, Cancel beside it and the pills under it. Its combobox-sheet check now waits for the sheet to finish rising, since it was measuring mid-animation now and then.

### 2026-11-19 — Fix: the dashboard's cards on a phone (from the Owner's review)

- **Income and expenses:** the three totals stack one per line on a narrow card (label left, amount right) instead of running into each other; three across when the card is wide, like Payables and Tax already were.
- **Links in line:** on a phone a link made 44px tall keeps its text in the middle (`align-content: center` in the tap-size rule), so each card's heading link (Open calendar, Banking, View jobs) sits level with its title and Retention held's Release sits beside its amount, across the app.
- **Accounts:** each account's name covers its row (the row is the tap target), so the name, its note, the icon and the balance line up. **Today:** a narrower time column on a phone.
- **Tests:** US-DASH-31 checks that no figure on the phone dashboard leaves its card or overlaps another (crore-sized amounts showed it; the E2E business's small amounts didn't).

### 2026-11-19 — Fix: phone lists, the pipeline, the meetings sheet and the dashboard greeting (from the Owner's review)

- **List rows:** on a phone a row's title stays on one line, and badges that don't fit beside it wrap under it (`ListRow`). Every list now gives its columns explicit phone roles, with a one-line title. That covers quotes (the number, with the quote's title beside the contact), contacts (logo and name, then "type · email", and only Archived as a badge), jobs, expenses, payments (the amount and customer were missing), credit notes, vendor bills, vendor credits, vendor payments, the catalogue and bundles, emails, journals, banking (accounts, register and reconciliations), receivables and payables (both views), team users, invites and teams, recurring schedules and expense categories. A title link or button covers the row and is exempt from the 44px rule. US-OPS-62 now also fails a route whose row titles wrap.
- **Search and Filters** span the width of the page on a phone (`FilterSheet`). A card's filter icon no longer sits on a chip's label.
- **Pipeline:** on a phone it now follows its design. The stages are chips at the top, the figures are one line ("9 leads · $102,465.00 open · Win rate 67%"), and search and Filters share a row (stage, owner, source, sort and view in the sheet). The stage's leads are rows (`LeadRow`: title, contact and source, value, next follow-up), with "Move a lead to another stage from its ⋯ menu." Refresh is under ⋯, and Add lead floats.
- **Meetings:** on a phone the top bar's sheet is "Calendars": the people's calendars, My activities, Upcoming and Meetings by contact. The mini calendar is gone from it, because the month view is the calendar (the Owner's call). Each contact's count lines up with its name.
- **Dashboard greeting:** "Good morning/afternoon" and the date come from the device's clock after it loads. They were rendered in the server's time zone (UTC in Docker) and then again in the browser's, a hydration error whenever the two disagreed (it predates the phone work). A test opens the dashboard with the browser on UTC+14.

### 2026-11-19 — US-OPS-55: open Spine from the home screen like an app

- **Standalone:** the web manifest says `display: "standalone"` and starts at `/dashboard` (with `id` and `scope`), keeping the name, short name, icons and the tokens' background colour. The root layout adds `viewport-fit=cover` and the iPhone home-screen tags (`appleWebApp`). Opened from the home screen, Spine has no address bar or toolbar. The top bar and tab bar already keep clear of the notch and the home indicator (`env(safe-area-inset-*)`).
- **Getting around:** the back arrow works as before, and so does the phone's own back gesture. In the home-screen app, a link to another site (the docs, a contact's website) opens in the browser (`useOpenOtherSitesInBrowser` in `lib/standalone.ts`); links within Spine, mailto: and tel: are unchanged.
- **Not in this story:** a service worker or offline use. `sw.js` still only handles push; the field app is the offline tool.
- **US-OPS-62 done:** with the floating buttons, action bars and builders in, every phone check is on (none waits on a later story). The `phone` project runs on every route in light and dark, in `pnpm verify` and before each release.
- **Tests and docs:** `us-ops-55.spec.ts`; US-SET-26's unit and E2E tests now expect `standalone`. D-206 and US-SET-26 note the change; the phone guide explains adding Spine to the home screen (and signing in once inside it on an iPhone); QA section 294.

### 2026-11-19 — US-DASH-31: the dashboard laid out for a phone

- **What needs you first:** under 768px the dashboard is one column. It starts with a one-line greeting and the date ("Good morning, Priya · Thu, Nov 19"), then Needs your attention, the key figures two per row, Today, Get started and the other cards one per row, in the layout chosen on a wider screen.
- **Attention rows:** each item's action (Send reminder, Review, Approve) is a button on the right of its row, and the title wraps to two lines. With more than three items, "Show all <n>" opens the rest. The note "Cleared items disappear automatically" isn't shown on a phone.
- **Header:** Accrual or Cash is under the top bar's ⋯, and Edit layout isn't offered on a phone. The greeting and the first attention item are on the first screen at 390×844.
- **Tests and docs:** `us-dash-31.spec.ts`; the phone guide; QA section 293.

### 2026-11-19 — US-RPT-41: reports that read on a phone

- **Filters in one line:** under 768px a report's filters are one line saying what's chosen ("Jan 1 – Nov 19, 2026 · Accrual · No comparison"). It opens a "Report filters" sheet with every filter and Show report (`ReportToolbar` `summary`; helpers `filterSummary`, `rangeSummary`, `asOfSummary`). Export is under the top bar's ⋯ through the web app's `components/report-toolbar.tsx` wrapper. Every report passes its summary.
- **Cards and charts:** a report's cards are chips in a row that scrolls sideways (`ReportKpis` is a `ChipStrip`, so the receivables and payables age cards are too). A chart is the screen's width, with its legend under it, fewer month labels and a narrower axis (`GroupedBarChart`).
- **Statements as lists:** `StatementTable` on a phone, with one label column and one or two amounts, is an indented list. It has section headings, each account with its amount, the other period's amount muted under it when comparing, bold subtotals and the total last. A drill-down link or button covers the whole row, with a chevron. P&L's and the Balance Sheet's two-period comparisons drop the Change columns on a phone, so they read as that list. Wider statements (each month, the ledger, the day book, GSTR-1, the tax summary by type) stay tables with a sticky first column.
- **Grids and lists:** `Table` and `DataTable` get `stickyFirstColumn` (with `phoneRows={false}`). The trial balance uses it, with the code above the name. List reports use phone rows, with their main figure on the right. The Tally mapping's group picker is now shown on a phone. The Reports page is grouped rows, each 44px and tappable across, with its star.
- **Tests and docs:** `us-rpt-41.spec.ts` and `us-rpt-41-phone.a11y.test.tsx`. Docs: ReportToolbar, StatementTable, Table, DataTable, the GroupedBarChart page and the phone guide; QA section 292.

### 2026-11-19 — US-MTG-18: a calendar made for a phone

- **Month first:** under 768px Meetings opens on the month (it was Agenda): a compact grid with one letter per weekday, today ringed, the chosen day filled, up to three dots per day in the calendars' colours (with the count in the day's name for screen readers), and the chosen day's meetings listed under it. Each row has its time (or All day), colour, title, place and contact. Tap a day to choose it. Swipe the grid or use the arrows for the next or previous month, and Today comes back. Arrow keys move the day.
- **Day:** a strip of the week's days, with their dots, over the day's timeline, with "3 meetings · 1 later" and the line at now. Swiping the strip moves a week and swiping the timeline moves a day. On a phone the timeline has no drag to create, move or resize, so a swipe isn't mistaken for one. A tap opens the meeting, and + creates one.
- **Toolbar:** two short rows. The month and year (tap it for a Pick a month sheet), the arrows and Today; then Month · Day · Agenda as a segmented control across the screen. The mini calendar and Calendars open from a filter button in the top bar, and New meeting is a floating + that opens full screen on the chosen day.
- **Quick view:** a meeting's quick view is a bottom sheet in every view. `BottomSheet` gets `hideHeader` for content with its own title and close.
- **Where:** new `calendar-phone.tsx` in `@spine/ui` (`CalendarPhoneToolbar`, `CalendarPhoneMonth`, `CalendarWeekStrip`, `CalendarQuickViewSheet`, `useSwipe`), used by `Calendar` on a phone. The event colours moved to `lib/calendar-colors.ts`. From 768px up the calendar is unchanged.
- **Tests and docs:** `us-mtg-18.spec.ts` and `calendar-phone.a11y.test.tsx`. US-MTG-17's phone test now expects the month and the top bar's filter button. Docs: Calendar, BottomSheet, the design-system page and the phone guide; QA section 291.

### 2026-11-19 — US-OPS-59: build a quote or invoice on a phone

- **A builder fills the screen:** under 768px New quote, New invoice, New vendor bill, New vendor credit and their Edit pages have no tab bar. The top bar is Cancel at the top left with the title centred (`AppShellPhoneBar` `onCancel`). Cancel runs the builder's own cancel through `usePhoneBuilderCancel`, so "Leave without saving?" asks first, as Back already did. Fields are one column.
- **Lines as cards and one sheet:** each line is a card (item and amount, description, "3 × $450.00", "10% off", its tax). Add item opens a new `LineSheet` (Cancel · New line · Done) with the item and catalogue search, description, quantity, unit price, discount, tax, price includes tax, HSN/SAC, supply type (and the account on a bill), and what the line comes to. It edits a copy that only Done keeps. Tapping a card opens it in the same sheet ("Line 2 of 3") with Move up, Move down and Delete. A new builder's untouched blank line isn't shown. `BottomSheet` gets `headerLeading` for the sheet's Cancel.
- **A slim bar:** `DocumentBuilderBar` on a phone is the total (tap it for the subtotal and tax), ⋯ with Save as draft and Preview PDF, and the main button (Save and send, Save and issue, Save and record). It steps aside with the tab bar while a field has focus, so the keyboard and the field have room.
- **Everywhere it applies:** the quote and invoice builders share the quote line editor. Vendor bills and vendor credits get the same cards and sheet (`PhoneBillLines`, also used by the recurring bill dialog), and so does the recurring invoice dialog. The credit note dialog's invoice lines are cards with their tick box and quantity. The dialogs were already full screen (US-OPS-60).
- **Tests and docs:** `us-ops-59.spec.ts` and `us-ops-59-phone.a11y.test.tsx`. US-OPS-54's back test now opens a record from the list (New invoice is a builder now). Docs: BottomSheet, AppShell and ActionBar, the design-system pages and the phone guide; QA section 290.

### 2026-11-19 — US-OPS-58: read and act on a record on a phone

- **The top of a record:** under 768px a record shows its number and status, then the amount that matters (an invoice's or bill's balance due while there is one, else its total; a payment's amount; a credit's amount left), then the contact. The breadcrumb gives way to the top bar's back arrow. This is a new `RecordHeader` in `@spine/ui`. The due line sits under the amount, so on an invoice or bill it leaves the meta line on a phone.
- **One main action at the bottom:** the next step for the record's state (Send reminder, Issue invoice, Record payment, Record bill, Approve, Invoice a milestone) is a full-width button in a new `ActionBar`. It renders into an `ActionBarSlot` that the shell places between the page and the tab bar, so it never covers the page, and it steps aside with the tab bar for full-screen dialogs and the keyboard.
- **Everything else under ⋯:** the record's More menu opens from the top bar as an action sheet headed by its number and a line about it (`usePhoneRecordMenu`; `DropdownMenuContent` gets `sheetDescription`). Buttons that sit beside More on a desktop (Edit, Preview PDF, Raise variation) are in it too, and focus returns to ⋯ when it closes.
- **Figures, tabs and lines:** figures are two per row in a new `RecordFigures`. Tabs scroll the chosen one into view, including when the page opens on it (`?tab=crew`) and when counts arrive. A quote's or invoice's lines are cards ("4 × $650.00", "Tax 18%") with the totals under them. A job's milestones, and the invoices a payment paid or bills a vendor payment paid, are phone rows.
- **Pages:** invoice, quote, credit note, job, contact, payment, vendor bill, expense, vendor credit and vendor payment. Recurring schedules have no record page (they're a list with a dialog), so there's nothing to change there. The contact page keeps its own header (logo and name under the shell's title); its Edit is the bar and the rest are under ⋯. With five figures a credit note's desktop strip is now one row of five.
- **Tests and docs:** `us-ops-58.spec.ts`, `us-ops-58-phone.a11y.test.tsx`, `action-bar.a11y.test.tsx` and `record-header.a11y.test.tsx`. The US-OPS-61 invoice check now looks for Issue invoice in the bar and Edit and Preview PDF under ⋯. Docs: ActionBar and RecordHeader built (89 web components), DropdownMenu and Tabs updated, the design-system pages and the phone guide; QA section 289. `@spine/ui` now lists `react-dom` (the bar's portal), which the workspace already had.

### 2026-11-19 — US-OPS-57: a list's figures, filters and main action on the first screen of a phone

- **Figures as chips:** under 768px a list's summary cards are compact chips (label and figure) in one row that scrolls sideways, so the first rows are on the first screen. A card that filters still does when tapped. This is a new `ChipStrip` in `@spine/ui`. When its cards are only figures (journals), the row is a focusable, named region so a keyboard can scroll it.
- **Filters in a sheet:** search and a Filters button share one row (a new `FilterSheet`). Filters opens every filter in a bottom sheet with Clear all and "Show 12 invoices". Each filter that's on shows as a chip with × under the row. On a desktop the filters are inline, as before.
- **Main action floats:** New invoice, New quote, Record payment, Add contact and the rest float above the tab bar with their label (a new `FloatingActionButton`), shrinking to + while the list scrolls. The page leaves room under the last row for it.
- **Other actions under ⋯:** Refresh, Import, Export, Recurring invoices, Transfer and Money in/out move into the top bar's ⋯ sheet (`PhoneMoreActions`). A menu inside it (Export) opens from there.
- **Pages:** invoices, quotes, jobs, payments, contacts, credit notes, expenses, vendor bills, vendor credits, vendor payments, catalogue, emails, journals, banking, receivables and payables. Receivables' and payables' age cards are the shared report summary and change with US-RPT-41.
- **Tests and docs:** `us-ops-57.spec.ts` and the `chip-strip`, `filter-sheet` and `floating-action-button` axe tests. US-OPS-62's main-action check is on for every list. Docs: ChipStrip, FilterSheet (new) and FloatingActionButton pages, the design-system pages and the phone guide; QA section 288.

### 2026-11-19 — US-OPS-56: lists as rows on a phone

- **Rows for every list:** under 768px every `Table` and `DataTable` list is `ListRow`s, a new `@spine/ui` component. The title and status are on the first line, the subtitle on the second, and the amount on the right with its ⋯ (an action sheet). The title's link covers the whole row, so tapping anywhere opens the record. There are no columns, headings or sideways scroll.
- **Placing the columns:** a column can carry a phone role (`title`, `badge`, `subtitle`, `trailing`, `trailingSub`, `action`, `select`, `hidden`). Otherwise `phoneRoles` places them: the first column as the title, a status column as the badge, the second as the subtitle, the last right-aligned one as the amount and an actions column as the ⋯. So all 33 lists have rows. Invoices carries an explicit mapping, with the balance due and its due line on the right.
- **Other list shapes:** a grouped table (quote versions) shows the latest version's row, an expandable one (receivables by customer) opens under its row, and a totals footer becomes a last row. `phoneRows={false}` keeps a grid a table.
- **Load more** replaces the pager after 25 ("25 of 87"); Columns and the page-size picker aren't offered.
- **Select mode:** invoices, catalogue, vendor bills, vendor credits, payables and receivables get Select in the top bar (`useSelectMode`, through a new page-action slot in the phone top bar). Checkboxes show only while selecting. The bulk bar docks along the bottom, and Done clears the selection.
- **Pipeline:** one stage at a time, with the stages as chips (with counts) above that scroll sideways. Its leads stay compact cards in a new `KanbanStack`, and moving one is in its menu.
- **Contacts and loading:** Contacts always shows rows, with no Table · List · Card switcher. While a list loads, `TableSkeleton` shows placeholder rows.
- **Tests and docs:** `us-ops-56.spec.ts`, `us-ops-56-phone.a11y.test.tsx` and `list-row.a11y.test.tsx` (including `phoneRoles`). The phone check measures a row title's link by its row. Docs: ListRow, Table, DataTable, Kanban and TableSkeleton, the design-system pages and the phone guide; QA section 287.

### 2026-11-18 — US-OPS-60: dialogs, menus and pickers made for a phone

- **In the shared components, so no screen changed:** under 768px every `Dialog` fills the screen and slides up. Its `DialogFooter` becomes the bar at the top, Cancel on the left and the action on the right, and the ✕ steps aside. A `<form>` wrapping body and footer is `display: contents` there, so the footer can move.
- **Menus:** every `DropdownMenu` is an action sheet (`data-phone-sheet="action"`). It floats 8px above the bottom edge over a dimmed page, with 52px rows and 20px icons. A destructive action is in the danger colour and still asks first (D-218), and the sheet ends with Cancel. `sheetTitle` heads it with what it acts on.
- **Pickers:** `Select`, `Combobox` (search at the top), `MultiSelect` and `DatePicker` open their options in a bottom sheet with 44px rows. One CSS rule in the preset overrides Radix's popper positioning for anything marked `data-phone-sheet` and draws the dimmed page behind it.
- **Confirmations** (`AlertDialog`) stay a small alert in the middle, their buttons full width and stacked, the action on top.
- **Drawers** (notifications, filter panels) open from the bottom at 70% of the screen. Dragging the grabber up takes one to full height; dragging down goes back, then closes it.
- **Search** fills the screen with Cancel in place of Esc, and its keyboard hints are hidden on touch screens.
- **Accessibility:** focus stays inside every sheet (Radix), each is named by its title, and Escape closes it. With reduced motion nothing slides (`motion-safe:`, and the sheet keyframes sit under `prefers-reduced-motion: no-preference`).
- **Tests and docs:** `us-ops-60.spec.ts` (phone and desktop) and `us-ops-60-phone.a11y.test.tsx`. US-OPS-15's dialog and drawer widths gave way to these. The docs for Dialog, DropdownMenu, Select, Combobox, DatePicker, Drawer, AlertDialog, MultiSelect and Command, and their design-system pages, are updated; QA section 286.

### 2026-11-18 — US-OPS-54: tabs along the bottom of the phone

- **The phone shell:** under 768px the web app now has a top bar with the page's title (not the logo), a back arrow, search and notifications. Sales and Money pages have the area's pages in a row under it. Tabs along the bottom: Home · Sales · Jobs · Money · More. The menu button, the slide-over navigation (US-OPS-14, D-066) and the breadcrumb are gone at that width. From 768px up nothing changes.
- **Tabs:** they come from the same `navSectionsFor` as the sidebar. A tab with no page the person can open isn't shown, and a Field member gets no Money tab: their own expenses are under More, following the story's example. Sales and Money open the list last used there, with its filters (`sessionStorage`); records aren't remembered, so tapping Money from an invoice goes back to its list.
- **More** opens the whole menu in a full-height `BottomSheet`, grouped as the sidebar is, then the account menu, Settings, Help and Sign out (`useSignOut`, shared with the account menu). Close, a swipe down or choosing a page closes it.
- **Back arrow:** it uses the history when Spine itself navigated, else the parent page (`parentPath`). A list's scroll is kept per address, so back returns to the same place.
- **Tab bar out of the way:** it's hidden on builders (`/new`, `/edit`). A CSS `:has()` rule also hides it while a full-screen sheet is open (`data-phone-fullscreen`: the More sheet, Settings and other `xl` dialogs) and, on a touch screen, while a text field has focus.
- **New in `@spine/ui`:** `BottomTabBar`, `BottomSheet`, `ActionSheet` (built now; US-OPS-60 wires it into menus) and `AppShellPhoneBar` and `AppShellAreaNav`, each with its doc page and axe test. `AppShellTopBar` and `AppShellMobileNav` are removed. `AppShellHeader`'s title is for screen readers only under 768px, since the top bar shows it, and its description is hidden. `lib/phone-shell.ts` holds the areas, titles and back targets as plain functions.
- **Tests and docs:** `us-ops-54.spec.ts` (phone, desktop, Field, axe in light and dark) and `us-ops-54.test.ts`. The US-OPS-62 phone check now requires the tab bar on every page but builders. US-OPS-14's slide-over test is replaced. Guide page "Use Spine on your phone"; QA section 285.

### 2026-11-18 — US-OPS-62: every page is checked at phone width before each release

- **A `phone` Playwright project** (390×844, touch, a phone user agent) runs `us-ops-62.spec.ts` as part of `pnpm verify` and the release run (D-260). It covers every app route, a record of each kind, every Settings pane and the bundled guide, in light and dark. It checks for sideways scroll, overlapping labels in a tab or button row, controls under 44px and axe AA. Each failure names the route and the check, writes `phone-failures.json` and attaches the page's screenshot.
- **One route list:** `apps/e2e/tests/routes.ts` now holds the routes for both this check and the accessibility audit (US-OPS-17), so a new route is checked by both. `us-ops-15.spec.ts`'s 19-route sweep is gone; this check covers it.
- **Waiting checks:** "the tab bar shows" and "the main action is on the first screen" are listed in the spec under their stories (US-OPS-54; US-OPS-57 and US-OPS-58) and switch on as those ship.
- **What the first run found, now fixed:**
  - Wide tables scrolled with no keyboard access (axe `scrollable-region-focusable` on document lines, the general ledger and others). They're now a new `ScrollX` box in `@spine/ui`, which becomes a focusable, named region only when it actually scrolls. `Table`, `StatementTable` and 17 table boxes in the web app use it.
  - A payment record scrolled sideways by 114px: an `sr-only` column label is `position: absolute`, so it escaped its table's scroll box and widened the page. `ScrollX` is `relative`, so it clips such children. The toast area is pinned with `inset-x-0` too, so it can't reach past the screen either.
  - The breadcrumb's short links ("Jobs", "Teams") were under 44px wide.
  - The guide's site title and search were 32px; the docs theme now gives them 44px on a phone.
  - The checks themselves: the small-controls helper skips visually hidden (`sr-only`) and off-screen controls, and the overlap check skips controls laid over others on purpose (a card's ⋯, the floating button).

### 2026-11-18 — US-OPS-61: what was broken on a phone is fixed

- **Tabs** (`@spine/ui` `TabsList`): under 768px the row scrolls sideways instead of wrapping, so a job's Milestones · Variation orders · Photos · Notes · Crew · Costing and the reports' statement tabs no longer land on each other. The underline becomes an inset shadow there and the focus ring is drawn inside, so the scrolling row clips neither.
- **Record headers:** the actions on an invoice, quote, job, payment, credit note, expense, vendor bill, vendor credit and vendor payment wrap inside the screen. Issue invoice used to run off the right edge.
- **Breadcrumb:** one line at every width. The middle items shorten with "…" (the full label is the tooltip), then the last. Each link is a 44px tap target with its text centred, so the middle item no longer sits higher than the others.
- **Checkboxes, radio buttons and switches:** these are `<button>`s, so the phone's 44px rule (US-OPS-14) drew each one as a blank 44px box, the "empty boxes" in the invoice list. Checkbox, RadioGroupItem and Switch now carry `data-tap-area`: they keep their size, and the 44px tap area is drawn around them. Segmented buttons with `role="radio"` still get the full 44px. The phone check's small-controls helper skips them, as its comment always said.
- **Search:** the ⌘K / Ctrl K hint is hidden on touch screens (`pointer: coarse`).
- Tests: `us-ops-61.spec.ts` (one check per criterion, plus the desktop still showing ⌘K) and new cases in `breadcrumb.a11y.test.tsx` and `checkbox.a11y.test.tsx`. Docs: Tabs, Breadcrumb, Checkbox, RadioGroup and Switch, with their design-system pages; QA script section 283.

### 2026-11-18 — Designs: the web app at phone width (D-283)

- **28 screens drawn** for US-OPS-54 to US-OPS-60, US-MTG-18, US-RPT-41 and US-DASH-31 on the design canvas "Spine web — phone layout", exported to `docs/design/screens/*Phone*.webp`. They're listed in `docs/design/screens.md` under "Web app at phone width" (649 screens now):
  - the shell, the More sheet and the home-screen app;
  - Invoices as rows, in Select mode and with the Filters sheet; the Pipeline;
  - an invoice and its action sheet; a job;
  - the quote builder and its line sheet;
  - Record payment as a full-screen sheet; a row's action sheet; a picker sheet;
  - the phone month and day;
  - Profit & Loss with its filters, and the Trial balance;
  - the dashboard;
  - dark versions of seven of these.
- **One stylesheet, from the tokens.** Every board uses one `phone.css` whose values come from `tokens.json`, in light and dark. A dark board is its light board with the theme switched. The demo data is the refined screens' business (Sahyadri Retail, INV-0038, JOB-002, rupees), and its figures add up.
- **Spec corrections the drawings found:**
  - US-MTG-18's calendar toolbar is two short rows: at 390px the month, the arrows, Today and Month · Day · Agenda don't fit one row at 44px each. `Calendar.md` changes to match.
  - `BottomTabBar.md` names the tab icons (`House`, `FileText`, `HardHat`, `Wallet`, `Menu`). The current tab gets a tinted pill, since Lucide has no filled icons. The bar is docked, not floating, so the + button can sit above it.
  - `AppShellPhone`, `AppShellPhoneNav` and `MeetingsPhone` note what replaces them.
- **Next:** the Owner reviews the designs; the build starts in waves (US-OPS-61 first) once they're approved.

### 2026-11-18 — Spec: the web app gets a phone layout of its own before 1.0 (D-283)

- **Why:** screenshots of the demo business at 390×844 showed each list's first screen filled by summary cards, tables showing only their first column, the main action halfway down, a job's tabs overlapping and Issue invoice running off the screen. The phone checks passed because they only look for a page that scrolls sideways.
- **Decision D-283** (supersedes D-045 and D-066): under 768px every screen has a phone layout. Tabs along the bottom (Home · Sales · Jobs · Money · More); lists as two-line rows; figures and filters as chips; filters in a sheet; a floating + for the main action; records with the main action at the bottom; builders with lines edited in a sheet; dialogs, menus and pickers as sheets; a phone calendar; reports with filters behind one line. Spine opens from the home screen without the browser bar. Desktop doesn't change. It ships before 1.0, in waves of betas.
- **New stories:** US-OPS-54 to US-OPS-62 (F-OPS-14), US-MTG-18 (F-MTG-06), US-RPT-41 (F-RPT-14), US-DASH-31 (F-DASH-12), in Phase 12 and `docs/progress.md`. US-OPS-61 fixes today's phone bugs first, and US-OPS-62 checks every route at phone width before each release.
- **Also updated:** NFR-COMP-02 and NFR-A11Y-02, the test layers, risk R-32, the design system (rule 13, the phone layout rules, a phone section on 13 component pages, and planned pages for BottomTabBar, BottomSheet, ActionSheet, ListRow, ChipStrip, FloatingActionButton, ActionBar and RecordHeader), and the docs index's counts, recounted from the feature files (205 features, 639 stories).
- **Next:** the phone screens in `docs/design/screens.md`, for the Owner's approval before anything is built.

### 2026-11-18 — The clean-machine test passed; Runtipi and Coolify upgrades checked for real (US-OPS-19, US-OPS-53, US-OPS-52)

- **US-OPS-19 is done:** the Owner followed only the README on a fresh machine with 1.0.0-beta.5 and issued a first invoice in under 5 minutes (Phase 12's exit criterion, NFR-MNT-01).
- **Runtipi:** Spine installed from the store on a real Runtipi and updated from 1.0.0-beta.4 to beta.5 through it. The Docker panels page no longer says it was only checked against a copy.
- **Coolify:** an install went from 1.0.0-beta.2 to beta.5 by pasting the new file. The Coolify pages' upgrade step now names a current version, and says an install from beta.3 or earlier pastes the file once to change to the `spine-proxy` image; after that, setting `SPINE_VERSION` is enough.

### 2026-11-17 — Fix: a closed toast's removal no longer outlives the toast host (US-OPS-38)

- The host removes a closed toast 200 ms after closing it, so Radix can fade it out. If the host unmounted first, the removal still ran; on a slow CI runner it fired after the test environment was gone and failed the web suite with "window is not defined". The host now clears its waiting removals when it unmounts. Test: `us-ops-38.test.tsx` closes a toast, unmounts the host, and checks the removal was cleared.

### 2026-11-17 — Fix: the release's upgrade check from 1.0.0-beta.4 (US-OPS-50)

- **What happened:** the first `v1.0.0-beta.5` tag stopped before publishing anything. `scripts/ci/upgrade-verify.sh` installs the previous release and signs up at `http://localhost/api`, which was right up to beta.3 (port 80). Beta.4's installer opens on port 7746 (D-279), so the sign-up reached nothing.
- **Now:** the check reads the previous install's `APP_URL` and `SPINE_PORT` from its `.env`, signs up there, and checks the upgrade keeps that port (80 when the old install had no `SPINE_PORT`). Spine itself is unchanged; the tag moves to the fixed commit, as `docs/release.md` says for a check that fails before publishing.

### 2026-11-17 — Version 1.0.0-beta.5

- The restore fix (`--new-secret` clears the sign-in keys) and Spine for Runtipi, below, with release notes in `docs/releases/v1.0.0-beta.5.md`. The download commands and the three Compose files' default image tags name the new version.

### 2026-11-16 — Spine for Runtipi, and Dockge on the Docker panels page (US-OPS-53, D-282)

- **Runtipi** installs only from app stores, so Spine has its own: [github.com/haribrothers/spine-runtipi](https://github.com/haribrothers/spine-runtipi). The same four containers from the published images; Runtipi generates the secret, the database password and the notification keys, and asks for the address for links. The proxy is the main service on port 7746, so Runtipi's local subdomain (`https://spine.<local domain>`) or a domain reaches it. The store's README also moves an existing install in: a backup, then a one-off restore into Runtipi's Spine.
- **Checked** against Runtipi's published schemas and its compose builder: the generated file ran on a Mac, Spine opened and signed up, and the README's migration commands, run as written, brought a backup's data back with sign-in working. Not yet on a real Runtipi.
- **Docker panels page:** new **Dockge** and **Runtipi** sections; the install page, README and Coolify page list them.
- **Release guide:** step 7 bumps the Runtipi store after each release.

### 2026-11-16 — Fix: after a restore with --new-secret, signing in works again (US-OPS-04)

- **What happened:** restoring a backup into an install with a different `AUTH_SECRET` (`./restore.sh --new-secret`) kept Better Auth's signing keys (`jwks`), which are encrypted with the old secret. Sign-in succeeded, then every page that read the session failed, with "Failed to decrypt private key" in the API's log. Found while moving an install into Runtipi.
- **Now:** when the backup's secret isn't this install's, the restore clears those keys ("Clearing the sign-in keys made with the old AUTH_SECRET…"), Better Auth makes new ones on first use, and everyone signs in again. With the same secret, the keys come back as before.
- The refusal message no longer mentions two-factor sign-in, which Spine doesn't have; the backups page says everyone signs in again after `--new-secret`.
- Test: `us-ops-04.integration.test.ts` restores with another secret and checks the keys are cleared, and kept with the same secret.

### 2026-11-16 — Run Spine from a Docker panel: Portainer, Synology, TrueNAS, Dokploy, Easypanel (US-OPS-53, D-281)

- **Why:** panels that take a pasted Compose file have no `.env` beside it and pass no `--profile`, so the main file started nothing there.
- **The file:** `docker/panels/docker-compose.yml`, attached to each release as `docker-compose.panels.yml`. No profiles, no `.env` file, nothing beside it; every setting is a variable the panel fills in. `AUTH_SECRET`, `POSTGRES_PASSWORD` and `APP_URL` are required, so a panel refuses to start without one and names it ("Set AUTH_SECRET, a random string of at least 32 characters"); `DATABASE_URL` and `API_URL` are built from them. Spine opens on port 7746 at any address, or `SPINE_PORT`.
- **The guide:** a new **Docker panels** page with a section each for Portainer, Synology Container Manager, TrueNAS, Dokploy and Easypanel: deploying, the settings, the port or the panel's own domain, and upgrading. Then backups to a bucket from the panel's or the machine's scheduler, and restoring with `restore.sh`. The install page links to it, and the Coolify page's "Other platforms" now points to it.
- **Tried for real on Portainer 2.45:** a stack without `AUTH_SECRET` was refused with that message and nothing started; with the three settings Spine opened at `http://localhost:7746`, signed up and kept the session; a stack update moved it to port 18080; and a backup was restored into the running stack with `restore.sh` as the page describes, Portainer still managing it afterwards. The other panels' steps follow their documentation, and the page says so.
- Test: `scripts/us-ops-53.test.mjs` keeps the file in step with the main one (images and version, every setting, the API's healthcheck and volumes, the proxy) and reads it with a real `docker compose config`.

### 2026-11-16 — Fix: the home page's install commands can be scrolled from the keyboard; a Budget card test no longer depends on timing (US-SITE-02, US-JOB-25)

- **Install commands:** the download line is long, so its box scrolls sideways, and the accessibility check (axe) failed the home page because a keyboard couldn't reach it. The box now takes focus, with a focus ring and the name "Install commands", so the arrow keys scroll it.
- **US-JOB-25's E2E test** looked for "No budget set" anywhere on the job page; the cost figure at the top says it too once costing loads, so the test failed whenever that came first. It now checks the Costing card's own line.

### 2026-11-16 — Caddy ships as Spine's own image, spine-proxy, with the routing built in (US-OPS-51, US-OPS-52, D-280)

- **Why:** the Compose file mounted `docker/Caddyfile` into the stock Caddy image, so it worked only with that file beside it. Panels that take a pasted Compose file (Portainer, TrueNAS, Dokploy, Easypanel) keep the YAML but not the file, and the Coolify file carried its own inline copy.
- **The image:** `docker/Dockerfile.proxy` is `caddy:2-alpine` plus Spine's Caddyfile. Each release builds it for amd64 and arm64 and tags it with the version, as `ghcr.io/haribrothers/spine-proxy`, next to `spine-api` and `spine-web`. Both Compose files run it; the service is still `caddy`, so installs, the tunnel, Coolify and the certificate volumes don't change.
- **Unchanged:** the port (`SPINE_PORT`), a domain (`SITE_ADDRESS` with ports 80 and 443) and `TRUSTED_PROXIES` still come from `.env`.
- **The Coolify file** loses its inline Caddyfile, and the test that kept it in step now checks it runs the same proxy image.
- **Releases still publish `Caddyfile`:** as the routing to start your own from (**HTTPS and domains › Your own routing** shows how to mount it), and because `upgrade.sh` from before this downloads it. The download commands stop naming it from v1.0.0-beta.4, the first release with the image.
- **Version 1.0.0-beta.4**, the first release with `spine-proxy` and one port at any address (D-279), with release notes in `docs/releases/v1.0.0-beta.4.md`.
- CI's restore and upgrade checks build this commit's proxy image too. Tests: `scripts/release/us-ops-51.test.mjs`, `scripts/us-ops-52.test.mjs`.

### 2026-11-16 — Spine opens on one port at any address; HTTPS when you give it a domain (US-OPS-01, US-OPS-50, D-279)

- **What a beta tester hit:** port 80 was already in use, `http://spine.local` didn't open, `https://<IP>` gave `ERR_SSL_PROTOCOL_ERROR`, and Spine answered only at the one address in `APP_URL`, so opening it by `localhost` and by IP from another machine couldn't both work. Odoo, Open WebUI, Immich, Twenty, Plane and Plausible publish one plain-HTTP port that answers at any address and make HTTPS opt-in; Spine took 80 and 443 and assumed HTTPS.
- **One port, any address:** Spine opens on port **7746**: `http://localhost:7746` on its machine, `http://<its IP>:7746` from every other device, over plain HTTP with no redirect. `--port 8080` (`SPINE_PORT` in `.env`) picks another. `APP_URL` is now only the address in links (emails, PDFs, invitations, agents); the installer suggests this machine's IP and the summary lists the other addresses (not the one it has just given).
- **Sign-in from any of them, and only them:** Better Auth trusts `APP_URL` and the local address a request came to (localhost, private and Tailscale IPs, `.local` names). A page on another site, another device's address or another port is refused (`INVALID_ORIGIN`), and so is a public name pointed at a private IP.
- **HTTPS when asked for:** `--app-url https://spine.example.com` has Caddy get the domain's certificate on ports 80 and 443 (`docker-compose.override.yml`), with port 7746 kept to the machine. `--behind-proxy` is for Tailscale, a Cloudflare Tunnel or your own proxy in front. `https://` on localhost, an IP or a `.local` name is refused with what to use instead; the docs show Tailscale for HTTPS without a domain.
- **Upgrades keep the address:** `upgrade.sh` gives an install from before this its port (`SPINE_PORT=80` for `http://localhost`) or, for an `https://` address, its certificate on 80 and 443.
- **Checked on a real install** with this branch's API image: `localhost`, `127.0.0.1` and this Mac's IP all open on 7746 and sign in; the web app keeps the session at the IP; another site, another device's IP and another port are refused with 403; no HSTS over HTTP. CI's restore check now signs in at `127.0.0.1:7746` and expects another site to be refused; its upgrade check expects port 80 kept.
- **Docs:** the README and install pages (one port, the address for links, `.env`), **HTTPS and domains** (your network, a name in the hosts file, your domain, Tailscale, another proxy or tunnel), **Configuration** (`SPINE_PORT`, `SITE_ADDRESS`) and **Troubleshooting**.
- Tests: `scripts/us-ops-01.test.mjs` (the installer, and a real `docker compose config` of what it writes), `scripts/us-ops-50.test.mjs` (keeping the address on upgrade), `apps/api/src/auth/us-ops-01.test.ts` (which origins sign-in trusts).

### 2026-11-15 — Fix: the home page's pinned-story E2E test starts at the first step (US-SITE-02)

- The re-made `v1.0.0-beta.3` tag's run stopped at E2E on one test: "scrolling the pinned story" expected the first step and found the third ("Milestones and retention"). Nothing was published. `scrollIntoViewIfNeeded()` centres the 5.6-screen section, which is the third step; locally the checks ran before the page's scroll handler caught up, so they passed, while on CI's runner the handler got there first. The home page itself was right.
- The test now scrolls to the section's start, and the first step is still showing half a second later.

### 2026-11-15 — Fix: integration tests no longer sign up against another program on the Mac (D-239)

- **What happened:** now and then a test file stopped while setting up with "Signup failed: 404 not found" or "401 Unauthorized" (US-SET-08, US-INV-24, US-TEAM-19 to 23 today), only when run on a Mac and never in CI. Each file's API listened on a free port on every interface, and the tests call `127.0.0.1`. On macOS another program can already hold the same port on `127.0.0.1` alone (VS Code, Bitwarden and OrbStack all do), and the calls reached it instead.
- **Fixed:** the test API's free port is bound on `127.0.0.1`, as the AI stub's already was, so macOS hands out only ports nothing else there is using. Files that need a fixed port (the agent sign-in tests, US-MCP-03 to 07) are unchanged.

### 2026-11-15 — Fix: the web image builds again, and v1.0.0-beta.3 is tagged again on the fix (US-SITE-12)

- **What went wrong:** the first `v1.0.0-beta.3` tag's run stopped at the self-hosting check: the web image couldn't build. Building the in-app help (US-SITE-12) generates its theme from `docs/design/tokens.json`, and `.dockerignore` left the whole `docs/` folder out of the image's build context. Neither `pnpm verify` nor a pull request builds the images, so nothing caught it before the tag. Nothing was published: no release, no images.
- **Fixed:** `.dockerignore` keeps `docs/design/tokens.json`. A test (`scripts/us-site-12.test.mjs`) applies `.dockerignore` and fails if that file is left out, or if the rest of the spec, secrets or local data get in.
- **The tag:** since nothing was published under it, `v1.0.0-beta.3` is deleted and made again on the fixed commit. `docs/release.md` now allows that only when a tag's run published nothing; once anything is published, the next version is tagged instead.

### 2026-11-15 — The repo is public; the README says which files to download and how to install on your own computer (US-OPS-19, D-278)

- **Public repo (D-278):** a beta tester on an Apple Silicon Mac got "no matching manifest for linux/arm64": the betas' images were amd64 only while the repo was private. The repo went public today, ahead of 1.0. From `v1.0.0-beta.3`, every release publishes amd64 and arm64 images, the nightly self-hosting checks run, and servers download releases and images without a GitHub token. The beta and Coolify guides drop the token and `docker login` steps. New commits use the GitHub noreply address.
- **Which files:** the README's "Install in 5 minutes" and both install pages in the docs list the seven files to download from the newest release, and say you don't need the `.apk` or the Coolify compose file. A `curl` loop downloads them by the release's tag, with nothing to install or sign in to. The old `gh release download --repo …` failed with "release not found", because GitHub doesn't count a pre-release as the latest release (and `gh` needs signing in).
- **On your own computer:** `--app-url http://localhost`, or the computer's IP address for other devices on the network, runs Spine on plain HTTP. It's fine for trying Spine out; the field app and notifications need a domain with HTTPS.
- A test (`scripts/us-ops-19.test.mjs`) checks the README and both install pages download this version's tag and list every file an install needs. `docs/release.md` adds the tag to the version bump.
- **Version 1.0.0-beta.3**, the first beta with arm64 images, with release notes in `docs/releases/v1.0.0-beta.3.md`.
- US-OPS-19 is still waiting for the Owner's clean-machine test (QA section 280).

### 2026-11-15 — The security review, refreshed: CSV exports can't carry a formula (US-OPS-18 done)

- **Signed off:** the Owner signed off [docs/security-review.md](docs/security-review.md) on 2026-11-15, accepting the items it lists as accepted. US-OPS-18 is done.
- **Fixed (CSV injection):** a cell starting with `=`, `+`, `-` or `@` went into CSV exports unchanged, so Excel or Sheets ran it as a formula. People outside the business can put text there: a customer's signer name on the public quote link, a payer's bank statement description. Such a cell now gets a leading `'` unless it's a plain number, so negative amounts stay numbers. One rule, `CSV_FORMULA_CELL` in `packages/shared/src/csv.ts`, used by the API's `toCsv` (reports, tax summary, audit log, data export) and the web app's `Papa.unparse` (the catalogue export and the import's problem rows). Contact, catalogue and opening-balance imports take the `'` off again, so an export imports back unchanged. `toCsv` also quotes a bare carriage return.
- **Dependencies:** the six node-forge advisories in `pnpm.auditConfig.ignoreGhsas` were fixed by the 1.4.3 override and are removed, so a new one fails CI. `pnpm audit --prod --audit-level high` passes.
- **Review:** [docs/security-review.md](docs/security-review.md) re-run against `main`: gitleaks over 678 commits finds no leaks, the full API integration suite passes, and the write-up now covers connected agents (access through the person's own rights, OAuth 2.1 with PKCE and 15-minute tokens, self-registration accepted with its limits, prompt injection accepted), every route that answers without a session, and the new job-photo delete. It's ready for the Owner's sign-off.
- **Guide:** Export or print a report, Data export and Import and export catalogue items say what the `'` is for.
- **Tests:** `us-ops-18` in `packages/shared` (the rule and the round trip), `apps/api/src/common/us-ops-18-csv.test.ts` and `apps/web/src/__tests__/us-ops-18.test.ts`. QA section 278 gains steps 5 and 6 and the export and import regressions.

### 2026-11-14 — Delete job photos, and see them full screen on the phone (US-JOB-39, US-MOB-30, US-MOB-31, D-277)

- **API:** `DELETE /jobs/:id/photos/:photoId { reason? }`: ownership first (own `job_photos.edit_own`, Field always on assigned jobs; others' `job_photos.edit_others`, never Field, else 403 `PHOTO_NOT_YOURS`), then the lock (job Completed or Cancelled, or milestone invoiced: Owner only, 409 `PHOTO_LOCKED`, and a reason, 400 `REASON_REQUIRED`). The row is marked removed (who, when, reason), audited as `photo_removed` (the job's activity shows it), and the stored file deleted once nothing else uses it. `GET /jobs/:id/photos` leaves removed photos out and gains `locked`, `lockedBy` and `canDelete`; the files' owner lookup and Today's photo count skip removed photos. Migration `0133_job_photo_removal`: the three columns, and `file_id` now empties (set null) when its file is deleted, as attachments do. The two photo capabilities are relabelled "Add and delete own job photos" and "Delete others' job photos"; the OpenAPI document is regenerated.
- **Web:** each photo on the Photos tab has a ⋯ menu (Open, Download, Delete photo); the viewer has Delete photo beside Download; `delete-photo-dialog.tsx` asks first, and asks an Owner for a reason on a locked photo. A new fixed `inverse-danger` token (#F17B72) colours Delete on the dark viewer. "Photo removed" in the job's activity.
- **Field app:** tapping a photo on a job or its Photos screen opens `/photo-viewer`: full screen and dark like the camera, "<n> of <total>", swipe, pinch or double-tap zoom, swipe down to close, Next/Previous photo for screen readers, the caption, milestone and who added it, no Save or Share. "Delete photo" follows the row's `canDelete`, needs a connection and is never queued; a waiting photo has "Discard", which takes it out of the outbox. Zoom is built on `PanResponder`, so no new native module or prebuild.
- **Checks:** `us-job-39.http.integration.test.ts` (5), `apps/e2e/tests/us-job-39.spec.ts` (2, runs in `pnpm verify`), `us-mob-30.test.tsx` (7), `us-mob-31.test.tsx` (7). API, web, shared, UI and mobile suites pass.
- **Spec and docs:** the stories gain the designed copy (the lock line, "Only Owners can delete a locked photo", the Photos tab's note) and `canDelete`; D-277's as-built note; 04-data-model (`file_id`); screens.md gains the five screens; QA script §281; the guide's "Add site photos to a job" (delete) and "Take site photos for a job" (look at and delete a photo).

### 2026-11-14 — Spec: delete job photos, and see them full screen on the phone (US-JOB-39, US-MOB-30, US-MOB-31, D-277)

- **Why:** a wrong photo on a job couldn't be removed anywhere, and the field app's photo tiles didn't open.
- **Agreed (D-277):** the person who added a photo can delete it while the job is Active or On hold and its milestone isn't invoiced. Milestone photos stay open after completion because they're added at that moment. Owners, and Staff whose Team has "Delete others' job photos" (`job_photos.edit_others`, until now reserved), can delete other people's open photos; Field never. A locked photo is Owner-only, with a reason. Removal works like removing an attachment (US-OPS-35): marked removed, audited, file deleted. On the phone a full-screen viewer (swipe, zoom, caption, who and when, no Save or Share); deleting needs a connection; a photo waiting to send can be discarded.
- **Spec:** new stories in 07-jobs and 17-mobile; D-277; `job_photos` gains `removed_at`, `removed_by_user_id`, `removal_reason`; `DELETE /jobs/:id/photos/:photoId`, `locked`/`lockedBy` on photo rows and `photo_removed` in job activity (05-api); the capability matrix and a rule in 07-security; Phase 12 and progress list the three stories. Screens come next: `JobPhotosViewer` (updated), `JobPhotoDelete`, `JobPhotoDeleteLocked`, `MobPhotoViewer`, `MobPhotoViewerAndroid`, `MobPhotoDelete`.

### 2026-11-14 — GSTR-1 leaves retention releases out (D-276, answers Q-21)

- **Why:** GSTR-1 counted a retention-release invoice as a supply of its own: an untaxed B2B invoice with no HSN/SAC, in the totals and in Documents issued. The retention had already been taxed on the progress invoices that held it back (D-130). Indian practice is the same: GST is paid on the full RA bill, retention included, and the release is a receipt against those bills, not a new tax invoice. Tally clears retention from its own ledger at final settlement, the same way.
- **GSTR-1:** `retention_release` invoices join deposit requests and opening invoices as not supplies, so they're left out of every table and Documents issued. Releases still take the next invoice number, so the series can skip one there.
- **Tax Summary:** releases never showed in its sales (they carry no tax or supply class), but voiding a release issued in an earlier period took its amount off the period's taxable sales. Now voiding one changes nothing, and the per-line breakdown leaves releases out.
- **Demo data:** India's construction and fit-out demos release retention like the other countries (D-192).
- **Checks:** `apps/api/src/modules/tax/gstr1/d-276.http.integration.test.ts` compares GSTR-1 (summary and JSON) and the Tax Summary before and after a release, and after voiding one issued last month. Without the fix, three of its four checks fail. `us-onb-18.test.ts` now expects releases in every country.
- **Spec:** D-276; Q-21 closed; 06-ledger-posting-rules (a note under P10); US-TAX-16's implementation notes; 01-onboarding (the demo edge case and criterion); QA script §175 step 10 and the demo note. Guide: "Export GSTR-1" and "Hold and release retention" say what's left out and why.

### 2026-11-14 — The website publishes after each merge (US-SITE-14 done)

- **Checked live:** the `spine-site` Worker is connected. `https://spine.h4loom.com/` and `/docs/` answer 200, `http://` redirects with a 301, and the redesigned home page from PR #20 went live after its merge. The Owner checked the rest in Cloudflare: a branch push gets a preview address, a change outside the sites starts no build, and a failed build leaves the live site as it was.
- **Spec:** US-SITE-14 is ticked in progress. Its implementation note in 19-website now says the Worker is connected, where it said connecting was the Owner's step. No contract or screen changes.

### 2026-11-14 — Fix: the dependency audit after two new node-forge advisories

- **Why:** `pnpm audit --prod` (the first step of `pnpm verify` and of CI) started failing on GHSA-rhr8-3pm8-cq29 and GHSA-6qrw-m8cv-hcxf, published 2026-11-10: both high, in `node-forge` 1.4.0, which reaches production through better-auth › drizzle-orm › expo-sqlite › expo's CLI.
- **Fix:** a pnpm override pins `node-forge` to ^1.4.3 (the patch release that fixes these and its other open advisories), like the existing overrides in the root `package.json`.

### 2026-11-14 — A redesigned home page with motion (US-SITE-02, D-275)

- **Why:** the home page was Starlight's stock splash: a left-aligned hero, a strip of pills, a flat screenshot and six identical cards, with nothing showing how Spine works. Redesigned on the design canvas from Mobbin references (Twenty, Beside, Mercury, FLORA, Function, Giga) and approved before building.
- **The page** (`apps/site`, now its own Astro page; the docs stay on Starlight):
  - a centred hero over the dashboard rebuilt in HTML, which tilts flat as you scroll, counts its figures up and has the example job's events arriving at its corner;
  - "How it works", pinned while scrolling moves one job from enquiry through quote, job, invoice and payment to a balanced journal entry (5% retention to 1150), with step buttons;
  - six feature cards with small working demos;
  - the install commands with a copy button, and a 404 page.
  Every word is in `src/locales/en/home.ts`; the colours, radii, shadows and motion timings are generated from `docs/design/tokens.json` (`tokens-css.mjs --home`). Inter and IBM Plex Mono are self-hosted (Fontsource) and the icons are Lucide (`@lucide/astro`; the GitHub links use Lucide 0.469's GitHub glyph, which later versions dropped), so the page makes no outside requests.
- **Motion and access:** motion runs only when the reader hasn't asked for reduced motion; phones, short windows, reduced motion and no JavaScript get the same content as a still list. The theme switch uses Starlight's stored setting, so the docs open in the same theme. axe finds no WCAG 2.1 AA violations in either theme.
- **Checks:** `scripts/us-site-02.test.mjs` builds the page and checks the copy, buttons, workflow, theme tokens, feature cards, footer, 404, no hex colours in the source, and that the example job's figures add up. `apps/e2e/tests/us-site-02.spec.ts` checks the pinned story, the step buttons, the theme carried into the docs, the reduced-motion and phone lists, and accessibility. CI's E2E job builds the site first. `scripts/site/build-pages.mjs` now checks every home-page link and `#anchor`, replacing `starlight-links-validator` there.
- **Spec:** US-SITE-02's screenshot criterion becomes "the product view follows the reader's theme", plus criteria for the pinned story, reduced motion and the shared theme. The screenshot run no longer captures the home page (US-SITE-06). D-275, `SiteHome`/`SiteHomeDark` (new images), 01-tech-stack, 02-architecture, 11-testing-release, progress and QA script §279 are updated.

### 2026-11-14 — The website redirects http to https, and builds only when it changes (US-SITE-14)

- **Why:** once `spine.h4loom.com` was live, `http://` still answered 200 over plain HTTP. The zone's Always Use HTTPS setting now sends a 301 to the https address.
- **docs/release.md › The website and docs:** step 3 gains the zone's HTTPS settings (Always Use HTTPS on, TLS 1.2, Automatic HTTPS Rewrites on, HSTS off for now), plus a redirect rule for the site alone as the narrower option. Step 4 checks the redirect. The QA script's step 8 checks it too.
- **docs/release.md › Build watch paths:** step-by-step setup of the Worker's watch paths, so a change outside the two sites (the API, the web app, the spec in `docs/`) doesn't start a site build. A new Worker builds on every change until they're set. It also explains why they can't go in `wrangler.jsonc` (Workers Builds ignores its `build` block), why the two paths outside the site folders are there, and Cloudflare's own build-anyway cases.

### 2026-11-06 — The website publishes as a Cloudflare Worker with static assets (US-SITE-14, D-274)

- **Why:** Cloudflare's dashboard now combines Workers and Pages, and Create makes a Worker whose build runs `npx wrangler deploy`. With no Wrangler config, that stopped at the monorepo root ("application detection logic has been run in the root of a workspace") after a successful `pnpm site:build`.
- **`wrangler.jsonc`** (repo root): the `spine-site` Worker serves `apps/site/dist`, answers a missing page with the nearest `404.html` (the docs' own under `/docs/`), turns on workers.dev and preview URLs, and sends no telemetry. It names no domain; the domain stays in `public-site.ts`. `scripts/us-site-14.test.mjs` checks the folder matches the build's and that no domain is named.
- **docs/release.md › The website and docs:** step-by-step setup in the combined dashboard (Settings › Build, Build variables, Branch control, Build watch paths, Domains & Routes), and what to check after the first build.
- **CI:** a pull request that changes only the home page, the docs site or how they publish (`apps/site`, `apps/docs` except `openapi.json`, `scripts/site`, `wrangler.jsonc`) runs a new **Sites** job alone: the two sites' install, `astro check`, the site script test and `pnpm site:build`. It feeds the required "Unit and integration" check, so a broken site still blocks the merge. `docs/design/tokens.json` now counts as app code (every app reads it); before, a tokens-only change skipped the app's unit tests.
- **Spec:** D-274 amends D-273. Updated 01-tech-stack, 02-architecture, 11-testing-release, 19-website (US-SITE-14), progress and the QA script.

### 2026-11-05 — The website at spine.h4loom.com with the docs under /docs/, the domain set in one place (US-SITE-14, D-273)

- **One site:** the home page is `spine.h4loom.com` and the docs `spine.h4loom.com/docs/` (they were `h4loom.com` and `docs.h4loom.com`). `pnpm site:build` builds the home page into `apps/site/dist` and the docs into its `docs/` folder, then checks that every home-page link into `/docs/` was built. CI, `pnpm verify` and the one Cloudflare Pages project (`spine-site`, docs/release.md) all run it. The home page's links to the docs no longer name a domain.
- **The domain is set once,** in `packages/shared/src/public-site.ts` (`SPINE_DOMAIN`, `SPINE_SITE_URL`, `SPINE_DOCS_URL`). The two sites' addresses, the bundled guide's "See the latest online docs", the app's ? › Online docs and the tests read it. `scripts/us-site-14.test.mjs` checks that the README and GitHub's issue template, which have to spell the addresses out, agree with it, and that no code names the domain itself.
- **Unchanged:** the field app's id `com.h4loom.spine`, and the `beta.` and `demo.` addresses. Pointing the bare `h4loom.com` at the home page is a Cloudflare redirect rule (docs/release.md).
- **Spec:** D-273 supersedes D-270's two projects and D-271's home page and docs addresses. Updated: 01-tech-stack, 02-architecture, 11-testing-release, 19-website (US-SITE-01, US-SITE-14), Q-15, the README. QA section 279 gains steps 9–11.

### 2026-11-05 — Fix: the meetings mini calendar after paging quickly (US-MTG-13)

- Paging the mini calendar several months at once could leave the month on screen without its busy-day dots: an earlier month's answer that arrived last replaced it. Answers for a month no longer on screen are now ignored. Found by the E2E suite (`us-mtg-13`), which failed now and then.

### 2026-11-05 — The README, licence and contributor guide (US-OPS-19, D-263)

- **README:** what Spine does, screenshots (light and dark), installing in 5 minutes, back up and restore, updating, help, status, the repository layout, contributing and the licence. The production section now describes the published images and migrations at start.
- **`LICENSE`:** AGPL-3.0-only, copyright (C) 2026 Hari Prasad (D-263). **`CONTRIBUTING.md`:** working from a story, tests, docs, the checks, pull requests and sign-off (Developer Certificate of Origin, no CLA). **`CODE_OF_CONDUCT.md`:** Contributor Covenant 2.1. **Templates:** bug, idea and pull request templates; security reports go to GitHub's private reporting.
- **`docs/release.md`:** versioning, the changelog and release notes (`docs/releases/v<version>.md`), the release steps and what CI publishes, archiving the docs per minor, the Cloudflare Pages setup, and what to do when a release goes wrong.
- **Left for the Owner:** the clean-machine test of following only the README to a first invoice (QA section 280).

### 2026-11-05 — The website, the docs and help in the app (US-SITE-01 to US-SITE-14, D-108, D-110, D-111, D-113, D-270)

- **Two sites:** `apps/docs` (`docs.h4loom.com`) and `apps/site` (`h4loom.com`), Astro 7 + Starlight 0.42, themed from `tokens.json`, with light, dark and auto modes and the Spine logo. Pagefind search. Every internal link is checked at build. CI and `pnpm verify` build both.
- **Content:** Get started (3 pages). The user guide: 268 task pages in 20 modules, each with who can do it, numbered steps in the app's own words and a screenshot. Self-hosting (9 pages: install, configuration of every setting, email, file storage, backups, upgrades, HTTPS, Coolify, troubleshooting). Developers (architecture, local setup, the ledger, testing, contributing, API conventions). A generated API reference: one page per operation, with who may call it, the Idempotency-Key, errors and a `curl` example.
- **Screenshots:** `pnpm --filter @spine/e2e screenshots` captures the 183 screens the guide lists, light and dark, from a demo install, and the home page's dashboard.
- **In the app:** the Help (?) button is a menu with Help for this page (the guide page for the screen you're on), User guide, What's new in <version>, Keyboard shortcuts and Online docs, all opening in a new tab. Every install serves the guide for its own version at `/help`, built into the web image, with no outside requests, so it works offline. It has its own search, and a banner saying which version it describes.
- **Versions:** `starlight-versions` archives each earlier minor once 1.1 ships (`apps/docs/src/versions.json`); `/versions/` lists them.
- **Publishing:** two Cloudflare Pages projects, set up as docs/release.md describes (the Owner connects them). The pull request template asks for the guide page (US-SITE-05).
- **Found while writing the guide** (the guide describes the app as it is; these are left for follow-up): US-SET-05's check that a starting number isn't at or below the last issued one isn't enforced. US-SET-04's warning when changing currency with documents isn't shown. US-DASH-10's keyboard reordering of dashboard cards isn't built (mouse only). US-MTG-07's "no response after a meeting ends" isn't enforced. D-198's field-app message when Jobs & field is off doesn't exist. The capability descriptions for "View dashboard summary" and "View ledger / journals" still say P&L and the balance sheet are Owner-only.
- **Tests:** `us-site-11` (web: the menu, its links and the route map) and `us-site-11-12` (E2E: the menu opens this page's guide from `/help`, with no outside requests, offline search, no developer docs and no version menu). QA section 279.

### 2026-11-05 — The security review before 1.0 (US-OPS-18, D-267)

- **Review:** [docs/security-review.md](docs/security-review.md) covers the OWASP Top 10 area by area, with each finding fixed or accepted, and is ready for the Owner's sign-off. `SECURITY.md` says how to report a vulnerability (GitHub private reporting).
- **Fixed:** the API now trusts the reverse proxy (loopback and private networks; `TRUST_PROXY` overrides). Before, every visitor behind Caddy shared one 20-a-minute public limit. The web app sends `X-Frame-Options`, `nosniff`, a referrer policy, a permissions policy and HSTS over HTTPS. The API sends `DENY`, `nosniff`, `no-referrer` and no `X-Powered-By`.
- **Dependencies:** 9 critical and 49 high advisories fixed by upgrading Next.js (15.5.28), nodemailer (10.0.6), Tiptap (3.30.5), DOMPurify (3.4.17) and Vitest (3.2.7, with Vite 6.4), and by pinning fixed transitive versions. The rest, all build tooling linked as optional peers, are reviewed and listed by id. CI and `pnpm verify` run `pnpm audit --prod --audit-level high`. The rich-text editor is always named, since Tiptap 3.30 gives it a text-box role.
- **Scans:** gitleaks over the whole history (10 reviewed false positives, in `.gitleaksignore`) and a ZAP baseline of the web app and the API (no failures; a Content-Security-Policy is risk R-31).
- **Tests:** `us-ops-18` integration test (guessed and tampered quote tokens and invitation ids get the same 404, per-visitor rate limits, headers). QA section 278.

### 2026-11-04 — Every user-facing string in translation files (US-OPS-16, D-268, D-069)

- **Strings:** every string the web app, the field app, `@spine/ui` and `@spine/ui-native` show now comes from `packages/shared/src/i18n/en.json`: about 7,650 strings in 34 areas, read through i18next (`react-i18next` in components). Keys are typed, so a missing or misspelled key fails typecheck. English is still the only language, and no wording changed. A translation is a sibling file with the same keys.
- **Lint:** `i18next/no-literal-string` (from `@spine/config/eslint/i18n`) fails CI on a hard-coded string in JSX text or a visible attribute, in all four packages.
- **Locale:** dates and numbers use the business's locale everywhere. Before, many dates used the browser's locale or a fixed `en-GB`. The web app reads `orgLocaleTag()`, and the field app and the component libraries read `formatLocale()` from `@spine/shared/i18n`, set from the business.
- **How:** 15 agents converted the apps area by area in parallel, after the setup (`80b9f778`). Then every literal they removed was checked against `en.json`, and lint, typecheck, unit tests and the E2E suite were run. Two tests that read source text now read the keys' English (US-OPS-10, US-SET-26).
- **Still in code, until 1.1 with emails, PDFs and API errors:** labels exported by `@spine/shared` that the server also uses. A few sentences are assembled from pieces.

### 2026-11-04 — Pass an accessibility audit of every screen (US-OPS-17, PRD §10.8)

- **Audit:** a new E2E runs axe-core (WCAG 2.1 A and AA) with demo data on every web page: 54 pages, a demo record of each of 9 kinds and 27 Settings panes, in light and dark mode. It now passes with no violations.
- **Fixed on the way:** the report tabs, the Documents pane's document tabs and the credit-note mode tabs named tab panels that don't exist. Currency, job, vendor and customer pickers inside a labelled field weren't named by it. The financial-year and currency/locale dropdowns, the Meetings "show every calendar" checkbox and the "Prices include tax by default" switch had no name. The numbering table's inputs had none. The calendar's event times were at 3.7:1 contrast. The expense page's receipt note sat inside a definition list.
- **Keyboard:** an E2E takes an accepted quote to a paid invoice with Tab and Enter alone and checks that every control on the way shows a focus ring.
- **Field app:** a test checks every touchable has a role and a label or visible text. The VoiceOver and TalkBack walkthrough is QA section 276.

### 2026-11-04 — The web app on a phone (US-OPS-14, US-OPS-15, finding C19, D-066)

- **Phone layout:** under 768px a top bar shows the menu button, the logo, notifications and your avatar, in place of the sidebar. The menu button slides the full navigation in from the left over a dimmed page, with search, a close button, and your name and help at the bottom. Tapping the dimmed area, Escape or a link closes it. New `@spine/ui` parts: `AppShellTopBar` and `AppShellMobileNav`, documented on the AppShell page.
- **Tap targets:** every control is at least 44×44px under 768px, set once in the Tailwind preset. Checkboxes, radios and switches keep their size with a 44px tap area around them.
- **Fits the screen:** page headers wrap their actions under the title. The dashboard's key figures are two per row and charts one per row. Content padding is 16px. Tables scroll inside their card, and no page scrolls sideways. Dialogs fill the width with a 16px gutter (Settings stays full-screen, D-236), drawers leave 16px, and form fields stack in one column below 768px (54 form grids moved from `sm:` to `md:`).
- **Tests:** `us-ops-14` (top bar, opening and closing the navigation, the dashboard at 390px, 44px controls) and `us-ops-15` (19 routes at 390×844 with no sideways scroll and tables scrolling in their box; dialog, drawer and form widths) E2E specs, and an AppShell a11y test for the phone parts. QA sections 274 and 275.

### 2026-11-04 — A helpful page for a missing page, and for an unexpected error (US-OPS-11, US-OPS-13, finding G8)

- **404:** an unknown address, a record id that can't be one, or a record that isn't in your organisation shows "404", "We can't find that page" and that financial documents are never deleted, inside the app shell, with "Go to dashboard" and "Go back". Signed out, an unknown address goes to the login page first and comes back after. Record pages use a new `useLoadFailure(id)` hook. Before, they showed only an error line (or a 500 for a malformed id).
- **Error page:** a page that fails on the server shows "Something went wrong on our side", that nothing saved was lost, and "Error reference: <request id>" with "Try again" (reloads) and "Go to dashboard". `ApiError` carries the API's `X-Request-Id`.
- **Tests:** `us-ops-11` and `us-ops-13` web tests and E2E specs (an unknown address, a missing and a malformed record, signed out; a stubbed 500 with its request id, Try again recovering, Go to dashboard). QA sections 272 and 273.

### 2026-11-04 — Respect reduced-motion settings everywhere (US-OPS-09, finding C25)

- **Web:** with `prefers-reduced-motion: reduce`, the Tailwind preset collapses the `--duration-*` tokens and ends every transition and animation at once (0.01ms, so code waiting for `transitionend` still runs). Dialogs, drawers, menus, popovers, toasts and the sidebar appear in their final state. Spinners keep turning, as the only sign that work is going on.
- **Phone:** `@spine/ui-native` has `useReduceMotion()` and `isReduceMotionEnabled()`. With Reduce Motion (iOS) or Remove animations (Android) on, `GaugeIndicator` shows its value without the spring, `FloatingTabBar`'s highlight snaps to the new tab and `FloatingLabelField`'s label moves without animating. `Skeleton` and `Carousel` already held still. The field app's native tabs follow the setting themselves.
- **Docs:** `motion.md` says how it's built in place of the C25 gap. The motion page in the design system and the gauge and floating label demos say what happens.
- **Tests:** a `us-ops-09` E2E (the palette, a menu, a toast and the sidebar with reduced motion, and a toast still animating without it) and a `us-ops-09` native test (gauge, tab highlight, floating label). QA section 271.

### 2026-11-04 — Tell owners a new version is available (US-OPS-06, D-055, D-269)

- **Daily check:** once a day (04:17), and at start-up if the last result is missing or a day old, the API asks GitHub Releases for Spine's latest release. Drafts and pre-releases don't count. The request carries only `Accept` and `User-Agent: Spine`: no version, address or business. A failed check is logged and keeps the last result. `UPDATE_CHECK=off` schedules nothing, so no request is made. Tests and CI set it off.
- **`GET /org/update-status`** (Owners only) returns `{ current, latest?, releaseUrl?, checkedAt? }`. The result is stored as the `update_check` setting, which the generic settings routes no longer read or write.
- **Banner:** Owners see "Spine <new> is available. You're on <current>. Updating runs database migrations automatically and takes a backup first." with "What's new" (the release's notes), "How to update" (the README's new Updating section) and a close button. Closing it hides it in that browser until the next version. Staff and Field never get it. Versions compare the semantic-version way, so 1.0.0 is newer than 1.0.0-beta.2.
- **Tests:** `us-ops-06` tests in the API (what the request sends, Owner-only access, failures and pre-releases kept out, `UPDATE_CHECK=off`), the web (the banner, closing it, the next version) and shared (version order). QA section 270.

### 2026-11-03 — Start with demo data from an environment flag (US-OPS-02, D-086)

- **`SEED_DEMO` works:** it was in `.env.example` but nothing read it. On first start, into an empty database only, `true` loads Riverstone Builders and `<country>:<industry>` (e.g. `IN:interior_design`) loads that demo business. The API logs "Demo data loaded — the first person to sign up becomes its owner." On a database with data it logs that seeding was skipped. An unknown value logs what it takes. A failure is logged and never stops the API.
- **No owner account:** the demo is loaded as a placeholder Owner with no password, and the business carries a `demo_awaiting_owner` setting. Sign-up stays open while it waits. The first sign-up takes the marker under a row lock, becomes the business's Primary Owner in place of the placeholder, and lands on the dashboard with onboarding marked skipped. Sign-up is invite-only after that. Two sign-ups at once can't both own it. `07-security.md` › Sign-up and `04-data-model.md` are updated.
- **Tests:** `us-ops-02` boots the app on a database of its own, made and migrated by the test, because first start needs an empty one: unset and unknown values, loading with no owner, the first sign-up becoming Primary Owner, sign-up closing, a restart skipping, and two claims at once. QA section 269.

### 2026-11-03 — Remove demo data and keep my real data (US-SET-08)

- **Settings › Data:** "Delete all demo data" now asks with the app's `useConfirm()` (D-218): "Delete all demo data?", what goes, that your own records stay and the demo people lose access, with "Cancel" and "Delete demo data". It then says what happened with the app's toast (D-223), "Demo data deleted · Your own records stay.", in place of Settings' generic "Saved". A failed delete used to fail silently. Now the pane shows the server's message and keeps the demo shown. The button reads "Deleting…" while it works.
- **Tests:** a `us-set-08` integration test (the demo goes, the demo people's memberships go, the Owner and their own customer stay, the status says so) and a web test of the pane's wording, confirm, toast and error. QA section 268.

### 2026-11-03 — Load demo data to explore (US-ONB-09)

- **A recurring meeting in every demo business:** each one's internal planning meeting ("Weekly crew scheduling" for Riverstone Builders, "Studio planning" for interior design, and so on) now repeats weekly for 12 weeks. Editing one shows the "This event" / "All events" choice (finding C5). The plans carry `weeklyFor`.
- **Loads when file storage is down:** the demo's logo, job and milestone photos and receipts go through one upload helper. After the first upload storage refuses (503 or 507), it skips the rest, so the demo loads without them instead of failing with every row rolled back. `POST /demo-data/seed` returns `notes` (`"Photos skipped — file storage isn't reachable."`), and the picker shows it with Continue rather than closing. Real photos (finding C10) came with US-JOB-38.
- **Tests:** `us-onb-09` integration tests (the weekly meeting and editing one occurrence of it, another industry's, storage refusing uploads), a shared test that all 35 demo businesses have one weekly meeting, and a web test of the picker's note. QA section 267.

### 2026-11-03 — An Android-only beta, and the keystore checked before the build (US-MOB-28, D-272)

- **Android only for now:** the field team uses Android, and TestFlight needs the Apple Developer Program, so the beta can ship just the APK (`build-beta.sh --android`). iPhone joins once the Owner enrols. `docs/beta.md` › The phone app now leads with Android and says how to share the APK while the repo is private: Google Drive or Firebase App Distribution, since testers can't download from a private GitHub release.
- **Found by the first real beta build:** a wrong keystore password failed only at the end of a six-minute Gradle build, as "Keystore was tampered with, or password was incorrect". `build-beta.sh` now checks the keystore's password, the alias and the key's password with `keytool` before `expo prebuild`, and names the variable to fix. The passwords reach keytool through the environment (`-storepass:env`), not its command line. In a PKCS12 keystore the key has the keystore's password, so the script says so if they differ.
- **Also:** a broken code block in `docs/beta.md` › A new beta, and the build steps name the current tag.
- **Tests:** `scripts/mobile/us-mob-28.test.mjs` runs the script against real keystores made by keytool (JKS with its own key password, and PKCS12), stopping at a fake `npx`: the right details go on to build; a wrong keystore password, alias or key password stops it first. QA section 265 rewritten for an Android-first beta.

<!--
Entry format (newest on top). At the start of a month, move the month before into docs/changelog/<yyyy-mm>.md.

### 2026-11-20 — US-XXX-NN: what people can now do (or "Fix: …")

- What changed and why, a sentence or two per bullet.
- **Tests:** the story-id tests that cover it.
-->
