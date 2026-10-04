# Menubar

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/menubar.tsx` · **Doc page:** `apps/design-system/src/app/components/menubar/page.tsx`

A visually persistent menu common in desktop applications that provides quick access to a consistent set of commands. Not currently used anywhere in Spine's own screens — its admin shells use SideNav, not a File/Edit-style menu bar — included in the catalogue for completeness.

## Import

```tsx
import { Menubar, MenubarMenu, MenubarGroup, MenubarSub, MenubarRadioGroup, MenubarTrigger } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `MenubarItem.destructive` | boolean | false |

## Rules and behaviour

- Full keyboard navigation with typeahead.
- Supports submenus, checkable items, and groups within each menu.

## Exports

`Menubar` · `MenubarMenu` · `MenubarGroup` · `MenubarSub` · `MenubarRadioGroup` · `MenubarTrigger` · `MenubarContent` · `MenubarItem` · `MenubarCheckboxItem` · `MenubarRadioItem` · `MenubarLabel` · `MenubarSeparator` · `MenubarSubTrigger` · `MenubarSubContent`

## Accessibility

Automated check: `packages/ui/src/components/menubar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
