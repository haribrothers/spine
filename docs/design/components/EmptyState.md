# EmptyState

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/empty-state.tsx` · **Doc page:** `apps/design-system/src/app/components/empty-state/page.tsx`

Used for every zero-results list and the first-run dashboard — Spine's onboarding principle is "never a blank screen with no next action."

## Import

```tsx
import { EmptyState } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `icon` | ReactNode | — |
| `title` | string | — |
| `description` | string | — |
| `action` | ReactNode | — |

## Rules and behaviour

- Centered icon, heading, optional description, and optional primary action.
- The action slot accepts any node, typically a Button, so it composes rather than reimplementing button styling.

## Exports

`EmptyStateProps` · `EmptyState`

## Accessibility

Automated check: `packages/ui/src/components/empty-state.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
