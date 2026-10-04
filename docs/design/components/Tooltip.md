# Tooltip

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/tooltip.tsx` · **Doc page:** `apps/design-system/src/app/components/tooltip/page.tsx`

A popup that displays information related to an element when hovered or focused. The lightest floating-content primitive — dark, small, supplementary only. Never the sole carrier of required information, since mobile/touch has no hover.

## Import

```tsx
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `delayDuration` | number | 700 (set to 200 in apps/design-system's shell) |
| `open` | boolean | — |
| `onOpenChange` | (open: boolean) => void | — |

## Rules and behaviour

- Configurable side, alignment, offsets, collision handling.
- Optionally render a pointing arrow.
- Supports custom show/hide delay duration, shared across a TooltipProvider.
- Closes on trigger click, Escape key, or when the trigger is scrolled out of view.

## Exports

`TooltipProvider` · `Tooltip` · `TooltipTrigger` · `TooltipContent`

## Accessibility

Automated check: `packages/ui/src/components/tooltip.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
