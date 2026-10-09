# Spine design system

The brand book for Spine's web app (`@spine/ui`), its native mobile app (`@spine/ui-native`), its documents (quote, invoice and receipt PDFs) and its emails. Values live in [tokens.json](tokens.json); motion in [motion.md](motion.md); one file per component in [components/](components/). The running references are `apps/design-system` (web) and `apps/design-system-native` / `apps/showcase-native` (native).

Source of truth: token values are authored in the front matter of `docs/DESIGN.md` and `packages/config/tailwind-preset.css` (web) and hand-synced into `packages/ui-native/src/tokens/` (native). `tokens.json` is generated from those files — change the source, then regenerate.

## Voice

Calm, understated, quietly competent. Spine is money software for people who did not sign up to learn bookkeeping, so it earns trust the way a well-kept paper ledger does: legible, consistent, nothing hidden.

- Plain words and short sentences. No accounting jargon on a screen a field user or office admin sees, unless the screen is an accounting report.
- Sentence case everywhere. Buttons are verbs: "Send quote", "Record payment", "Mark complete".
- Name the thing: "Delete this draft invoice?", "Make Sarah Mendes an owner?".
- Say what happens to people's data: "Photos are saved on this phone and sync when you're back online."
- Errors say what to do next: "The Spine server didn't answer. Try again in a minute."
- Unknown data in designs is written `[IN BRACKETS]`.

## Surfaces and layers

- `background` is the page canvas; `surface` is cards and panels. Split in both themes so raised content reads as a step up: light `#F7F6F3` vs `#FFFFFF`, dark `#121110` vs `#191815` ([D-131](../prd/12-decisions.md)).
- The sidebar, dialogs, drawers, menus and inputs are `surface` in both themes; only the page behind the content is `background`.
- Depth comes from borders and one tonal step, not shadows. A card is a 1px-bordered surface.
- Shadows are reserved for temporary, layered UI: dialogs, drawers, popovers, toasts.
- Stacking order (`zIndex` in tokens): dropdown 1000 → sticky header 1100 → overlay 1200 → modal 1300 → popover 1600 → toast 1700 → tooltip 1800. Popover sits above modal because selects and menus open inside dialogs.
- Toasts and tooltips use the fixed `inverse` surface (`#211F1A` with white text) in both themes.

## Colour

| Role | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#2954E5` | `#6B8AFF` | The one primary action per screen, links, active nav, focus ring |
| `on-surface` | `#211F1A` | `#F3F2EE` | Body text |
| `on-surface-muted` | `#726C5A` | `#9A9786` | Secondary text, captions |
| `scrim` | `rgba(18,17,16,0.32)` | `rgba(0,0,0,0.62)` | The dimmed backdrop behind dialogs, drawers and the search palette (US-OPS-26) |
| `shadow-raised` / `shadow-overlay` / `shadow-toast` | `0 4px 14px rgba(33,31,26,.10)` / `0 10px 30px …0.14` / `0 4px 14px …0.16` | `rgba(0,0,0,.45)` / `.55` / `.55` | Menus and popovers / dialogs, drawers, palette / toasts — stronger in dark so surfaces stand off the page |
| `border` / `border-strong` | `#E7E5E0` / `#D3D0C9` | `#2C2B26` / `#3B392F` | Hairline and emphasised borders |
| `paid` on `paid-bg` | `#177044` on `#E4F5EB` | `#4ADE94` on `#132A1E` | Paid, approved, complete, synced |
| `due-soon` on `due-soon-bg` | `#946000` on `#FCF0D4` | `#F2B23D` on `#332506` | Due soon, waiting to sync, needs attention |
| `overdue` on `overdue-bg` | `#B3261E` on `#FBE6E4` | `#F17B72` on `#3A1512` | Overdue, rejected, failed, destructive action |
| `draft` on `draft-bg` | `#726C5A` on `#F2F1EE` | `#9A9786` on `#201F1B` | Draft, pending — nothing has happened yet |
| `info` on `info-bg` | `#2954E5` on `#EAEFFD` | `#6B8AFF` on `#181F35` | Neutral system messages, submitted |

Rules:

- **Status colours are reserved.** Paid, due-soon, overdue and draft mean financial or workflow status and nothing else. A self-hoster can recolour `primary` (Settings › Branding) but never these four.
- **Every status chip carries a text label.** Colour never carries meaning alone.
- **Event categories** (`category-blue` … `category-slate`, each with a `-bg`) are a separate, user-chosen palette used only by the calendar.
- **Contrast:** every text/background pair above passes WCAG 2.1 AA (4.5:1) in its own mode; `neutral-500` was darkened to `#726C5A` and `paid` to `#177044` specifically to pass on tinted backgrounds. Theme presets (Spine Blue `#2954E5` 6.0:1, Harbour Teal `#0D6E6E` 6.0:1, Plum `#7C3AED` 5.7:1, Graphite `#4B473E` 9.3:1 on white) all pass with white button text.
- Dark-mode colours are tuned per mode, never mechanically inverted.
- Text on filled controls uses `on-primary` / `on-danger`: white in light mode, `#121110` in dark mode, because white on the dark-mode primary `#6B8AFF` is only 3.1:1 ([D-099](../prd/12-decisions.md)).
- Dark versions of representative drawn screens are on the canvas and in [screens.md](screens.md) (names ending `Dark`); every other screen follows the same token mapping. PDFs and customer emails are always light.

## Typography

| Token | Web (Inter) | Use |
|---|---|---|
| `display` | 32px / 650 / 1.2 | Page-level hero numbers only |
| `h1` | 24px / 650 / 1.25 | Page titles |
| `h2` | 18px / 600 / 1.3 | Section titles |
| `h3` | 15px / 600 / 1.4 | Card and dialog titles |
| `body-lg` | 15px / 400 / 1.55 | Reading text (quote terms) |
| `body-md` | 14px / 400 / 1.5 | Default body, table cells |
| `body-sm` | 13px / 400 / 1.45 | Helper text, dense tables |
| `label` | 13px / 550 / 1.3 | Field labels, column headers, buttons |
| `caption` | 12px / 500 / 1.35 | Chips, timestamps |
| `mono-data` | IBM Plex Mono 13px / 500, `tnum` | Money amounts and document numbers |

Native: `@expo/ui` controls use the platform system font (SF Pro on iOS, Roboto on Android) at platform sizes (iOS large title 34pt, body 17pt; Material title-large 22sp, body-large 16sp). NativeWind components use Inter with the scale in `packages/ui-native/src/tokens/typography.ts`.

## Spacing, radius, shadow and blur

- **Spacing:** 4 · 8 · 12 · 20 · 32 · 48 px (`xs`…`2xl`). Card padding 20px (16px mobile). Page margins 32px desktop / 16px mobile.
- **Radius:** `sm` 6px (chips, small controls) · `md` 8px (buttons, inputs) · `lg` 12px (cards, dialogs) · `full` (status chips, avatars). Data tables use 0px.
- **Shadow:** only on dialogs, drawers, popovers, toasts (`0 20px 48px rgba(33,31,26,0.25)` for dialogs).
- **Blur:** iOS only, from the system: native tab bar and `scrollEdgeEffects` under large-title headers. Android uses `ScrollEdgeMask` (a fade, not a blur). Web uses no blur.

## Layout

- Web desktop: sidebar 240px + content capped at 1200px. Breakpoints 768 (tablet) / 1024 (desktop) / 1280 (wide).
- Web phone (< 768px): top bar with menu button, logo, notifications and account; the sidebar becomes a slide-over menu (`AppShellPhone`, `AppShellPhoneNav`). Tables scroll sideways in their own box; charts stack one per row.
- Settings is a dialog with a section list on the left; Users, Teams and Audit log are routed pages under Team.
- Mobile app: native stack per tab; large titles on top-level screens; inset grouped lists on iOS, full-width list items on Android.
- Touch targets are at least 44×44 on every touch surface.

## Phases 8–9: books, tax and setup screens

The 60 screens for Phase 8 (Books completeness) and Phase 9 (Tax, documents and setup) are on the design canvas pages "Phase 8 · Books completeness" and "Phase 9 · Tax, documents and setup", and in [screens.md](screens.md) ([D-133](../prd/12-decisions.md)). They use the D-131 page/surface split and only existing tokens.

**Navigation.** The sidebar gains three items. The drawn screens share one sidebar component on the canvas (`V1Sidebar`):

| Group | Items |
|---|---|
| Overview | Dashboard |
| Sales | Contacts · Pipeline · Meetings · Catalogue · Quotes |
| Jobs | Jobs |
| Billing | Invoices · Credit Notes · Payments · Receivables |
| Purchases | Vendor Bills · **Vendor Credits** · Expenses · Vendor Payments · Payables |
| Money | **Banking** |
| Reports | Reports · **Journals** |
| Team | Users · Teams · Audit log |

Items still follow the rule in US-TEAM-18: a person sees only the sections they can open. Banking needs `banking.view`, Journals needs `ledger.view`, and anything in a switched-off module is gone ([D-154](../prd/12-decisions.md)). The Settings dialog gains GST, Opening balances, Documents, Emails and Modules. Set up Spine opens from the user menu.

**Page layout.** New pages follow the captured list pages (`InvoicesList`, `VendorBillsList`, `Receivables`) and report pages (`ReportsPL`), and an automated check verified every drawn screen:

1. Breadcrumb, page title and description. Detail pages put their actions top right; list pages don't.
2. One row of KPI cards (`StatCard`) in an equal-width grid, every card the same height. Label 14px, value 28px bold, an optional caption.
3. Filter row: selects and date fields on the left, the page's actions on the right with the one primary button last. Every control is 40px tall.
4. Search row: search box (256px) on the left, "Columns" on the right.
5. `DataTable`: sunken header row, sort icons on sortable columns, status chips, money right-aligned with tabular figures, and a ⋯ row menu when rows have actions.
6. Pager: "1–n of n · per page" on the left, page numbers on the right.
7. Reports (D-180) follow one order: the header's description ends with the range and any comparison or basis ("Income less expenses · Jan 1 – Oct 6, 2026 · Accrual basis"); tabs where reports are siblings; a `ReportToolbar` of labelled 40px filters (From, To, Compare with, Basis, then the report's own) with Export (CSV, Excel, PDF, Print) and then the one primary action on the right, bottom-aligned — filters apply as they change, no Refresh; one KPI row of three or four cards; a chart only where it adds something, in a card; the table — `StatementTable` for statements, `DataTable` with a `footer` totals row for lists (search, Columns and pager as above); one muted footnote. A passing check is a footnote; a failing one is a red alert.

Screens that extend an existing one reuse that screen's layout exactly; only the new fields are added:

| Kind | Follows | Shape |
|---|---|---|
| Builders (`InvoiceBuilderGst`, `VendorCreditBuilder`) | `InvoiceBuilder`, `VendorBillBuilder` | Title + description; header card of labelled fields in three columns (required fields marked `*`, helper text under the field); "Lines" card of line blocks (move arrows, item name + "Prefill from catalogue", description, Qty / Unit price / Discount % / Line total, Tax + "Price includes tax", delete); "Add item / Add heading / Add text line"; Notes and Terms card; totals card on the right; Cancel and "Save as draft" at the bottom. GST adds an HSN/SAC + Supply type row inside each line block and Place of supply in the header card |
| Drawers (`CatalogItemDrawerGst`, `ContactGstDialog`, `ReconcileCreateDrawer`) | `CatalogItemDrawer`, `ContactCreateDrawer` | 448px from the right over the dimmed list; title, description and ✕, divider; one column of fields (two side by side where the captured drawer pairs them); footer bar with Cancel and the primary action |
| Dialogs (payments, refunds, credit notes, transfers, journals, imports, recurring bills) | `RecordPaymentDialog`, `CreditNoteDialog`, `ImportContactsDialog` | Title, description and ✕, divider; fields two to a row; money right-aligned; divider; Cancel and the primary action on the right. Confirmations (void, undo, lock, remove, switch off) are the compact `AlertDialog` with no dividers |
| Settings panes (`SettingsTaxCountry`, `SettingsTaxGst`, `SettingsModules`, `SettingsDocumentLayout`, `SettingsEmailTemplates`, `SettingsPaymentInstructionsUpi`) | `SettingsTax` | 896px dialog: search, "ORGANISATION" list with icons (GST, Opening balances, Payment instructions, Documents, Emails and Modules added), ✕; pane title + description; uppercase section labels with "+ Add …"; bordered lists with ⋯; toggle cards. Small dialogs inside Settings (`TaxRateDialogType`) open over the pane like `TaxRateDialog` |
| Onboarding (`OnbTaxCountry`) | `OnbTaxRate` | Centred logo, numbered stepper with done steps ticked, one card, "Skip to dashboard" and Continue, theme button bottom right |
| Privileges (`TeamPrivilegesBooks`) | `TeamPrivilegesExpanded` | Team name, Members / Privileges tabs, one accordion: group rows with a chevron and a group switch, expanded rows with a title, a description and a switch |
| Detail pages (`VendorBillAttachments`, `VendorCreditDetail`, `ManualJournalDetail`) | `VendorBillDetail` | "Back to …", header card (number, status chip, contact · due date, history icon, actions), one card per section (Lines, Payments, Credits applied, Attachments), totals card. No KPI row |
| Documents (`InvoicePdfGst`, `ReportPdf`) | `InvoicePdfPaymentInstructions`, `StatementPdf` | Business mark and address, title and number top right, 4px document-colour rule, "Bill to" and "Balance due", line table, totals, "How to pay" box with a coloured left edge, page footer |

**Patterns and the components they use:**

| Pattern | Screens | Built from |
|---|---|---|
| Money account picker ("Paid into" / "Paid from"), preselected with the last account used | `NewPaymentDialogAccount`, refunds, transfers, tax payment | [Select](components/Select.md) with [HelperText](components/HelperText.md) |
| Report toolbar: From/To, Compare with, Basis, the report's own filters, Export (CSV, Excel, PDF, Print), then the primary action | every report, Receivables, Payables | [ReportToolbar](components/ReportToolbar.md), [DatePicker](components/DatePicker.md), [Select](components/Select.md), [ToggleGroup](components/ToggleGroup.md) (single choice, Accrual/Cash), [DropdownMenu](components/DropdownMenu.md) |
| Statement: sections, subtotals and a total | P&L, Balance Sheet, Cash Flow, Tax Summary, General ledger, Day book | [StatementTable](components/StatementTable.md) |
| Aging: four cards and a bar across all five ages | Receivables, Payables | [StatCard](components/StatCard.md), [SegmentedBar](components/SegmentedBar.md) |
| Report centre: grouped report links with favourites | `ReportsCenter` | [Card](components/Card.md), [Toggle](components/Toggle.md) (star, with an `aria-label`) |
| Reconcile: statement lines beside unreconciled entries, a running difference, and Finish disabled until the difference is zero | `ReconcileAccount` | [Card](components/Card.md), [Checkbox](components/Checkbox.md), [StatCard](components/StatCard.md), [Button](components/Button.md). The difference shows a sign and text, never colour alone |
| Create from a statement line | `ReconcileCreateDrawer` | [Drawer](components/Drawer.md), [RadioGroup](components/RadioGroup.md) |
| Editable money grids: opening balances, journal lines, apply credit | `OpeningBalances`, `ManualJournalDialog`, `ApplyVendorCreditDialog` | [DataTable](components/DataTable.md) with [MoneyInput](components/MoneyInput.md) cells; derived cells in muted text; a `danger` [Banner](components/Banner.md) for "Out by <amount>" |
| Capability rows in the privilege matrix | `TeamPrivilegesBooks` | [Switch](components/Switch.md) with the label and the capability code |
| Modules: a switch per module, and confirmation before switching one off | `SettingsModules`, `ModuleOffConfirm` | [Switch](components/Switch.md), [AlertDialog](components/AlertDialog.md) |
| Setup cards with done / to do | `SetupSpine` | [Card](components/Card.md), [StatusChip](components/StatusChip.md), [Progress](components/Progress.md) |
| Document options beside a live preview | `SettingsDocumentLayout` | [Tabs](components/Tabs.md), [Checkbox](components/Checkbox.md), [Textarea](components/Textarea.md) |
| Email text with placeholders | `SettingsEmailTemplates` | [Textarea](components/Textarea.md), [Badge](components/Badge.md) chips that insert a placeholder |
| Books cards on the dashboard: accounts, payables, top expenses, ready to bill, tax this period | `DashboardOwnerBooks` | [StatCard](components/StatCard.md), [Card](components/Card.md), [TrendBarChart](components/TrendBarChart.md); bars carry their amount as text |

**New components to build with their stories** (each with its `apps/design-system` page and axe test, [D-033](../prd/12-decisions.md)):

- **`FileDropzone`**: drop or pick files, showing the allowed types, size and count limits in text (US-OPS-33).
- **`AttachmentList`**: file rows with a type tile, name, size, who added it, and Download/Remove; Remove becomes Owner-only with a reason on locked records (US-OPS-33–US-OPS-35).
- **UPI QR**: rendered in the API by `qrcode` into the PDF ([D-150](../prd/12-decisions.md)). It's a document element, not an `@spine/ui` component.

**AI assistant (Phase 9).** AI never gets its own page outside Settings › AI; it appears inside the forms it fills:

- **The AI control** is a secondary button with a sparkle icon and a verb: "Read from document", "Read receipt", "Draft with AI", "Draft lines with AI". It's only rendered when AI is on, the feature is on and the person may use it (D-162, D-167).
- **"Suggested by AI"** marks every field AI filled: an `info` tint on the field and a small text label, so it never relies on colour alone. The mark goes when the person edits the field. A banner above the form says what was filled and what to check ("Check the lines before saving").
- **Working and failure states** use the existing `Spinner` and `Banner`: the form stays usable while AI works, and failures say what to do ("AI didn't answer. Fill this in by hand or try again.").
- **Review lists** (quote lines, bank suggestions) show suggestions with a reason and a tick box. Only "Add to quote", "Match" or the normal save acts on them.
- Settings › AI follows the Settings dialog pattern: master switch card, provider fields with "Test connection", feature switches with "What's sent", and the budget with a usage bar.

**Sample data.** Phase 8 screens use the demo business, Riverstone Builders (USD). Phase 9's GST, GSTR-1, Tally and UPI screens use a sample Indian business, Kaveri Interiors (₹, Karnataka), so the Indian formats show: lakh grouping, GSTINs and state codes.

## Platforms

| | Web | iOS | Android |
|---|---|---|---|
| Components | `@spine/ui` (Radix + Tailwind 4) | `@spine/ui-native` on `@expo/ui` SwiftUI | `@spine/ui-native` on `@expo/ui` Jetpack Compose |
| Navigation | Sidebar + routed pages | expo-router native tabs (floating tab bar) | expo-router native tabs (Material navigation bar) |
| Primary action | Filled button | Filled button, inline | Extended FAB or filled pill button |
| Icons | Lucide | Lucide in content; SF Symbols in the tab bar | Lucide in content; Material Symbols in the tab bar |
| Dark mode | `data-theme` toggle (light/dark/system) | System + in-app preference | System + in-app preference |

Android is designed, not ported: every mobile screen has a Material 3 artboard (`…Android`). Material roles are mapped from Spine tokens in `tokens.json › color.android`.

## Logo

The layered mark and the SPiNE wordmark ([D-203](../prd/12-decisions.md), [D-206](../prd/12-decisions.md)). The source SVGs are in [`docs/logos/`](../logos/): the mark, the horizontal and vertical lockups (with on-dark versions), one-colour silhouettes and the iOS and Android app-icon art. Screens never use image files of the logo: the web draws it with `SpineLogo` from `@spine/ui`, the phone with `SpineLogo` from `@spine/ui-native`, both from the same paths. The wordmark is a fixed brand colour (Spine blue in light mode, light text in dark) that no business theme changes. The minimum size is 20 px for the mark and 96 px wide for a lockup. The app icons, splash and favicons are exported from those SVGs (`apps/mobile/assets/brand/`, `apps/web/src/app/icon.svg`). Customer-facing pages, PDFs and emails show the **business's** logo and name (Settings › Business profile), with "Sent with Spine" in small type at most.

## Iconography

Lucide everywhere, `currentColor`, stroke 1.75 on web (2 on native), sizes 16 / 18 / 20 / 24. Native imports one icon per subpath (`lucide-react-native/icons/house`), never the barrel. Native tab bars use SF Symbols / Material Symbols because the native tab bar only accepts those. Icons are decorative (`aria-hidden`) unless they are the only content of a button, which then gets an `aria-label`.

## Motion

Functional only: motion confirms a state changed. Durations 100 / 150 / 180 / 260 ms, standard / decelerate / accelerate easing, and `prefers-reduced-motion` collapses them. Details in [motion.md](motion.md).

## Documents and email

- PDFs (quote, invoice, receipt) use the business logo, name and address, the document colour from Settings › Branding as a single accent, and the document footer. Money in `mono-data`. PDFs must render byte-identically across installs.
- From Phase 9, PDFs use bundled Noto Sans and Noto Sans Devanagari instead of built-in Helvetica, so ₹ and Hindi names print ([D-151](../prd/12-decisions.md)).
- **Layout options**, per document type (Settings › Documents): paper size, which columns show, the title, default terms and notes, a signature, the amount in words, a tax summary table and the UPI QR. One layout only, no template editor; issued PDFs never change ([D-152](../prd/12-decisions.md)).
- **GST invoices** (India) are titled "Tax Invoice" or "Bill of Supply". They show both GSTINs, the place of supply, HSN/SAC per line, CGST + SGST or IGST per line, and an HSN-wise tax table (`InvoicePdfGst`).
- **UPI QR** sits beside the payment instructions with "Scan to pay ₹<amount> with any UPI app" and the UPI ID in text, so it never relies on the image alone ([D-150](../prd/12-decisions.md)).
- **Report PDFs** (`ReportPdf`) share the document header: logo, business name, report name, range and basis, a 4px document-colour rule, and "Prepared <date> · page n of m" in the footer. Landscape when a report has more than five amount columns.
- Every email uses one shared layout (`EmailBrandedQuote`): 6px brand-colour bar, logo and business name, heading, short body, a key-facts box, one primary button, and the business footer. From Phase 9 the owner edits each customer email's subject and message (`SettingsEmailTemplates`); the layout around them stays fixed ([D-153](../prd/12-decisions.md)).

## Accessibility

WCAG 2.1 AA is required, not aspired to.

- Keyboard: every control reachable and operable; visible 2px `primary` focus ring with 2px offset.
- Text contrast 4.5:1 (3:1 at 24px+), checked in both themes.
- Never colour alone: status chips have text; charts have labels or a table.
- Real elements: `<button>`, `<a href>`, `<input>` with `<label>`; icon-only buttons have `aria-label`; dialogs trap focus and return it on close.
- `prefers-reduced-motion` respected.
- Touch targets 44×44 minimum on mobile and on the web phone layout.
- Every `@spine/ui` component has an axe-core test (`*.a11y.test.tsx`), enforced by `check-a11y-coverage.mjs`; native components assert the props passed to the native bridge and are checked with VoiceOver/TalkBack by hand.

## Rules found while documenting the built app

These came from comparing the screens against this system (findings C4, C14, C15 in the PRD's open questions) and are now rules:

1. **Confirmation buttons are primary unless they delete, void or remove.** "All events", "Create invoice" and "Make owner" are primary blue; "Delete", "Void invoice" and "Deactivate" are `danger`.
2. **A step reused from onboarding in Settings says "Save", never "Continue".**
3. **Promoting someone to Owner asks for confirmation**, like every other change to someone's access.
4. **Customer-facing error pages are branded** with the business's name and how to contact it.

## Components

Each component has a page in [components/](components/) generated from its source and doc page: summary, import, props, variants, rules and accessibility test.

### Web — `@spine/ui` (79)

[Accordion](components/Accordion.md) · [Alert](components/Alert.md) · [AlertDialog](components/AlertDialog.md) · [AppShell](components/AppShell.md) · [AspectRatio](components/AspectRatio.md) · [Banner](components/Banner.md) · [Avatar](components/Avatar.md) · [Badge](components/Badge.md) · [Breadcrumb](components/Breadcrumb.md) · [Button](components/Button.md) · [ButtonGroup](components/ButtonGroup.md) · [Calendar](components/Calendar.md) · [CalendarMini](components/CalendarMini.md) · [Card](components/Card.md) · [Carousel](components/Carousel.md) · [Chart](components/Chart.md) · [Checkbox](components/Checkbox.md) · [Collapsible](components/Collapsible.md) · [Combobox](components/Combobox.md) · [Command](components/Command.md) · [ContextMenu](components/ContextMenu.md) · [DataList](components/DataList.md) · [DataTable](components/DataTable.md) · [DatePicker](components/DatePicker.md) · [Dialog](components/Dialog.md) · [DonutChart](components/DonutChart.md) · [Drawer](components/Drawer.md) · [DropdownMenu](components/DropdownMenu.md) · [EmptyState](components/EmptyState.md) · [Field](components/Field.md) · [Form](components/Form.md) · [FormField](components/FormField.md) · [HelperText](components/HelperText.md) · [HoverCard](components/HoverCard.md) · [Input](components/Input.md) · [InputGroup](components/InputGroup.md) · [Kanban](components/Kanban.md) · [Kbd](components/Kbd.md) · [Label](components/Label.md) · [Layout](components/Layout.md) · [Menubar](components/Menubar.md) · [MoneyInput](components/MoneyInput.md) · [MultiSelect](components/MultiSelect.md) · [NativeSelect](components/NativeSelect.md) · [NavigationMenu](components/NavigationMenu.md) · [OtpField](components/OtpField.md) · [PageLoader](components/PageLoader.md) · [Pagination](components/Pagination.md) · [PaginationBar](components/PaginationBar.md) · [PasswordToggleField](components/PasswordToggleField.md) · [Popover](components/Popover.md) · [Progress](components/Progress.md) · [RadioGroup](components/RadioGroup.md) · [ReorderableList](components/ReorderableList.md) · [Resizable](components/Resizable.md) · [RichTextEditor](components/RichTextEditor.md) · [ScrollArea](components/ScrollArea.md) · [Select](components/Select.md) · [Separator](components/Separator.md) · [Sidebar](components/Sidebar.md) · [Skeleton](components/Skeleton.md) · [Slider](components/Slider.md) · [Spinner](components/Spinner.md) · [StatCard](components/StatCard.md) · [StatusChip](components/StatusChip.md) · [Stepper](components/Stepper.md) · [Switch](components/Switch.md) · [Table](components/Table.md) · [TableSkeleton](components/TableSkeleton.md) · [Tabs](components/Tabs.md) · [Textarea](components/Textarea.md) · [Timeline](components/Timeline.md) · [Toast](components/Toast.md) · [Toggle](components/Toggle.md) · [ToggleGroup](components/ToggleGroup.md) · [Toolbar](components/Toolbar.md) · [Tooltip](components/Tooltip.md) · [TrendBarChart](components/TrendBarChart.md) · [Typography](components/Typography.md)

### Native — `@spine/ui-native` (31)

[ActionTile](components/ActionTileNative.md) · [Avatar](components/AvatarNative.md) · [Badge](components/BadgeNative.md) · [BottomSheet](components/BottomSheetNative.md) · [Button](components/ButtonNative.md) · [Card](components/CardNative.md) · [ContextMenu](components/ContextMenuNative.md) · [DateTimePicker](components/DateTimePickerNative.md) · [Divider](components/DividerNative.md) · [EmptyState](components/EmptyStateNative.md) · [FloatingLabelField](components/FloatingLabelFieldNative.md) · [FloatingTabBar](components/FloatingTabBarNative.md) · [FormRow](components/FormRowNative.md) · [FullWidthButton](components/FullWidthButtonNative.md) · [GaugeIndicator](components/GaugeIndicatorNative.md) · [KpiCard](components/KpiCardNative.md) · [TextField](components/NativeTextFieldNative.md) · [ScrollEdgeMask](components/ScrollEdgeMaskNative.md) · [SegmentedControl](components/SegmentedControlNative.md) · [SelectField](components/SelectFieldNative.md) · [SelectListField](components/SelectListFieldNative.md) · [Select](components/SelectNative.md) · [Skeleton](components/SkeletonNative.md) · [Slider](components/SliderNative.md) · [Spinner](components/SpinnerNative.md) · [StatusChip](components/StatusChipNative.md) · [Stepper](components/StepperNative.md) · [Switch](components/SwitchNative.md) · [TabBar](components/TabBarNative.md) · [TextField](components/TextFieldNative.md) · [Toast](components/ToastNative.md)
