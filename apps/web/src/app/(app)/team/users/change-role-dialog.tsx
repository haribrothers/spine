"use client";

import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@spine/ui";
import { useT } from "../../../../lib/i18n";
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
  const t = useT();
  // Until someone ticks or unticks, the default Team — even if the Teams load after it opens.
  const [chosen, setChosen] = useState<string[] | null>(null);
  const teamIds = chosen ?? teams.filter((team) => team.isDefault).map((team) => team.id);
  const toStaff = member?.role === "field";

  useEffect(() => {
    if (member) setChosen(null);
  }, [member]);

  if (!member) return null;
  const first = member.name.split(" ")[0] ?? "";
  const current = member.teams?.map((team) => team.name) ?? [];
  const role = toStaff ? t("team.roles.staff") : t("team.roles.field");
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("team.changeRoleDialog.title", { name: member.name, role })}</AlertDialogTitle>
          <AlertDialogDescription>
            {toStaff
              ? t("team.changeRoleDialog.toStaff", { first })
              : `${t("team.changeRoleDialog.toField", { first })}${current.length ? t("team.changeRoleDialog.comeOff", { teams: current.join(", ") }) : ""}${t("team.changeRoleDialog.appliesNext")}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {toStaff && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-on-surface">{t("team.changeRoleDialog.teamsTheyllBeOn")}</span>
            <TeamChecklist teams={teams} value={teamIds} onChange={setChosen} label={t("team.changeRoleDialog.teamsTheyllBeOn")} showCounts={false} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("team.common.goBack")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(member, toStaff ? "staff" : "field", toStaff ? teamIds : [])}>
            <MENU_ICONS.changeRole size={14} aria-hidden />
            {t("team.common.changeToRole", { role })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
