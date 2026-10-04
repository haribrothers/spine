# EmptyState

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/empty-state.tsx` · **Doc page:** `apps/design-system-native/app/components/empty-state.tsx`

Used for every zero-results list and the first-run dashboard — Spine&apos;s onboarding principle is &quot;never a blank screen with no next action.&quot;

## Import

```tsx
import { EmptyState } from "@spine/ui-native";
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
- Unlike web, the icon isn't auto-sized via a descendant CSS selector (RN has none) — pass an already-sized icon element, e.g. &lt;Inbox size={24} /&gt;.

## Exports

`EmptyStateProps` · `EmptyState`

## Accessibility

Automated check: `packages/ui-native/src/components/empty-state.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
