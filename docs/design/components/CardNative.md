# Card

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/card.tsx` · **Doc page:** `apps/design-system-native/app/components/card.tsx`

The default container for grouped content — 8px radius, 1px border, no shadow.

## Import

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@spine/ui-native";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `…` | standard ViewProps/TextProps on every sub-part | — |

## Rules and behaviour

- Composable sub-parts (Header, Title, Description, Content, Footer) — use only the ones a given card needs.

## Exports

`Card` · `CardHeader` · `CardTitle` · `CardDescription` · `CardContent` · `CardFooter`

## Accessibility

Automated check: `packages/ui-native/src/components/card.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
