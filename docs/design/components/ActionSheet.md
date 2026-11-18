# ActionSheet

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** `packages/ui/src/components/action-sheet.tsx` · **Doc page:** `apps/design-system/src/app/components/action-sheet/page.tsx` · **Stories:** US-OPS-56, US-OPS-58, US-OPS-60

A menu that rises from the bottom on a phone: a row's ⋯, a page's ⋯, Export. What `DropdownMenu` renders under 768px (D-283).

**Status:** built; `DropdownMenu` and the list rows' ⋯ render it under 768px with US-OPS-56 and US-OPS-60.

## Import

```tsx
import { ActionSheet } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `open` · `onOpenChange` | `boolean` · `(open) => void` | — |
| `title` | `string` — what the actions act on | — |
| `subtitle` | `string` | — |
| `actions` | `ActionSheetAction[]` — `{ key, label, icon, onSelect, destructive, disabled }` | — |


## Rules and behaviour

- Choosing an action closes the sheet, then runs it, so a confirmation (D-218) opens over the page.
- One action per row with its icon from the D-222 vocabulary, then Cancel, set apart.
- A destructive action uses the danger colour and still asks first with `useConfirm()` (D-218).
- Every row is at least 44px tall; focus starts on the first action; Escape and Cancel close it.

## Accessibility

Automated check: `packages/ui/src/components/action-sheet.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
