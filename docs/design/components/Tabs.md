# Tabs

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/tabs.tsx` · **Doc page:** `apps/design-system/src/app/components/tabs/page.tsx`

A set of layered sections of content — known as tab panels — that display one panel at a time. Underline-indicator style, for switching between views within one page — e.g. a job's Overview/Milestones/Photos tabs.

## Import

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | string | — |
| `defaultValue` | string | — |
| `onValueChange` | (value: string) => void | — |
| `activationMode` | automatic \| manual | automatic |

## Rules and behaviour

- Can be controlled or uncontrolled.
- Supports horizontal/vertical orientation.
- Full keyboard navigation.
- Supports automatic/manual activation.

## Phone (under 768px, [D-283](../../prd/12-decisions.md)) — planned

- Under 768px the tab list is one row that scrolls sideways, with counts beside their labels; labels never wrap or overlap, and the chosen tab scrolls into view (US-OPS-58, US-OPS-61).

## Exports

`Tabs` · `TabsList` · `TabsTrigger` · `TabsContent`

## Accessibility

Automated check: `packages/ui/src/components/tabs.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
