# Spinner

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/spinner.tsx` · **Doc page:** `apps/design-system-native/app/components/spinner.tsx`

An indeterminate loading indicator for actions with no known duration — e.g. &quot;sending invoice…&quot;. Prefer a skeleton-shaped placeholder for content that has a known shape, once this package has one.

## Import

```tsx
import { Spinner } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `size` | sm \| md \| lg | md |
| `label` | string | — |

## Rules and behaviour

- Three sizes: sm, md, lg — approximated via a transform: scale() on top of RN's own small/large ActivityIndicator sizes, since RN has no arbitrary pixel size the way web's Lucide-based spinner does.
- The same ActivityIndicator + theme-aware color resolution Button's own loading state already relies on, extracted into its own component now that a second, non-Button use needs it.
- accessibilityRole="alert" + accessibilityLiveRegion="polite" — the RN equivalent of web's role="status" span, so assistive tech gets a polite announcement without focus moving anywhere.

## Exports

`SpinnerProps` · `Spinner`

## Accessibility

Automated check: `packages/ui-native/src/components/spinner.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
