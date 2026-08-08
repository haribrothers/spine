"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths } from "date-fns";
import {
  Alert,
  AlertDescription,
  Calendar,
  MiniCalendar,
  type CalendarEvent,
  type CalendarView,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import type { Contact } from "../contacts/types";
import type { Meeting } from "./types";

/** Meeting (API row, string dates) -> CalendarEvent (Date objects) for the Calendar component. */
function toCalendarEvent(meeting: Meeting): CalendarEvent {
  return {
    id: meeting.id,
    title: meeting.title,
    start: new Date(meeting.startAt),
    end: new Date(meeting.endAt),
    allDay: meeting.allDay,
    color: meeting.color,
    description: meeting.description ?? undefined,
    location: meeting.location ?? undefined,
    contactId: meeting.contactId ?? undefined,
    recurrence: meeting.recurrence
      ? {
          frequency: meeting.recurrence.frequency,
          interval: meeting.recurrence.interval,
          end:
            meeting.recurrence.end.type === "date"
              ? { type: "date", date: new Date(meeting.recurrence.end.date) }
              : meeting.recurrence.end,
        }
      : undefined,
  };
}

/** CalendarEvent (Date objects) -> the API's create/update payload shape (ISO strings). */
function toMeetingPayload(event: CalendarEvent) {
  return {
    contactId: event.contactId ?? null,
    title: event.title,
    startAt: event.start.toISOString(),
    endAt: event.end.toISOString(),
    allDay: event.allDay ?? false,
    color: event.color,
    description: event.description ?? null,
    location: event.location ?? null,
    recurrence: event.recurrence
      ? {
          frequency: event.recurrence.frequency,
          interval: event.recurrence.interval,
          end:
            event.recurrence.end.type === "date"
              ? { type: "date" as const, date: event.recurrence.end.date.toISOString() }
              : event.recurrence.end,
        }
      : null,
  };
}

/**
 * S-01.9 — the /meetings page's calendar. Composes the existing @spine/ui
 * Calendar (Day/Week/Month/Agenda, drag to create/move/resize, recurrence)
 * with a persistent right-side rail (MiniCalendar + a static "Calendars"
 * list, matching the reference layout the story was built from) rather
 * than Calendar's own built-in toolbar popover mini-calendar — the
 * reference design wants it always visible, not tucked behind a click.
 *
 * Meetings are fetched for a generous ±2-month window around the current
 * date (not a per-view-exact range) — computing Day/Week/Month/Agenda's
 * exact visible range would duplicate logic that's private to calendar.tsx,
 * and meeting volumes at this app's scale don't justify it. Re-fetches
 * whenever `date` moves outside the already-loaded window.
 */
export function MeetingsCalendar() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("week");
  const [date, setDate] = useState(new Date());
  const [loadedWindow, setLoadedWindow] = useState<{ from: Date; to: Date } | null>(null);

  const loadMeetings = useCallback((center: Date) => {
    const from = addMonths(center, -2);
    const to = addMonths(center, 2);
    apiClient
      .get<Meeting[]>(`/meetings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then((rows) => {
        setMeetings(rows);
        setLoadedWindow({ from, to });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load meetings."));
  }, []);

  useEffect(() => {
    // Runs on mount (loadedWindow is null) and again only once `date`
    // actually leaves the already-loaded ±2-month window — not on every
    // day/week step within it.
    if (!loadedWindow || date < loadedWindow.from || date > loadedWindow.to) {
      loadMeetings(date);
    }
  }, [date, loadedWindow, loadMeetings]);

  useEffect(() => {
    apiClient
      .get<Contact[]>("/contacts?includeArchived=true")
      .then(setContacts)
      .catch(() => setContacts([]));
  }, []);

  const contactOptions = useMemo(() => contacts.map((c) => ({ value: c.id, label: c.name })), [contacts]);
  const contactsById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const events = useMemo<CalendarEvent[]>(() => (meetings ?? []).map(toCalendarEvent), [meetings]);

  async function handleCreate(event: CalendarEvent) {
    const created = await apiClient.post<Meeting>("/meetings", toMeetingPayload(event));
    setMeetings((prev) => (prev ? [...prev, created] : [created]));
  }

  async function handleUpdate(event: CalendarEvent) {
    const updated = await apiClient.put<Meeting>(`/meetings/${event.id}`, toMeetingPayload(event));
    setMeetings((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)) ?? prev);
  }

  async function handleDelete(eventId: string) {
    await apiClient.delete(`/meetings/${eventId}`);
    setMeetings((prev) => prev?.filter((m) => m.id !== eventId) ?? prev);
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] gap-4">
      <Calendar
        className="min-w-0 flex-1"
        events={events}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        contactOptions={contactOptions}
        onEventCreate={handleCreate}
        onEventUpdate={handleUpdate}
        onEventDelete={handleDelete}
      />

      <aside className="hidden w-72 shrink-0 flex-col gap-6 overflow-y-auto rounded-lg border border-border bg-surface p-4 lg:flex">
        <MiniCalendar selected={date} onSelect={setDate} />

        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-on-surface">Meetings by contact</h3>
          {meetings === null ? (
            <p className="text-[13px] text-on-surface-muted">Loading…</p>
          ) : (
            (() => {
              const withContact = meetings.filter((m) => m.contactId);
              if (withContact.length === 0) {
                return <p className="text-[13px] text-on-surface-muted">No meetings linked to a contact in this range.</p>;
              }
              const counts = new Map<string, number>();
              for (const m of withContact) {
                if (m.contactId) counts.set(m.contactId, (counts.get(m.contactId) ?? 0) + 1);
              }
              return (
                <ul className="flex flex-col gap-1.5">
                  {[...counts.entries()].map(([contactId, count]) => (
                    <li key={contactId} className="flex items-center justify-between text-[13px]">
                      <span className="truncate text-on-surface">{contactsById.get(contactId)?.name ?? "Unknown contact"}</span>
                      <span className="shrink-0 text-on-surface-muted">{count}</span>
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </div>
      </aside>
    </div>
  );
}
