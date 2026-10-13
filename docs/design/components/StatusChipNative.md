# StatusChip

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/status-chip.tsx` · **Doc page:** `apps/showcase-native/src/components/demos/status-chip-demo.tsx`

The single component for paid/due-soon/overdue/draft. This reserved palette is never repurposed for a generic badge or tag — see Badge for that. Always paired with a text label; color alone never carries the meaning.

## Import

```tsx
import { StatusChip } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `status` | paid \| due-soon \| overdue \| draft | draft |

## Rules and behaviour

- The status prop only accepts the four reserved values — the type system enforces the reserved-palette rule, not just documentation.
- Always renders as a pill shape, distinct from Badge's shape at a glance is intentional but not the sole signal — text is always present too.

## Exports

`statusChipVariants` · `StatusChipProps` · `StatusChip`

## Accessibility

Automated check: `packages/ui-native/src/components/status-chip.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
