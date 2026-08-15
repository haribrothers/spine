"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { STATUS_CLASSNAME, STATUS_LABEL } from "./meeting-attendee-status";
import { MeetingVisibilityAndInviteesEditor } from "./meeting-visibility-and-invitees-editor";
import type { Meeting, MeetingAttendee, MeetingVisibility } from "./types";
import { useMeetingRespond } from "./use-meeting-respond";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
}

/**
 * PRD S-01.10/S-01.11/S-01.12 — visibility + attendee management for a
 * single meeting. Deliberately meetings-app-local, not part of @spine/ui's
 * generic Calendar/CalendarEventEditor: attendees-with-response-status and
 * org/private visibility are meetings-domain concepts (mirroring the
 * `meeting_attendees` table, which doesn't exist for a generic calendar
 * event), and CLAUDE.md requires an apps/design-system doc-page update for
 * any @spine/ui component API change — real process cost for a feature
 * only this one page needs. See meetings-calendar.tsx's own doc comment
 * for the same reasoning already applied to its delete-confirmation flow.
 *
 * The organizer's own visibility/invite editing happens inline in the
 * create/edit dialog instead (see `MeetingAttendeesFields`, rendered via
 * Calendar's `renderExtraFields` slot) — this panel is reached from the
 * "Manage attendees" sidebar entry on an EXISTING meeting, for viewing
 * every attendee's response status and, for a non-organizer viewer with
 * their own invite, a self-service respond control. The organizer can
 * still edit visibility/attendees from here too, as a convenience
 * alternative to reopening the full edit dialog.
 */
export function MeetingAttendeesPanel({
  meeting,
  members,
  currentUserId,
  onClose,
  onSaved,
}: {
  meeting: Meeting;
  members: Member[];
  currentUserId: string;
  onClose: () => void;
  onSaved: (updated: Meeting) => void;
}) {
  const [visibility, setVisibility] = useState<MeetingVisibility>(meeting.visibility);
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>([]);
  const [attendees, setAttendees] = useState<MeetingAttendee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { respond: handleRespond, busy: respondBusy, error: respondError } = useMeetingRespond(meeting.id, setAttendees);

  const isOrganizer = meeting.organizerUserId === currentUserId;

  useEffect(() => {
    setLoading(true);
    apiClient
      .get<MeetingAttendee[]>(`/meetings/${meeting.id}/attendees`)
      .then((rows) => {
        setAttendees(rows);
        setAttendeeUserIds(rows.filter((r) => r.userId && r.userId !== meeting.organizerUserId).map((r) => r.userId as string));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load attendees."))
      .finally(() => setLoading(false));
  }, [meeting.id, meeting.organizerUserId]);

  const myAttendeeRow = attendees?.find((a) => a.userId === currentUserId);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiClient.put<Meeting>(`/meetings/${meeting.id}`, {
        visibility,
        attendeeUserIds,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage attendees</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          {(error || respondError) && (
            <Alert variant="critical">
              <AlertDescription>{error ?? respondError}</AlertDescription>
            </Alert>
          )}

          {!isOrganizer && myAttendeeRow && (
            <div className="flex flex-col gap-2 rounded-md border border-border-strong p-3">
              <p className="text-[13px] font-medium text-on-surface">Your response</p>
              <div className="flex gap-2">
                {(["accepted", "tentative", "declined"] as const).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={myAttendeeRow.status === status ? "primary" : "secondary"}
                    disabled={respondBusy}
                    onClick={() => handleRespond(status)}
                  >
                    {STATUS_LABEL[status]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {isOrganizer && (
            <MeetingVisibilityAndInviteesEditor
              visibility={visibility}
              onVisibilityChange={setVisibility}
              attendeeUserIds={attendeeUserIds}
              onAttendeeUserIdsChange={setAttendeeUserIds}
              members={members}
              excludeUserId={meeting.organizerUserId ?? currentUserId}
            />
          )}

          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : (
            attendees &&
            attendees.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-medium text-on-surface">Attendees</p>
                <ul className="flex flex-col gap-2">
                  {attendees.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-[13px]">
                      <Avatar size="sm">
                        <AvatarFallback>{(a.name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-on-surface">
                        {a.name ?? "Former member"}
                        {a.userId === meeting.organizerUserId && " (organizer)"}
                      </span>
                      <Badge className={STATUS_CLASSNAME[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {isOrganizer ? "Cancel" : "Close"}
          </Button>
          {isOrganizer && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
