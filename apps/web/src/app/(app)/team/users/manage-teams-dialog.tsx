"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Spinner } from "@spine/ui";
import { useT } from "../../../../lib/i18n";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import type { MemberRow } from "../../../../lib/members";
import { TeamChecklist, type TeamOption } from "./team-checklist";

/**
 * US-TEAM-20 (D-232) — `ManageTeamsDialog`: tick the Teams a Staff member
 * is on. Saving replaces them at once; what a Team allows is changed on the
 * Team's own page.
 */
export function ManageTeamsDialog({
  member,
  teams,
  onOpenChange,
  onSave,
}: {
  member: MemberRow | null;
  teams: TeamOption[];
  onOpenChange: (open: boolean) => void;
  onSave: (member: MemberRow, teamIds: string[]) => Promise<void>;
}) {
  const t = useT();
  const [value, setValue] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    setValue(member.teams?.map((team) => team.id) ?? []);
    setError(null);
  }, [member]);

  async function save() {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(member, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("team.manageTeamsDialog.failed"));
    } finally {
      setSaving(false);
    }
  }

  const first = member?.name.split(" ")[0] ?? "";
  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("team.manageTeamsDialog.title", { name: member?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("team.manageTeamsDialog.description", { first })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <TeamChecklist teams={teams} value={value} onChange={setValue} label={t("team.common.teams")} />
          <p className="text-[12.5px] text-on-surface-muted">
            {t("team.manageTeamsDialog.changeOnPage")}{" "}
            <Link href="/team/teams" className="font-medium text-primary hover:underline">
              {t("team.common.teams")}
            </Link>
            .
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("team.common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <MENU_ICONS.approve size={14} aria-hidden />}
            {t("team.manageTeamsDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
