# Avatar

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/avatar.tsx` · **Doc page:** `apps/design-system-native/app/components/avatar.tsx`

A circular image with a fallback for representing a user or organization — initials on a primary-color fill by default, or an image when available.

## Import

```tsx
import { Avatar } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `size` | sm \| md \| lg | md |
| `source` | ImageSourcePropType | — |
| `fallback` | string | — |

## Rules and behaviour

- Automatic fallback to initials if an image source is missing or fails to load (RN's Image onError, the equivalent of web's Radix load-failure behavior).
- Three sizes: sm, md, lg.
- No compound Root/Image/Fallback API like web — there's no Radix primitive being wrapped here, so it collapses to plain source/fallback props on one component.

## Exports

`AvatarProps` · `Avatar`

## Accessibility

Automated check: `packages/ui-native/src/components/avatar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
