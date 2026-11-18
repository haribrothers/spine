# ChipStrip

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** planned, `packages/ui/src/components/chip-strip.tsx` · **Doc page:** planned, `apps/design-system/src/app/components/chip-strip/page.tsx` · **Stories:** US-OPS-54, US-OPS-56, US-OPS-57, US-RPT-41

A row of compact chips that scrolls sideways: a list's summary figures ("Overdue $4,542.50"), an area's pages, a board's stages, the filters that are on (D-283).

**Status:** planned for the web app's phone layout ([D-283](../../prd/12-decisions.md)). Its props and exports are filled in from the source when it's built, with its doc page and axe test in the same change.

## Rules and behaviour

- Each chip is a button (it filters, or opens a page) at least 44px tall; the chosen one is marked by more than colour.
- The row scrolls with touch and with the keyboard (arrow keys); a fade at the edge shows there's more; the page itself never scrolls sideways.
- A filter chip has × to remove that filter.

## Accessibility

Automated check (planned): `packages/ui/src/components/chip-strip.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
