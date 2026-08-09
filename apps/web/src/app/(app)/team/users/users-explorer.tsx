"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Spinner } from "@spine/ui";
import { apiClient } from "../../../../lib/api-client";
import type { MemberRow as MemberRowData } from "../../../../lib/members";
import { InviteTeamStep } from "../../../onboarding/steps/invite-team-step";
import { TransferPrimaryOwnerDialog } from "./transfer-primary-owner-dialog";
import { UserRow } from "./user-row";

export function UsersExplorer({ currentMemberId }: { currentMemberId: string }) {
  const [members, setMembers] = useState<MemberRowData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const rows = await apiClient.get<MemberRowData[]>("/org/members");
      setMembers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users.");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function run(action: () => Promise<unknown>, fallbackMessage: string) {
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackMessage);
    }
  }

  const owners = (members ?? []).filter((m) => m.role === "owner" && m.id !== currentMemberId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-on-surface">Users</h2>
          <p className="text-[13px] text-on-surface-muted">Everyone with access to this organisation.</p>
        </div>
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!members ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="rounded-md border border-border-strong">
            {members.map((member) => (
              <UserRow
                key={member.id}
                member={member}
                isCurrentUser={member.id === currentMemberId}
                onDeactivate={(id) => run(() => apiClient.put(`/org/members/${id}/deactivate`), "Could not deactivate user.")}
                onReactivate={(id) => run(() => apiClient.put(`/org/members/${id}/reactivate`), "Could not reactivate user.")}
                onPromote={(id) => run(() => apiClient.put(`/org/members/${id}/promote`), "Could not promote user.")}
                onDemote={(id) => run(() => apiClient.put(`/org/members/${id}/demote`), "Could not demote user.")}
                onTransferPrimaryOwner={member.isPrimaryOwner ? () => setTransferOpen(true) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-on-surface">Invite a teammate</h2>
          <p className="text-[13px] text-on-surface-muted">They&apos;ll receive an email invite to join this organisation.</p>
        </div>
        <InviteTeamStep
          onInvite={(email, role) => apiClient.post("/org/invitations", { email, role })}
          onFinish={reload}
          hideFooter
        />
      </div>

      <TransferPrimaryOwnerDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        owners={owners}
        onTransfer={(newPrimaryOwnerMemberId) =>
          run(
            () => apiClient.post("/org/members/transfer-primary-owner", { newPrimaryOwnerMemberId }),
            "Could not transfer primary ownership.",
          )
        }
      />
    </div>
  );
}
