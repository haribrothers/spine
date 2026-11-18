# RecordHeader

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** planned, `packages/ui/src/components/record-header.tsx` · **Doc page:** planned, `apps/design-system/src/app/components/record-header/page.tsx` · **Stories:** US-OPS-58

The top of a record on a phone: its number or name, its status and its key amount (total or balance due), then the contact (D-283).

**Status:** planned for the web app's phone layout ([D-283](../../prd/12-decisions.md)). Its props and exports are filled in from the source when it's built, with its doc page and axe test in the same change.

## Rules and behaviour

- The back arrow lives in the top bar, so there's no breadcrumb.
- The amount uses the display size from the tokens; the status is a `Badge` with its text.
- Figures under it (a job's contract, billed, cost, margin) are two per row.

## Accessibility

Automated check (planned): `packages/ui/src/components/record-header.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
