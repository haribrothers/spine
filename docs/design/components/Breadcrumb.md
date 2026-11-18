# Breadcrumb

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/breadcrumb.tsx` · **Doc page:** `apps/design-system/src/app/components/breadcrumb/page.tsx`

A trail of links showing the current page's ancestry. body-sm typography, muted grey with the current page in on-surface.

## Import

```tsx
import { BreadcrumbItem, Breadcrumb } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `items` | { label: string; href?: string }[] | — |

## Rules and behaviour

- The last item (no href) renders as plain, non-interactive text for the current page.
- One line at every width: when space runs out the middle items shorten with "…" first (the full label is their tooltip), then the last; the first keeps its text (US-OPS-61).
- Under 768px each link is 44px tall to tap, with its text centred on the line.

## Exports

`BreadcrumbItem` · `Breadcrumb`

## Accessibility

Automated check: `packages/ui/src/components/breadcrumb.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
