"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Badge, Button, Card, DatePicker, FormField, Input, NativeSelect, Spinner } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { Plus, Trash2 } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { CompleteMilestoneDialog } from "./complete-milestone-dialog";
import { MILESTONE_STATUS_LABELS, type EditableMilestone, type Job, type Milestone, type MilestoneAmountType } from "../types";

const STATUS_BADGE_CLASS: Record<Milestone["status"], string> = {
  pending: "bg-draft-bg text-draft",
  completed: "bg-due-soon-bg text-due-soon",
  invoiced: "bg-paid-bg text-paid",
};

function toEditable(milestones: Milestone[]): EditableMilestone[] {
  return milestones
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((m) => ({
      key: m.id,
      id: m.id,
      name: m.name,
      sequence: m.sequence,
      amountType: m.amountType,
      amount: m.amount,
      dueDate: m.dueDate,
      status: m.status,
    }));
}

function blankMilestone(sequence: number): EditableMilestone {
  return { key: `new-${Date.now()}-${Math.random()}`, name: "", sequence, amountType: "percent", amount: 0, dueDate: null };
}

/**
 * S-04.2/S-04.3 — define/edit a job's milestone set, with the 100%-total
 * validation UX (S-04.3's own wording: "so I don't accidentally under-bill
 * a job"). The server (MilestonesService.setAll) is the sole source of
 * truth for the validation rule (percent-type milestones must sum to
 * exactly 100%, fixed-type milestones have no such constraint) — this UI
 * doesn't duplicate that logic client-side beyond a live running-total
 * hint, and always surfaces the API's own `BadRequestException` message
 * verbatim on save failure (e.g. "Milestone percentages must total 100%
 * (currently 80%)") rather than inventing its own copy, since the server
 * message already includes the actual current total.
 *
 * Once ANY milestone reaches `invoiced`, the whole set is read-only in
 * this editor except for adding brand-new rows — MilestonesService.setAll
 * rejects removing an invoiced milestone outright, and editing one's
 * amount/type after it's already been billed would silently misrepresent
 * history, so this UI disables those fields rather than letting a save
 * round-trip fail.
 */
export function MilestonesSection({
  job,
  canManage,
  canUpdateStatus,
  onJobChanged,
}: {
  job: Job;
  /** invoices.manage — define/edit the milestone set, raise a progress invoice. */
  canManage: boolean;
  /** jobs.update_milestones — mark a milestone complete (field-reachable). */
  canUpdateStatus: boolean;
  onJobChanged: () => void;
}) {
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<EditableMilestone[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completingMilestone, setCompletingMilestone] = useState<Milestone | null>(null);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<Milestone[]>(`/jobs/${job.id}/milestones`)
      .then(setMilestones)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load milestones."));
  }, [job.id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEditing() {
    setRows(milestones && milestones.length ? toEditable(milestones) : [blankMilestone(0)]);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
  }

  function updateRow(key: string, patch: Partial<EditableMilestone>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((current) => [...current, blankMilestone(current.length)]);
  }

  const percentTotal = rows.filter((r) => r.amountType === "percent").reduce((sum, r) => sum + (r.amount || 0), 0);
  const hasPercentRows = rows.some((r) => r.amountType === "percent");

  async function handleSave() {
    setSaveError(null);
    if (!rows.length) {
      setSaveError("Add at least one milestone.");
      return;
    }
    if (rows.some((r) => !r.name.trim())) {
      setSaveError("Every milestone needs a name.");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiClient.put<Milestone[]>(`/jobs/${job.id}/milestones`, {
        milestones: rows.map((r, index) => ({
          id: r.id,
          name: r.name.trim(),
          sequence: index,
          amountType: r.amountType,
          amount: r.amount,
          dueDate: r.dueDate,
        })),
      });
      setMilestones(updated);
      setEditing(false);
    } catch (err) {
      // Surface the API's own BadRequestException message verbatim (e.g.
      // "Milestone percentages must total 100% (currently 80%)") — see
      // this component's own doc comment on why this isn't re-derived
      // client-side.
      setSaveError(err instanceof Error ? err.message : "Could not save milestones.");
    } finally {
      setSaving(false);
    }
  }

  async function handleInvoice(milestoneId: string) {
    setActionError(null);
    setInvoicingId(milestoneId);
    try {
      const invoice = await apiClient.post<{ id: string }>(`/jobs/${job.id}/milestones/${milestoneId}/invoice`);
      window.location.href = `/invoices/${invoice.id}`;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not raise an invoice for this milestone.");
      setInvoicingId(null);
    }
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!milestones) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (editing) {
    const anyInvoiced = rows.some((r) => r.status === "invoiced");
    return (
      <Card className="flex flex-col gap-4">
        {saveError && (
          <Alert variant="critical">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}
        {anyInvoiced && (
          <Alert variant="warning">
            <AlertDescription>
              At least one milestone has already been invoiced — its billing details can no longer be edited or removed, only new
              milestones can be added alongside it.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const locked = row.status === "invoiced";
            return (
              <div key={row.key} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
                <FormField label="Name" required className="min-w-[10rem] flex-1">
                  {(field) => (
                    <Input
                      {...field}
                      value={row.name}
                      disabled={locked}
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      placeholder="e.g. Foundation complete"
                    />
                  )}
                </FormField>
                <FormField label="Type" className="w-32">
                  {() => (
                    <NativeSelect
                      value={row.amountType}
                      disabled={locked}
                      onChange={(e) => updateRow(row.key, { amountType: e.target.value as MilestoneAmountType })}
                    >
                      <option value="percent">% of contract</option>
                      <option value="fixed">Fixed amount</option>
                    </NativeSelect>
                  )}
                </FormField>
                <FormField label={row.amountType === "percent" ? "Percent" : `Amount (${job.currency})`} className="w-32">
                  {(field) => (
                    <Input
                      {...field}
                      type="number"
                      min={0}
                      value={row.amountType === "percent" ? row.amount : row.amount / 100}
                      disabled={locked}
                      onChange={(e) => {
                        const raw = Number(e.target.value) || 0;
                        updateRow(row.key, { amount: row.amountType === "percent" ? raw : Math.round(raw * 100) });
                      }}
                    />
                  )}
                </FormField>
                <FormField label="Due date" className="w-40">
                  {() => (
                    <DatePicker
                      value={row.dueDate ? new Date(row.dueDate) : undefined}
                      onChange={(d) => updateRow(row.key, { dueDate: d.toISOString().slice(0, 10) })}
                    />
                  )}
                </FormField>
                {!locked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.name || "this milestone"}`}
                    onClick={() => removeRow(row.key)}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            <Plus size={14} className="mr-1" />
            Add milestone
          </Button>
          {hasPercentRows && (
            <span className={`text-[13px] font-medium ${Math.round(percentTotal * 100) === 10000 ? "text-paid" : "text-overdue"}`}>
              Percent total: {percentTotal}%
            </span>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={cancelEditing} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Save milestones"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      {actionError && (
        <Alert variant="critical">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-on-surface">Billing milestones</h3>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={startEditing}>
            {milestones.length ? "Edit milestones" : "Define milestones"}
          </Button>
        )}
      </div>

      {milestones.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">
          No milestones defined yet — this job will bill on its own schedule (e.g. a single final invoice) until milestones are set up.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {milestones
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-on-surface">{m.name}</span>
                    <Badge className={STATUS_BADGE_CLASS[m.status]}>{MILESTONE_STATUS_LABELS[m.status]}</Badge>
                  </div>
                  <p className="text-[12px] text-on-surface-muted">
                    {m.amountType === "percent" ? `${m.amount}% of contract` : "Fixed amount"}
                    {m.dueDate && <> · Due {new Date(m.dueDate).toLocaleDateString()}</>}
                  </p>
                  {m.completionNotes && <p className="mt-1 text-[12px] text-on-surface-muted">"{m.completionNotes}"</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] tabular-nums text-on-surface">
                    {toDecimalString({ amount: BigInt(m.resolvedAmount), currency: job.currency })} {job.currency}
                  </span>
                  {m.status === "pending" && canUpdateStatus && (
                    <Button size="sm" variant="secondary" onClick={() => setCompletingMilestone(m)}>
                      Mark complete
                    </Button>
                  )}
                  {m.status === "completed" && canManage && (
                    <Button size="sm" onClick={() => handleInvoice(m.id)} disabled={invoicingId === m.id}>
                      {invoicingId === m.id ? <Spinner size="sm" /> : "Raise invoice"}
                    </Button>
                  )}
                  {m.status === "invoiced" && m.invoicedInvoiceId && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`/invoices/${m.invoicedInvoiceId}`}>View invoice</a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      <CompleteMilestoneDialog
        job={job}
        milestone={completingMilestone}
        onOpenChange={(open) => !open && setCompletingMilestone(null)}
        onCompleted={() => {
          setCompletingMilestone(null);
          load();
          onJobChanged();
        }}
      />
    </Card>
  );
}

