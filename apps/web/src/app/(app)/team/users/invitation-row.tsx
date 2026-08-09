"use client";

import { useState } from "react";
import { Badge, Button, Spinner } from "@spine/ui";
import type { InvitationRow as InvitationRowData } from "../../../../lib/invitations";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  staff: "Staff",
  field: "Field",
};

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export function InvitationRow({
  invitation,
  onResend,
  onCancel,
}: {
  invitation: InvitationRowData;
  onResend: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<"resend" | "cancel" | null>(null);
  const expired = isExpired(invitation.expiresAt);

  async function guarded(action: "resend" | "cancel", fn: () => Promise<void>) {
    setBusy(action);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-3 text-[13px] last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-on-surface">{invitation.email}</span>
          <Badge>{expired ? "Expired" : "Pending"}</Badge>
        </div>
        <span className="truncate text-on-surface-muted">
          Invited as {ROLE_LABELS[invitation.role] ?? invitation.role}
        </span>
      </div>
      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => guarded("resend", () => onResend(invitation.id))}>
        {busy === "resend" ? <Spinner size="sm" /> : "Resend"}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => guarded("cancel", () => onCancel(invitation.id))}>
        {busy === "cancel" ? <Spinner size="sm" /> : "Cancel"}
      </Button>
    </div>
  );
}
