# ActionBar

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** planned, `packages/ui/src/components/action-bar.tsx` · **Doc page:** planned, `apps/design-system/src/app/components/action-bar/page.tsx` · **Stories:** US-OPS-58, US-OPS-59

The bar at the bottom of a record or builder on a phone: the main action for the record's state as a full-width button, or a builder's total and its main button, with ⋯ for the rest (D-283).

**Status:** planned for the web app's phone layout ([D-283](../../prd/12-decisions.md)). Its props and exports are filled in from the source when it's built, with its doc page and axe test in the same change.

## Rules and behaviour

- One primary button; the rest go to an `ActionSheet` from ⋯.
- A builder's bar shows the total, which opens the subtotal and tax when tapped.
- Sits above the home indicator, and moves out of the way of the keyboard while typing.

## Accessibility

Automated check (planned): `packages/ui/src/components/action-bar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
