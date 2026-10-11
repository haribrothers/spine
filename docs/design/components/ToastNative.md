# Toast

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/toast.tsx` · **Doc page:** `apps/design-system-native/app/components/toast.tsx`

A succinct message that is displayed temporarily. Dark chrome, auto-dismissing — confirms an action succeeded. Never carries a validation error, which belongs inline once this package has a HelperText equivalent.

## Import

```tsx
import { ToastMessage, Toast } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `useToast(duration)` | number | 2500 |
| `Toast.title` | string | — |
| `Toast.description` | string | — |
| `Toast.onDismiss` | () => void | — |

## Rules and behaviour

- useToast(duration) is a single-message-at-a-time hook per screen — no Radix ToastProvider/Viewport equivalent needed. (The web app now uses one stacking `ToastHost` instead, D-223; the field app keeps one message at a time.)
- Calling show() again while a toast is visible replaces the message and resets the auto-dismiss timer, rather than queuing a second toast.
- Chrome stays dark regardless of the app's own light/dark theme — it reads raw light-mode neutral900/neutral50 values directly rather than theme-reactive dark: classNames, avoiding the contrast collapse those would cause in dark mode.

## Exports

`ToastMessage` · `ToastProps` · `Toast` · `useToast`

## Accessibility

Automated check: `packages/ui-native/src/components/toast.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
