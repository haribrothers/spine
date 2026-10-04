# Resizable

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/resizable.tsx` · **Doc page:** `apps/design-system/src/app/components/resizable/page.tsx`

Accessible resizable panel groups and layouts, built on react-resizable-panels.

## Import

```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `ResizablePanelGroup.orientation` | horizontal \| vertical | horizontal |
| `ResizablePanel.defaultSize` | number (percentage) | — |
| `ResizableHandle.withHandle` | boolean | false |

## Rules and behaviour

- Supports horizontal and vertical orientation.
- Persists layout via the underlying library's own storage hooks if wired up.
- Optional visible grip handle.

## Exports

`ResizablePanelGroup` · `ResizablePanel` · `ResizableHandle`

## Accessibility

Automated check: `packages/ui/src/components/resizable.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
