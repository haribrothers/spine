# InputGroup

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/input-group.tsx` · **Doc page:** `apps/design-system/src/app/components/input-group/page.tsx`

Wraps an Input with a leading/trailing icon or addon — e.g. SearchInput's leading search icon, or a trailing currency-code addon.

## Import

```tsx
import { InputGroup, InputGroupAddon, InputGroupInput } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `…` | standard <div>/<input> attributes on the respective sub-parts | — |

## Rules and behaviour

- The focus ring applies to the whole group, not just the inner input, so it reads as one control.

## Exports

`InputGroup` · `InputGroupAddon` · `InputGroupInput`

## Accessibility

Automated check: `packages/ui/src/components/input-group.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
