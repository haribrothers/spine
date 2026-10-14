# Select

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/select.tsx` · **Doc page:** `apps/showcase-native/src/components/demos/select-demo.tsx`

A single-choice picker for simple flat option lists — the native counterpart to web&apos;s NativeSelect. Uses the OS&apos;s own native picker chrome (a wheel/dialog on iOS/Android, a real &lt;select&gt; on web), the lightest-weight option when a custom-styled menu isn&apos;t needed.

## Import

```tsx
import { SelectOption, Select } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `options` | { label: string; value: T }[] | — |
| `value` | T | — |
| `onValueChange` | (value: T) => void | — |
| `enabled` | boolean | true |

## Rules and behaviour

- Uses @expo/ui's universal Picker — a real native SwiftUI/Jetpack Compose dropdown via a Host bridge, not a NativeWind-styled RN primitive.
- Themed via Host's seedColor/colorScheme, matching every other @expo/ui-backed component in this package — not a per-component color prop.

## Exports

`SelectOption` · `SelectProps` · `Select`

## Accessibility

Automated check: `packages/ui-native/src/components/select.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
