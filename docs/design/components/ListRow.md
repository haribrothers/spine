# ListRow

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** `packages/ui/src/components/list-row.tsx` · **Doc page:** `apps/design-system/src/app/components/list-row/page.tsx` · **Stories:** US-OPS-56, US-DASH-31

One record as a two-line row on a phone: title and status on the first line, subtitle on the second, the amount on the right, and a chevron when it opens something. What `DataTable` rows become under 768px (D-283).

**Status:** built (US-OPS-56); `Table` and `DataTable` render it under 768px.

## Import

```tsx
import { ListRow, ListRowSkeleton } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `title` | ReactNode — a link in it covers the whole row | — |
| `badge` · `subtitle` · `trailing` · `trailingSub` | ReactNode | — |
| `leading` | ReactNode — an icon tile, avatar or Select mode's checkbox | — |
| `action` | ReactNode — the ⋯ or a button, above the row's link | — |
| `selected` | boolean | `false` |

## Rules and behaviour

- Slots: `title`, `badge` (status, with its text), `subtitle`, `trailing` (amount or figure, tabular numbers), `action` (a ⋯ that opens an `ActionSheet`, or a button such as Send reminder), `selected` (a checkbox in Select mode).
- The whole row is the link to the record; the ⋯ and any button are separate targets of at least 44px.
- Long titles and subtitles truncate with … on one line each; the amount never truncates.
- Loading placeholder rows of the same height.

## Accessibility

Automated check: `packages/ui/src/components/list-row.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
