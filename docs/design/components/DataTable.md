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

## Rules and behaviour

- Client-side search filtering via a searchKey accessor.
- A Columns dropdown lets the user hide/show individual columns without losing sort state.
- Composes Table underneath rather than reimplementing row rendering.

## Exports

`DataTableProps` · `DataTable`

## Accessibility

Automated check: `packages/ui/src/components/data-table.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
