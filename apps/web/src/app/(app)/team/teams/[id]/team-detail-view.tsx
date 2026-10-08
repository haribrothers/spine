"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Button,
  Combobox,
  Input,
  Label,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@spine/ui";
import { ArrowLeft, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { CAPABILITIES, CAPABILITY_LABELS, CAPABILITY_REQUIRES, capabilitiesOff, withImpliedPrivileges, type Capability } from "@spine/shared";
import { useModules } from "../../../../../lib/modules-context";
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
  const router = useRouter();
  const { modules } = useModules();
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [staffMembers, setStaffMembers] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  // Which capability groups ("Manage Contacts", "Manage Catalogue", ...)
  // are expanded — keyed by group label. Groups default COLLAPSED (a
  // group not yet in this set counts as closed) so the matrix opens
  // compact and a user expands only the groups they care about.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [pendingMemberId, setPendingMemberId] = useState("");

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

  /**
   * The Members tab shows only current members plus a picker of Staff not
   * yet on THIS team (a Staff user may legitimately belong to several
   * teams at once, per §2.1's most-permissive-wins model, so the picker
   * doesn't hide someone already on another team) — replaced an earlier
   * checkbox-per-org-staff-member list that didn't scale past a handful of
   * users. Still backed by the same full-replace `PUT .../members`
   * endpoint (no incremental add/remove route exists), so add/remove both
   * resend the complete id array.
   */
  async function setMemberIds(nextIds: string[]) {
    setError(null);
    try {
      await apiClient.put(`/org/teams/${teamId}/members`, { memberIds: nextIds });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update team members.");
    }
  }

  async function handleAddMember() {
    if (!detail || !pendingMemberId) return;
    const currentIds = detail.members.map((m) => m.memberId);
    await setMemberIds([...currentIds, pendingMemberId]);
    setPendingMemberId("");
  }

  async function handleRemoveMember(memberId: string) {
    if (!detail) return;
    const currentIds = detail.members.map((m) => m.memberId);
    await setMemberIds(currentIds.filter((id) => id !== memberId));
  }

  /** US-BANK-12 — says which other privileges changed with this one, and why. */
  function impliedNotice(capability: Capability, granted: boolean): string | null {
    const changed = withImpliedPrivileges([{ capability, granted }]).filter((c) => c.capability !== capability && detail?.privileges[c.capability] !== c.granted);
    if (!changed.length) return null;
    const names = changed.map((c) => `“${CAPABILITY_LABELS[c.capability].label}”`).join(" and ");
    const reason = CAPABILITY_REQUIRES[granted ? capability : changed[0]!.capability]?.reason ?? "";
    return `${names} turned ${granted ? "on" : "off"} too. ${reason}`.trim();
  }

  async function togglePrivilege(capability: Capability, granted: boolean) {
    setError(null);
    const implied = impliedNotice(capability, granted);
    try {
      await apiClient.put(`/org/teams/${teamId}/privileges`, { privileges: [{ capability, granted }] });
      setNotice(implied);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update privileges.");
    }
  }

  /** Group-level "toggle all" switch (S-01.15/S-02.5's matrix UI) — sets every capability in the group to the same value in one request. */
  async function toggleGroup(capabilities: Capability[], granted: boolean) {
    setError(null);
    setNotice(null);
    try {
      await apiClient.put(`/org/teams/${teamId}/privileges`, {
        privileges: capabilities.map((capability) => ({ capability, granted })),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update privileges.");
    }
  }

  function toggleGroupExpanded(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
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
  const teamMembers = staffMembers.filter((m) => memberIds.has(m.id));
  const availableStaff = staffMembers.filter((m) => !memberIds.has(m.id));

  // Nest capabilities sharing a CAPABILITY_LABELS `group` under one header
  // row with a "toggle all" switch (S-01.15/S-02.5) — an ungrouped
  // capability renders as its own top-level row, same as before grouping
  // existed. Built from CAPABILITIES' own order so group membership can
  // never drift from the single source of truth in @spine/shared.
  const privilegeRows: ({ kind: "single"; capability: Capability } | { kind: "group"; label: string; capabilities: Capability[] })[] = [];
  const groupIndexByLabel = new Map<string, number>();
  // US-SET-24: a switched-off module's privileges aren't shown; their grants are kept.
  const hidden = capabilitiesOff(modules);
  for (const capability of CAPABILITIES) {
    if (hidden.has(capability)) continue;
    const group = CAPABILITY_LABELS[capability].group;
    if (!group) {
      privilegeRows.push({ kind: "single", capability });
      continue;
    }
    const existingIndex = groupIndexByLabel.get(group);
    if (existingIndex === undefined) {
      groupIndexByLabel.set(group, privilegeRows.length);
      privilegeRows.push({ kind: "group", label: group, capabilities: [capability] });
    } else {
      const row = privilegeRows[existingIndex];
      if (row?.kind === "group") row.capabilities.push(capability);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Same explicit-back-button convention as contacts/contact-detail.tsx
          — the breadcrumb's "Teams" segment is technically clickable, but
          that alone doesn't read as a strong back affordance for a detail
          page one level deep. */}
      <button
        type="button"
        onClick={() => router.push("/team/teams")}
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-on-surface-muted transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={14} />
        Back to teams
      </button>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert variant="info" data-testid="privilege-notice">
          <AlertDescription>{notice}</AlertDescription>
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

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="privileges">Privileges</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-team-member">Add a staff member</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox
                    options={availableStaff.map((m) => ({ value: m.id, label: `${m.name} (${m.email})` }))}
                    value={pendingMemberId}
                    onValueChange={setPendingMemberId}
                    placeholder={availableStaff.length ? "Select a staff member…" : "Every Staff member is already on this team"}
                    emptyText="No matching staff."
                  />
                </div>
                <Button variant="secondary" disabled={!pendingMemberId} onClick={handleAddMember}>
                  Add
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-on-surface-muted">Members of this team.</p>
              {teamMembers.length === 0 ? (
                <p className="text-[13px] text-on-surface-muted">No members yet — add one above.</p>
              ) : (
                <div className="rounded-md border border-border-strong bg-surface">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 border-b border-border px-3 py-2.5 text-[13px] last:border-0"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-on-surface">{member.name}</span>
                      <span className="truncate text-on-surface-muted">{member.email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-overdue hover:bg-overdue-bg"
                        aria-label={`Remove ${member.name} from this team`}
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="privileges">
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-on-surface-muted">
              What members of this team can do. A Staff member in multiple teams gets the union of everything any
              of their teams grant.
            </p>
            <div className="rounded-md border border-border-strong bg-surface">
              {privilegeRows.map((row) => {
                if (row.kind === "single") {
                  const capability = row.capability;
                  return (
                    <div key={capability} className="flex items-center gap-3 border-b border-border px-3 py-2.5 text-[13px] last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-on-surface">{CAPABILITY_LABELS[capability].label}</p>
                        <p className="text-on-surface-muted">{CAPABILITY_LABELS[capability].description}</p>
                      </div>
                      <Switch
                        checked={detail.privileges[capability] ?? false}
                        onCheckedChange={(checked) => togglePrivilege(capability, checked)}
                        aria-label={CAPABILITY_LABELS[capability].label}
                      />
                    </div>
                  );
                }

                const allGranted = row.capabilities.every((c) => detail.privileges[c] ?? false);
                const isExpanded = expandedGroups.has(row.label);
                return (
                  <div key={row.label} className="border-b border-border last:border-0">
                    <div className="flex items-center gap-3 bg-surface-muted px-3 py-2.5 text-[13px]">
                      <button
                        type="button"
                        onClick={() => toggleGroupExpanded(row.label)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-semibold text-on-surface"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                        <span className="truncate">{row.label}</span>
                      </button>
                      <Switch checked={allGranted} onCheckedChange={(checked) => toggleGroup(row.capabilities, checked)} aria-label={`Everything in ${row.label}`} />
                    </div>
                    {isExpanded &&
                      row.capabilities.map((capability) => (
                        <div key={capability} className="flex items-center gap-3 border-t border-border py-2.5 pl-6 pr-3 text-[13px]">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-on-surface">{CAPABILITY_LABELS[capability].label}</p>
                            <p className="text-on-surface-muted">{CAPABILITY_LABELS[capability].description}</p>
                          </div>
                          <Switch
                            checked={detail.privileges[capability] ?? false}
                            onCheckedChange={(checked) => togglePrivilege(capability, checked)}
                            aria-label={CAPABILITY_LABELS[capability].label}
                          />
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
