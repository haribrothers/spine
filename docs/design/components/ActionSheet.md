# ActionSheet

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** planned, `packages/ui/src/components/action-sheet.tsx` · **Doc page:** planned, `apps/design-system/src/app/components/action-sheet/page.tsx` · **Stories:** US-OPS-56, US-OPS-58, US-OPS-60

A menu that rises from the bottom on a phone: a row's ⋯, a page's ⋯, Export. What `DropdownMenu` renders under 768px (D-283).

**Status:** planned for the web app's phone layout ([D-283](../../prd/12-decisions.md)). Its props and exports are filled in from the source when it's built, with its doc page and axe test in the same change.

## Rules and behaviour

- One action per row with its icon from the D-222 vocabulary, then Cancel, set apart.
- A destructive action uses the danger colour and still asks first with `useConfirm()` (D-218).
- Every row is at least 44px tall; focus starts on the first action; Escape and Cancel close it.

## Accessibility

Automated check (planned): `packages/ui/src/components/action-sheet.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
