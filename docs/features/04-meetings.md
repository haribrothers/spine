# 04 · Meetings & calendar

An Outlook-style calendar for meetings with contacts and colleagues: day, week, month and agenda views, private or org-wide visibility, invitations with responses, a quick-view popover, and recurring meetings whose single occurrences can be changed without touching the series. Reminders and invite notifications are in 14 Notifications.

**Screens:** `MeetingsWeek` (P1), `MeetingsMonth` (P2), `MeetingsAgenda` (P3), `MeetingsEmpty` (P2), `MeetingQuickView` (P1), `MeetingQuickViewRecurring` (P2), `MeetingEditorDetails` (P1), `MeetingEditorPeople` (P1), `MeetingScopeChoice` (P2), `MeetingDeleteConfirm` (P2), `MeetingsWeekRefined` (P2), `MeetingsWeekRefinedDark` (P2), `MeetingsMonthRefined` (P2), `MeetingsAgendaRefined` (P2), `MeetingsPhone` (P2), `MeetingQuickViewFits` (P2), `MeetingsPhoneMonth` (P1), `MeetingsPhoneMonthDark` (P1), `MeetingsPhoneDay` (P1)
**Depends on:** 03 Contacts (meeting ↔ contact link), 15 Team (members to invite), 14 Notifications.

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-MTG-01 | Calendar views and scheduling | P1 | 1 | `MeetingsWeek`, `MeetingsMonth`, `MeetingsAgenda`, `MeetingsEmpty`, `MeetingEditorDetails` |
| F-MTG-02 | Invitations, visibility and responses | P1 | 1 | `MeetingEditorPeople`, `MeetingQuickView` |
| F-MTG-03 | Quick view and recurring meetings | P1 | 1 | `MeetingQuickView`, `MeetingQuickViewRecurring`, `MeetingScopeChoice`, `MeetingDeleteConfirm` |
| F-MTG-04 | Own/others meeting rights | P1 | 4 | `MeetingQuickView`, `MeetingEditorDetails` |
| F-MTG-05 | A calendar that's easy to use: busy days in the mini calendar, a New meeting button, the working day in view, useful sidebar lists, the same place on return, and every screen size | P2 | Refinements | `MeetingsWeekRefined`, `MeetingsWeekRefinedDark`, `MeetingsMonthRefined`, `MeetingsAgendaRefined`, `MeetingsPhone`, `MeetingQuickViewFits` |
| F-MTG-06 | A calendar made for a phone: a month with busy-day dots and the day's meetings, a week strip over the day (D-283) | P1 | 12 | `MeetingsPhoneMonth`, `MeetingsPhoneDay`, `MeetingsPhoneMonthDark` |

## User stories

### US-MTG-01 · Schedule a meeting on the calendar
**Feature:** F-MTG-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `MeetingsWeek`, `MeetingEditorDetails`
**As** office staff, **I want** to put a meeting on the calendar, **so that** I can plan my week and never miss a commitment.

Legacy: S-01.9

**Acceptance criteria**
- **Given** Meetings ("Schedule and view meetings with your contacts."), **when** I drag across empty time in Day or Week view, **then** a new-event dialog opens with that start and end.
- **Given** the dialog's "Details" tab, **when** I fill "Title" (required), optional contact, all-day switch, start, end, category colour, location and notes, and press "Save changes", **then** the meeting appears on the calendar in its colour.
- **Given** an existing meeting, **when** I drag it to another time or drag its edge, **then** its start or end changes and is saved.
- **Given** a keyboard user on a selected event, **when** they use the resize controls, **then** they can change its end time without a mouse.
- **Given** end is before start, **when** I save, **then** the end field shows an error and nothing is saved.

**Implementation notes**
- API: `POST /meetings`, `PUT /meetings/:id`.
- Data: `meetings` (`start_at`, `end_at`, `all_day`, `color`, `location`, `description`, `recurrence`, `organizer_user_id`, `visibility`).
- UI: `@spine/ui` `Calendar` + `MiniCalendar`; `meetings-calendar.tsx`.
- Edge: external calendar sync is out of scope (D-028).

### US-MTG-02 · Switch calendar views and jump to a date
**Feature:** F-MTG-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `MeetingsWeek`, `MeetingsMonth`, `MeetingsAgenda`, `MeetingsEmpty`
**As** a member, **I want** day, week, month and agenda views and a mini calendar, **so that** I can see my time the way I need.

**Acceptance criteria**
- **Given** the calendar toolbar, **when** I choose "Day", "Week", "Month" or "Agenda", **then** the view changes and the heading shows the range (e.g. "October 4 – 10, 2026", "Upcoming from Oct 4, 2026").
- **Given** any view, **when** I press "Today" or the arrows, **then** the range moves to today or the previous/next range.
- **Given** the mini calendar, **when** I click a date, **then** the main view jumps to it.
- **Given** the sidebar toggle, **when** I press "Hide calendar sidebar", **then** the mini calendar and lists collapse and "Show calendar sidebar" restores them.
- **Given** no meetings in the range, **when** I view Agenda, **then** I see "No upcoming meetings in this range.".

**Implementation notes**
- API: `GET /meetings?from=&to=` (occurrences expanded server-side, exceptions applied).
- UI: sidebar lists "Upcoming" and "Meetings by contact".

### US-MTG-03 · Show or hide colleagues' calendars and my activities
**Feature:** F-MTG-01 · **Priority:** P2 · **Phase:** 1 · **Screens:** `MeetingsWeek`
**As** a member, **I want** to toggle each person's calendar and overlay my activities, **so that** I can compare schedules.

**Acceptance criteria**
- **Given** the "Calendars" list, **when** I untick a person, **then** meetings they organise or attend disappear from the view.
- **Given** I tick "My Activities", **when** the view renders, **then** my activities with follow-up dates appear as items on those days.
- **Given** the organisation has only me, **when** I open the list, **then** I see "No team members yet.".
- **Given** I hide a calendar, **when** I return later on this device, **then** the same calendars are hidden.

**Implementation notes**
- UI: per-person filters are client-side over meetings I'm already allowed to read.
- Edge: hiding a calendar never reveals meetings I can't read.

### US-MTG-04 · Link a meeting to a contact
**Feature:** F-MTG-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `MeetingEditorDetails`
**As** office staff, **I want** to link a meeting to a customer, **so that** it appears on their timeline.

**Acceptance criteria**
- **Given** the "Details" tab, **when** I pick a contact, **then** it's saved with the meeting.
- **Given** a meeting linked to a contact, **when** I open the contact's Timeline, **then** the meeting is listed.
- **Given** a meeting with no contact (internal), **when** I save, **then** it's accepted.
- **Given** the sidebar "Meetings by contact", **when** meetings in range are linked, **then** each contact is listed with its count; otherwise "No meetings linked to a contact in this range.".

**Implementation notes**
- Data: `meetings.contact_id` (nullable).

### US-MTG-05 · Invite specific colleagues privately
**Feature:** F-MTG-02 · **Priority:** P1 · **Phase:** 1 · **Screens:** `MeetingEditorPeople`
**As** a member, **I want** to invite chosen colleagues so only they and I can see the meeting, **so that** my calendar doesn't broadcast private matters.

Legacy: S-01.10

**Acceptance criteria**
- **Given** the "People" tab, **when** it opens for a new meeting, **then** "Visible to everyone in the org" is off with "Only you and invited attendees can see this meeting.".
- **Given** I pick a person in "Select people to invite…" and press "Add", **when** it's added, **then** they appear in the list below with a remove control.
- **Given** a private meeting, **when** a Staff or Field user who isn't the organiser or an invitee requests it, **then** it's absent from their calendar and `GET /meetings/:id` returns 404.
- **Given** an Owner, **when** they open the calendar, **then** they see every meeting, private or not.
- **Given** I save the invite list, **when** people were added, **then** each new invitee is notified (US-NTF-06).

**Implementation notes**
- API: `PUT /meetings/:id` with `attendeeUserIds` (replaces the list; service diffs added/removed).
- Data: `meeting_attendees` (`user_id` ON DELETE SET NULL; shows "Former member").
- Edge: attendees are series-level only; not editable per occurrence.

### US-MTG-06 · Make a meeting visible to the whole organisation
**Feature:** F-MTG-02 · **Priority:** P1 · **Phase:** 1 · **Screens:** `MeetingEditorPeople`
**As** a member, **I want** to show a meeting to everyone, **so that** team events appear on every calendar without inviting each person.

Legacy: S-01.11

**Acceptance criteria**
- **Given** the "People" tab, **when** I turn on "Visible to everyone in the org", **then** the helper changes to "Every org member can see this meeting.".
- **Given** an org-visible meeting, **when** any member opens the calendar, **then** they see it.
- **Given** an org-visible meeting, **when** a member who can see it but lacks edit rights opens it, **then** they can read it but not edit or delete it.

**Implementation notes**
- Data: `meetings.visibility` (`private` default, `org`).

### US-MTG-07 · Respond to a meeting invitation
**Feature:** F-MTG-02 · **Priority:** P1 · **Phase:** 1 · **Screens:** `MeetingQuickView`
**As** an invited attendee, **I want** to accept, decline or say maybe, **so that** the organiser knows who's coming.

Legacy: S-01.12

**Acceptance criteria**
- **Given** I'm invited, **when** I open the meeting's quick view, **then** "Your response" shows my current state and Accept, Decline and Tentative buttons.
- **Given** I choose a response, **when** it saves, **then** my state changes and the organiser sees it next to my name.
- **Given** I change an earlier response (e.g. accepted → declined), **when** it saves, **then** the organiser is notified; my very first response doesn't notify.
- **Given** the meeting has ended, **when** I open it, **then** responses can't be changed.
- **Given** I'm not invited, **when** I open the quick view, **then** no response buttons show.

**Implementation notes**
- API: `POST /meetings/:id/respond` (no capability; requires an attendee row).
- Data: `meeting_attendees.status`, `responded_at`.

### US-MTG-08 · Check a meeting's details in a quick view
**Feature:** F-MTG-03 · **Priority:** P1 · **Phase:** 1 · **Screens:** `MeetingQuickView`, `MeetingQuickViewRecurring`
**As** a member, **I want** clicking a meeting to show a small summary first, **so that** I don't open the full form just to check it.

Legacy: S-01.13

**Acceptance criteria**
- **Given** any calendar view, **when** I click a meeting, **then** a popover anchored to it shows title, date and time, recurrence description (e.g. "Weekly on weekdays"), location, contact, organiser and attendees with their responses.
- **Given** I may edit it, **when** the popover opens, **then** it shows Edit and Delete icon buttons, a "More options" menu and Close.
- **Given** I may only read it, **when** the popover opens, **then** Edit and Delete are replaced by a "View only" indicator.
- **Given** the popover is open, **when** I press Escape, **then** it closes and focus returns to the meeting.

**Implementation notes**
- UI: `meeting-quick-view-popover.tsx`; icon buttons have aria-labels ("Edit", "Delete", "More options", "Close").

### US-MTG-09 · Change or delete one occurrence or the whole series
**Feature:** F-MTG-03 · **Priority:** P2 · **Phase:** 1 · **Screens:** `MeetingScopeChoice`, `MeetingDeleteConfirm`
**As** a member editing a recurring meeting, **I want** to choose this event or all events, **so that** I can move one instance without disturbing the rest.

Legacy: S-01.14

**Acceptance criteria**
- **Given** a recurring meeting, **when** I choose Edit, **then** "Edit recurring event" asks "This is a recurring event. Do you want to edit just this event, or all events in the series?" with "Cancel", "This event" and "All events".
- **Given** I choose "This event" and change the time, **when** I save, **then** only that date moves; the series and other dates are unchanged.
- **Given** I choose "All events", **when** I save, **then** the series changes and the dialog says "Editing updates the entire series.".
- **Given** I delete with "This event", **when** I confirm "Delete this occurrence?", **then** only that date disappears; with "All events" and "Delete this meeting?" the whole series goes.
- **Given** I drag a recurring meeting, **when** I drop it, **then** "Move recurring event" asks the same choice.

**Implementation notes**
- API: `PUT/DELETE /meetings/:id` with `scope: "occurrence" | "series"` and `occurrenceDate`.
- Data: `meeting_occurrence_exceptions` (`modified` / `cancelled`).
- UI: `meeting-scope-choice-dialog.tsx`. "All events" must be a primary button, not danger (US-OPS-10, finding C4).
- Edge: no "this and following" option (D-024).

### US-MTG-10 · Duplicate a meeting
**Feature:** F-MTG-03 · **Priority:** P3 · **Phase:** 1 · **Screens:** `MeetingQuickView`
**As** a member, **I want** to copy a meeting, **so that** I can schedule a similar one quickly.

**Acceptance criteria**
- **Given** a meeting's quick view, **when** I choose "More options" › "Duplicate", **then** the new-event dialog opens pre-filled with its title, contact, length, location, notes, visibility and invitees.
- **Given** the duplicate, **when** I save, **then** a separate meeting is created and the original is unchanged.
- **Given** I cancel, **when** the dialog closes, **then** nothing is created.

**Implementation notes**
- API: `POST /meetings`.

### US-MTG-11 · Let a Team manage only the meetings it organises
**Feature:** F-MTG-04 · **Priority:** P1 · **Phase:** 4 · **Screens:** `MeetingQuickView`, `MeetingEditorDetails`
**As** an owner, **I want** own/others rights for meetings, **so that** scheduling access is tuned per Team.

Legacy: S-01.17

**Acceptance criteria**
- **Given** a member with `meetings.edit_own` only, **when** they open a meeting they organise, **then** they can edit it.
- **Given** the same member, **when** they open a meeting someone else organises, **then** Edit is hidden in the popover and calendar drag is disabled, and `PUT` returns 403.
- **Given** a member with `meetings.delete_others`, **when** they delete a colleague's meeting, **then** it's deleted.
- **Given** a member without `meetings.edit_own`, **when** they drag on empty calendar time, **then** no new-event dialog opens.

**Implementation notes**
- API: service-layer ownership check on `organizer_user_id`.
- UI: `meetings-calendar.tsx` derives own/others per event from `useCapabilities()` (hooks can't run per event).

### US-MTG-12 · Keep meeting visibility independent of management rights
**Feature:** F-MTG-04 · **Priority:** P1 · **Phase:** 4 · **Screens:** `MeetingQuickView`
**As** an owner, **I want** management rights never to reveal private meetings, **so that** granting edit access doesn't leak anyone's calendar.

**Acceptance criteria**
- **Given** a Staff user with `meetings.edit_others`, **when** they list meetings, **then** private meetings they're not on are still absent.
- **Given** that user, **when** they request a private meeting by id, **then** they get 404.
- **Given** an attendee without any meeting capability, **when** they respond to their invite, **then** it works.

**Implementation notes**
- API: `MeetingsService` read filter applied before any capability check (D-024).

### US-MTG-13 · See which days have meetings in the mini calendar
**Feature:** F-MTG-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `MeetingsWeekRefined`, `MeetingsWeekRefinedDark`, `MeetingsMonthRefined`
**As** a member, **I want** the mini calendar to show which days are busy and where I am, **so that** I can find a free day or a meeting at a glance.

Decision: D-212

**Acceptance criteria**
- **Given** the mini calendar, **when** a day has at least one meeting I can see in a calendar that's ticked, **then** a single dot shows under its date (recurring meetings count on each day they occur; cancelled occurrences don't). With "My Activities" ticked, days with my follow-ups count too.
- **Given** a day with a dot, **when** I hover it or a screen reader reads it, **then** it says how many ("Wednesday, October 7, 2026, 2 meetings"); a day without one reads as before.
- **Given** the main view is Week or Day, **when** the mini calendar shows, **then** that week or day is shaded; the chosen date stays filled and today keeps its colour.
- **Given** I move the main view (arrows, Today, a mini calendar date) into another month, **when** it moves, **then** the mini calendar shows that month; **given** I page the mini calendar to another month, **when** it shows, **then** its dots load for that month.
- **Given** I untick a person's calendar, **when** the mini calendar redraws, **then** their meetings no longer add dots; dots never come from meetings I can't read.

**Implementation notes**
- UI: `MiniCalendar` (`@spine/ui`) takes `markedDates` (counts by day), `highlightRange` and a controlled `month` / `onMonthChange`; the page counts occurrences with `expandRecurringEvent` over the meetings it has loaded and loads the mini calendar's month when it's outside the loaded window.
- No API change (`GET /meetings?from=&to=`).

### US-MTG-14 · Start a meeting from a button, and open on the working day
**Feature:** F-MTG-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `MeetingsWeekRefined`, `MeetingQuickViewFits`
**As** office staff, **I want** a New meeting button and the calendar opened on my working hours, **so that** I can schedule without dragging and see my day without scrolling.

Decision: D-212

**Acceptance criteria**
- **Given** I may create meetings, **when** the calendar shows, **then** the toolbar has "New meeting"; pressing it opens the new-event dialog for 30 minutes from the next half hour today, or from 9:00 AM on the shown day when that isn't today. Without the right to create meetings, there's no button (US-MTG-11).
- **Given** Week or Day view, **when** it opens or I switch to it, **then** it's scrolled so 8 AM is at the top, or, when the view includes today and it's later than 9 AM, so the hour before now is at the top.
- **Given** today is in the Week or Day view, **when** it shows, **then** a line in the overdue colour marks the current time on today's column and moves as time passes; other days have none.
- **Given** a meeting near the bottom or right edge of the window, **when** I open its quick view, **then** the popover flips or shifts so all of it, attendees included, stays inside the window.

**Implementation notes**
- UI: `Calendar` (`@spine/ui`) gains a toolbar slot for the button and a way to open its create dialog with a start and end, a scroll-to-hour on Week and Day, and the now line; the quick view's `PopoverContent` uses collision padding, and shows a placeholder attendee row while attendees load so it's placed at its full height from the start (it used to open short, run past the window for a frame, then jump).

### US-MTG-15 · Get to a meeting or a contact from the sidebar lists
**Feature:** F-MTG-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `MeetingsWeekRefined`
**As** a member, **I want** the sidebar lists to say when things are and take me there, **so that** they're worth reading.

Decision: D-212

**Acceptance criteria**
- **Given** "Upcoming", **when** it shows, **then** it lists my next 8 meetings from now in the calendars that are ticked, each with its day and time ("Today · 2:00 PM", "Tomorrow · 9:00 AM", "Tue 13 Oct · 9:00 AM", "Fri 16 Oct · All day"); recurring meetings list each occurrence. With none in the next 60 days it says "Nothing in the next 60 days."
- **Given** an upcoming meeting, **when** I press its title, **then** the calendar moves to its day and opens its quick view; the attendees button still opens the attendees panel.
- **Given** "Meetings by contact", **when** it shows, **then** it counts the meetings in the range the calendar heading shows (the week, day or month), each contact links to its page, and with none it says "No meetings linked to a contact in this range."

**Implementation notes**
- UI: Upcoming reads from now to 60 days on, separate from the calendar's loaded window. No API change.

### US-MTG-16 · Come back to the same calendar view and date
**Feature:** F-MTG-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `MeetingsWeekRefined`, `MeetingsMonthRefined`
**As** a member, **I want** the calendar to keep its view and date in the address, **so that** Back, reload and bookmarks return me to the same place.

Decision: D-210, D-212

**Acceptance criteria**
- **Given** I change the view or the date, **when** it changes, **then** the address follows (for example `/meetings?view=month&date=2026-10-12`); the plain `/meetings` is the default.
- **Given** that address, **when** I reload, bookmark it or press Back from another page, **then** the same view and date show.
- **Given** `/meetings` with no view, **when** it opens, **then** it shows the view I last used on this device, on today.
- **Given** the dashboard's "Open calendar" (`?view=day`) or a meeting link (`?id=`), **when** it opens, **then** it works as before (US-DASH-16, US-NTF-06).

**Implementation notes**
- UI: `useSearchParams` and `router.replace`, as on Contacts (D-210); the last view in local storage.

### US-MTG-17 · Use the calendar on any screen size
**Feature:** F-MTG-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `MeetingsAgendaRefined`, `MeetingsPhone`
**As** a member on a laptop or a phone, **I want** the calendar to fit my screen, **so that** I can read it without fighting the layout.

Decision: D-212

**Acceptance criteria**
- **Given** a window 1024 px or wider, **when** the calendar shows, **then** it and the sidebar run to the bottom of the window, with no page scroll at 1280 × 800.
- **Given** a window under 768 px, **when** `/meetings` opens with no view in the address, **then** it opens in Agenda; the toolbar wraps (Today, the arrows and the range on one row, the views on the next) and nothing scrolls sideways. Week isn't offered there; an address asking for Week shows Day.
- **Given** a window under 1024 px, **when** the calendar shows, **then** a "Mini calendar" button above it opens the mini calendar and the Calendars list in a sheet.
- **Given** Agenda, **when** a meeting row shows, **then** it has the time (or "All day"), title, location and contact; pressing it opens the quick view.

**Implementation notes**
- UI: `meetings-calendar.tsx` measures its height like the pipeline board (`useFillHeight`); `Calendar`'s toolbar wraps; Agenda rows take location and contact names from the page.
- Edge: the app's left navigation has no phone layout yet, so on a phone it has to be collapsed; a phone layout for the app shell is outside this story.
- Superseded under 768px by US-MTG-18 (D-283): a phone opens on the month with the day's meetings, and the toolbar is one row.

### US-MTG-18 · Use a calendar made for my phone
**Feature:** F-MTG-06 · **Priority:** P1 · **Phase:** 12 · **Screens:** `MeetingsPhoneMonth`, `MeetingsPhoneDay`, `MeetingsPhoneMonthDark`
**As** an owner between site visits, **I want** my calendar to work like my phone's, **so that** I can see my week and book a meeting with my thumb.

Decision: D-283

**Acceptance criteria**
- **Given** a window under 768px, **when** `/meetings` opens with no view in the address, **then** it shows the month as a compact grid (one letter per weekday), today circled, a dot under each day that has meetings (up to three, in their calendars' colours, with the number for screen readers), and the chosen day's meetings listed under the grid with their time (or "All day"), title, location and contact.
- **Given** the month, **when** I tap a day, **then** it's chosen and its meetings show under the grid; when I swipe the grid left or right, or tap the arrows, **then** the next or previous month shows; Today returns to today.
- **Given** Day, **when** I choose it, **then** a strip of the week's seven days (with their dots) sits over a timeline of the chosen day, scrolled to the working day or to now; swiping the strip moves a week, swiping the timeline moves a day, and a line marks now.
- **Given** the toolbar, **when** it shows, **then** it's one row: the month and year (tapping it picks another), Today, and Month · Day · Agenda as a segmented control; the mini calendar and Calendars list open from the top bar.
- **Given** Agenda, **when** I choose it, **then** it works as US-MTG-17 describes.
- **Given** the + button, **when** I tap it, **then** New meeting opens as a full-screen sheet (US-OPS-60) on the chosen day, at the next half hour.
- **Given** a meeting in any view, **when** I tap it, **then** its quick view opens as a bottom sheet.

**Implementation notes**
- `Calendar` in `@spine/ui` gains a phone month (dots and a day list) and a week strip for Day; swiping uses pointer events, with the arrows for keyboard and switch users; reduced motion turns off the slide. `meetings-calendar.tsx`'s phone default changes from Agenda to the month.
