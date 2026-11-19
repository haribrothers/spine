"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, addMonths, isSameMonth } from "date-fns";
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
  Drawer,
  DrawerBody,
  FloatingActionButton,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Popover,
  PopoverAnchor,
  PopoverContent,
  cn,
  expandEventsInRange,
  isOccurrenceAlreadyModified,
  type CalendarEvent,
  type CalendarEventInstance,
  type CalendarView,
} from "@spine/ui";
import { Building2, CalendarDays, ChevronDown, ListFilter, PanelRightClose, PanelRightOpen, Plus, Users, X } from "lucide-react";
import { replaceQuery } from "../../../lib/replace-query";
import { useSession } from "../../../lib/auth-client";
import { apiClient } from "../../../lib/api-client";
import { t as translate, useT } from "../../../lib/i18n";
import { useCapabilities } from "../../../lib/capabilities-context";
import type { Activity, ActivityType, Contact } from "../contacts/types";
import { MeetingAttendeesFields } from "./meeting-attendees-fields";
import { MeetingAttendeesPanel } from "./meeting-attendees-panel";
import { MeetingQuickViewPopover } from "./meeting-quick-view-popover";
import { MeetingScopeChoiceDialog } from "./meeting-scope-choice-dialog";
import type { Meeting, MeetingAttendee } from "./types";
import { useFillHeight } from "../../../lib/use-fill-height";
import { orgLocaleTag } from "../../../lib/money";
import { useToast } from "../../../components/toast-host";
import { SectionLink } from "../../../components/section-link";
import { usePhoneBarAction } from "../../../lib/phone-bar";
import {
  DEFAULT_VIEW,
  UPCOMING_DAYS,
  UPCOMING_LIMIT,
  calendarQuery,
  countByDay,
  isCalendarView,
  monthGrid,
  newMeetingRange,
  parseCalendarParams,
  rangeLabel,
  upcomingLabel,
  viewForWidth,
  visibleRange,
} from "./meetings-state";

const SIDEBAR_STORAGE_KEY = "spine.meetings.sidebar-collapsed";
const MEMBERS_STORAGE_KEY = "spine.meetings.hidden-organizers";
const ACTIVITIES_VISIBLE_KEY = "spine.meetings.show-activities";
/** US-MTG-16 — the last view used on this device. */
const VIEW_STORAGE_KEY = "spine.meetings.view";
const NARROW_QUERY = "(max-width: 767px)";
const COMPACT_QUERY = "(max-width: 1023px)";
const CALENDAR_MIN_HEIGHT = 480;

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: translate("meetings.calendar.activityType.call"),
  meeting: translate("meetings.calendar.activityType.meeting"),
  note: translate("meetings.calendar.activityType.note"),
  task: translate("meetings.calendar.activityType.task"),
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
 * **Capability gating** (user-reported: the create dialog used to open and
 * fail with a raw API 403 for anyone without `meetings.edit_own`, and a
 * meeting the viewer couldn't edit was still draggable/resizable and
 * double-click still jumped straight to the full edit dialog). Create is
 * gated by `canCreateEvents={canCreateMeetings}` — clicking/dragging empty
 * calendar space is fully inert without `meetings.edit_own`, so the
 * dialog never opens rather than opening and erroring on Save. Per-meeting
 * edit is gated by `nonEditableEventIds` (own/others resolved the same way
 * `renderEventPopover` already resolves it below) — Calendar suppresses
 * drag/resize/keyboard-resize for those ids but still routes click and
 * double-click through to `renderEventPopover`/`onEventDoubleClick` as
 * normal, so the quick-view popover — which already read-only-gates its
 * own Edit/Delete/Duplicate affordances — is reachable either way; the
 * double-click handler below additionally short-circuits to a no-op for a
 * non-editable meeting rather than opening the full edit dialog, since a
 * double-click's whole purpose is to skip straight past the popover.
 * `nonDeletableEventIds` (own/others resolved the same way against
 * `meetings.delete_own`/`delete_others`, independent of the edit grants
 * above) hides the built-in edit dialog's own Delete button — that
 * dialog is reachable whenever edit is allowed, so its Delete button
 * needed its own separate gate rather than assuming edit access implies
 * delete access (user-reported: it didn't check this at all before).
 *
 * Meetings are fetched for a generous ±2-month window around the current
 * date (not a per-view-exact range) — computing Day/Week/Month/Agenda's
 * exact visible range would duplicate logic that's private to calendar.tsx,
 * and meeting volumes at this app's scale don't justify it. Re-fetches
 * whenever `date` moves outside the already-loaded window.
 */
export function MeetingsCalendar() {
  const t = useT();
  const showToast = useToast();
  const { data: session } = useSession();
  const { capabilities } = useCapabilities();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("week");
  const [date, setDate] = useState(new Date());
  const [loadedWindow, setLoadedWindow] = useState<{ from: Date; to: Date } | null>(null);
  // US-MTG-13: the month the mini calendar shows (it follows `date`), and that month's meetings when they're outside the loaded window.
  const [miniMonth, setMiniMonth] = useState(new Date());
  const [miniMeetings, setMiniMeetings] = useState<{ key: string; rows: Meeting[] } | null>(null);
  // US-MTG-15: the next 60 days, separate from the calendar's window.
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[] | null>(null);
  // US-MTG-14/15: requests the Calendar acts on.
  const [createRequest, setCreateRequest] = useState<{ start: Date; end: Date } | null>(null);
  const [openRequest, setOpenRequest] = useState<{ eventId: string; occurrenceStart: Date } | null>(null);
  // US-MTG-17: phone (no Week, Agenda by default) and under 1024 px (mini calendar in a sheet).
  const [narrow, setNarrow] = useState(false);
  const [compact, setCompact] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const fill = useFillHeight({ minHeight: CALENDAR_MIN_HEIGHT });

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
    // US-MTG-16: the view and date from the address; else the last view on this device (Agenda on a phone), on today.
    // The dashboard's "Open calendar" (?view=day, US-DASH-16) is just such an address.
    const params = parseCalendarParams(new URLSearchParams(window.location.search));
    const isNarrow = window.matchMedia(NARROW_QUERY).matches;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    } catch {
      // storage unavailable; use the default
    }
    // US-MTG-18: the month on a phone (it was Agenda before the phone layout).
    const initialView = params.view ?? (isNarrow ? "month" : isCalendarView(stored) ? stored : DEFAULT_VIEW);
    const initialDate = params.date ?? new Date();
    setNarrow(isNarrow);
    setCompact(window.matchMedia(COMPACT_QUERY).matches);
    setView(viewForWidth(initialView, isNarrow));
    setDate(initialDate);
    setMiniMonth(initialDate);
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

  /** US-MTG-16: the address follows the view and date (no history entry per step). */
  function writeAddress(nextView: CalendarView, nextDate: Date) {
    const query = calendarQuery(nextView, nextDate, new Date());
    replaceQuery(pathname, query);
  }

  function changeView(next: CalendarView) {
    setView(next);
    writeAddress(next, date);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // storage unavailable; the address still has it
    }
  }

  function changeDate(next: Date) {
    setDate(next);
    writeAddress(view, next);
  }

  // US-MTG-13: the mini calendar follows the main view into another month.
  useEffect(() => {
    setMiniMonth((prev) => (isSameMonth(prev, date) ? prev : date));
  }, [date]);

  // US-MTG-17: follow the window's width (no Week on a phone).
  useEffect(() => {
    const narrowList = window.matchMedia(NARROW_QUERY);
    const compactList = window.matchMedia(COMPACT_QUERY);
    const onChange = () => {
      setNarrow(narrowList.matches);
      setCompact(compactList.matches);
      if (narrowList.matches) setView((prev) => viewForWidth(prev, true));
      if (!compactList.matches) setSheetOpen(false);
    };
    narrowList.addEventListener("change", onChange);
    compactList.addEventListener("change", onChange);
    return () => {
      narrowList.removeEventListener("change", onChange);
      compactList.removeEventListener("change", onChange);
    };
  }, []);

  const loadMeetings = useCallback((center: Date) => {
    const from = addMonths(center, -2);
    const to = addMonths(center, 2);
    apiClient
      .get<Meeting[]>(`/meetings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then((rows) => {
        setMeetings(rows);
        setLoadedWindow({ from, to });
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("meetings.calendar.loadFailed")));
  }, [t]);

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
      .get<Contact[]>("/contacts?picker=1&includeArchived=true")
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
  // US-MTG-16: dropping ?id= keeps the view and date in the address.
  const withoutId = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("id");
    const query = params.toString();
    return `/meetings${query ? `?${query}` : ""}`;
  };
  useEffect(() => {
    if (!deepLinkId) return;
    apiClient
      .get<Meeting>(`/meetings/${deepLinkId}`)
      .then((meeting) => {
        setAttendeesPanel(meeting);
        router.replace(withoutId());
      })
      .catch(() => {
        // Meeting may have been deleted, or is no longer visible to this
        // user — silently drop the deep link rather than showing an error
        // for what's likely just a stale notification link.
        router.replace(withoutId());
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

  // A meeting is non-editable for the current viewer when neither the own
  // nor others own/others capability applies — same "own" resolution as
  // renderEventPopover's own manual re-derivation below (organizerUserId
  // matching the session user, null/unset counts as unowned), computed
  // once here per meeting rather than per-callback since this is a plain
  // top-level memo, not a render-prop with Rules-of-Hooks constraints.
  const nonEditableEventIds = useMemo(() => {
    if (!session?.user?.id) return new Set<string>();
    const ids = new Set<string>();
    for (const meeting of visibleMeetings) {
      const isOwnMeeting = meeting.organizerUserId !== null && meeting.organizerUserId === session.user.id;
      const canEditMeeting = capabilities?.[isOwnMeeting ? "meetings.edit_own" : "meetings.edit_others"] ?? false;
      if (!canEditMeeting) ids.add(meeting.id);
    }
    return ids;
  }, [visibleMeetings, session?.user?.id, capabilities]);

  // Same own/others resolution as nonEditableEventIds above, but against
  // meetings.delete_own/delete_others — edit and delete are independent
  // grants, so a user with edit_own but not delete_own can reach the
  // built-in edit dialog (opened via the popover's own already-gated
  // Edit button) yet must still not see Delete inside it.
  const nonDeletableEventIds = useMemo(() => {
    if (!session?.user?.id) return new Set<string>();
    const ids = new Set<string>();
    for (const meeting of visibleMeetings) {
      const isOwnMeeting = meeting.organizerUserId !== null && meeting.organizerUserId === session.user.id;
      const canDeleteMeeting = capabilities?.[isOwnMeeting ? "meetings.delete_own" : "meetings.delete_others"] ?? false;
      if (!canDeleteMeeting) ids.add(meeting.id);
    }
    return ids;
  }, [visibleMeetings, session?.user?.id, capabilities]);

  const canCreateMeetings = capabilities?.["meetings.edit_own"] ?? false;
  // US-OPS-42: `?new=1` (search's "New meeting") opens the new-meeting form for the next half hour.
  const newParam = searchParams.get("new") === "1";
  useEffect(() => {
    if (newParam && canCreateMeetings) setCreateRequest(newMeetingRange(new Date(), new Date()));
  }, [newParam, canCreateMeetings]);

  const events = useMemo<CalendarEvent[]>(
    () => [...visibleMeetings.map(toCalendarEvent), ...activityEvents],
    [visibleMeetings, activityEvents],
  );

  const isVisible = useCallback((m: Meeting) => !m.organizerUserId || !hiddenOrganizers.has(m.organizerUserId), [hiddenOrganizers]);

  // US-MTG-13: dots for the mini calendar's month, from the loaded meetings when they cover it, else that month's own.
  const miniGrid = useMemo(() => monthGrid(miniMonth), [miniMonth]);
  const miniKey = miniGrid.start.toISOString();
  const miniCovered = Boolean(loadedWindow && miniGrid.start >= loadedWindow.from && addDays(miniGrid.end, 1) <= loadedWindow.to);
  useEffect(() => {
    if (!hydrated || miniCovered) return;
    const from = miniGrid.start;
    const to = addDays(miniGrid.end, 1);
    // Paging quickly asks for several months at once; an earlier month's answer arriving last mustn't replace this one's.
    let current = true;
    apiClient
      .get<Meeting[]>(`/meetings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then((rows) => current && setMiniMeetings({ key: miniKey, rows }))
      .catch(() => current && setMiniMeetings({ key: miniKey, rows: [] }));
    return () => {
      current = false;
    };
  }, [hydrated, miniCovered, miniGrid, miniKey, meetings]);
  const marks = useMemo(() => {
    const source = miniCovered ? visibleMeetings : miniMeetings?.key === miniKey ? miniMeetings.rows.filter(isVisible) : [];
    return countByDay([...source.map(toCalendarEvent), ...activityEvents], miniGrid.start, miniGrid.end);
  }, [miniCovered, visibleMeetings, miniMeetings, miniKey, isVisible, activityEvents, miniGrid]);
  const markLabel = useCallback(
    (n: number) => (showActivities ? t("meetings.calendar.markWithActivities", { count: n }) : t("meetings.calendar.mark", { count: n })),
    [showActivities, t],
  );

  // US-MTG-15: the next meetings from now, refreshed whenever the calendar's meetings change.
  useEffect(() => {
    if (!hydrated) return;
    const from = new Date();
    const to = addDays(from, UPCOMING_DAYS);
    apiClient
      .get<Meeting[]>(`/meetings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then(setUpcomingMeetings)
      .catch(() => setUpcomingMeetings([]));
  }, [hydrated, meetings]);
  const upcoming = useMemo(() => {
    if (!upcomingMeetings) return null;
    const now = new Date();
    const byId = new Map(upcomingMeetings.map((m) => [m.id, m]));
    return expandEventsInRange(upcomingMeetings.filter(isVisible).map(toCalendarEvent), now, addDays(now, UPCOMING_DAYS))
      .filter((i) => i.occurrenceEnd >= now)
      .sort((a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime())
      .slice(0, UPCOMING_LIMIT)
      .map((instance) => ({ instance, meeting: byId.get(instance.event.id)! }));
  }, [upcomingMeetings, isVisible]);

  // US-MTG-15: meetings by contact in the range the heading shows.
  const contactCounts = useMemo(() => {
    const range = visibleRange(view, date);
    const counts = new Map<string, number>();
    const linked = visibleMeetings.filter((m) => m.contactId).map(toCalendarEvent);
    for (const instance of expandEventsInRange(linked, range.start, addDays(range.end, 1))) {
      const id = instance.event.contactId;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [visibleMeetings, view, date]);

  function openUpcoming(instance: CalendarEventInstance) {
    changeDate(instance.occurrenceStart);
    setSheetOpen(false);
    setOpenRequest({ eventId: instance.event.id, occurrenceStart: instance.occurrenceStart });
  }

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
    const title = meetings?.find((m) => m.id === pendingDelete.eventId)?.title ?? t("meetings.calendar.theMeeting");
    try {
      if (pendingDelete.scope === "occurrence" && pendingDelete.occurrenceDate) {
        await apiClient.delete(
          `/meetings/${pendingDelete.eventId}?scope=occurrence&occurrenceDate=${encodeURIComponent(pendingDelete.occurrenceDate.toISOString())}`,
        );
        const refreshed = await apiClient.get<Meeting>(`/meetings/${pendingDelete.eventId}`);
        setMeetings((prev) => prev?.map((m) => (m.id === refreshed.id ? refreshed : m)) ?? prev);
        const day = pendingDelete.occurrenceDate.toLocaleDateString(orgLocaleTag(), { weekday: "short", day: "numeric", month: "short" });
        showToast(t("meetings.calendar.deleted"), t("meetings.calendar.deletedOccurrence", { title, day }));
      } else {
        await apiClient.delete(`/meetings/${pendingDelete.eventId}`);
        setMeetings((prev) => prev?.filter((m) => m.id !== pendingDelete.eventId) ?? prev);
        showToast(t("meetings.calendar.deleted"), t(pendingDelete.scope === "series" ? "meetings.calendar.deletedSeries" : "meetings.calendar.deletedOne", { title }));
      }
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("meetings.calendar.deleteFailed"));
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
  // US-MTG-18: on a phone the mini calendar and Calendars open from the top bar; + floats.
  usePhoneBarAction(
    narrow ? (
      <button
        type="button"
        aria-label={t("meetings.calendar.calendars")}
        aria-haspopup="dialog"
        onClick={() => setSheetOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ListFilter size={22} aria-hidden />
      </button>
    ) : null,
    [narrow],
  );

  if (!hydrated) {
    return <div ref={fill.ref} style={fill.height ? { height: fill.height } : undefined} className="min-h-[480px] animate-pulse rounded-lg border border-border bg-surface-sunken" />;
  }

  const allOrganizersVisible = hiddenOrganizers.size === 0;

  /** The sidebar's sections: beside the calendar from 1024 px, in a sheet below that (US-MTG-17). */
  function renderSidebar(inSheet: boolean) {
    return (
      <>
          {/* US-MTG-18: on a phone the month view is the calendar; the sheet holds the rest. */}
          {!narrow && (
          <MiniCalendar
            selected={date}
            onSelect={(picked) => {
              changeDate(picked);
              setSheetOpen(false);
            }}
            month={miniMonth}
            onMonthChange={setMiniMonth}
            marks={marks}
            markLabel={markLabel}
            highlight={view === "week" || view === "day" ? visibleRange(view, date) : undefined}
            headerAction={
              inSheet ? undefined : (
                <Button variant="ghost" size="sm" onClick={toggleSidebar} aria-label={t("meetings.calendar.hideSidebar")}>
                  <PanelRightClose size={16} />
                </Button>
              )
            }
          />
          )}

          <Collapsible open={calendarsOpen} onOpenChange={setCalendarsOpen}>
            <div className="flex items-center gap-2">
              <Checkbox checked={allOrganizersVisible} onCheckedChange={(v) => toggleAllOrganizers(v === true)} aria-label={t("meetings.calendar.showEveryCalendar")} />
              <CollapsibleTrigger className="flex flex-1 items-center justify-between text-[13px] font-semibold text-on-surface">
                {t("meetings.calendar.calendars")}
                <ChevronDown size={14} className={calendarsOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-2 flex flex-col gap-2 pl-1">
              {members.length === 0 ? (
                <p className="text-[13px] text-on-surface-muted">{t("meetings.calendar.noMembers")}</p>
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
            {t("meetings.calendar.myActivities")}
          </label>

          <section className="flex flex-col gap-1.5" aria-labelledby="upcoming-heading" data-testid="meetings-upcoming">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="upcoming-heading" className="text-[13px] font-semibold text-on-surface">
                {t("meetings.calendar.upcoming")}
              </h3>
              <span className="text-[12px] text-on-surface-muted">{t("meetings.calendar.nextDays", { days: UPCOMING_DAYS })}</span>
            </div>
            {upcoming === null ? (
              <p className="text-[13px] text-on-surface-muted">{t("meetings.calendar.loading")}</p>
            ) : upcoming.length === 0 ? (
              <p className="text-[13px] text-on-surface-muted">{t("meetings.calendar.nothingUpcoming", { days: UPCOMING_DAYS })}</p>
            ) : (
              <ul className="-mx-1.5 flex flex-col">
                {upcoming.map(({ instance, meeting }) => {
                  const when = upcomingLabel(instance.occurrenceStart, instance.event.allDay ?? false, new Date());
                  return (
                    <li key={instance.instanceId} className="flex items-start gap-1">
                      <button
                        type="button"
                        onClick={() => openUpcoming(instance)}
                        className="flex min-w-0 flex-1 flex-col rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-on-surface">{meeting.title}</span>
                          {meeting.visibility === "org" && <Badge className="shrink-0">{t("meetings.calendar.org")}</Badge>}
                        </span>
                        <span className={cn("text-[12px]", when.startsWith(t("meetings.upcoming.today")) ? "font-medium text-primary" : "text-on-surface-muted")}>{when}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-0.5 h-7 w-7 shrink-0 p-0"
                        aria-label={t("meetings.calendar.attendeesFor", { title: meeting.title })}
                        onClick={() => setAttendeesPanel(meeting)}
                      >
                        <Users size={14} />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-1.5" aria-labelledby="by-contact-heading" data-testid="meetings-by-contact">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="by-contact-heading" className="text-[13px] font-semibold text-on-surface">
                {t("meetings.calendar.byContact")}
              </h3>
              <span className="text-[12px] text-on-surface-muted">{rangeLabel(view, date, new Date())}</span>
            </div>
            {meetings === null ? (
              <p className="text-[13px] text-on-surface-muted">{t("meetings.calendar.loading")}</p>
            ) : contactCounts.length === 0 ? (
              <p className="text-[13px] text-on-surface-muted">{t("meetings.calendar.noByContact")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {contactCounts.map(([contactId, count]) => (
                  <li key={contactId} className="flex items-center justify-between gap-2 text-[13px]">
                    <SectionLink href={`/contacts/${contactId}`} className="truncate font-medium text-primary hover:underline">
                      {contactsById.get(contactId)?.name ?? t("meetings.calendar.unknownContact")}
                    </SectionLink>
                    <span className="shrink-0 tabular-nums text-on-surface-muted">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
      </>
    );
  }

  return (
    <div ref={fill.ref} style={fill.height ? { height: fill.height } : undefined} className="flex min-h-[480px] gap-4 max-md:-mx-4" data-testid="meetings-calendar">
      <Calendar
        className="min-h-0 min-w-0 flex-1"
        events={events}
        view={view}
        onViewChange={changeView}
        date={date}
        onDateChange={changeDate}
        views={narrow ? ["month", "day", "agenda"] : undefined}
        createRequest={createRequest}
        openRequest={openRequest}
        toolbarAction={
          narrow ? undefined : (
          <>
            {compact && (
              <Button variant="secondary" size="icon" className="h-8 w-8" aria-label={t("meetings.calendar.miniCalendar")} onClick={() => setSheetOpen(true)}>
                <CalendarDays size={16} aria-hidden />
              </Button>
            )}
            {canCreateMeetings && (
              <Button size="sm" onClick={() => setCreateRequest(newMeetingRange(date, new Date()))} aria-label={t("meetings.calendar.newMeeting")}>
                <Plus size={14} aria-hidden />
                {narrow ? t("meetings.calendar.new") : t("meetings.calendar.newMeeting")}
              </Button>
            )}
          </>
          )
        }
        agendaDetails={(instance) => {
          if (instance.event.id.startsWith("activity-")) return null;
          const contact = instance.event.contactId ? contactsById.get(instance.event.contactId) : undefined;
          return contact ? (
            <span className="flex items-center gap-1">
              <Building2 size={12} aria-hidden />
              {contact.name}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Users size={12} aria-hidden />
              {t("meetings.calendar.internal")}
            </span>
          );
        }}
        contactOptions={contactOptions}
        onEventCreate={handleCreate}
        onEventUpdate={handleUpdate}
        onEventDelete={handleDeleteRequest}
        readOnlyEventIds={readOnlyEventIds}
        onReadOnlyEventClick={(instance, target) => {
          activityDetailAnchorRef.current = target ?? null;
          setActivityDetail(instance);
        }}
        nonEditableEventIds={nonEditableEventIds}
        nonDeletableEventIds={nonDeletableEventIds}
        canCreateEvents={canCreateMeetings}
        duplicateRequest={duplicatePrefill ? { event: duplicatePrefill } : null}
        onRecurringMoveOrResize={(request, onConfirm, onCancel) => {
          setScopeChoice({ action: "move", onConfirm, onCancel });
        }}
        onEventDoubleClick={({ instance, onEdit, onDelete }) => {
          // A non-editable meeting's double-click must NOT reach the
          // built-in edit dialog — Calendar itself has no capability
          // concept, so this consumer-level check is the only gate. There
          // is no separate "read-only dialog" to open instead (per this
          // component's own design): the quick-view popover already IS
          // the read-only view, so a double-click on a non-editable
          // meeting is simply a no-op, same as clicking it once already
          // opens that same popover via renderEventPopover.
          if (nonEditableEventIds.has(instance.event.id)) return;
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

      {narrow && canCreateMeetings && (
        <FloatingActionButton className="[&>*]:w-[52px] [&>*]:px-0">
          <Button onClick={() => setCreateRequest(newMeetingRange(date, new Date()))} aria-label={t("meetings.calendar.newMeeting")}>
            <Plus aria-hidden />
          </Button>
        </FloatingActionButton>
      )}

      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent size="sm" aria-describedby={undefined}>
          <DrawerHeader>
            <DrawerTitle>{narrow ? t("meetings.calendar.calendars") : t("meetings.calendar.miniCalendar")}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="flex flex-col gap-5">{sheetOpen && renderSidebar(true)}</DrawerBody>
        </DrawerContent>
      </Drawer>

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
            aria-label={t("meetings.calendar.showSidebar")}
          >
            <PanelRightOpen size={16} />
          </Button>
        </div>
      ) : (
        <aside className="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto rounded-lg border border-border bg-surface p-4 lg:flex" aria-label={t("meetings.calendar.sidebar")}>
          {renderSidebar(false)}
        </aside>
      )}

      <Popover open={!!activityDetail} onOpenChange={(open) => !open && setActivityDetail(null)}>
        <PopoverAnchor virtualRef={activityDetailAnchorRef} />
        <PopoverContent align="start" side="right" className="w-72 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge>{t("meetings.calendar.activity")}</Badge>
                <h3 className="text-[14px] font-semibold text-on-surface">{activityDetail?.event.title}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                aria-label={t("meetings.calendar.close")}
                onClick={() => setActivityDetail(null)}
              >
                <X size={14} />
              </Button>
            </div>
            <p className="text-[13px] text-on-surface-muted">
              {activityDetail && t("meetings.calendar.due", { date: activityDetail.occurrenceStart.toLocaleString(orgLocaleTag()) })}
            </p>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDelete?.scope === "occurrence" ? t("meetings.calendar.deleteOccurrenceTitle") : t("meetings.calendar.deleteMeetingTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.scope === "occurrence"
                ? t("meetings.calendar.deleteOccurrenceDescription")
                : t("meetings.calendar.deleteMeetingDescription")}
              {deleteError && <span className="mt-2 block text-overdue">{deleteError}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>{t("meetings.calendar.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={deleteBusy} onClick={handleConfirmDelete}>
              {t("meetings.calendar.delete")}
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
