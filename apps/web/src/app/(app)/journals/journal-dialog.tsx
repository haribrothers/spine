"use client";

import { useModule } from "../../../lib/modules-context";
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  Combobox,
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
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { JOURNAL_CONTROL_CODES, JOURNAL_CONTROL_HINT, JOURNAL_OUT_BY, type ManualJournal } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const NO_JOB = "__none__";

export interface JournalLineDraft {
  key: string;
  accountId: string;
  description: string;
  debit: bigint;
  credit: bigint;
  jobId: string;
}

const blank = (): JournalLineDraft => ({ key: Math.random().toString(36).slice(2), accountId: "", description: "", debit: 0n, credit: 0n, jobId: NO_JOB });

/**
 * US-RPT-20 (D-134) — `ManualJournalDialog`: date, reason and lines of
 * account, description, debit, credit and optional job. "Post journal"
 * waits until the lines balance; control accounts aren't offered.
 */
export function JournalDialog({
  open,
  onOpenChange,
  currency,
  initial,
  onPosted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  /** US-RPT-21 — "Copy to new journal" starts from a journal's lines. */
  initial?: { reason: string; lines: Omit<JournalLineDraft, "key">[] } | null;
  onPosted: (journal: ManualJournal) => void;
}) {
  const [date, setDate] = useState<Date>(new Date());
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<JournalLineDraft[]>([blank(), blank()]);
  const [accounts, setAccounts] = useState<{ value: string; label: string }[]>([]);
  const [jobs, setJobs] = useState<{ id: string; name: string; number: string | null }[]>([]);
  // US-SET-24: no Job column while Jobs & field is switched off.
  const jobsOn = useModule("jobsField");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(new Date());
    setReason(initial?.reason ?? "");
    setLines(initial?.lines.length ? initial.lines.map((l) => ({ ...l, key: Math.random().toString(36).slice(2) })) : [blank(), blank()]);
    setError(null);
    apiClient
      .get<Record<string, { id: string; code: string; name: string }[]>>("/org/accounts")
      .then((grouped) =>
        setAccounts(
          Object.values(grouped)
            .flat()
            .filter((a) => !(JOURNAL_CONTROL_CODES as readonly string[]).includes(a.code))
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
        ),
      )
      .catch(() => setAccounts([]));
    apiClient.get<{ id: string; name: string; number: string | null }[]>("/jobs?picker=1").then(setJobs).catch(() => {});
  }, [open, initial]);

  const debits = useMemo(() => lines.reduce((s, l) => s + l.debit, 0n), [lines]);
  const credits = useMemo(() => lines.reduce((s, l) => s + l.credit, 0n), [lines]);
  const outBy = debits > credits ? debits - credits : credits - debits;
  const complete = lines.every((l) => l.accountId && (l.debit > 0n) !== (l.credit > 0n));
  const canPost = reason.trim() && complete && debits > 0n && outBy === 0n && lines.length >= 2;

  function update(key: string, patch: Partial<JournalLineDraft>) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // A line is a debit or a credit.
        if (patch.debit !== undefined && patch.debit > 0n) next.credit = 0n;
        if (patch.credit !== undefined && patch.credit > 0n) next.debit = 0n;
        return next;
      }),
    );
  }

  async function post() {
    setSaving(true);
    setError(null);
    try {
      const journal = await apiClient.post<ManualJournal>("/manual-journals", {
        date: iso(date),
        reason: reason.trim(),
        lines: lines.map((l) => ({ accountId: l.accountId, description: l.description.trim() || null, debit: l.debit.toString(), credit: l.credit.toString(), jobId: l.jobId === NO_JOB ? null : l.jobId })),
      });
      onOpenChange(false);
      onPosted(journal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post this journal.");
    } finally {
      setSaving(false);
    }
  }

  const money = (v: bigint) => formatMoney(v, currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New journal</DialogTitle>
          <DialogDescription>For adjustments no document covers. Journals are never edited — a mistake is reversed.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr]">
            <FormField label="Date" required>
              {() => <DatePicker value={date} onChange={(d) => d && setDate(d)} />}
            </FormField>
            <FormField label="Reason" required>
              {(field) => <Input {...field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Depreciation for March" />}
            </FormField>
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-[13px]" data-testid="journal-lines">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-left text-on-surface-muted">
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Debit</th>
                  <th className="px-3 py-2 text-right font-medium">Credit</th>
                  {jobsOn && <th className="px-3 py-2 font-medium">Job</th>}
                  <th className="px-1 py-2">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.key} className="border-b border-border last:border-0 align-top">
                    <td className="min-w-48 px-3 py-2">
                      <Combobox aria-label={`Account, line ${i + 1}`} options={accounts} value={l.accountId || undefined} onValueChange={(v) => update(l.key, { accountId: v })} placeholder="Choose an account" emptyText="No matching account." />
                    </td>
                    <td className="min-w-40 px-3 py-2">
                      <Input aria-label={`Description, line ${i + 1}`} value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} maxLength={200} />
                    </td>
                    <td className="w-32 px-3 py-2">
                      <MoneyInput aria-label={`Debit, line ${i + 1}`} value={l.debit} onValueChange={(v) => update(l.key, { debit: v })} currency={currency} />
                    </td>
                    <td className="w-32 px-3 py-2">
                      <MoneyInput aria-label={`Credit, line ${i + 1}`} value={l.credit} onValueChange={(v) => update(l.key, { credit: v })} currency={currency} />
                    </td>
                    {jobsOn && (
                      <td className="min-w-36 px-3 py-2">
                        <Select value={l.jobId} onValueChange={(v) => update(l.key, { jobId: v })}>
                          <SelectTrigger aria-label={`Job, line ${i + 1}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_JOB}>—</SelectItem>
                            {jobs.map((j) => (
                              <SelectItem key={j.id} value={j.id}>
                                {j.number ? `${j.number} · ` : ""}
                                {j.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    <td className="px-1 py-2">
                      {lines.length > 2 && (
                        <Button variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                          <X size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-strong bg-surface-sunken font-semibold text-on-surface">
                  <td />
                  <td className="px-3 py-2">Totals</td>
                  <td className="px-3 py-2 text-right tabular-nums" data-testid="journal-debits">
                    {money(debits)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" data-testid="journal-credits">
                    {money(credits)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <div>
            <Button variant="secondary" size="sm" onClick={() => setLines((ls) => [...ls, blank()])}>
              <Plus size={14} aria-hidden />
              Add line
            </Button>
          </div>
          {outBy !== 0n && (
            <Alert variant="critical" data-testid="journal-out-by">
              <AlertDescription>{JOURNAL_OUT_BY(money(outBy))}</AlertDescription>
            </Alert>
          )}
          <p className="text-[12px] text-on-surface-muted">{JOURNAL_CONTROL_HINT}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={post} disabled={!canPost || saving}>
            {saving ? <Spinner size="sm" /> : "Post journal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
