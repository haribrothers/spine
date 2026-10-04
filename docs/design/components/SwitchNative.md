# Switch

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/switch.tsx` · **Doc page:** none yet

`@expo/ui`'s universal `Switch` — real SwiftUI `Toggle`/Jetpack Compose `Switch` via a `Host` bridge. Net-new component (no prior ui-native implementation existed) — prop names deliberately match `@expo/ui`'s own `value`/`onValueChange`, NOT web `packages/ui`'s `checked`/ `onCheckedChange` — confirmed against `SwitchProps`'s real TS type, which has no `color` prop at all (unlike Button, Switch's accent color is theme-only, set via `Host`'s `seedColor`, with no per-instance override).

## Import

```tsx
import { Switch } from "@spine/ui-native";
```

## Exports

`SwitchProps` · `Switch`

## Accessibility

Automated check: `packages/ui-native/src/components/switch.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
