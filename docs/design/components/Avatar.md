# Avatar

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/avatar.tsx` · **Doc page:** `apps/design-system/src/app/components/avatar/page.tsx`

An image element with a fallback for representing a user or organization. Circular, initials-on-primary-fill by default, or an image when available.

## Import

```tsx
import { Avatar, AvatarImage, AvatarFallback } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `size` | sm \| md \| lg | md |
| `AvatarImage.src` | string | — |
| `AvatarFallback.delayMs` | number | — |

## Rules and behaviour

- Automatic fallback while an image is loading or if it fails to load.
- Three sizes: sm, md, lg.

## Exports

`Avatar` · `AvatarImage` · `AvatarFallback`

## Accessibility

Automated check: `packages/ui/src/components/avatar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
