"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Spinner } from "@spine/ui";
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
  const [value, setValue] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    setValue(member.teams?.map((t) => t.id) ?? []);
    setError(null);
  }, [member]);

  async function save() {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(member, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save their Teams. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const first = member?.name.split(" ")[0] ?? "";
  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Manage Teams — {member?.name}</DialogTitle>
          <DialogDescription>
            {first} can open what their Teams allow, together. Without a Team, they can&apos;t open anything.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <TeamChecklist teams={teams} value={value} onChange={setValue} label="Teams" />
          <p className="text-[12.5px] text-on-surface-muted">
            Change what a Team allows on its own page under{" "}
            <Link href="/team/teams" className="font-medium text-primary hover:underline">
              Teams
            </Link>
            .
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <MENU_ICONS.approve size={14} aria-hidden />}
            Save Teams
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
