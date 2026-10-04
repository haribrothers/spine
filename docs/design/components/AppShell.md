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
| `AppShellHeader.breadcrumb` | BreadcrumbItem[] | — |
| `AppShellHeader.title` | string | — |
| `AppShellHeader.description` | string | — |
| `AppShellHeader.action` | ReactNode | — |
| `AppShellContent.fullWidth` | boolean | false |

## Rules and behaviour

- Compound API — AppShell (frame), AppShellSidebar (nav rail), AppShellHeader (breadcrumb/title/description/action), AppShellContent (scrollable main region, capped to the 1200px container width by default) — composed per page rather than configured through one large props object.
- AppShellContent's fullWidth prop opts a page out of the 1200px cap for content that's wide by nature (a multi-column board, a dense table) rather than form/prose — the cap exists to keep reading-width content comfortable, and just wastes space on content designed to fill the screen.
- Nav content is entirely caller-supplied via a `sections` prop (grouped items with icon/label/href) — AppShell has no built-in opinion about which pages exist in a given app.
- Collapse toggle is real (built on Sidebar's existing collapsed state) and typically persisted by the consuming app (e.g. to localStorage) so it survives navigation — AppShell itself is stateless and takes `collapsed`/`onCollapsedChange` as controlled props.
- renderLink stays router-agnostic — pass a Next.js `&lt;Link&gt;` (or any anchor) so @spine/ui never depends on next/link directly.
- AppShellHeader's breadcrumb and action are optional — a page can render AppShellContent directly and build its own header if AppShellHeader doesn't fit.

## Exports

`AppShell` · `AppShellNavItem` · `AppShellNavSection` · `AppShellSidebarProps` · `AppShellSidebar` · `AppShellHeaderProps` · `AppShellHeader` · `AppShellContentProps` · `AppShellContent`

## Accessibility

Automated check: `packages/ui/src/components/app-shell.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
