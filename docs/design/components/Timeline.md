# Timeline

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/timeline.tsx` · **Doc page:** `apps/design-system/src/app/components/timeline/page.tsx`

A vertical, connected feed of heterogeneous events — first built for a contact's merged quote + activity history (S-01.3), where a customer's quotes, calls, meetings, notes, and tasks all need to read as one chronological story rather than separate lists. Domain-agnostic by design: Timeline only knows how to lay out an icon, title, description, and timestamp with a connecting rail — the caller (e.g. the contact Timeline tab) merges and sorts events from however many real sources exist (quotes and activities today; invoices/payments once those modules land) before handing them to this component as one flat, pre-sorted array.

## Import

```tsx
import { TimelineItemData, Timeline } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `items` | TimelineItemData[] | — |
| `TimelineItemData.id` | string | — |
| `TimelineItemData.icon` | ReactNode | — |
| `TimelineItemData.title` | ReactNode | — |
| `TimelineItemData.description` | ReactNode | — |
| `TimelineItemData.timestamp` | ReactNode | — |
| `TimelineItemData.meta` | ReactNode | — |

## Rules and behaviour

- Renders items in the order given — Timeline doesn't sort, since a caller merging multiple event sources (quotes + activities) already needs to interleave and sort them by timestamp itself.
- Each item's icon and tone are fully caller-supplied — Timeline has no built-in notion of "quote" or "activity" event types, only a generic icon + optional tone (neutral/success/critical) for the connecting dot.
- tone maps to existing semantic tokens (paid/overdue), not arbitrary colors — reserve success/critical for an event that carries real status (an accepted or rejected quote), not routine entries.
- timestamp is any ReactNode, not a fixed date format — pass a pre-formatted relative time (e.g. via date-fns formatDistanceToNow) so locale/format stays the consuming app's decision.
- meta renders beside the timestamp for small trailing context, like a Badge marking a task done/open.
- The connecting rail between items is purely visual (an aria-hidden line) — screen readers get the list structure via the underlying &lt;ol&gt;, not the decorative line.

## Exports

`TimelineItemData` · `TimelineProps` · `Timeline`

## Accessibility

Automated check: `packages/ui/src/components/timeline.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
