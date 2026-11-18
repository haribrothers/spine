# FilterSheet

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/filter-sheet.tsx` · **Doc page:** `apps/design-system/src/app/components/filter-sheet/page.tsx` · **Stories:** US-OPS-57

A list's filters: inline from 768px up, as they were; under 768px one row with the search and a Filters button, a chip for each filter that's on, and a bottom sheet with every filter (D-283).

## Import

```tsx
import { FilterSheet, type FilterChip } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `search` | ReactNode — the page's search; pass it only on a phone | — |
| `chips` | `FilterChip[]` — `{ key, label, onRemove }` for each filter that's on | `[]` |
| `onClearAll` | `() => void` — Clear all | — |
| `showLabel` | string — the sheet's button ("Show 3 invoices") | "Show results" |
| `className` | string — the desktop row's layout | — |

## Rules and behaviour

- The Filters button shows how many filters are on; each chip has × to remove its filter (44px targets).
- The sheet (`BottomSheet`) holds every filter control and the sort, one under another at full width, with Clear all and Show results.
- A page hides its own inline "Clear filters" on a phone; the sheet has Clear all.

## Accessibility

Automated check: `packages/ui/src/components/filter-sheet.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
