# TableSkeleton

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/table-skeleton.tsx` · **Doc page:** `apps/design-system/src/app/components/table-skeleton/page.tsx`

A loading placeholder shaped like Table/DataTable&apos;s actual rendered output — the same column headers and alignment as the real table, not a generic set of bars — so a page doesn&apos;t visibly reflow once data arrives. Pass the same columns (header text, order, alignment) used for the live Table/DataTable so the two never drift apart.

## Import

```tsx
import { TableSkeletonColumn, TableSkeleton } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `columns` | TableSkeletonColumn[] | — |
| `rows` | number | 8 |
| `key` | string | — |
| `header` | string | — |
| `align` | left \| right | left |
| `width` | string | — |

## Rules and behaviour

- Under 768px it shows `ListRowSkeleton` placeholder rows instead of the table (US-OPS-56), by CSS, so it works server-rendered.
- Renders the real &lt;thead&gt; with the given columns' header text and alignment, not a placeholder bar.
- Body rows are Skeleton bars, one per column, respecting each column's align and optional width.
- rows controls how many placeholder rows render (defaults to 8).

## Exports

`TableSkeletonColumn` · `TableSkeletonProps` · `TableSkeleton`

## Accessibility

Automated check: `packages/ui/src/components/table-skeleton.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
