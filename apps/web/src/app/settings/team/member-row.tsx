"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Spinner,
} from "@spine/ui";
import type { MemberRow as MemberRowData } from "../../../lib/members";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  staff: "Staff",
  field: "Field",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function MemberRow({
  member,
  onDeactivate,
  onReactivate,
}: {
  member: MemberRowData;
  onDeactivate: (memberId: string) => Promise<void>;
  onReactivate: (memberId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-3 text-[13px] last:border-0">
      <Avatar className="shrink-0">
        <AvatarFallback>{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-on-surface">{member.name}</span>
          {!member.isActive && <Badge>Deactivated</Badge>}
        </div>
        <span className="truncate text-on-surface-muted">{member.email}</span>
      </div>
      <span className="shrink-0 text-on-surface-muted">{ROLE_LABELS[member.role] ?? member.role}</span>
      {member.isActive ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" disabled={busy}>
              Deactivate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {member.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                They&apos;ll immediately lose access to this organisation. Their existing records (journal lines,
                audit entries, job history) are kept and are not reassigned or deleted. You can reactivate them
                later from this same list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onDeactivate(member.id);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Spinner size="sm" /> : "Deactivate"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onReactivate(member.id);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner size="sm" /> : "Reactivate"}
        </Button>
      )}
    </div>
  );
}
