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

- The viewport is pinned with `inset-x-0` under 640px, so it can never reach past a phone's screen (US-OPS-62).
- In the web app, toasts come from one `ToastHost` in the app layout via `useToast()`; a toast shown before opening another page stays visible there. They stack newest on top, up to `max` (default 3; 2 at phone width) — a new toast over the limit closes the oldest — and each closes after `duration` (default 5000 ms), paused on hover or focus (D-223, US-OPS-38).
- Automatically closes after a set duration.
- Swipe to dismiss on touch devices.
- Supports an optional action button (ToastAction).
- Multiple toasts stack and queue via the shared ToastProvider/ToastViewport.

## Exports

`ToastProvider` · `ToastViewport` · `Toast` · `ToastTitle` · `ToastDescription` · `ToastClose` · `ToastAction`

## Accessibility

Automated check: `packages/ui/src/components/toast.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
