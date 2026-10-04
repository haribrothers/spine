# Banner

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/banner.tsx` · **Doc page:** `apps/design-system/src/app/components/banner/page.tsx`

A full-width notice across the top of the content area, above the page header — for app-wide states an Owner should act on, such as an available update (`UpgradeNotice`) or storage running out (US-OPS-31). Distinct from Alert, which sits inside a page, and Toast, which is temporary.

## Import

```tsx
import { Banner } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `variant` | info \| warning \| critical | info |
| `title` | ReactNode | — |
| `icon` | ReactNode | a variant icon; pass null for none |
| `actions` | ReactNode | — |
| `onDismiss` | () => void | — (no close button) |
| `dismissLabel` | string | "Dismiss" |

## Rules and behaviour

- Render it through `AppShellContent`'s `banner` slot so it spans the content area, outside the 1200px cap.
- Colours come from the status tokens (`info-bg`, `due-soon-bg`, `overdue-bg`); text is `on-surface` and actions `primary`, in light and dark mode.
- A leading icon per variant so colour is never the only signal.
- critical renders role="alert"; info and warning render role="status".

## Exports

`bannerVariants` · `BannerProps` · `Banner`

## Accessibility

Automated check: `packages/ui/src/components/banner.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
