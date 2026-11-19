# ReportToolbar

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/report-toolbar.tsx` · **Doc page:** `apps/design-system/src/app/components/report-toolbar/page.tsx`

The bar above every report: labelled 40px filters on the left (From, To, Compare with, Basis, then the report's own), the page's actions on the right — Export, then the one primary button last — all aligned to the bottom edge of the controls. Filters apply as they change, so there's no Refresh button (US-RPT-40).

## Import

```tsx
import { ReportToolbar, ReportFilter, ReportFilterCheckbox } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `filters` | ReactNode | — |
| `actions` | ReactNode | — |
| `loading` | boolean | false |

## Rules and behaviour

- `ReportFilter` puts a label over any 40px control; a function child gets the label's id for `aria-labelledby` (Select, MultiSelect).
- `ReportFilterCheckbox` is a yes/no option, 40px tall so it lines up.
- `loading` shows a spinner ("Updating the report") after the filters; the figures on screen stay until the new ones arrive.
- Hidden in print.

## Phone (under 768px, [D-283](../../prd/12-decisions.md)) — built (US-RPT-41)

- Under 768px the filters collapse to one summary line ("Jan 1 – Nov 18, 2026 · Accrual · No comparison") that opens a `BottomSheet` with every filter; Export moves under the top bar's ⋯ (US-RPT-41).
- `summary` is that line, built by the page from what's chosen (`filterSummary`, `rangeSummary`, `asOfSummary` in `reports/report-kit.tsx`); without it the line says "Filters". The sheet is "Report filters" with the filters one per row and Show report. The web app's `components/report-toolbar.tsx` wraps it so `actions` go under ⋯ (`PhoneMoreActions`). Test: `us-rpt-41-phone.a11y.test.tsx`.

## Exports

`ReportToolbarProps` · `ReportToolbar` · `ReportFilterProps` · `ReportFilter` · `ReportFilterCheckboxProps` · `ReportFilterCheckbox`

## Accessibility

Automated check: `packages/ui/src/components/report-toolbar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
