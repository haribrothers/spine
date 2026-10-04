# Toast

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/toast.tsx` · **Doc page:** `apps/design-system/src/app/components/toast/page.tsx`

A succinct message that is displayed temporarily. Dark chrome, bottom-right, auto-dismissing — confirms an action succeeded. Never carries a validation error, which belongs inline via HelperText.

## Import

```tsx
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `Toast.open` | boolean | — |
| `Toast.onOpenChange` | (open: boolean) => void | — |
| `Toast.duration` | number | 5000 |
| `ToastViewport.label` | string | — |

## Rules and behaviour

- Automatically closes after a set duration.
- Swipe to dismiss on touch devices.
- Supports an optional action button (ToastAction).
- Multiple toasts stack and queue via the shared ToastProvider/ToastViewport.

## Exports

`ToastProvider` · `ToastViewport` · `Toast` · `ToastTitle` · `ToastDescription` · `ToastClose` · `ToastAction`

## Accessibility

Automated check: `packages/ui/src/components/toast.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
