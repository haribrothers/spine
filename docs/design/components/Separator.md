# Separator

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/separator.tsx` · **Doc page:** `apps/design-system/src/app/components/separator/page.tsx`

Visually or semantically separates content. A 1px border-colored rule, horizontal or vertical, for separating sections within a card or toolbar without a full card boundary.

## Import

```tsx
import { Separator } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `orientation` | horizontal \| vertical | horizontal |
| `decorative` | boolean | true |

## Rules and behaviour

- Supports horizontal and vertical orientation.
- Decorative by default (hidden from assistive tech) since it's usually a visual-only divider.

## Exports

`Separator`

## Accessibility

Automated check: `packages/ui/src/components/separator.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
