# Button

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/button.tsx` · **Doc page:** `apps/showcase-native/src/components/demos/button-demo.tsx`

Triggers an action or event. One primary (filled) action per screen — everything else is secondary, ghost, or a plain link.

## Import

```tsx
import { ButtonVariant, ButtonControlSize, Button } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `variant` | primary \| secondary \| danger \| ghost | primary |
| `size` | default \| sm \| touch \| icon | touch |
| `loading` | boolean | false |
| `disabled` | boolean | false |

## Rules and behaviour

- Renders RN's Pressable/Text, styled via NativeWind className, not StyleSheet.
- Four visual variants: primary, secondary, danger, ghost.
- Four sizes, including a 44px touch size — the default here, since this is a field-companion app.
- accessibilityRole and accessibilityState (disabled/busy) set automatically.

## Exports

`ButtonVariant` · `ButtonControlSize` · `ButtonProps` · `Button`

## Accessibility

Automated check: `packages/ui-native/src/components/button.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
