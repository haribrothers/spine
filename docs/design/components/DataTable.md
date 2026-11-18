# DataTable

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/data-table.tsx` · **Doc page:** `apps/design-system/src/app/components/data-table/page.tsx`

Table plus a search box and a column-visibility toggle — the richer layer for a full data-management screen (e.g. the invoice list), where plain Table (sortable + paginated only) is enough for embedded contexts like a quote's line items.

## Import

```tsx
import { DataTable } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `columns` | TableColumn<T>[] | — |
| `data` | T[] | — |
| `rowKey` | (row: T) => string | — |
| `searchKey` | (row: T) => string | — |
| `searchPlaceholder` | string | — |
| `pageSize` | number | — |
| `configurablePageSize` | boolean | false |
| `pageSizeOptions` | number[] | [10, 25, 50, 100] |
| `footer` | Partial<Record<string, ReactNode>> | — |
| `page` / `onPageChange` | number / (page) => void | — (uncontrolled) |
| `toolbarStart` | ReactNode | — (the built-in search box) |
| `selected` / `onSelectedChange` / `selectLabel` | as Table | — |
| `renderExpanded` / `expandLabel` | as Table | — |
| `sort` / `onSortChange` | as Table | — |
| `defaultHidden` | string[] | [] |

## Rules and behaviour

- `footer` adds a totals row, keyed by column, on the sunken band in the table's `<tfoot>` (a report's "Total"); columns left out stay blank (US-RPT-40).
- Client-side search filtering via a searchKey accessor.
- A Columns dropdown lets the user hide/show individual columns without losing sort state; `defaultHidden` sets which start hidden.
- Selection and a parent-kept sort pass through to Table (US-CAT-12, US-CAT-13).
- Composes Table underneath rather than reimplementing row rendering.

## Phone (under 768px, [D-283](../../prd/12-decisions.md)) — planned

- Under 768px each row renders as a `ListRow` from the columns' phone roles (`title`, `subtitle`, `trailing`, `badge`) or a `phoneRow` renderer: no headings, no sideways scroll. Columns and the page-size picker are hidden, Load more replaces the pager ("25 of 87"), and selecting is a Select mode from the top bar (US-OPS-56).
- Search stays; sort moves into the list's Filters sheet (US-OPS-57).

## Exports

`DataTableProps` · `DataTable`

## Accessibility

Automated check: `packages/ui/src/components/data-table.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
