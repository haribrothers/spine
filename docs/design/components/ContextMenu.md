# ContextMenu

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/context-menu.tsx` · **Doc page:** `apps/design-system/src/app/components/context-menu/page.tsx`

Displays a menu located at the pointer, triggered by a right click or a long press. Identical visual list to DropdownMenu — same styling, different trigger gesture; don't hand-roll a second menu visual language for it.

## Import

```tsx
import { ContextMenu, ContextMenuTrigger, ContextMenuGroup, ContextMenuSub, ContextMenuRadioGroup, ContextMenuContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `ContextMenuItem.destructive` | boolean | false |

## Rules and behaviour

- Supports submenus, checkable items, and groups — the same sub-part shapes as DropdownMenu.
- Full keyboard navigation with typeahead.

## Exports

`ContextMenu` · `ContextMenuTrigger` · `ContextMenuGroup` · `ContextMenuSub` · `ContextMenuRadioGroup` · `ContextMenuContent` · `ContextMenuItem` · `ContextMenuCheckboxItem` · `ContextMenuRadioItem` · `ContextMenuLabel` · `ContextMenuSeparator` · `ContextMenuSubTrigger` · `ContextMenuSubContent`

## Accessibility

Automated check: `packages/ui/src/components/context-menu.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
