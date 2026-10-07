# Alert

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/alert.tsx` · **Doc page:** `apps/design-system/src/app/components/alert/page.tsx`

Displays a callout for user attention. A persistent, page-level, non-dismissible-by- default inline message (e.g. "This entity has 3 lapsed certifications requiring action") — distinct from Toast (temporary/dismissible) and StatusChip (per-row status).

## Import

```tsx
import { Alert, AlertTitle, AlertDescription } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `variant` | info \| warning \| critical \| success | info |
| `icon` | ReactNode | a variant-appropriate default; pass null for none |

## Rules and behaviour

- Four variants sharing the same background/text pairs as StatusChip's palette, plus info: info, warning, critical, success.
- A leading icon that defaults per variant (Info/AlertTriangle/AlertCircle/CheckCircle2) so color is never the only signal — pass icon={null} to opt out, or a custom icon to override.
- critical renders role="alert" (interrupts screen readers, for genuine errors); info/warning/success render role="status" (polite announcement).
- `AlertTitle` and `AlertDescription` are both full-contrast `on-surface`. Muted text isn't used on alert tints: it measured 4.37:1 on the light critical tint (US-OPS-33).

## Exports

`alertVariants` · `AlertProps` · `Alert` · `AlertTitle` · `AlertDescription`

## Accessibility

Automated check: `packages/ui/src/components/alert.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
