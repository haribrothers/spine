"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription, Badge, Button, Card, DatePicker, FormField, Input, NativeSelect, Spinner, cn } from "@spine/ui";
import { Check, Circle, Flag, Lock, Plus, Trash2 } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCanEditOwnership } from "../../../../lib/capabilities-context";
import { HistorySection } from "../../../../components/history-section";
import { MILESTONE_STATUS_LABELS, type EditableMilestone, type Job, type Milestone, type MilestoneAmountType } from "../types";
import { formatMoney, orgLocaleTag } from "../../../../lib/money";
import { calendarDate } from "../../quotes/quotes-list-state";
import { billedByMilestones, inOrder, milestoneDueText } from "../job-page-state";

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
      amount: m.amount ?? 0,
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
 * verbatim on save failure.
 *
 * Once ANY milestone reaches `invoiced`, its billing details are locked in
 * this editor; only new rows can be added alongside it.
 *
 * US-JOB-35 (D-215) — read as progress: "Billed X of Y" with a bar, then
 * each milestone in order with a step marker, its amount and share, its
 * due state (overdue in the overdue colour) and its action. A job without
 * milestones asks to set up how it's billed (US-JOB-30). The job page owns
 * the milestones and the complete/invoice actions, so its header's next
 * step and these rows stay in step.
 */
export function MilestonesSection({
  job,
  milestones,
  onChanged,
  canComplete,
  canInvoice,
  onComplete,
  onInvoice,
  invoicingId,
}: {
  job: Job;
  milestones: Milestone[] | null;
  /** Reloads the job and its milestones after a change. */
  onChanged: () => void;
  canComplete: (m: Milestone) => boolean;
  canInvoice: boolean;
  onComplete: (m: Milestone) => void;
  onInvoice: (m: Milestone) => void;
  invoicingId: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<EditableMilestone[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const locale = orgLocaleTag();

  // US-JOB-20: milestones are owned through the job, by whoever created it.
  const canManage = useCanEditOwnership(job.createdByUserId ?? null, {
    own: "milestones.edit_own",
    others: "milestones.edit_others",
  });

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
      await apiClient.put<Milestone[]>(`/jobs/${job.id}/milestones`, {
        milestones: rows.map((r, index) => ({
          id: r.id,
          name: r.name.trim(),
          sequence: index,
          amountType: r.amountType,
          amount: r.amount,
          dueDate: r.dueDate,
        })),
      });
      setEditing(false);
      onChanged();
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
              <div key={row.key} className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3">
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
                {/* eslint-disable-next-line no-restricted-syntax -- a field label naming the currency to type in, not an amount */}
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

  const ordered = inOrder(milestones);
  const withMoney = job.contractValueAmount !== undefined;
  const contract = BigInt(job.contractValueAmount ?? "0");
  const billed = billedByMilestones(milestones);
  const billedPct = contract > 0n ? Math.min(100, Math.round(Number((billed * 1000n) / contract) / 10)) : 0;
  const done = milestones.filter((m) => m.status !== "pending").length;
  const held = BigInt(job.retentionHeld ?? "0");

  if (ordered.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-2" data-testid="milestones-empty">
        <h3 className="text-[14px] font-semibold text-on-surface">Set up how this job is billed</h3>
        <p className="text-[13px] text-on-surface-muted">
          Split the contract into milestones — a share or an amount each, with a due date — and invoice each one as it&apos;s done. Without milestones, bill the job however you like.
        </p>
        {canManage && (
          <Button className="mt-1" onClick={startEditing}>
            <Plus size={14} aria-hidden />
            Add milestones
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col p-0" data-testid="milestones">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        {withMoney ? (
          <>
            <span className="text-[13px] text-on-surface-muted" data-testid="milestones-billed">
              Billed <b className="font-semibold text-on-surface">{formatMoney(billed, job.currency)}</b> of <b className="font-semibold text-on-surface">{formatMoney(contract, job.currency)}</b>
            </span>
            <span className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${billedPct}%` }} />
            </span>
            <span className="text-[12.5px] tabular-nums text-on-surface-muted">{billedPct}%</span>
          </>
        ) : (
          <span className="flex-1 text-[13px] text-on-surface-muted">
            {done} of {ordered.length} milestones done
          </span>
        )}
        {canManage && (
          <Button variant="secondary" size="sm" onClick={startEditing}>
            Edit milestones
          </Button>
        )}
      </div>

      <ol className="flex flex-col divide-y divide-border">
        {ordered.map((m) => {
          const due = milestoneDueText(m.dueDate, now, locale);
          const share = m.amount === undefined ? null : m.amountType === "percent" ? `${m.amount}% of contract` : "Fixed amount";
          return (
            <li key={m.id} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:grid-cols-[28px_minmax(0,1fr)_auto_auto]" data-testid="milestone-row">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border",
                  m.status === "invoiced" ? "border-transparent bg-paid text-on-primary" : m.status === "completed" ? "border-primary bg-info-bg text-primary" : "border-border-strong bg-surface text-on-surface-muted",
                )}
                aria-hidden
              >
                {m.status === "invoiced" ? <Check size={14} /> : m.status === "completed" ? <Flag size={13} /> : <Circle size={12} />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-on-surface">{m.name}</span>
                  <Badge className={STATUS_BADGE_CLASS[m.status]}>{MILESTONE_STATUS_LABELS[m.status]}</Badge>
                </div>
                <p className="text-[12.5px] text-on-surface-muted">
                  {[
                    share,
                    m.status === "pending" ? null : m.completedAt ? `completed ${calendarDate(m.completedAt, now, locale)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {m.status === "pending" && (
                    <>
                      {share ? " · " : ""}
                      <span className={due.tone === "over" ? "font-medium text-overdue" : due.tone === "soon" ? "font-medium text-due-soon" : ""}>{due.text}</span>
                    </>
                  )}
                  {m.status === "completed" && <span className="font-medium text-overdue"> · not invoiced yet</span>}
                </p>
                {m.completionNotes && <p className="mt-1 text-[12px] text-on-surface-muted">“{m.completionNotes}”</p>}
              </div>
              <span className="col-start-2 text-[13.5px] font-semibold tabular-nums text-on-surface sm:col-start-auto sm:text-right">
                {m.resolvedAmount !== undefined ? formatMoney(BigInt(m.resolvedAmount), job.currency) : ""}
              </span>
              <div className="col-start-2 flex items-center gap-1 sm:col-start-auto sm:justify-end">
                {m.status === "pending" && canComplete(m) && (
                  <Button size="sm" variant="secondary" onClick={() => onComplete(m)}>
                    Mark complete
                  </Button>
                )}
                {m.status === "completed" && canInvoice && (
                  <Button size="sm" variant="secondary" onClick={() => onInvoice(m)} disabled={invoicingId === m.id}>
                    {invoicingId === m.id ? <Spinner size="sm" /> : "Raise invoice"}
                  </Button>
                )}
                {m.status === "invoiced" && m.invoicedInvoiceId && (
                  <Button size="sm" variant="secondary" asChild>
                    <a href={`/invoices/${m.invoicedInvoiceId}`}>View invoice</a>
                  </Button>
                )}
                <HistorySection endpoint={`/jobs/${job.id}/milestones/${m.id}/history`} subjectLabel="this milestone" />
              </div>
            </li>
          );
        })}
      </ol>

      {withMoney && job.status === "completed" && held > 0n && (
        <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-[13px] text-on-surface-muted" data-testid="retention-held">
          <Lock size={14} aria-hidden />
          <span>
            Retention held <b className="font-semibold text-on-surface">{formatMoney(held, job.currency)}</b>
            {(job.retentionPct ?? 0) > 0 ? ` (${job.retentionPct}%)` : ""} — release it now the job is complete.
          </span>
        </p>
      )}
    </Card>
  );
}
