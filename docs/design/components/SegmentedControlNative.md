# SegmentedControl

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/segmented-control.tsx` · **Doc page:** none yet

`@expo/ui/community/segmented-control`'s real, genuinely native component — a real SwiftUI `Picker` in `.segmented` style on iOS, a real Jetpack Compose `SingleChoiceSegmentedButtonRow` on Android (confirmed by reading both platform implementation files directly) — wrapped here so consuming apps never import `@expo/ui` directly for this control. Was previously imported straight from `@expo/ui` in `apps/showcase-native`'s Home screen; moved here as part of making `packages/ui-native` the sole `@expo/ui`/styling touchpoint for consuming apps.

## Import

```tsx
import { SegmentedControl } from "@spine/ui-native";
```

## Exports

`SegmentedControlProps` · `SegmentedControl`

## Accessibility

Automated check: `packages/ui-native/src/components/segmented-control.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
