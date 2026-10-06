# StatementTable

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/statement-table.tsx` · **Doc page:** `apps/design-system/src/app/components/statement-table/page.tsx`

A financial statement as a table — Profit & Loss, Balance Sheet, Cash Flow, Tax Summary, a ledger account's entries — with Table's header, type size and spacing, plus section headings, subtotals and a total. Not sorted or paged: the order is the meaning. A list of rows to search and sort uses DataTable with a `footer` instead.

## Import

```tsx
import { StatementTable, StatementRow, StatementColumn } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `columns` | StatementColumn[] | — |
| `rows` | StatementRow[] | — |
| `data-testid` | string | — |

## Rules and behaviour

- Row kinds: `section` (uppercase heading), `line`, `subtotal` (bold), `total` (bold on the sunken band, in `<tfoot>`), `empty` (a muted line).
- Any number of right-aligned value columns with tabular figures (comparison columns, each month).
- Signs and arrows carry direction, never colour alone.

## Exports

`StatementColumn` · `StatementRow` · `StatementTableProps` · `StatementTable`

## Accessibility

Automated check: `packages/ui/src/components/statement-table.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
