# ChipStrip

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** `packages/ui/src/components/chip-strip.tsx` · **Doc page:** `apps/design-system/src/app/components/chip-strip/page.tsx` · **Stories:** US-OPS-54, US-OPS-56, US-OPS-57, US-RPT-41

A row of compact chips that scrolls sideways: a list's summary figures ("Overdue $4,542.50"), an area's pages, a board's stages, the filters that are on (D-283).

**Status:** built (US-OPS-57); list pages wrap their summary cards in it.

## Import

```tsx
import { ChipStrip } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `label` | string — names the group | — |
| `className` | string — the desktop layout (a grid) | — |


## Rules and behaviour

- Its look is CSS: a `StatCard` inside it (`[data-chip-strip] [data-stat-card]`) shows its label and figure under 768px, and hides its detail and hint; a card that is a button still filters when tapped. From 768px up it's the grid its `className` gives.
- A chip that filters is a button at least 44px tall; the chosen one is marked by more than colour: `aria-pressed` and a heavier border (its border plus a ring).
- The row scrolls with touch; the chip cut off at the edge shows there's more; the page itself never scrolls sideways.
- When the row scrolls and none of its chips can take focus (figures only, as on Journals), it becomes a focusable region named by `label` (or "Summary, scrolls sideways") so a keyboard can scroll it. With buttons inside it adds no tab stop.
- A filter that's on shows as a chip with × in `FilterSheet`, not here.

## Accessibility

Automated check: `packages/ui/src/components/chip-strip.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
