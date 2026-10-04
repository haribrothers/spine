# Sidebar

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/sidebar.tsx` · **Doc page:** `apps/design-system/src/app/components/sidebar/page.tsx`

The reusable container behind an admin app's collapsible sidebar shell, per docs/DESIGN.md — a header slot (logo + collapse toggle), grouped SidebarNavItem lists, collapsible to an icon-only rail, with an optional footer slot (user menu). New admin-style screens should compose this rather than re-deriving the sidebar shell per app.

## Import

```tsx
import { Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarFooter } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `Sidebar.collapsed` | boolean | false |
| `SidebarHeader.logo` | ReactNode | — |
| `SidebarHeader.collapsed` | boolean | false |
| `SidebarHeader.onCollapsedChange` | (collapsed: boolean) => void | — |
| `SidebarGroup.collapsed` | boolean | false |
| `SidebarGroupLabel.collapsed` | boolean | false |
| `SidebarNavItem.icon` | ReactNode | — |
| `SidebarNavItem.active` | boolean | false |
| `SidebarNavItem.disabled` | boolean | false |
| `SidebarNavItem.collapsed` | boolean | false |

## Rules and behaviour

- A collapsed prop switches to a 64px icon-only rail; SidebarNavItem and SidebarGroupLabel hide their label automatically in that state.
- When collapsed, SidebarNavItem becomes a centered 36px square (icon centered inside) rather than a full-width row — pass collapsed to the enclosing SidebarGroup too so it centers its items in the rail.
- SidebarHeader renders a built-in logo + collapse-toggle row when given a logo and/or onCollapsedChange — pass children instead for a fully custom header.
- Disabled nav items render greyed-out and non-interactive rather than being omitted, per the existing AppShell convention.

## Exports

`SidebarProps` · `Sidebar` · `SidebarHeaderProps` · `SidebarHeader` · `SidebarContent` · `SidebarGroupProps` · `SidebarGroup` · `SidebarGroupLabelProps` · `SidebarGroupLabel` · `SidebarFooter` · `SidebarNavItemProps` · `SidebarNavItem`

## Accessibility

Automated check: `packages/ui/src/components/sidebar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
