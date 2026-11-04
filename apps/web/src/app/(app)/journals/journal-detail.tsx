"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AppShellHeader,
  Button,
  Card,
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
  Spinner,
  StatusChip,
} from "@spine/ui";
import type { ManualJournal } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { HistorySection } from "../../../components/history-section";
import { useMyRole } from "../../../lib/role-context";
import { JournalDialog } from "./journal-dialog";
import { useLoadFailure } from "../../../lib/use-load-failure";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** US-RPT-20, US-RPT-21 — `ManualJournalDetail`: the journal's lines and, once reversed, the reversal. */
export function JournalDetail({ journalId }: { journalId: string }) {
  const loadFailed = useLoadFailure(journalId);
  const [journal, setJournal] = useState<ManualJournal | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  // US-RPT-21
  const router = useRouter();
  const isOwner = useMyRole() === "owner";
  const [copyOpen, setCopyOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseDate, setReverseDate] = useState<Date>(new Date());
  const [reverseReason, setReverseReason] = useState("");
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reverse() {
    setBusy(true);
    setReverseError(null);
    try {
      setJournal(await apiClient.post<ManualJournal>(`/manual-journals/${journalId}/reverse`, { date: iso(reverseDate), reason: reverseReason.trim() }));
      setReverseOpen(false);
    } catch (err) {
      setReverseError(err instanceof Error ? err.message : "Couldn't reverse this journal.");
    } finally {
      setBusy(false);
    }
  }

  const load = useCallback(() => {
    apiClient
      .get<ManualJournal>(`/manual-journals/${journalId}`)
      .then(setJournal)
      .catch((err) => loadFailed(err) || setError(err instanceof Error ? err.message : "Couldn't load this journal."));
  }, [journalId, loadFailed]);

  useEffect(() => {
    load();
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, [load]);

  const money = (v: string) => (BigInt(v) === 0n ? "" : formatMoney(BigInt(v), currency));

  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Reports" }, { label: "Journals", href: "/journals" }, { label: "Detail" }]} title="Journal" />
      <Link href="/journals" className="mb-4 inline-flex items-center gap-1.5 text-[14px] text-on-surface hover:text-primary">
        <ArrowLeft size={14} aria-hidden />
        Back to journals
      </Link>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!journal ? (
        !error && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[20px] font-semibold text-on-surface">{journal.number}</h2>
                {journal.status === "reversed" ? <StatusChip status="draft">Reversed</StatusChip> : <StatusChip status="paid">Posted</StatusChip>}
              </div>
              <p className="mt-1 text-[14px] text-on-surface-muted">
                {day(journal.date)} · {journal.reason}
                {journal.postedBy ? ` · posted by ${journal.postedBy.name}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2" data-testid="journal-actions">
              <HistorySection endpoint={`/manual-journals/${journal.id}/history`} subjectLabel="this journal" />
              {isOwner && (
                <Button variant="secondary" onClick={() => setCopyOpen(true)}>
                  Copy to new journal
                </Button>
              )}
              {isOwner && journal.status === "posted" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReverseDate(new Date());
                    setReverseReason("");
                    setReverseError(null);
                    setReverseOpen(true);
                  }}
                >
                  Reverse
                </Button>
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-on-surface">Lines</h2>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-[14px]" data-testid="journal-detail-lines">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken text-left text-on-surface-muted">
                    <th className="px-4 py-2 font-medium">Account</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 text-right font-medium">Debit</th>
                    <th className="px-4 py-2 text-right font-medium">Credit</th>
                    <th className="px-4 py-2 font-medium">Job</th>
                  </tr>
                </thead>
                <tbody>
                  {(journal.lines ?? []).map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-on-surface">
                        {l.account.code} · {l.account.name}
                      </td>
                      <td className="px-4 py-2 text-on-surface">{l.description ?? ""}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(l.debit)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(l.credit)}</td>
                      <td className="px-4 py-2 text-on-surface">{l.job ? `${l.job.number ? `${l.job.number} · ` : ""}${l.job.name}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border-strong font-semibold text-on-surface">
                    <td />
                    <td className="px-4 py-2">Totals</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMoney(BigInt(journal.total), currency)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMoney(BigInt(journal.total), currency)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {journal.reversal && (
            <Card className="flex flex-col gap-1" data-testid="journal-reversal">
              <h2 className="text-[15px] font-semibold text-on-surface">Reversal</h2>
              <p className="text-[14px] text-on-surface">
                Reversed on {day(journal.reversal.date)}
                {journal.reversal.by ? ` by ${journal.reversal.by.name}` : ""}
              </p>
              <p className="text-[14px] text-on-surface-muted">{journal.reversal.reason}</p>
            </Card>
          )}
        </div>
      )}
      {journal && (
        <JournalDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          currency={currency}
          initial={{
            reason: journal.reason,
            lines: (journal.lines ?? []).map((l) => ({ accountId: l.account.id, description: l.description ?? "", debit: BigInt(l.debit), credit: BigInt(l.credit), jobId: l.job?.id ?? "__none__" })),
          }}
          onPosted={(j) => router.push(`/journals/${j.id}`)}
        />
      )}
      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Reverse {journal?.number}</DialogTitle>
            <DialogDescription>A reversing entry mirrors every line. The journal stays in the history as Reversed.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {reverseError && (
              <Alert variant="critical">
                <AlertDescription>{reverseError}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Reversal date" required>
                {() => <DatePicker value={reverseDate} onChange={(d) => d && setReverseDate(d)} />}
              </FormField>
              <FormField label="Reason" required>
                {(field) => <Input {...field} value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} maxLength={200} placeholder="e.g. Wrong account" />}
              </FormField>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setReverseOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={reverse} disabled={busy || !reverseReason.trim()}>
              {busy ? <Spinner size="sm" /> : "Reverse journal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
