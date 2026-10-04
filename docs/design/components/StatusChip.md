# StatusChip

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/status-chip.tsx` · **Doc page:** `apps/design-system/src/app/components/status-chip/page.tsx`

The single component for paid/due-soon/overdue/draft. This reserved palette is never repurposed for a generic badge or tag — see Badge for that. Always paired with a text label; color alone never carries the meaning.

## Import

```tsx
import { StatusChip } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `status` | paid \| due-soon \| overdue \| draft | draft |

## Variants

- `status`: `paid`, `due-soon`, `overdue`, `draft`

## Rules and behaviour

- The status prop only accepts the four reserved values — the type system enforces the reserved-palette rule, not just documentation.
- Always renders as a pill shape, distinct from Badge's shape at a glance is intentional but not the sole signal — text is always present too.

## Exports

`statusChipVariants` · `StatusChipProps` · `StatusChip`

## Accessibility

Automated check: `packages/ui/src/components/status-chip.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
