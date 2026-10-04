# Spinner

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/spinner.tsx` · **Doc page:** `apps/design-system/src/app/components/spinner/page.tsx`

An indeterminate loading indicator for actions with no known duration — e.g. "sending invoice…". Prefer Skeleton for content that has a known shape.

## Import

```tsx
import { Spinner } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `size` | sm \| md \| lg | md |
| `label` | string | — |

## Rules and behaviour

- Three sizes: sm, md, lg.
- Respects prefers-reduced-motion by relying on the browser's own reduced-motion handling for CSS animation.
- Wrapped in a role="status" span with an aria-label — the bare &lt;svg&gt; icon carries aria-hidden, since an SVG has no implicit ARIA role and can't reliably carry its own accessible name in every screen reader.

## Exports

`Spinner`

## Accessibility

Automated check: `packages/ui/src/components/spinner.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
