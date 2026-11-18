# ListRow

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** planned, `packages/ui/src/components/list-row.tsx` · **Doc page:** planned, `apps/design-system/src/app/components/list-row/page.tsx` · **Stories:** US-OPS-56, US-DASH-31

One record as a two-line row on a phone: title and status on the first line, subtitle on the second, the amount on the right, and a chevron when it opens something. What `DataTable` rows become under 768px (D-283).

**Status:** planned for the web app's phone layout ([D-283](../../prd/12-decisions.md)). Its props and exports are filled in from the source when it's built, with its doc page and axe test in the same change.

## Rules and behaviour

- Slots: `title`, `badge` (status, with its text), `subtitle`, `trailing` (amount or figure, tabular numbers), `action` (a ⋯ that opens an `ActionSheet`, or a button such as Send reminder), `selected` (a checkbox in Select mode).
- The whole row is the link to the record; the ⋯ and any button are separate targets of at least 44px.
- Long titles and subtitles truncate with … on one line each; the amount never truncates.
- Loading placeholder rows of the same height.

## Accessibility

Automated check (planned): `packages/ui/src/components/list-row.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
