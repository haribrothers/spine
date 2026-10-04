# Divider

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/divider.tsx` · **Doc page:** none yet

A plain 1px row separator for use INSIDE a form card/group between rows (`FormSection`-style grouping) — never a standalone section separator on its own, which is what web `packages/ui`'s `Separator` is for. Full-bleed within its container (no horizontal inset) so it reads as separating two rows rather than framing one field, matching the "borderless field, card provides the boundary, dividers separate rows" form redesign.

## Import

```tsx
import { Divider } from "@spine/ui-native";
```

## Exports

`Divider`

## Accessibility

Automated check: `packages/ui-native/src/components/divider.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
