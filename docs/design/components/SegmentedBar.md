# SegmentedBar

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/segmented-bar.tsx` · **Doc page:** `apps/design-system/src/app/components/segmented-bar/page.tsx`

One bar split into parts — what's owed by age on Receivables and Payables — with a text legend giving each part's amount and share.

## Import

```tsx
import { SegmentedBar, SegmentedBarSegment } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `segments` | SegmentedBarSegment[] | — |
| `aria-label` | string | — |
| `emptyState` | ReactNode | "Nothing to show." |

## Rules and behaviour

- Each part's width is its share of the total; zero parts stay in the legend.
- Colours are theme tokens — the reserved financial-status colours for ages.
- The bar's accessible name lists every part and amount.

## Exports

`SegmentedBarSegment` · `SegmentedBarProps` · `SegmentedBar`

## Accessibility

Automated check: `packages/ui/src/components/segmented-bar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
