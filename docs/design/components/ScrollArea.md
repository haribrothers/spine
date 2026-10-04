# ScrollArea

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/scroll-area.tsx` · **Doc page:** `apps/design-system/src/app/components/scroll-area/page.tsx`

Augments native scroll functionality for custom, cross-browser styling. Thin, bordered thumb, no native OS chrome — for any internally-scrolling panel (a long SideNav list, a code block).

## Import

```tsx
import { ScrollArea } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `…` | standard <div> attributes on the root | — |

## Rules and behaviour

- Cross-browser consistent scrollbar styling.
- Scrollbars only appear when needed / on hover, matching each OS's own convention where relevant.

## Exports

`ScrollArea`

## Accessibility

Automated check: `packages/ui/src/components/scroll-area.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
