# Calendar

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/calendar.tsx` · **Doc page:** `apps/design-system/src/app/components/calendar/page.tsx`

An Outlook-style scheduling calendar with Day, Week, Month, and Agenda views. Drag an empty slot to create an event, drag an existing event to move it, drag its edges to resize (Day/Week), and overlapping events lay out side-by-side rather than stacking. Supports all-day and multi-day events, a fixed color-coded category palette, and simple daily/weekly/monthly recurrence with an end date or occurrence count.

## Import

```tsx
import { CalendarView, RecurringMoveOrResizeRequest, Calendar } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `events` | CalendarEvent[] | — |
| `onEventCreate` | (event: CalendarEvent, extra?: Record<string, unknown>) => void | — |
| `onEventUpdate` | (event: CalendarEvent, extra?: Record<string, unknown>) => void | — |
| `onEventDelete` | (eventId: string) => void | — |
| `onViewChange` | (view: CalendarView) => void | — |
| `date` | Date | — |
| `onDateChange` | (date: Date) => void | — |
| `contactOptions` | { value: string; label: string }[] | — |
| `readOnlyEventIds` | Set<string> | — |
| `onReadOnlyEventClick` | (instance: CalendarEventInstance) => void | — |
| `nonEditableEventIds` | Set<string> | — |
| `nonDeletableEventIds` | Set<string> | — |
| `canCreateEvents` | boolean | true |
| `renderExtraFields` | (ctx: { isEdit: boolean; event: CalendarEvent \| null; setExtra: (extra: Record<string, unknown>) => void }) => React.ReactNode | — |
| `toolbarAction` | ReactNode | — |
| `views` | CalendarView[] | all four |
| `createRequest` | { start: Date; end: Date } \| null | — |
| `openRequest` | { eventId: string; occurrenceStart: Date } \| null | — |
| `agendaDetails` | (instance) => ReactNode | — |
| `className` | string | — |
| `id` | string | — |
| `title` | string | — |
| `start` | Date | — |
| `end` | Date | — |
| `allDay` | boolean | false |
| `location` | string | — |
| `description` | string | — |
| `recurrence` | CalendarRecurrenceRule | — |
| `contactId` | string | — |
| `interval` | number | 1 |
| `selected` | Date | — |
| `onSelect` | (date: Date) => void | — |
| `className` | string | — |
| `headerAction` | ReactNode | — |

## Rules and behaviour

- Day, Week, Month, and Agenda views, switchable via a toolbar view toggle.
- Click-and-drag on an empty time slot to create an event, pre-filled with the dragged time range.
- Drag an existing event to move it to a new time or day; drag its top/bottom edge to resize (Day/Week only).
- Overlapping events in the same time range lay out side-by-side via a greedy column-assignment algorithm, never stacked illegibly.
- All-day events render in a dedicated all-day strip (Day/Week) or as full-width bars (Month).
- Multi-day events render as spanning bars across Month/Week.
- Simple recurrence — daily/weekly/monthly with an end date or occurrence count — expanded into concrete instances per visible range via date-fns, including month-boundary and DST-adjacent arithmetic.
- A fixed 8-color category palette (docs/DESIGN.md's category-* tokens), assigned per event.
- A mini month-picker in the toolbar (built on the same MiniCalendar DatePicker uses) to jump the visible range to any date.
- Prev / Today / Next navigation, scoped to the active view's step size.
- Fully controlled — the caller owns events, view, and date; drag/resize/create interaction state stays internal.
- Optional contactOptions prop adds a Contact field to the event editor (a searchable Combobox) so an event can optionally link to an external record — first used by the /meetings page (S-01.9) to schedule meetings against a CRM contact.
- Optional readOnlyEventIds + onReadOnlyEventClick let a caller overlay events from another source Calendar shouldn't let the user drag/resize/edit through its own dialog — a matching id skips move/resize entirely and routes clicks to the caller's own handler instead of the built-in editor. First used to overlay activities (calls/notes/tasks with a due date, no time range) alongside real scheduled meetings.
- US-MTG-14 (D-212): Day and Week open scrolled to 8 AM, or the hour before now on today after 9 AM (`calendarScrollHour`); the week's day headers stay in view; a now line (overdue colour) marks the current time on today's column. `toolbarAction` adds a control before the view switch; `createRequest` opens the create dialog for a range; the quick view flips, shifts and scrolls to fit in the window.
- US-MTG-15: `openRequest` opens an occurrence's quick view once its day is on screen.
- US-MTG-17: `views` limits the views offered; Agenda rows show the time range, place and `agendaDetails`, stacking on narrow screens; the toolbar wraps.

## Phone (under 768px, [D-283](../../prd/12-decisions.md)) — built (US-MTG-18)

- Under 768px Month is a compact grid with up to three dots per busy day and the chosen day's meetings listed under it; Day is a week strip over a timeline; swipe moves month, week or day, and the arrows do the same for keyboard users; the toolbar is two short rows, the month and year with the arrows and Today, then Month · Day · Agenda as a segmented control the width of the screen (US-MTG-18, `MeetingsPhoneMonth`).
- Built in `calendar-phone.tsx`: `CalendarPhoneToolbar` (the month opens a Pick a month sheet), `CalendarPhoneMonth` (one letter per weekday, today ringed, the chosen day filled, each day's name carries its count; arrow keys move the day), `CalendarWeekStrip` (with the day's count and how many are still to come today) and `useSwipe` (pointer events, `touch-action: pan-y`; a mostly vertical drag is a scroll, not a swipe). On a phone the Day timeline has no drag to create, move or resize, so a sideways swipe moves the day and a tap opens the event; the quick view (`renderEventPopover`) is a bottom sheet (`CalendarQuickViewSheet`), and `toolbarAction` isn't shown (the page puts its actions in the top bar and a floating +). The event colours live in `lib/calendar-colors.ts`.
- Test: `calendar-phone.a11y.test.tsx`.

## Exports

`CalendarView` · `RecurringMoveOrResizeRequest` · `CalendarProps` · `Calendar`

## Accessibility

Automated check: `packages/ui/src/components/calendar.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
