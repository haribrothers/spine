# BottomTabBar

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** `packages/ui/src/components/bottom-tab-bar.tsx` · **Doc page:** `apps/design-system/src/app/components/bottom-tab-bar/page.tsx` · **Stories:** US-OPS-54

The bar along the bottom of the web app under 768px: Home · Sales · Jobs · Money · More, each an icon and a label. It replaces the slide-over menu (D-283, US-OPS-54).

**Status:** built (US-OPS-54); the web app's phone layout renders it from `app-layout.tsx`.

## Import

```tsx
import { BottomTabBar } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `items` | `BottomTabBarItem[]` — `{ key, href, label, icon, current }` | — |
| `renderLink` | `(item, { className, "aria-current", children }) => ReactNode` — e.g. a Next.js `Link` | — |
| `renderButton` | `(item, { className, children }) => ReactNode` — for a tab that isn't a link (More) | — |
| `buttonKeys` | `string[]` — the keys rendered with `renderButton` | `[]` |
| `className` | `string` | — |


## Rules and behaviour

- Marked `data-tabbar`: CSS hides it while a full-screen sheet (`[data-phone-fullscreen]`) is open and, on a touch screen, while a text field has focus.
- Up to five tabs; a tab whose pages the person can't open isn't rendered, and the others share the width.
- The icons are Lucide `House`, `FileText`, `HardHat`, `Wallet` and `Menu`. The current tab is marked by a tinted pill behind its icon (`info-bg`), a heavier label and `aria-current="page"`, never by colour alone (Lucide has no filled icons).
- Each tab is at least 44×44px; the bar sits above the home indicator (`env(safe-area-inset-bottom)`).
- Hidden while the keyboard, a builder or a full-screen sheet is open.
- A `<nav>` labelled "Main"; works in light and dark from tokens. It's docked to the bottom edge on `surface` with a top border, not floating, so the floating + button can sit above it; each tab's icon-over-label look follows the field app's `FloatingTabBar` ([FloatingTabBarNative](FloatingTabBarNative.md)). Drawn in `AppShellPhoneTabs`.

## Accessibility

Automated check: `packages/ui/src/components/bottom-tab-bar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
