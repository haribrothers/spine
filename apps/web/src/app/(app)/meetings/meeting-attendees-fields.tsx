"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api-client";
import { MeetingVisibilityAndInviteesEditor } from "./meeting-visibility-and-invitees-editor";
import type { MeetingAttendee, MeetingVisibility } from "./types";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
}

/**
 * PRD S-01.10/S-01.11 — visibility + invitee picker rendered INLINE inside
 * @spine/ui's Calendar create/edit dialog, via its `renderExtraFields` slot
 * (a generic escape hatch, same "consumer-owned data the shared component
 * has no concept of" shape as `contactOptions`/`CalendarEvent.contactId`).
 * Kept meetings-app-local rather than baked into Calendar itself — see
 * meetings-calendar.tsx's own doc comment for why.
 *
 * Purely local state: `setExtra` reports the current `{visibility,
 * attendeeUserIds}` up to Calendar on every change, which threads through
 * to `onEventCreate`/`onEventUpdate`'s `extra` param — nothing here calls
 * the API directly, so create and edit both save in one action (the
 * dialog's own "Save" button), not a separate follow-up step. On edit,
 * seeds from the meeting's already-invited attendees (fetched once); on
 * create there's no meeting id yet, so it starts from the organizer-only
 * default (private, no one else invited).
 */
export function MeetingAttendeesFields({
  meetingId,
  organizerUserId,
  currentUserId,
  members,
  initialVisibility,
  setExtra,
}: {
  meetingId: string | null;
  organizerUserId: string | null;
  currentUserId: string;
  members: Member[];
  /** The meeting's actual current visibility in edit mode — always "private" in create mode, matching the server's own create-time default. Without this, editing an org-visibility meeting without touching this section would silently flip it back to private on save. */
  initialVisibility: MeetingVisibility;
  setExtra: (extra: Record<string, unknown>) => void;
}) {
  const [visibility, setVisibilityState] = useState<MeetingVisibility>(initialVisibility);
  const [attendeeUserIds, setAttendeeUserIdsState] = useState<string[]>([]);

  // `setExtra` is a fresh closure on every parent render (it's created
  // inline inside Calendar's `renderExtraFields` call), so it can't safely
  // be a dependency of a useEffect without either an infinite loop or a
  // lint-suppressed stale-closure risk. Reporting the new value directly
  // from each change handler sidesteps both — no effect needed at all.
  function setVisibility(next: MeetingVisibility) {
    setVisibilityState(next);
    setExtra({ visibility: next, attendeeUserIds });
  }

  function setAttendeeUserIds(next: string[]) {
    setAttendeeUserIdsState(next);
    setExtra({ visibility, attendeeUserIds: next });
  }

  useEffect(() => {
    // Re-seed on every distinct meetingId (including switching from one
    // edit session to a fresh create, or vice versa) — this component
    // instance is reused across dialog opens (Calendar doesn't remount
    // it, only its `state` prop changes), so useState's initial value
    // alone only applies once, on the very first mount.
    setVisibilityState(initialVisibility);
    setAttendeeUserIdsState([]);
    // Report the starting state immediately, even before any field is
    // touched or (for edit mode) the attendee fetch resolves — otherwise
    // clicking Save without touching this section at all would leave
    // `extra` undefined and silently omit visibility/attendeeUserIds from
    // the payload, relying on the server's own default matching by
    // coincidence rather than actually reporting the real current state.
    setExtra({ visibility: initialVisibility, attendeeUserIds: [] });
    if (!meetingId) return;
    apiClient
      .get<MeetingAttendee[]>(`/meetings/${meetingId}/attendees`)
      .then((rows) => {
        const ids = rows.filter((r) => r.userId && r.userId !== organizerUserId).map((r) => r.userId as string);
        setAttendeeUserIdsState(ids);
        setExtra({ visibility: initialVisibility, attendeeUserIds: ids });
      })
      .catch(() => {
        // Best-effort prefill — if this fails, the picker just starts
        // empty rather than blocking the dialog from being usable.
      });
    // Intentionally keyed on meetingId + initialVisibility only (both
    // stable primitives for a given meeting) — organizerUserId is static
    // alongside them, and pulling the live `visibility` state or the
    // per-render `setExtra` closure into the deps would refetch on every
    // keystroke elsewhere in the dialog instead of once per distinct
    // meeting.
  }, [meetingId, initialVisibility]);

  const organizerId = organizerUserId ?? currentUserId;

  return (
    <div className="rounded-md border border-border p-3">
      <MeetingVisibilityAndInviteesEditor
        visibility={visibility}
        onVisibilityChange={setVisibility}
        attendeeUserIds={attendeeUserIds}
        onAttendeeUserIdsChange={setAttendeeUserIds}
        members={members}
        excludeUserId={organizerId}
      />
    </div>
  );
}
