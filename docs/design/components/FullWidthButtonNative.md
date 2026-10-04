# FullWidthButton

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/full-width-button.tsx` · **Doc page:** none yet

A genuinely full-width native button — `Button` (this package's default, content-sized native `@expo/ui` button) has NO working `fullWidth` option, and this component exists specifically because that turned out to be a real, confirmed upstream `@expo/ui` limitation, not something fixable by a prop on `Button` itself. Read this doc comment in full before touching either component again.

## Import

```tsx
import { FullWidthButton } from "@spine/ui-native";
```

## Exports

`FullWidthButtonProps` · `FullWidthButton`

## Accessibility

Automated check: `packages/ui-native/src/components/full-width-button.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
