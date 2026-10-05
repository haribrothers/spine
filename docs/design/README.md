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

Files in [logo/](logo/): `spine-logo-horizontal.png` and `spine-logo-horizontal-light.png` (1024×301) and `spine-logo-vertical.png` (1024×1024). The app shell and sign-in screens use the horizontal mark; the square mark is the app icon source. Customer-facing pages, PDFs and emails show the **business's** logo and name (Settings › Business profile), with "Sent with Spine" in small type at most.

## Iconography

Lucide everywhere, `currentColor`, stroke 1.75 on web (2 on native), sizes 16 / 18 / 20 / 24. Native imports one icon per subpath (`lucide-react-native/icons/house`), never the barrel. Native tab bars use SF Symbols / Material Symbols because the native tab bar only accepts those. Icons are decorative (`aria-hidden`) unless they are the only content of a button, which then gets an `aria-label`.

## Motion

Functional only: motion confirms a state changed. Durations 100 / 150 / 180 / 260 ms, standard / decelerate / accelerate easing, and `prefers-reduced-motion` collapses them. Details in [motion.md](motion.md).

## Documents and email

- PDFs (quote, invoice, receipt) use the business logo, name and address, the document colour from Settings › Branding as a single accent, and the document footer. Money in `mono-data`. PDFs must render byte-identically across installs.
- Every email uses one shared layout (`EmailBrandedQuote`): 6px brand-colour bar, logo and business name, heading, short body, a key-facts box, one primary button, and the business footer.

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
