"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths } from "date-fns";
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Calendar,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MiniCalendar,
  type CalendarEvent,
  type CalendarEventInstance,
  type CalendarView,
} from "@spine/ui";
import { ChevronDown, PanelRightClose, PanelRightOpen } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { Activity, ActivityType, Contact } from "../contacts/types";
import type { Meeting } from "./types";

const SIDEBAR_STORAGE_KEY = "spine.meetings.sidebar-collapsed";
const MEMBERS_STORAGE_KEY = "spine.meetings.hidden-organizers";
const ACTIVITIES_VISIBLE_KEY = "spine.meetings.show-activities";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  task: "Task",
};

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

/** Activity (with a dueAt) -> a read-only CalendarEvent marker — a single due-instant rendered as a short block, not a real time-ranged meeting. */
function activityToCalendarEvent(activity: Activity): CalendarEvent {
  const due = new Date(activity.dueAt as string);
  return {
    id: `activity-${activity.id}`,
    title: `${ACTIVITY_LABELS[activity.type]}${activity.notes ? `: ${activity.notes}` : ""}`,
    start: due,
    end: new Date(due.getTime() + 30 * 60000),
    color: "slate",
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
 * with a collapsible right-side rail: a persistent MiniCalendar, a
 * per-organizer "Calendars" checklist (Odoo-style — each org member's
 * meetings are toggleable, derived from real `organizerUserId` data and
 * `GET /org/members`, not a fabricated multi-calendar concept), and a "My
 * Activities" toggle overlaying activities with a due date as read-only
 * markers via Calendar's `readOnlyEventIds`/`onReadOnlyEventClick` (added
 * for this — activities have no end time/aren't draggable meetings, so
 * they render as inert markers with their own small detail popover rather
 * than opening the meeting editor).
 *
 * Meetings are fetched for a generous ±2-month window around the current
 * date (not a per-view-exact range) — computing Day/Week/Month/Agenda's
 * exact visible range would duplicate logic that's private to calendar.tsx,
 * and meeting volumes at this app's scale don't justify it. Re-fetches
 * whenever `date` moves outside the already-loaded window.
 */
export function MeetingsCalendar() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("week");
  const [date, setDate] = useState(new Date());
  const [loadedWindow, setLoadedWindow] = useState<{ from: Date; to: Date } | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [calendarsOpen, setCalendarsOpen] = useState(true);
  const [hiddenOrganizers, setHiddenOrganizers] = useState<Set<string>>(new Set());
  const [showActivities, setShowActivities] = useState(false);
  const [activityDetail, setActivityDetail] = useState<CalendarEventInstance | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const collapsed = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (collapsed === "1") setSidebarCollapsed(true);
    const hidden = window.localStorage.getItem(MEMBERS_STORAGE_KEY);
    if (hidden) {
      try {
        setHiddenOrganizers(new Set(JSON.parse(hidden)));
      } catch {
        // ignore malformed stored value
      }
    }
    const activitiesVisible = window.localStorage.getItem(ACTIVITIES_VISIBLE_KEY);
    if (activitiesVisible === "1") setShowActivities(true);
    // `date` itself is re-seeded here too (not just read from initial state)
    // — this component has occasionally been observed rendering server-side
    // with a `new Date()` several days behind the client's real clock in
    // long-running dev sessions (a Next.js dev-mode RSC staleness issue,
    // not app logic — the toolbar's week label is purely derived from
    // `date`, and the mini calendar's own month grid renders correctly).
    // Re-setting it post-mount, gated by `hydrated`, is a structural fix
    // regardless of that root cause: the calendar now only ever renders
    // using a client-computed "now," never a possibly-stale SSR one.
    setDate(new Date());
    setHydrated(true);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function toggleOrganizer(userId: string, visible: boolean) {
    setHiddenOrganizers((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(userId);
      else next.add(userId);
      window.localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function toggleAllOrganizers(visible: boolean) {
    setHiddenOrganizers(() => {
      const next = visible ? new Set<string>() : new Set(members.map((m) => m.userId));
      window.localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function toggleActivitiesVisible(visible: boolean) {
    setShowActivities(visible);
    window.localStorage.setItem(ACTIVITIES_VISIBLE_KEY, visible ? "1" : "0");
  }

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
    apiClient
      .get<Member[]>("/org/members")
      .then(setMembers)
      .catch(() => setMembers([]));
    apiClient
      .get<Activity[]>("/activities")
      .then(setActivities)
      .catch(() => setActivities([]));
  }, []);

  const contactOptions = useMemo(() => contacts.map((c) => ({ value: c.id, label: c.name })), [contacts]);
  const contactsById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const visibleMeetings = useMemo(
    () => (meetings ?? []).filter((m) => !m.organizerUserId || !hiddenOrganizers.has(m.organizerUserId)),
    [meetings, hiddenOrganizers],
  );

  const activityEvents = useMemo<CalendarEvent[]>(() => {
    if (!showActivities || !activities) return [];
    return activities.filter((a) => a.dueAt).map(activityToCalendarEvent);
  }, [showActivities, activities]);

  const readOnlyEventIds = useMemo(() => new Set(activityEvents.map((e) => e.id)), [activityEvents]);

  const events = useMemo<CalendarEvent[]>(
    () => [...visibleMeetings.map(toCalendarEvent), ...activityEvents],
    [visibleMeetings, activityEvents],
  );

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

  // Renders nothing date-dependent until after mount — `date` starts as a
  // fixed placeholder and is only ever set to a real `new Date()` client-side
  // (see the mount effect above), so SSR never emits text that could differ
  // from the client's own clock.
  if (!hydrated) {
    return <div className="h-[calc(100vh-220px)] min-h-[480px] animate-pulse rounded-lg border border-border bg-surface-sunken" />;
  }

  const allOrganizersVisible = hiddenOrganizers.size === 0;

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] gap-4">
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="self-end lg:self-auto"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Show calendar sidebar" : "Hide calendar sidebar"}
        >
          {sidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        </Button>
      </div>

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
        readOnlyEventIds={readOnlyEventIds}
        onReadOnlyEventClick={setActivityDetail}
      />

      {!sidebarCollapsed && (
        <aside className="hidden w-72 shrink-0 flex-col gap-6 overflow-y-auto rounded-lg border border-border bg-surface p-4 lg:flex">
          <MiniCalendar selected={date} onSelect={setDate} />

          <Collapsible open={calendarsOpen} onOpenChange={setCalendarsOpen}>
            <div className="flex items-center gap-2">
              <Checkbox checked={allOrganizersVisible} onCheckedChange={(v) => toggleAllOrganizers(v === true)} />
              <CollapsibleTrigger className="flex flex-1 items-center justify-between text-[13px] font-semibold text-on-surface">
                Calendars
                <ChevronDown size={14} className={calendarsOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-2 flex flex-col gap-2 pl-1">
              {members.length === 0 ? (
                <p className="text-[13px] text-on-surface-muted">No team members yet.</p>
              ) : (
                members.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 text-[13px]">
                    <Checkbox
                      checked={!hiddenOrganizers.has(member.userId)}
                      onCheckedChange={(v) => toggleOrganizer(member.userId, v === true)}
                    />
                    <Avatar size="sm">
                      <AvatarFallback>{member.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-on-surface">{member.name}</span>
                  </label>
                ))
              )}
            </CollapsibleContent>
          </Collapsible>

          <label className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
            <Checkbox checked={hydrated ? showActivities : false} onCheckedChange={(v) => toggleActivitiesVisible(v === true)} />
            My Activities
          </label>

          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-on-surface">Meetings by contact</h3>
            {meetings === null ? (
              <p className="text-[13px] text-on-surface-muted">Loading…</p>
            ) : (
              (() => {
                const withContact = visibleMeetings.filter((m) => m.contactId);
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
      )}

      <Dialog open={!!activityDetail} onOpenChange={(open) => !open && setActivityDetail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge>Activity</Badge>
              {activityDetail?.event.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-on-surface-muted">{activityDetail && `Due ${activityDetail.occurrenceStart.toLocaleString()}`}</p>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setActivityDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
