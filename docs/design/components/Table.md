# Table

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/table.tsx` · **Doc page:** `apps/design-system/src/app/components/table/page.tsx`

Zero-radius, dense row height, sticky header, sortable columns, client-side pagination — the primary vehicle for quote/invoice line items and the AR/AP aging report. See DataTable for the richer variant with a search box and column-visibility toggle.

## Import

```tsx
import { TableColumn, Table } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `columns` | TableColumn<T>[] | — |
| `data` | T[] | — |
| `rowKey` | (row: T) => string | — |
| `pageSize` | number | 20 |
| `configurablePageSize` | boolean | false |
| `pageSizeOptions` | number[] | [10, 25, 50, 100] |
| `groupBy` | (row: T) => string | — |
| `groupPrimary` | (rows: T[]) => T | — |
| `groupMemberLabel` | (row: T) => ReactNode | — |
| `footer` | Partial<Record<string, ReactNode>> | — |
| `page` / `onPageChange` | number / (page) => void | — (uncontrolled) |
| `selected` / `onSelectedChange` | ReadonlySet<string> / (next: Set<string>) => void | — (no checkboxes) |
| `selectLabel` | (row: T) => string | the row key |
| `sort` / `onSortChange` | TableSort \| null / (sort) => void | — (uncontrolled) |
| `key` | string | — |
| `header` | string | — |
| `render` | (row: T) => ReactNode | — |
| `sortValue` | (row: T) => string \| number \| bigint | — |
| `align` | left \| right | left |

## Rules and behaviour

- `footer` adds a totals row, keyed by column, on the sunken band in the table's `<tfoot>` (a report's "Total"); columns left out stay blank (US-RPT-40).
- Column-level sorting via a sortValue accessor — click a header to toggle ascending/descending/off.
- Automatic client-side pagination once data exceeds pageSize.
- `selected` adds a checkbox column (US-CAT-12): each row's box is labelled "Select <selectLabel>", the header box ("Select every row on this page") ticks or clears the page and shows part-ticked when some are; selected rows get `aria-selected` and the info tint.
- `sort` keeps the sort in the parent (e.g. in the address, US-CAT-13); `TableSort` is `{ key, direction }`.
- Set configurablePageSize to render a PaginationBar (rows-per-page select + summary) instead of a fixed pageSize.
- Sticky header row stays visible while scrolling a tall table.
- Alternating hover tint on rows.
- Set groupBy to cluster rows that share a key (e.g. every version of the same quote) into one expandable group instead of showing every row flat — sorting and pagination then operate over groups, not raw rows.

## Exports

`TableColumn` · `TableProps` · `TableSort` · `SortDirection` · `Table`

## Accessibility

Automated check: `packages/ui/src/components/table.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
