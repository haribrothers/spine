"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, Button, Combobox, Field, Label, Switch } from "@spine/ui";
import { Trash2 } from "lucide-react";
import { useT } from "../../../lib/i18n";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
}

/**
 * PRD S-01.10/S-01.11 redesign — replaces the old private/org RadioGroup
 * with a single Switch ("Visible to everyone in the org"), and the old
 * instant-multiselect invitee picker with an explicit searchable-combobox +
 * Add flow: pick one person, click Add, they land in a list below with
 * their own remove control. Same two visibility values and same
 * attendeeUserIds array underneath — presentation-only change.
 *
 * Shared between the edit dialog's People tab (meeting-attendees-fields.tsx)
 * and the standalone "Manage attendees" panel (meeting-attendees-panel.tsx),
 * which previously duplicated this block almost verbatim.
 */
export function MeetingVisibilityAndInviteesEditor({
  visibility,
  onVisibilityChange,
  attendeeUserIds,
  onAttendeeUserIdsChange,
  members,
  excludeUserId,
}: {
  visibility: "private" | "org";
  onVisibilityChange: (visibility: "private" | "org") => void;
  attendeeUserIds: string[];
  onAttendeeUserIdsChange: (ids: string[]) => void;
  members: Member[];
  /** Organizer's own userId — never offered as an invitee (they're implicitly included). */
  excludeUserId: string;
}) {
  const t = useT();
  const [pendingUserId, setPendingUserId] = useState("");

  const invitableMembers = members.filter((m) => m.userId !== excludeUserId && !attendeeUserIds.includes(m.userId));
  const memberOptions = invitableMembers.map((m) => ({ value: m.userId, label: m.name }));
  const membersById = new Map(members.map((m) => [m.userId, m]));

  function handleAdd() {
    if (!pendingUserId) return;
    onAttendeeUserIdsChange([...attendeeUserIds, pendingUserId]);
    setPendingUserId("");
  }

  function handleRemove(userId: string) {
    onAttendeeUserIdsChange(attendeeUserIds.filter((id) => id !== userId));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
        <div>
          <Label htmlFor="meeting-visibility-org" className="font-medium">
            {t("meetings.visibility.label")}
          </Label>
          <p className="text-[12px] text-on-surface-muted">
            {visibility === "org" ? t("meetings.visibility.org") : t("meetings.visibility.private")}
          </p>
        </div>
        <Switch
          id="meeting-visibility-org"
          checked={visibility === "org"}
          onCheckedChange={(checked) => onVisibilityChange(checked ? "org" : "private")}
        />
      </div>

      <Field>
        <Label>{t("meetings.visibility.invite")}</Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Combobox
              options={memberOptions}
              value={pendingUserId}
              onValueChange={setPendingUserId}
              placeholder={t("meetings.visibility.invitePlaceholder")}
            />
          </div>
          <Button type="button" variant="secondary" disabled={!pendingUserId} onClick={handleAdd}>
            {t("meetings.visibility.add")}
          </Button>
        </div>
      </Field>

      {attendeeUserIds.length > 0 && (
        <ul className="flex flex-col gap-2">
          {attendeeUserIds.map((userId) => {
            const member = membersById.get(userId);
            return (
              <li key={userId} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px]">
                <Avatar size="sm">
                  <AvatarFallback>{(member?.name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-on-surface">{member?.name ?? t("meetings.visibility.unknownMember")}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-overdue hover:bg-overdue-bg"
                  aria-label={t("meetings.visibility.removeAria", { name: member?.name ?? t("meetings.visibility.person") })}
                  onClick={() => handleRemove(userId)}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
