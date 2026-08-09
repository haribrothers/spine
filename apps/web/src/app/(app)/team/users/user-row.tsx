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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
} from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import type { MemberRow as MemberRowData } from "../../../../lib/members";

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

export function UserRow({
  member,
  isCurrentUser,
  onDeactivate,
  onReactivate,
  onPromote,
  onDemote,
  onTransferPrimaryOwner,
}: {
  member: MemberRowData;
  isCurrentUser: boolean;
  onDeactivate: (memberId: string) => Promise<void>;
  onReactivate: (memberId: string) => Promise<void>;
  onPromote: (memberId: string) => Promise<void>;
  onDemote: (memberId: string) => Promise<void>;
  /** Only present for the current Primary Owner's own row, and only when the viewer IS the Primary Owner (see UsersExplorer). */
  onTransferPrimaryOwner?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDemote, setConfirmDemote] = useState(false);

  async function guarded(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-3 text-[13px] last:border-0">
      <Avatar className="shrink-0">
        <AvatarFallback>{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-on-surface">{member.name}</span>
          {member.isPrimaryOwner && <Badge>Primary Owner</Badge>}
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
              <AlertDialogAction onClick={() => guarded(() => onDeactivate(member.id))}>
                {busy ? <Spinner size="sm" /> : "Deactivate"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => guarded(() => onReactivate(member.id))}>
          {busy ? <Spinner size="sm" /> : "Reactivate"}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" disabled={busy} aria-label="More actions">
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {member.role === "staff" && (
            <DropdownMenuItem onSelect={() => guarded(() => onPromote(member.id))}>Promote to Owner</DropdownMenuItem>
          )}
          {member.role === "owner" && !member.isPrimaryOwner && !isCurrentUser && (
            <DropdownMenuItem onSelect={() => setConfirmDemote(true)}>Demote to Staff</DropdownMenuItem>
          )}
          {onTransferPrimaryOwner && (
            <DropdownMenuItem onSelect={onTransferPrimaryOwner}>Transfer primary ownership…</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDemote} onOpenChange={setConfirmDemote}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Demote {member.name} to Staff?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll lose Owner-level access immediately. They keep whatever Team memberships they already
              have — if they have none, they&apos;ll have no Staff-tier access until you assign them a Team from
              the Teams page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await guarded(() => onDemote(member.id));
                setConfirmDemote(false);
              }}
            >
              {busy ? <Spinner size="sm" /> : "Demote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
