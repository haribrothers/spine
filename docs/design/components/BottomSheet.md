# BottomSheet

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** planned, `packages/ui/src/components/bottom-sheet.tsx` · **Doc page:** planned, `apps/design-system/src/app/components/bottom-sheet/page.tsx` · **Stories:** US-OPS-57, US-OPS-59, US-OPS-60

A panel that rises from the bottom of the screen for a phone: filters, pickers, the More menu, a line being edited, a record's quick view. Built on Radix Dialog (D-283).

**Status:** planned for the web app's phone layout ([D-283](../../prd/12-decisions.md)). Its props and exports are filled in from the source when it's built, with its doc page and axe test in the same change.

## Rules and behaviour

- Heights: `auto` (to its content, up to 90% of the screen) or `full`; a grabber shows when it can be dragged between them, and swiping down closes it.
- A title, and Close (or Cancel with an action on the right, for a form) in its header; focus stays inside; Escape closes it.
- Reduced motion: it appears without sliding.
- Shares its look with the field app's [BottomSheet](BottomSheetNative.md).

## Accessibility

Automated check (planned): `packages/ui/src/components/bottom-sheet.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
