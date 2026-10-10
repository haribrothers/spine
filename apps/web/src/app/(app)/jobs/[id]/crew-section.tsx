"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Card, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner } from "@spine/ui";
import { X } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCapability } from "../../../../lib/capabilities-context";
import type { MemberRow } from "../../../../lib/members";
import type { Job, JobAssignee } from "../types";

/**
 * Phase 5 (Mobile) — who's assigned to this job's crew, backing S-11.2's
 * "today's assigned jobs" mobile home-screen query (`GET /jobs?assignedToMe=true`).
 * Read is unconditional (every GET on this module is); assign/unassign is
 * gated by the dedicated `jobs.assign` workflow-action capability, not
 * `jobs.edit_own`/`edit_others` — see permissions.ts's own doc comment on
 * why "who can edit this job's fields" and "who decides the crew" are
 * separate questions an Owner may want to grant separately.
 */
/** `onChanged` lets the job page refresh its tab count and Activity (US-JOB-35, US-JOB-37). */
export function CrewSection({ job, onChanged }: { job: Job; onChanged?: () => void }) {
  const canAssign = useCapability("jobs.assign");
  const [assignees, setAssignees] = useState<JobAssignee[] | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<JobAssignee[]>(`/jobs/${job.id}/assignees`)
      .then(setAssignees)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this job's crew."));
  }, [job.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAssign) return;
    apiClient
      .get<MemberRow[]>("/org/members")
      .then((rows) => setMembers(rows.filter((m) => m.isActive)))
      .catch(() => {});
  }, [canAssign]);

  async function handleAssign() {
    if (!selectedUserId) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/jobs/${job.id}/assignees`, { userId: selectedUserId });
      setSelectedUserId("");
      load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign this user to the job.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassign(userId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/jobs/${job.id}/assignees/${userId}`);
      load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this user from the job.");
    } finally {
      setBusy(false);
    }
  }

  const assignedUserIds = new Set((assignees ?? []).map((a) => a.userId));
  const assignableMembers = (members ?? []).filter((m) => !assignedUserIds.has(m.userId));

  return (
    <Card className="flex flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <h3 className="text-[14px] font-semibold text-on-surface">Crew</h3>
      <p className="text-[13px] text-on-surface-muted">
        Assigned users see this job on their mobile home screen.
      </p>

      {canAssign && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="Add a user…" />
            </SelectTrigger>
            <SelectContent>
              {assignableMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name} ({m.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={handleAssign} disabled={busy || !selectedUserId}>
            {busy ? <Spinner size="sm" /> : "Assign"}
          </Button>
        </div>
      )}

      {!assignees ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : assignees.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">No one is assigned to this job yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {assignees.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-on-surface">{a.name}</p>
                <p className="text-[11px] text-on-surface-muted">{a.email}</p>
              </div>
              {canAssign && (
                <button
                  type="button"
                  onClick={() => handleUnassign(a.userId)}
                  disabled={busy}
                  aria-label={`Remove ${a.name} from this job`}
                  className="text-on-surface-muted transition-colors hover:text-critical disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
