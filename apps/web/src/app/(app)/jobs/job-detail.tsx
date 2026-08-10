"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataList,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { CostingSection } from "./[id]/costing-section";
import { MilestonesSection } from "./[id]/milestones-section";
import { NotesSection } from "./[id]/notes-section";
import { PhotosSection } from "./[id]/photos-section";
import { VariationOrdersSection } from "./[id]/variation-orders-section";
import { useEntityToast } from "./entity-toast";
import { JOB_STATUS_LABELS, type Job, type JobStatus } from "./types";

interface MemberRow {
  userId: string;
  role: string;
}

const STATUS_BADGE_CLASS: Record<Job["status"], string> = {
  active: "bg-due-soon-bg text-due-soon",
  on_hold: "bg-draft-bg text-draft",
  completed: "bg-paid-bg text-paid",
  cancelled: "bg-overdue-bg text-overdue",
};

/**
 * Job detail — header (name, contact, site address, status, dates,
 * contract value, retention %) plus tabbed sections for Milestones,
 * Variation Orders, Photos, Notes, and Costing.
 *
 * **Capability gating**: this codebase has no client-side fine-grained
 * capability check yet (grepped for one — doesn't exist; `quote-detail.tsx`
 * and `team-detail-view.tsx` both only ever check `role === "owner"` via
 * `GET /org/members/me` / `/org/members`, since `GET /org/teams` — the
 * only place a member's effective Team grants are readable — is hard-coded
 * Owner-only and a Staff/Field member can't read their own capability set).
 * So this page follows that exact precedent: gates purely on `role`
 * (owner/staff can do the `invoices.manage`-gated actions, i.e. define
 * milestones/raise invoices/apply variations/release retention;
 * owner/staff/field can all do the `jobs.update_milestones`-gated actions,
 * i.e. mark a milestone complete/add photos/add notes). This is a
 * necessarily coarser approximation than the server's own per-Team
 * enforcement — a Staff member whose Team doesn't actually grant
 * `invoices.manage` will still see these buttons here and get a real 403
 * from the server on click, exactly like every other page in this app
 * (hiding a button is UI signal, never access control, per this
 * codebase's own established doc comments on `getMyMembership`/nav
 * placement).
 */
export function JobDetail({ jobId, currentUserId }: { jobId: string; currentUserId: string | null }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [isConstruction, setIsConstruction] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const { show: showToast, toast } = useEntityToast();

  const load = useCallback(() => {
    apiClient
      .get<Job>(`/jobs/${jobId}`)
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load job."));
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!currentUserId) return;
    apiClient
      .get<MemberRow[]>("/org/members")
      .then((members) => {
        const self = members.find((m) => m.userId === currentUserId);
        setRole(self?.role ?? null);
      })
      .catch(() => {});
  }, [currentUserId]);

  // S-12.3 — the org's onboarding-wizard industry template, re-read here
  // (not just at onboarding time) since it's editable later from Settings
  // per CLAUDE.md's onboarding rules. Used only to decide whether the
  // retention-% disclosure in EditJobDialog starts open or collapsed —
  // see that component's own doc comment for why this is a default, not a
  // hard gate: Jobs itself stays fully usable for every org regardless of
  // template.
  useEffect(() => {
    apiClient
      .get<{ key: string; value: { template?: string } | null }>("/org/settings/industry_template")
      .then((res) => setIsConstruction(res.value?.template === "construction"))
      .catch(() => {});
  }, []);

  const canManage = role === "owner" || role === "staff";
  const canUpdateStatus = role === "owner" || role === "staff" || role === "field";

  async function handleReleaseRetention() {
    if (!job) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/jobs/${job.id}/release-retention`);
      setReleaseOpen(false);
      load();
      showToast("Retention released", "A retention-release invoice has been created for this job.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not release retention for this job.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !job) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!job) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/jobs")}
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-on-surface-muted transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={14} />
        Back to jobs
      </button>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold text-on-surface">{job.name}</h2>
              <Badge className={STATUS_BADGE_CLASS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-on-surface-muted">
              {job.contactName ?? "Unknown contact"}
              {job.siteAddress && <> · {job.siteAddress}</>}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Edit job
              </Button>
            )}
            {canManage && job.retentionPct > 0 && (
              <Button variant="secondary" onClick={() => setReleaseOpen(true)} disabled={busy}>
                Release retention
              </Button>
            )}
          </div>
        </div>

        <DataList
          items={[
            {
              label: "Contract value",
              value: `${toDecimalString({ amount: BigInt(job.contractValueAmount), currency: job.currency })} ${job.currency}`,
            },
            { label: "Retention", value: job.retentionPct > 0 ? `${job.retentionPct}%` : "None" },
            { label: "Start date", value: job.startDate ? new Date(job.startDate).toLocaleDateString() : "—" },
            { label: "End date", value: job.endDate ? new Date(job.endDate).toLocaleDateString() : "—" },
            ...(job.sourceQuoteId
              ? [{ label: "Source quote", value: <a href={`/quotes/${job.sourceQuoteId}`} className="text-primary hover:underline">View quote</a> }]
              : []),
          ]}
        />

        {job.notes && (
          <div>
            <h3 className="text-[13px] font-semibold text-on-surface-muted">Notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-on-surface">{job.notes}</p>
          </div>
        )}
      </Card>

      <Tabs defaultValue="milestones">
        <TabsList>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="variations">Variation orders</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="costing">Costing</TabsTrigger>
        </TabsList>
        <TabsContent value="milestones">
          <MilestonesSection job={job} canManage={canManage} canUpdateStatus={canUpdateStatus} onJobChanged={load} />
        </TabsContent>
        <TabsContent value="variations">
          <VariationOrdersSection job={job} canCreate={canManage} canApply={canManage} onJobChanged={load} />
        </TabsContent>
        <TabsContent value="photos">
          <PhotosSection job={job} canUpload={canUpdateStatus} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesSection job={job} canAdd={canUpdateStatus} />
        </TabsContent>
        <TabsContent value="costing">
          <CostingSection job={job} />
        </TabsContent>
      </Tabs>

      <EditJobDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        job={job}
        defaultShowRetention={isConstruction}
        onSaved={(updated) => {
          setJob(updated);
          setEditOpen(false);
          showToast("Job updated", `${updated.name} has been updated.`);
        }}
      />

      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release retention?</DialogTitle>
            <DialogDescription>
              Creates a retention-release invoice for whatever retention is still outstanding across this job's issued progress
              invoices. If nothing is currently held back, this will be rejected.
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setReleaseOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={handleReleaseRetention} disabled={busy}>
              {busy ? <Spinner size="sm" /> : "Release retention"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast}
    </div>
  );
}

/**
 * Edit job dialog — status, dates, notes, and retention %. Retention lives
 * behind a collapsible "Advanced" disclosure rather than a top-level field
 * — see this task's own S-12.3 judgment call (documented in the final
 * report): retention is a construction-specific concern the PRD's "simple
 * by default, capable underneath" principle says shouldn't clutter every
 * org's edit form, but it must stay fully reachable/editable for any org
 * regardless of industry template (never a hard gate).
 */
function EditJobDialog({
  open,
  onOpenChange,
  job,
  defaultShowRetention,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  /** S-12.3 — true when the org's industry template is "construction" (JobDetail's own read of GET /org/settings/industry_template). Only affects whether the disclosure starts open; a job that already has a nonzero retentionPct always starts open regardless, and every org can open it manually either way — see this component's own doc comment. */
  defaultShowRetention: boolean;
  onSaved: (job: Job) => void;
}) {
  const [name, setName] = useState(job.name);
  const [siteAddress, setSiteAddress] = useState(job.siteAddress ?? "");
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [startDate, setStartDate] = useState<Date | undefined>(job.startDate ? new Date(job.startDate) : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(job.endDate ? new Date(job.endDate) : undefined);
  const [retentionPct, setRetentionPct] = useState(job.retentionPct);
  const [notes, setNotes] = useState(job.notes ?? "");
  const [advancedOpen, setAdvancedOpen] = useState(job.retentionPct > 0 || defaultShowRetention);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(job.name);
    setSiteAddress(job.siteAddress ?? "");
    setStatus(job.status);
    setStartDate(job.startDate ? new Date(job.startDate) : undefined);
    setEndDate(job.endDate ? new Date(job.endDate) : undefined);
    setRetentionPct(job.retentionPct);
    setNotes(job.notes ?? "");
    setAdvancedOpen(job.retentionPct > 0 || defaultShowRetention);
    setError(null);
  }, [open, job, defaultShowRetention]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Job name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await apiClient.put<Job>(`/jobs/${job.id}`, {
        name: name.trim(),
        siteAddress: siteAddress || null,
        status,
        startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
        endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
        retentionPct,
        notes: notes || null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this job.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit job</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField label="Job name" required>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Site address">
            {(field) => <Input {...field} value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="Optional" />}
          </FormField>
          <FormField label="Status" required>
            {() => (
              <Select value={status} onValueChange={(v) => setStatus(v as JobStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start date">{() => <DatePicker value={startDate} onChange={setStartDate} />}</FormField>
            <FormField label="End date">{() => <DatePicker value={endDate} onChange={setEndDate} />}</FormField>
          </div>
          <FormField label="Notes">
            {(field) => <Textarea {...field} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
          </FormField>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-[13px] font-medium text-on-surface-muted hover:text-on-surface"
              >
                <ChevronDown size={14} className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                Advanced (retention)
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <FormField label="Retention %" helperText="Percentage of each progress invoice held back until Release retention.">
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={String(retentionPct)}
                    onChange={(e) => setRetentionPct(Number(e.target.value) || 0)}
                  />
                )}
              </FormField>
            </CollapsibleContent>
          </Collapsible>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
