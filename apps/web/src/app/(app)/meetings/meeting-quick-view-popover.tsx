"use client";

import { format } from "date-fns";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  type CalendarEventInstance,
  type CalendarRecurrenceRule,
} from "@spine/ui";
import { Copy, Eye, MapPin, MoreVertical, Pencil, Repeat, Trash2, Users, X } from "lucide-react";
import { STATUS_CLASSNAME, STATUS_LABEL } from "./meeting-attendee-status";
import type { Meeting, MeetingAttendee } from "./types";
import { useMeetingRespond } from "./use-meeting-respond";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
}

/** "Weekly on weekdays"-style summary — not exact RFC 5545 text, just enough for a quick-glance popover. */
function describeRecurrence(rule: CalendarRecurrenceRule): string {
  const interval = rule.interval && rule.interval > 1 ? rule.interval : undefined;
  const unit = { daily: "day", weekly: "week", monthly: "month" }[rule.frequency];
  const cadence = interval ? `Every ${interval} ${unit}s` : `${{ daily: "Daily", weekly: "Weekly", monthly: "Monthly" }[rule.frequency]}`;
  const end =
    rule.end.type === "count" ? `, ${rule.end.count} times` : `, until ${format(rule.end.date, "MMM d, yyyy")}`;
  return `${cadence}${end}`;
}

/**
 * PRD S-01.13 — read-only quick-view popover shown before the full edit
 * dialog when a calendar event is clicked, rendered via @spine/ui Calendar's
 * `renderEventPopover` slot (Calendar owns the Popover chrome/positioning;
 * this component owns all meetings-domain content, same "app-local
 * composition" precedent as MeetingAttendeesFields/MeetingAttendeesPanel).
 *
 * Edit and Delete are gated independently — `canEdit` from
 * `meetings.edit_own`/`edit_others`, `canDelete` from `meetings.delete_own`/
 * `delete_others` (own vs. others resolved by the caller from
 * `meeting.organizerUserId`, see meetings-calendar.tsx's own comment on why
 * that happens there rather than via the shared `useCanEditOwnership` hook).
 * This is UI convenience only — the API independently re-checks both via
 * `requireOwnershipCapability` regardless of what's shown here. RSVP
 * buttons render only when the current user has their own attendee row
 * (self-service, no capability required — PRD S-01.12).
 */
export function MeetingQuickViewPopover({
  instance,
  meeting,
  attendees,
  currentUserId,
  canEdit,
  canDelete,
  contactLabel,
  organizerName,
  onEdit,
  onDelete,
  onDuplicate,
  onAttendeesUpdated,
  onClose,
}: {
  instance: CalendarEventInstance;
  meeting: Meeting;
  attendees: MeetingAttendee[] | null;
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  contactLabel?: string;
  organizerName?: string;
  onEdit: (scope?: "series" | "occurrence") => void;
  onDelete: (scope?: "series" | "occurrence") => void;
  onDuplicate: () => void;
  onAttendeesUpdated: (rows: MeetingAttendee[]) => void;
  onClose: () => void;
}) {
  const { event, occurrenceStart, occurrenceEnd, isRecurring } = instance;
  const { respond, busy: respondBusy } = useMeetingRespond(meeting.id, onAttendeesUpdated);
  const myAttendeeRow = attendees?.find((a) => a.userId === currentUserId);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-on-surface">{event.title}</h3>
        <div className="flex shrink-0 items-center gap-0.5">
          {canEdit ? (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Edit" onClick={() => onEdit(isRecurring ? undefined : "series")}>
              <Pencil size={14} />
            </Button>
          ) : (
            <span
              className="flex h-7 w-7 items-center justify-center text-on-surface-muted"
              aria-label="View only — you don't have permission to edit this meeting"
              title="View only"
            >
              <Eye size={14} />
            </span>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-overdue hover:bg-overdue-bg"
              aria-label="Delete"
              onClick={() => onDelete(isRecurring ? undefined : "series")}
            >
              <Trash2 size={14} />
            </Button>
          )}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="More options">
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy size={14} />
                  Duplicate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Close" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] text-on-surface-muted">
        <p>
          {event.allDay
            ? format(occurrenceStart, "EEEE, MMMM d")
            : `${format(occurrenceStart, "EEEE, MMMM d")} · ${format(occurrenceStart, "h:mm a")} – ${format(occurrenceEnd, "h:mm a")}`}
        </p>
        {event.recurrence && (
          <p className="flex items-center gap-1.5">
            <Repeat size={12} />
            {describeRecurrence(event.recurrence)}
          </p>
        )}
        {event.location && (
          <p className="flex items-center gap-1.5">
            <MapPin size={12} />
            {event.location}
          </p>
        )}
        {contactLabel && <p>Linked to {contactLabel}</p>}
        {organizerName && <p>Organized by {organizerName}</p>}
      </div>

      {!canEdit && myAttendeeRow && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-[12px] font-medium text-on-surface">Your response</p>
          <div className="flex gap-2">
            {(["accepted", "tentative", "declined"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={myAttendeeRow.status === status ? "primary" : "secondary"}
                disabled={respondBusy}
                onClick={() => respond(status)}
              >
                {STATUS_LABEL[status]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {attendees && attendees.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-on-surface">
            <Users size={12} />
            Attendees
          </p>
          <ul className="flex flex-col gap-1.5">
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
      )}
    </div>
  );
}

export function memberLabel(members: Member[], userId: string | null): string | undefined {
  return userId ? members.find((m) => m.userId === userId)?.name : undefined;
}
