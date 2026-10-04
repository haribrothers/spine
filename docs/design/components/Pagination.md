# Pagination

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/pagination.tsx` · **Doc page:** `apps/design-system/src/app/components/pagination/page.tsx`

Numbered + prev/next, current page in a filled primary-colored pill.

## Import

```tsx
import { Pagination } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `page` | number | — |
| `pageCount` | number | — |
| `onPageChange` | (page: number) => void | — |

## Rules and behaviour

- A sliding window of page numbers centered on the current page.
- Prev/next buttons disable at the boundaries.

## Exports

`PaginationProps` · `Pagination`

## Accessibility

Automated check: `packages/ui/src/components/pagination.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
