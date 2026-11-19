# FloatingActionButton

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** `packages/ui/src/components/floating-action-button.tsx` · **Doc page:** `apps/design-system/src/app/components/floating-action-button/page.tsx` · **Stories:** US-OPS-57, US-MTG-18

The page's main action on a phone: a round button above the tab bar, with its label at the top of the list ("New quote") that shrinks to + while the list scrolls (D-283).

**Status:** built (US-OPS-57); list pages wrap their main button in it.

## Import

```tsx
import { FloatingActionButton } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `children` | the page's main `Button` (or `Button asChild` with a link) | — |


## Rules and behaviour

- From 768px up it renders its child where it was. Under 768px it floats bottom right above the tab bar, 52px tall, and shrinks to its icon while `<main>` scrolls (`text-[0px]`, so the label is still read). Marked `data-main-action` for the phone check.
- One per page, and only for the page's primary action (rule 3: one primary action per screen); other actions go under the top bar's ⋯.
- Keeps its label for screen readers when it shrinks; 56px, clear of the tab bar and the home indicator; `primary` colour with `on-primary` content.
- Hidden in Select mode and while the keyboard is open.

## Accessibility

Automated check: `packages/ui/src/components/floating-action-button.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
