# BottomSheet

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** `packages/ui/src/components/bottom-sheet.tsx` · **Doc page:** `apps/design-system/src/app/components/bottom-sheet/page.tsx` · **Stories:** US-OPS-57, US-OPS-59, US-OPS-60

A panel that rises from the bottom of the screen for a phone: filters, pickers, the More menu, a line being edited, a record's quick view. Built on Radix Dialog (D-283).

**Status:** built; the More sheet uses it (US-OPS-54). `Dialog`, `Select`, `Combobox`, `DatePicker` and `Drawer` render it under 768px with US-OPS-60.

## Import

```tsx
import { BottomSheet } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `open` · `onOpenChange` | `boolean` · `(open) => void` | — |
| `title` | `string` — shown in the header and names the dialog | — |
| `description` | `string` — read after the title, not shown | — |
| `height` | `"auto" \| "full"` — `full` marks it `data-phone-fullscreen`, which hides the tab bar | `"auto"` |
| `footer` | `ReactNode` — the sheet's buttons | — |
| `headerAction` | `ReactNode` — replaces Close | — |


## Rules and behaviour

- A downward drag of 80px on the grabber or header closes it; a press on a control in the header is a press, not a drag.
- Heights: `auto` (to its content, up to 90% of the screen) or `full`; a grabber shows when it can be dragged between them, and swiping down closes it.
- A title, and Close (or Cancel with an action on the right, for a form) in its header; focus stays inside; Escape closes it.
- Reduced motion: it appears without sliding.
- Shares its look with the field app's [BottomSheet](BottomSheetNative.md).

## Accessibility

Automated check: `packages/ui/src/components/bottom-sheet.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
