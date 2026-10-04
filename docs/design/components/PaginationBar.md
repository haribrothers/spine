# PaginationBar

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/pagination-bar.tsx` · **Doc page:** `apps/design-system/src/app/components/pagination-bar/page.tsx`

Pairs a rows-per-page select with Pagination and an &quot;x–y of n&quot; summary — the configurable list-page footer for any screen that fetches its full result set and paginates client-side, such as Contacts and Catalogue. Table also renders this internally when given configurablePageSize.

## Import

```tsx
import { PaginationBar } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `page` | number | — |
| `pageSize` | number | — |
| `pageSizeOptions` | number[] | [10, 25, 50, 100] |
| `total` | number | — |
| `onPageChange` | (page: number) => void | — |
| `onPageSizeChange` | (pageSize: number) => void | — |

## Rules and behaviour

- Rows-per-page &lt;select&gt;, defaulting to 10/25/50/100 (override via pageSizeOptions).
- "x–y of n" summary reflecting the current page and page size.
- Hides the Pagination control entirely when everything fits on one page.

## Exports

`PaginationBarProps` · `PaginationBar`

## Accessibility

Automated check: `packages/ui/src/components/pagination-bar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
