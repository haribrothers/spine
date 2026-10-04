# Typography

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/typography.tsx` · **Doc page:** `apps/design-system/src/app/components/typography/page.tsx`

Heading/prose style presets matching docs/DESIGN.md's type scale — for content-heavy screens (a quote's terms, a help article) rather than dashboard chrome, which typically composes its own headings inline per component (Card's CardTitle, etc.).

## Import

```tsx
import { Display, H1, H2, H3, Lead, P } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `…` | standard heading/paragraph attributes on each preset | — |

## Rules and behaviour

- Seven presets — Display, H1, H2, H3, Lead, P, Muted — each a thin wrapper over a semantic HTML element with the matching DESIGN.md type-scale styling.

## Exports

`Display` · `H1` · `H2` · `H3` · `Lead` · `P` · `Muted`

## Accessibility

Automated check: `packages/ui/src/components/typography.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
