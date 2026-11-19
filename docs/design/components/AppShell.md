# AppShell

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/app-shell.tsx` · **Doc page:** `apps/design-system/src/app/components/app-shell/page.tsx`

The persistent shell every signed-in area of Spine renders inside — a collapsible left sidebar (logo, grouped nav sections, pinned user menu) plus a main content region with an optional breadcrumb + title + description + primary-action header. First applied to `/dashboard` and `/settings`, replacing Settings' previous standalone shell so both areas share one implementation instead of two.

## Import

```tsx
import { AppShell, AppShellNavItem, AppShellNavSection, AppShellSidebar, AppShellHeader, AppShellContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `AppShellSidebar.logo` | ReactNode | — |
| `AppShellSidebar.collapsed` | boolean | — |
| `AppShellSidebar.onCollapsedChange` | (collapsed: boolean) => void | — |
| `AppShellSidebar.sections` | AppShellNavSection[] | — |
| `AppShellSidebar.isActive` | (href: string) => boolean | — |
| `AppShellSidebar.renderLink` | (item: AppShellNavItem, children: ReactNode) => ReactNode | — |
| `AppShellSidebar.userMenu` | ReactNode | — |
| `AppShellTopBar.logo` | ReactNode | — |
| `AppShellTopBar.onMenuClick` | () => void | — |
| `AppShellTopBar.actions` | ReactNode | — |
| `AppShellTopBar.menuLabel` | string | "Open navigation" |
| `AppShellMobileNav.open` / `onOpenChange` | boolean / (open: boolean) => void | — |
| `AppShellMobileNav.logo`, `sections`, `isActive`, `renderLink`, `search` | as `AppShellSidebar` | — |
| `AppShellMobileNav.footer` | ReactNode | — |
| `AppShellHeader.breadcrumb` | BreadcrumbItem[] | — |
| `AppShellHeader.title` | string | — |
| `AppShellHeader.description` | string | — |
| `AppShellHeader.action` | ReactNode | — |
| `AppShellContent.fullWidth` | boolean | false |
| `AppShellContent.banner` | ReactNode | — (app-wide `Banner`s shown above the page, outside the width cap) |

## Rules and behaviour

- Compound API — AppShell (frame), AppShellSidebar (nav rail), AppShellHeader (breadcrumb/title/description/action), AppShellContent (scrollable main region, capped to the 1200px container width by default) — composed per page rather than configured through one large props object.
- AppShellContent's fullWidth prop opts a page out of the 1200px cap for content that's wide by nature (a multi-column board, a dense table) rather than form/prose — the cap exists to keep reading-width content comfortable, and just wastes space on content designed to fill the screen.
- Nav content is entirely caller-supplied via a `sections` prop (grouped items with icon/label/href) — AppShell has no built-in opinion about which pages exist in a given app.
- Collapse toggle is real (built on Sidebar's existing collapsed state) and typically persisted by the consuming app (e.g. to localStorage) so it survives navigation — AppShell itself is stateless and takes `collapsed`/`onCollapsedChange` as controlled props.
- renderLink stays router-agnostic — pass a Next.js `&lt;Link&gt;` (or any anchor) so @spine/ui never depends on next/link directly.
- Under 768px (US-OPS-14, D-066) the sidebar is hidden and `AppShellTopBar` shows a menu button, the logo and the app's actions (notifications, avatar). The menu button opens `AppShellMobileNav`: the same sections sliding in from the left over a dimmed page, with a close button. Tapping the dimmed area, Escape or a followed link closes it. Every control is at least 44×44px. AppShellContent's padding drops to 16px.
- AppShellHeader's breadcrumb and action are optional — a page can render AppShellContent directly and build its own header if AppShellHeader doesn't fit.

## Phone (under 768px, [D-283](../../prd/12-decisions.md))

- Built (US-OPS-54): under 768px the sidebar gives way to `AppShellPhoneBar` (title, back arrow, search, notifications), `AppShellAreaNav` (an area's pages in a row that scrolls sideways) and `BottomTabBar`. The old top bar with a menu button and slide-over navigation (US-OPS-14) is gone. `AppShellHeader`'s title is for screen readers only there, and its description is hidden. On a builder (`/new`, `/edit`) the bar is Cancel at the top left and the title centred, with nothing on the right (`onCancel`, US-OPS-59); the builder registers its own cancel with `usePhoneBuilderCancel`, so unsaved changes are asked about first.
- In short: `BottomTabBar` (Home · Sales · Jobs · Money · More); the top bar shows the page title, a back arrow on records, builders and pages below an area's first page, search, notifications and at most one action. Breadcrumbs aren't shown. Tabs come from the same capability checks as the sidebar (US-OPS-54).
- Clears the notch and the home indicator with `env(safe-area-inset-*)`, for the home-screen app (planned, US-OPS-55).

## Exports

`AppShell` · `AppShellPhoneBar` · `AppShellPhoneBarProps` · `AppShellAreaNav` · `AppShellAreaNavProps` · `AppShellNavItem` · `AppShellNavSection` · `AppShellSidebarProps` · `AppShellSidebar` · `AppShellHeaderProps` · `AppShellHeader` · `AppShellContentProps` · `AppShellContent`

## Accessibility

Automated check: `packages/ui/src/components/app-shell.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
