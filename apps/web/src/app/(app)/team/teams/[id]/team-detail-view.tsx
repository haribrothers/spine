"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Checkbox, Input, Label, Spinner, Switch } from "@spine/ui";
import { CAPABILITIES, CAPABILITY_LABELS, type Capability } from "@spine/shared";
import { apiClient } from "../../../../../lib/api-client";
import type { MemberRow } from "../../../../../lib/members";
import type { TeamDetail } from "../../../../../lib/teams";

/**
 * PRD §2.1/S-10.13-14 — a Team's two configurable things: which Staff
 * members belong to it, and which capabilities it grants (the privilege
 * matrix). CAPABILITIES/CAPABILITY_LABELS come straight from @spine/shared
 * — the same list the API's CapabilityGuard enforces — so this UI can never
 * offer a capability the server doesn't also check (PRD's "single source of
 * truth" requirement).
 */
export function TeamDetailView({ teamId }: { teamId: string }) {
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [staffMembers, setStaffMembers] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [teamDetail, members] = await Promise.all([
        apiClient.get<TeamDetail>(`/org/teams/${teamId}`),
        apiClient.get<MemberRow[]>("/org/members"),
      ]);
      setDetail(teamDetail);
      setNameDraft(teamDetail.name);
      setStaffMembers(members.filter((m) => m.role === "staff"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load team.");
    }
  }, [teamId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleRenameBlur() {
    if (!detail || nameDraft.trim() === detail.name || !nameDraft.trim()) {
      setNameDraft(detail?.name ?? "");
      return;
    }
    setSavingName(true);
    try {
      await apiClient.put(`/org/teams/${teamId}`, { name: nameDraft.trim() });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename team.");
      setNameDraft(detail.name);
    } finally {
      setSavingName(false);
    }
  }

  async function toggleMember(memberId: string, checked: boolean) {
    if (!detail) return;
    const currentIds = detail.members.map((m) => m.memberId);
    const nextIds = checked ? [...currentIds, memberId] : currentIds.filter((id) => id !== memberId);
    setError(null);
    try {
      await apiClient.put(`/org/teams/${teamId}/members`, { memberIds: nextIds });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update team members.");
    }
  }

  async function togglePrivilege(capability: Capability, granted: boolean) {
    setError(null);
    try {
      await apiClient.put(`/org/teams/${teamId}/privileges`, { privileges: [{ capability, granted }] });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update privileges.");
    }
  }

  if (!detail || !staffMembers) {
    return (
      <div className="flex items-center justify-center py-8">
        {error ? (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <Spinner />
        )}
      </div>
    );
  }

  const memberIds = new Set(detail.members.map((m) => m.memberId));

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="team-name">Team name</Label>
        <Input
          id="team-name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={handleRenameBlur}
          disabled={detail.isDefault || savingName}
          className="max-w-sm"
        />
        {detail.isDefault && <p className="text-[13px] text-on-surface-muted">The default team&apos;s name can&apos;t be changed.</p>}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-on-surface">Members</h2>
          <p className="text-[13px] text-on-surface-muted">Staff members assigned to this team.</p>
        </div>
        {staffMembers.length === 0 ? (
          <p className="text-[13px] text-on-surface-muted">No Staff members in this organisation yet.</p>
        ) : (
          <div className="rounded-md border border-border-strong">
            {staffMembers.map((member) => (
              <label
                key={member.id}
                htmlFor={`member-${member.id}`}
                className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 text-[13px] last:border-0"
              >
                <Checkbox
                  id={`member-${member.id}`}
                  checked={memberIds.has(member.id)}
                  onCheckedChange={(checked) => toggleMember(member.id, checked === true)}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-on-surface">{member.name}</span>
                <span className="truncate text-on-surface-muted">{member.email}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-on-surface">Privileges</h2>
          <p className="text-[13px] text-on-surface-muted">
            What members of this team can do. A Staff member in multiple teams gets the union of everything any of
            their teams grant.
          </p>
        </div>
        <div className="rounded-md border border-border-strong">
          {CAPABILITIES.map((capability) => (
            <div key={capability} className="flex items-center gap-3 border-b border-border px-3 py-2.5 text-[13px] last:border-0">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-on-surface">{CAPABILITY_LABELS[capability].label}</p>
                <p className="text-on-surface-muted">{CAPABILITY_LABELS[capability].description}</p>
              </div>
              <Switch
                checked={detail.privileges[capability] ?? false}
                onCheckedChange={(checked) => togglePrivilege(capability, checked)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
