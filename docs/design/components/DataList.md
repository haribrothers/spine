# DataList

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/data-list.tsx` · **Doc page:** `apps/design-system/src/app/components/data-list/page.tsx`

Label-to-value rows for a single record's detail view — lighter-weight than a full Table for one record rather than a collection.

## Import

```tsx
import { DataListItem, DataList } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `items` | { label: string; value: ReactNode }[] | — |

## Rules and behaviour

- Renders as a definition list (&lt;dl&gt;) with a divider between rows.
- The value slot accepts any node, not just text.

## Exports

`DataListItem` · `DataList`

## Accessibility

Automated check: `packages/ui/src/components/data-list.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
