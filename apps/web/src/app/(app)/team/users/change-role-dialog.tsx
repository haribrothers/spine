"use client";

import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@spine/ui";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import type { MemberRow } from "../../../../lib/members";
import { TeamChecklist, type TeamOption } from "./team-checklist";

/**
 * US-TEAM-22 (D-232) — `ChangeRoleConfirm`: moving someone between Staff
 * and Field asks first. To Staff it asks which Teams they join (the
 * default Team ticked); to Field it names the Teams they come off.
 */
export function ChangeRoleDialog({
  member,
  teams,
  onOpenChange,
  onConfirm,
}: {
  member: MemberRow | null;
  teams: TeamOption[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (member: MemberRow, role: "staff" | "field", teamIds: string[]) => void;
}) {
  // Until someone ticks or unticks, the default Team — even if the Teams load after it opens.
  const [chosen, setChosen] = useState<string[] | null>(null);
  const teamIds = chosen ?? teams.filter((t) => t.isDefault).map((t) => t.id);
  const toStaff = member?.role === "field";

  useEffect(() => {
    if (member) setChosen(null);
  }, [member]);

  if (!member) return null;
  const first = member.name.split(" ")[0];
  const current = member.teams?.map((t) => t.name) ?? [];
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Change {member.name} to {toStaff ? "Staff" : "Field"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {toStaff
              ? `${first} will have their Teams' access instead of Field access — the office pages, not only the jobs they're assigned to. It applies the next time they open Spine.`
              : `${first} will only see the jobs they're assigned to, without money, and their own meetings and expenses.${current.length ? ` They'll come off ${current.join(", ")}.` : ""} It applies the next time they open Spine.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {toStaff && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-on-surface">Teams they&apos;ll be on</span>
            <TeamChecklist teams={teams} value={teamIds} onChange={setChosen} label="Teams they'll be on" showCounts={false} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Go back</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(member, toStaff ? "staff" : "field", toStaff ? teamIds : [])}>
            <MENU_ICONS.changeRole size={14} aria-hidden />
            Change to {toStaff ? "Staff" : "Field"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
