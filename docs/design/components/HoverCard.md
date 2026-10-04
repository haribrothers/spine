# HoverCard

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/hover-card.tsx` · **Doc page:** `apps/design-system/src/app/components/hover-card/page.tsx`

For sighted users to preview content available behind a link. Sits between Tooltip and Popover — a richer preview (e.g. a contact's name → mini activity summary) on hover, still supplementary.

## Import

```tsx
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `openDelay` | number | 700 |
| `closeDelay` | number | 300 |

## Rules and behaviour

- Configurable open/close delay.
- Supports hover and focus.
- Customize side, alignment, offsets, collision handling.

## Exports

`HoverCard` · `HoverCardTrigger` · `HoverCardContent`

## Accessibility

Automated check: `packages/ui/src/components/hover-card.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
