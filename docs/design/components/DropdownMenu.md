# DropdownMenu

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/dropdown-menu.tsx` · **Doc page:** `apps/design-system/src/app/components/dropdown-menu/page.tsx`

Displays a menu to the user — such as a set of actions or functions — triggered by a button. A click-triggered floating action list — a table row's overflow menu.

## Import

```tsx
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuSub, DropdownMenuRadioGroup, DropdownMenuContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `DropdownMenuItem.destructive` | boolean | false |
| `DropdownMenuItem.disabled` | boolean | false |
| `DropdownMenuContent.align` | start \| center \| end | start |
| `DropdownMenuContent.sideOffset` | number | 4 |

## Rules and behaviour

- Can be controlled or uncontrolled.
- Supports submenus with configurable reading direction.
- Supports items, labels, groups, checkable items (single or multiple) and a separator.
- Focus is fully managed and customizable.
- Full keyboard navigation with typeahead.
- Renders at the z-popover stacking tier, above Dialog/Drawer's z-modal tier — a DropdownMenu opened from inside a Dialog or Drawer always renders on top of it.

## Exports

`DropdownMenu` · `DropdownMenuTrigger` · `DropdownMenuGroup` · `DropdownMenuSub` · `DropdownMenuRadioGroup` · `DropdownMenuContent` · `DropdownMenuItem` · `DropdownMenuCheckboxItem` · `DropdownMenuRadioItem` · `DropdownMenuLabel` · `DropdownMenuSeparator` · `DropdownMenuSubTrigger` · `DropdownMenuSubContent`

## Accessibility

Automated check: `packages/ui/src/components/dropdown-menu.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
