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
- An item's direct `svg` child is its icon: 14 px, muted, 10 px before the label, red on a `destructive` item; items are at least 32 px tall. Screens never add their own spacing; action items take their icon from the D-222 vocabulary, destructive items come last after a `DropdownMenuSeparator` (US-OPS-37).
- Renders at the z-popover stacking tier, above Dialog/Drawer's z-modal tier — a DropdownMenu opened from inside a Dialog or Drawer always renders on top of it.

## Phone (under 768px, [D-283](../../prd/12-decisions.md)) — planned

- Under 768px a menu opens as an `ActionSheet` from the bottom, with each item's icon (D-222) and Cancel; destructive items use the danger colour and still ask first (US-OPS-60).

## Exports

`DropdownMenu` · `DropdownMenuTrigger` · `DropdownMenuGroup` · `DropdownMenuSub` · `DropdownMenuRadioGroup` · `DropdownMenuContent` · `DropdownMenuItem` · `DropdownMenuCheckboxItem` · `DropdownMenuRadioItem` · `DropdownMenuLabel` · `DropdownMenuSeparator` · `DropdownMenuSubTrigger` · `DropdownMenuSubContent`

## Accessibility

Automated check: `packages/ui/src/components/dropdown-menu.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
