"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addMonths } from "date-fns";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Calendar,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  MiniCalendar,
  Popover,
  PopoverAnchor,
  PopoverContent,
  isOccurrenceAlreadyModified,
  type CalendarEvent,
  type CalendarEventInstance,
  type CalendarView,
} from "@spine/ui";
import { ChevronDown, PanelRightClose, PanelRightOpen, Users, X } from "lucide-react";
import { useSession } from "../../../lib/auth-client";
import { apiClient } from "../../../lib/api-client";
import { useCapabilities } from "../../../lib/capabilities-context";
import type { Activity, ActivityType, Contact } from "../contacts/types";
import { MeetingAttendeesFields } from "./meeting-attendees-fields";
import { MeetingAttendeesPanel } from "./meeting-attendees-panel";
import { MeetingQuickViewPopover } from "./meeting-quick-view-popover";
import { MeetingScopeChoiceDialog } from "./meeting-scope-choice-dialog";
import type { Meeting, MeetingAttendee } from "./types";

const SIDEBAR_STORAGE_KEY = "spine.meetings.sidebar-collapsed";
const MEMBERS_STORAGE_KEY = "spine.meetings.hidden-organizers";
const ACTIVITIES_VISIBLE_KEY = "spine.meetings.show-activities";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
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
    // PRD S-01.14 — carries per-occurrence overrides/cancellations through
    // to @spine/ui's expandRecurringEvent, which consults this to skip
    // cancelled dates and apply modified overrides during expansion.
    occurrenceExceptions: (meeting.occurrenceExceptions ?? []).map((exception) => ({
      occurrenceDate: new Date(exception.occurrenceDate),
      status: exception.status,
      start: exception.startAt ? new Date(exception.startAt) : undefined,
      end: exception.endAt ? new Date(exception.endAt) : undefined,
      title: exception.title ?? undefined,
      location: exception.location ?? undefined,
      description: exception.description ?? undefined,
    })),
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

/**
 * CalendarEvent (Date objects) -> the API's create/update payload shape
 * (ISO strings). `extra` is whatever MeetingAttendeesFields last reported
 * via Calendar's renderExtraFields slot ({visibility, attendeeUserIds}) —
 * present when this event came from the create/edit dialog's Save button,
 * absent for a drag-move/resize (Calendar's onEventUpdate fires identically
 * for both, but only the dialog path renders extra fields at all), in
 * which case visibility/attendeeUserIds are simply omitted from the
 * payload so the API's update() leaves them untouched.
 */
function toMeetingPayload(
  event: CalendarEvent,
  extra?: Record<string, unknown>,
  scope?: "series" | "occurrence",
  occurrenceDate?: Date,
) {
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
    ...(extra?.visibility !== undefined ? { visibility: extra.visibility } : {}),
    ...(extra?.attendeeUserIds !== undefined ? { attendeeUserIds: extra.attendeeUserIds } : {}),
    ...(scope === "occurrence" ? { scope, occurrenceDate: occurrenceDate?.toISOString() } : {}),
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
  const { data: session } = useSession();
  const { capabilities } = useCapabilities();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const activityDetailAnchorRef = useRef<HTMLElement | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ eventId: string; scope?: "series" | "occurrence"; occurrenceDate?: Date } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [attendeesPanel, setAttendeesPanel] = useState<Meeting | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // PRD S-01.13/S-01.14 — quick-view popover state and its attendee cache
  // (fetched lazily per popover open, not eagerly for every visible
  // meeting), plus the scope-choice alert shown before Edit/Delete on a
  // recurring meeting.
  const [popoverAttendees, setPopoverAttendees] = useState<Record<string, MeetingAttendee[]>>({});
  const [scopeChoice, setScopeChoice] = useState<
    | { action: "edit"; onEdit: (scope?: "series" | "occurrence") => void; onDelete: (scope?: "series" | "occurrence") => void }
    | { action: "delete"; onEdit: (scope?: "series" | "occurrence") => void; onDelete: (scope?: "series" | "occurrence") => void }
    // PRD S-01.14 — a completed drag-move or resize on a recurring
    // occurrence, deferred here the same way popover Edit/Delete already
    // are, before Calendar commits anything.
    | { action: "move"; onConfirm: (scope: "series" | "occurrence") => void; onCancel: () => void }
    | null
  >(null);
  const [duplicatePrefill, setDuplicatePrefill] = useState<CalendarEvent | null>(null);

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

  // S-10.20/S-10.21 — notification deep links land here as /meetings?id=...
  // (e.g. "you've been invited," "starting soon"). Fetches the specific
  // meeting directly rather than relying on it already being in the
  // currently-loaded ±2-month window, then opens its attendees panel and
  // strips the query param so a refresh doesn't reopen it. Depends on the
  // read `deepLinkId` value itself (not `searchParams`/`router`, whose
  // identity can churn on navigation) so this only re-runs when the id
  // in the URL actually changes.
  const deepLinkId = searchParams.get("id");
  useEffect(() => {
    if (!deepLinkId) return;
    apiClient
      .get<Meeting>(`/meetings/${deepLinkId}`)
      .then((meeting) => {
        setAttendeesPanel(meeting);
        router.replace("/meetings");
      })
      .catch(() => {
        // Meeting may have been deleted, or is no longer visible to this
        // user — silently drop the deep link rather than showing an error
        // for what's likely just a stale notification link.
        router.replace("/meetings");
      });
  }, [deepLinkId, router]);

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

  async function handleCreate(event: CalendarEvent, extra?: Record<string, unknown>) {
    const created = await apiClient.post<Meeting>("/meetings", toMeetingPayload(event, extra));
    setMeetings((prev) => (prev ? [...prev, created] : [created]));
  }

  async function handleUpdate(event: CalendarEvent, extra?: Record<string, unknown>, scope?: "series" | "occurrence", occurrenceDate?: Date) {
    if (scope === "occurrence") {
      // The series row's own id, not the client-synthesized instance —
      // `event.id` here is already `instance.event.id` (Calendar threads
      // the series event straight through), so this targets the right
      // meeting; the response is the upserted exception row, not a
      // `Meeting`, so refetch the series' own row to pick up the new
      // `occurrenceExceptions` entry rather than trying to merge it by hand.
      await apiClient.put(`/meetings/${event.id}`, toMeetingPayload(event, extra, scope, occurrenceDate));
      const refreshed = await apiClient.get<Meeting>(`/meetings/${event.id}`);
      setMeetings((prev) => prev?.map((m) => (m.id === refreshed.id ? refreshed : m)) ?? prev);
      return;
    }
    const updated = await apiClient.put<Meeting>(`/meetings/${event.id}`, toMeetingPayload(event, extra));
    setMeetings((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)) ?? prev);
  }

  /**
   * `Calendar`'s own `onEventDelete` (packages/ui) fires this immediately
   * on the user's delete action with no confirmation of its own — this
   * component is the right place to add one, rather than teaching the
   * shared `@spine/ui` Calendar about a confirmation flow every consumer
   * might want shaped differently. Same "AlertDialog for a real,
   * consequential yes/no" convention as every other delete confirmation
   * in this app (contacts, quotes, catalogue, teams). `scope`/`occurrenceDate`
   * (PRD S-01.14) come from the quick-view popover's scope-choice dialog for
   * a recurring meeting — undefined for a non-recurring one, matching
   * today's whole-meeting delete.
   */
  function handleDeleteRequest(eventId: string, scope?: "series" | "occurrence", occurrenceDate?: Date) {
    setDeleteError(null);
    setPendingDelete({ eventId, scope, occurrenceDate });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      if (pendingDelete.scope === "occurrence" && pendingDelete.occurrenceDate) {
        await apiClient.delete(
          `/meetings/${pendingDelete.eventId}?scope=occurrence&occurrenceDate=${encodeURIComponent(pendingDelete.occurrenceDate.toISOString())}`,
        );
        const refreshed = await apiClient.get<Meeting>(`/meetings/${pendingDelete.eventId}`);
        setMeetings((prev) => prev?.map((m) => (m.id === refreshed.id ? refreshed : m)) ?? prev);
      } else {
        await apiClient.delete(`/meetings/${pendingDelete.eventId}`);
        setMeetings((prev) => prev?.filter((m) => m.id !== pendingDelete.eventId) ?? prev);
      }
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this meeting.");
    } finally {
      setDeleteBusy(false);
    }
  }

  /**
   * PRD S-01.14 — shared by the popover's Edit/Delete buttons and
   * double-click (both reach `Calendar`'s built-in edit dialog through the
   * same `onEdit`/`onDelete` closure shape): on a recurring meeting with no
   * explicit scope yet, skip straight to "this event" if the occurrence is
   * already individually modified (no ambiguity left to ask about),
   * otherwise show the This event/All events choice.
   */
  function resolveEditOrDeleteScope(
    action: "edit" | "delete",
    instance: CalendarEventInstance,
    onEdit: (scope?: "series" | "occurrence") => void,
    onDelete: (scope?: "series" | "occurrence") => void,
  ) {
    if (!instance.isRecurring) {
      if (action === "edit") onEdit();
      else onDelete();
      return;
    }
    if (isOccurrenceAlreadyModified(instance.event, instance.originalOccurrenceStart, true)) {
      if (action === "edit") onEdit("occurrence");
      else onDelete("occurrence");
      return;
    }
    setScopeChoice({ action, onEdit, onDelete });
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
        onEventDelete={handleDeleteRequest}
        readOnlyEventIds={readOnlyEventIds}
        onReadOnlyEventClick={(instance, target) => {
          activityDetailAnchorRef.current = target ?? null;
          setActivityDetail(instance);
        }}
        duplicateRequest={duplicatePrefill ? { event: duplicatePrefill } : null}
        onRecurringMoveOrResize={(request, onConfirm, onCancel) => {
          setScopeChoice({ action: "move", onConfirm, onCancel });
        }}
        onEventDoubleClick={({ instance, onEdit, onDelete }) => {
          resolveEditOrDeleteScope("edit", instance, onEdit, onDelete);
        }}
        renderExtraFields={({ isEdit, event, setExtra }) => {
          if (!session?.user?.id) return null;
          const editingMeeting = isEdit ? (meetings?.find((m) => m.id === event?.id) ?? null) : null;
          return (
            <MeetingAttendeesFields
              meetingId={editingMeeting?.id ?? null}
              organizerUserId={editingMeeting?.organizerUserId ?? session.user.id}
              currentUserId={session.user.id}
              members={members}
              initialVisibility={editingMeeting?.visibility ?? "private"}
              setExtra={setExtra}
            />
          );
        }}
        renderEventPopover={({ instance, onEdit, onDelete, onClose }) => {
          if (!session?.user?.id) return null;
          const meeting = meetings?.find((m) => m.id === instance.event.id);
          if (!meeting) return null;
          if (!(meeting.id in popoverAttendees)) {
            apiClient
              .get<MeetingAttendee[]>(`/meetings/${meeting.id}/attendees`)
              .then((rows) => setPopoverAttendees((prev) => ({ ...prev, [meeting.id]: rows })))
              .catch(() => setPopoverAttendees((prev) => ({ ...prev, [meeting.id]: [] })));
          }
          // Own vs. others resolved manually here (rather than via the
          // useCanEditOwnership hook) because this is a plain callback
          // invoked during render, not a component — calling a hook inside
          // it would violate the Rules of Hooks the moment a different
          // meeting is rendered on a later call. Same "own" definition as
          // that hook: organizerUserId matching the session user, null/
          // unset counts as unowned. UI convenience only — MeetingsService
          // enforces the same rules server-side via requireOwnershipCapability.
          const isOwnMeeting = meeting.organizerUserId !== null && meeting.organizerUserId === session.user.id;
          const canEditMeeting = capabilities?.[isOwnMeeting ? "meetings.edit_own" : "meetings.edit_others"] ?? false;
          const canDeleteMeeting = capabilities?.[isOwnMeeting ? "meetings.delete_own" : "meetings.delete_others"] ?? false;
          return (
            <MeetingQuickViewPopover
              instance={instance}
              meeting={meeting}
              attendees={popoverAttendees[meeting.id] ?? null}
              currentUserId={session.user.id}
              canEdit={canEditMeeting}
              canDelete={canDeleteMeeting}
              contactLabel={meeting.contactId ? contactsById.get(meeting.contactId)?.name : undefined}
              organizerName={members.find((m) => m.userId === meeting.organizerUserId)?.name}
              onEdit={(scope) => {
                if (instance.isRecurring && !scope) {
                  onClose();
                  resolveEditOrDeleteScope("edit", instance, onEdit, onDelete);
                  return;
                }
                onEdit(scope);
              }}
              onDelete={(scope) => {
                if (instance.isRecurring && !scope) {
                  onClose();
                  resolveEditOrDeleteScope("delete", instance, onEdit, onDelete);
                  return;
                }
                onDelete(scope);
              }}
              onDuplicate={() => {
                setDuplicatePrefill({ ...instance.event, id: `${instance.event.id}-copy` });
                onClose();
              }}
              onAttendeesUpdated={(rows) => setPopoverAttendees((prev) => ({ ...prev, [meeting.id]: rows }))}
              onClose={onClose}
            />
          );
        }}
      />

      <MeetingScopeChoiceDialog
        open={!!scopeChoice}
        action={scopeChoice?.action ?? "edit"}
        onOpenChange={(open) => {
          if (open || !scopeChoice) return;
          if (scopeChoice.action === "move") scopeChoice.onCancel();
          setScopeChoice(null);
        }}
        onChoose={(chosenScope) => {
          if (!scopeChoice) return;
          const choice = scopeChoice;
          setScopeChoice(null);
          if (choice.action === "edit") {
            choice.onEdit(chosenScope);
          } else if (choice.action === "delete") {
            choice.onDelete(chosenScope);
          } else {
            choice.onConfirm(chosenScope);
          }
        }}
      />

      {sidebarCollapsed ? (
        <div className="hidden w-10 shrink-0 justify-center rounded-lg border border-border bg-surface pt-3 lg:flex">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            aria-label="Show calendar sidebar"
          >
            <PanelRightOpen size={16} />
          </Button>
        </div>
      ) : (
        <aside className="hidden w-72 shrink-0 flex-col gap-6 overflow-y-auto rounded-lg border border-border bg-surface p-4 lg:flex">
          <MiniCalendar
            selected={date}
            onSelect={setDate}
            headerAction={
              <Button variant="ghost" size="sm" onClick={toggleSidebar} aria-label="Hide calendar sidebar">
                <PanelRightClose size={16} />
              </Button>
            }
          />

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
            <h3 className="text-[13px] font-semibold text-on-surface">Upcoming</h3>
            {meetings === null ? (
              <p className="text-[13px] text-on-surface-muted">Loading…</p>
            ) : (
              (() => {
                const now = new Date();
                const upcoming = visibleMeetings
                  .filter((m) => new Date(m.endAt) >= now)
                  .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                  .slice(0, 8);
                if (upcoming.length === 0) {
                  return <p className="text-[13px] text-on-surface-muted">No upcoming meetings in this range.</p>;
                }
                return (
                  <ul className="flex flex-col gap-1.5">
                    {upcoming.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-[13px]">
                        <span className="min-w-0 flex-1 truncate text-on-surface">{m.title}</span>
                        {m.visibility === "org" && <Badge className="shrink-0">Org</Badge>}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 shrink-0 p-0"
                          aria-label={`Attendees for ${m.title}`}
                          onClick={() => setAttendeesPanel(m)}
                        >
                          <Users size={14} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </div>

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

      <Popover open={!!activityDetail} onOpenChange={(open) => !open && setActivityDetail(null)}>
        <PopoverAnchor virtualRef={activityDetailAnchorRef} />
        <PopoverContent align="start" side="right" className="w-72 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge>Activity</Badge>
                <h3 className="text-[14px] font-semibold text-on-surface">{activityDetail?.event.title}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                aria-label="Close"
                onClick={() => setActivityDetail(null)}
              >
                <X size={14} />
              </Button>
            </div>
            <p className="text-[13px] text-on-surface-muted">
              {activityDetail && `Due ${activityDetail.occurrenceStart.toLocaleString()}`}
            </p>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDelete?.scope === "occurrence" ? "Delete this occurrence?" : "Delete this meeting?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.scope === "occurrence"
                ? "This removes just this occurrence from the calendar for everyone. The rest of the series is unaffected. This cannot be undone."
                : "This removes it from the calendar for everyone. This cannot be undone."}
              {deleteError && <span className="mt-2 block text-overdue">{deleteError}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleteBusy} onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {attendeesPanel && session?.user?.id && (
        <MeetingAttendeesPanel
          meeting={attendeesPanel}
          members={members}
          currentUserId={session.user.id}
          onClose={() => setAttendeesPanel(null)}
          onSaved={(updated) => setMeetings((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)) ?? prev)}
        />
      )}
    </div>
  );
}
