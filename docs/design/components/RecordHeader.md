# RecordHeader

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/record-header.tsx` · **Doc page:** `apps/design-system/src/app/components/record-header/page.tsx` · **Stories:** US-OPS-58

The top of a record: its number or name and status, then on a phone its key amount (total or balance due), then the contact, dates and where it came from, with its actions on the right from 768px up (D-283). `RecordFigures`, from the same file, holds the figures under it.

**Status:** built (US-OPS-58); record pages use it.

## Import

```tsx
import { RecordFigures, RecordHeader } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `title` | ReactNode — the number or name; the page's h1 | — |
| `badges` | ReactNode — its status `Badge` and any others ("Progress claim 2") | — |
| `subtitle` | ReactNode — a line under the title (a job's name) | — |
| `amount` | `{ label, value, note?, tone?: "default" \| "overdue" \| "paid" }` — the key amount, shown under the title on a phone only | — |
| `meta` | ReactNode — the contact, dates and where it came from | — |
| `actions` | ReactNode — the record's actions, on the right from 768px up | — |
| `children` | ReactNode — anything under the meta line | — |

`RecordFigures` takes `columns` (1–5, figures per row from 768px up; the default is how many there are) and any `div` props.

## Rules and behaviour

- The back arrow lives in the top bar on a phone, so there's no breadcrumb.
- The amount uses the display size from the tokens (32px); the status is a `Badge` with its text. An overdue amount and its note are in the overdue colour, a paid one in the paid colour. From 768px up the amount isn't rendered at all (it's in the figures), so the page has no hidden copy of it.
- The record's actions: hide their row on a phone (`max-md:hidden`); the main one goes in an `ActionBar`, the rest under the top bar's ⋯.
- `RecordFigures`: one box with lines between the figures, in one row from 768px up, two per row on a phone, and a last one on its own the full width (a job's Complete).

## Accessibility

Automated check: `packages/ui/src/components/record-header.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
