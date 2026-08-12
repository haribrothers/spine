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
  MultiSelect,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  cn,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import type { Meeting, MeetingAttendee, MeetingAttendeeStatus, MeetingVisibility } from "./types";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
}

const STATUS_LABEL: Record<MeetingAttendeeStatus, string> = {
  invited: "Invited",
  accepted: "Accepted",
  declined: "Declined",
  tentative: "Tentative",
};

/** Badge itself is intentionally neutral-toned (see its own doc comment — StatusChip is reserved for financial status), so attendee-response color is applied here via className rather than a Badge variant. */
const STATUS_CLASSNAME: Record<MeetingAttendeeStatus, string> = {
  invited: "",
  accepted: "bg-paid-bg text-paid",
  declined: "bg-overdue-bg text-overdue",
  tentative: "bg-due-soon-bg text-due-soon",
};

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
  const [respondBusy, setRespondBusy] = useState(false);

  const isOrganizer = meeting.organizerUserId === currentUserId;
  const memberOptions = members.filter((m) => m.userId !== meeting.organizerUserId).map((m) => ({ value: m.userId, label: m.name }));

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

  async function handleRespond(status: "accepted" | "declined" | "tentative") {
    setRespondBusy(true);
    setError(null);
    try {
      await apiClient.post(`/meetings/${meeting.id}/respond`, { status });
      const rows = await apiClient.get<MeetingAttendee[]>(`/meetings/${meeting.id}/attendees`);
      setAttendees(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your response.");
    } finally {
      setRespondBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage attendees</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
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
            <>
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-medium text-on-surface">Visibility</p>
                <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as MeetingVisibility)} className="gap-2">
                  <label
                    htmlFor="meeting-visibility-private"
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                      visibility === "private" ? "border-primary bg-primary/5" : "border-border-strong",
                    )}
                  >
                    <RadioGroupItem value="private" id="meeting-visibility-private" className="mt-0.5" />
                    <div>
                      <p className="text-[13px] font-medium text-on-surface">Private</p>
                      <p className="text-[12px] text-on-surface-muted">Only you and invited attendees can see this meeting.</p>
                    </div>
                  </label>
                  <label
                    htmlFor="meeting-visibility-org"
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                      visibility === "org" ? "border-primary bg-primary/5" : "border-border-strong",
                    )}
                  >
                    <RadioGroupItem value="org" id="meeting-visibility-org" className="mt-0.5" />
                    <div>
                      <p className="text-[13px] font-medium text-on-surface">Everyone in the org</p>
                      <p className="text-[12px] text-on-surface-muted">Every org member can see this meeting on their calendar.</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-medium text-on-surface">Invite people</p>
                <MultiSelect options={memberOptions} value={attendeeUserIds} onValueChange={setAttendeeUserIds} placeholder="Select people to invite…" />
              </div>
            </>
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
