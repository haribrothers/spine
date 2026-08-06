"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import type { MemberRow as MemberRowData } from "../../../lib/members";
import { InviteTeamStep } from "../../onboarding/steps/invite-team-step";
import { MemberRow } from "../team/member-row";

/**
 * S-10.2 (list + invite) and S-10.3 (deactivate). Onboarding's
 * invite-team-step.tsx only ever sends invites — there's no member listing
 * anywhere else in the codebase, so `/org/members` (GET) is a dedicated
 * endpoint (apps/api/src/modules/org/members.controller.ts). InviteTeamStep
 * is reused directly, same as onboarding does. "Finish" here just re-fetches
 * the list.
 *
 * Relocated from the old routed `settings/team/page.tsx` into a pane —
 * content/logic unchanged. `member-row.tsx` stays at its original path
 * (`settings/team/member-row.tsx`) and is imported from there since it has
 * no other reason to move.
 */
export function TeamPane() {
  const [members, setMembers] = useState<MemberRowData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const rows = await apiClient.get<MemberRowData[]>("/org/members");
      setMembers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load team members.");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDeactivate(memberId: string) {
    setError(null);
    try {
      await apiClient.put(`/org/members/${memberId}/deactivate`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate member.");
    }
  }

  async function handleReactivate(memberId: string) {
    setError(null);
    try {
      await apiClient.put(`/org/members/${memberId}/reactivate`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reactivate member.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>Everyone with access to this organisation.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="critical" className="mb-3">
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
                <MemberRow key={member.id} member={member} onDeactivate={handleDeactivate} onReactivate={handleReactivate} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>They&apos;ll receive an email invite to join this organisation.</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteTeamStep
            onInvite={(email, role) => apiClient.post("/org/invitations", { email, role })}
            onFinish={reload}
            hideFooter
          />
        </CardContent>
      </Card>
    </div>
  );
}
