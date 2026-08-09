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
      setError(err instanceof Error ? err.message : "Could not transfer primary ownership.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer primary ownership</DialogTitle>
          <DialogDescription>
            The Primary Owner is this instance&apos;s super-admin and can&apos;t be demoted or removed by anyone
            else. Transferring hands that status to another Owner — you&apos;ll become a regular Owner afterward,
            demotable by others going forward.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {owners.length === 0 ? (
            <p className="text-[13px] text-on-surface-muted">
              There are no other Owners yet. Promote a Staff member to Owner first, then you can transfer primary
              ownership to them.
            </p>
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select an owner" />
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
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={busy || !selected}>
            {busy ? <Spinner size="sm" /> : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
