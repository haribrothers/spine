# CalendarMini

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/calendar-mini.tsx` · **Doc page:** `apps/design-system/src/app/components/calendar/page.tsx` (MiniCalendar section)

A month-grid picker: DatePicker and Calendar's toolbar host it in a Popover; the Meetings sidebar shows it on its own. `headerAction` puts a control at the right of the month header (e.g. a panel-collapse toggle).

## Props

| Prop | Type | Default |
|---|---|---|
| `selected` | Date | — |
| `onSelect` | (date: Date) => void | — |
| `headerAction` | ReactNode | — |
| `month` | Date | — |
| `onMonthChange` | (month: Date) => void | — |
| `marks` | Map<string, number> | — |
| `markLabel` | (count: number) => string | "n events" |
| `highlight` | { start: Date; end: Date } | — |
| `className` | string | — |

## Rules and behaviour

- US-MTG-13 (D-212): with `marks`, a day whose count is above 0 gets one dot under its date, and its count in a Tooltip and in its accessible name ("Wednesday, October 7, 2026, 2 meetings"). Keys come from `miniCalendarDayKey` (local YYYY-MM-DD).
- `highlight` shades a range as one band across each week it touches (the selected day stays filled, today keeps its colour).
- With `month` and `onMonthChange` the month is controlled, so it can follow a larger calendar; the arrows ask for the first of the next or previous month.

## Import

```tsx
import { MiniCalendar } from "@spine/ui";
```

## Exports

`MiniCalendarProps` · `MiniCalendar` · `miniCalendarDayKey`

## Accessibility

Automated check: `packages/ui/src/components/calendar-mini.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
