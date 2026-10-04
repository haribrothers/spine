# Card

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/card.tsx` · **Doc page:** `apps/design-system/src/app/components/card/page.tsx`

The default container for grouped content — 12px radius, 1px border, no shadow.

## Import

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `…` | standard <div> attributes on every sub-part | — |

## Rules and behaviour

- Composable sub-parts (Header, Title, Description, Content, Footer) — use only the ones a given card needs.

## Exports

`Card` · `CardHeader` · `CardTitle` · `CardDescription` · `CardContent` · `CardFooter`

## Accessibility

Automated check: `packages/ui/src/components/card.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
