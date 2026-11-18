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

- Its scroll box is a [ScrollX](ScrollX.md): wider than the screen, it scrolls inside its box and is a focusable region (US-OPS-62).
- Row kinds: `section` (uppercase heading), `line`, `subtotal` (bold), `total` (bold on the sunken band, in `<tfoot>`), `empty` (a muted line).
- Any number of right-aligned value columns with tabular figures (comparison columns, each month).
- Signs and arrows carry direction, never colour alone.

## Phone (under 768px, [D-283](../../prd/12-decisions.md)) — planned

- Under 768px it renders as an indented list: section headings, each account with its amount on the right, bold subtotals and the total last; a comparison's other period shows muted under each amount; tapping an account drills down (US-RPT-41).

## Exports

`StatementColumn` · `StatementRow` · `StatementTableProps` · `StatementTable`

## Accessibility

Automated check: `packages/ui/src/components/statement-table.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
