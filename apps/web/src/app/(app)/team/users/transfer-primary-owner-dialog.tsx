"use client";

import { useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { useT } from "../../../../lib/i18n";
import type { MemberRow as MemberRowData } from "../../../../lib/members";

/**
 * PRD §2.1/S-10.15-16 — only the current Primary Owner can move this flag,
 * to an existing Owner, via an explicit confirmed action (never a side
 * effect of demote/deactivate). `owners` is pre-filtered by the caller to
 * exclude the current Primary Owner themselves — the API also rejects
 * self-transfer, but the picker shouldn't offer it at all.
 */
export function TransferPrimaryOwnerDialog({
  open,
  onOpenChange,
  owners,
  onTransfer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owners: MemberRowData[];
  onTransfer: (newPrimaryOwnerMemberId: string) => Promise<void>;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTransfer() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await onTransfer(selected);
      onOpenChange(false);
      setSelected("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("team.transferDialog.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("team.transferDialog.title")}</DialogTitle>
          <DialogDescription>{t("team.transferDialog.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {owners.length === 0 ? (
            <p className="text-[13px] text-on-surface-muted">{t("team.transferDialog.noOwners")}</p>
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder={t("team.transferDialog.selectOwner")} />
              </SelectTrigger>
              <SelectContent>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name} ({owner.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("team.common.cancel")}
          </Button>
          <Button onClick={handleTransfer} disabled={busy || !selected}>
            {busy ? <Spinner size="sm" /> : t("team.transferDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
