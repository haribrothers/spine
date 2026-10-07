"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AppShellHeader,
  Badge,
  Button,
  DataTable,
  EmptyState,
  StatCard,
  StatusChip,
  type TableColumn,
} from "@spine/ui";
import { History } from "lucide-react";
import type { MoneyAccount, ReconciliationSummary } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { NoAccess } from "../../../components/no-access";
import { formatDay } from "./dates";
import { useEntityToast } from "./entity-toast";

const finishedAt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * US-BANK-11 — `ReconciliationsHistory`: every finished reconciliation of an
 * account, newest first. Only the latest can be undone; undoing takes the
 * tick off its entries and unmatches its statement lines, and deletes nothing.
 */
export function ReconciliationsHistory({ accountId }: { accountId: string }) {
  const canReconcile = useCapability("banking.reconcile");
  const [account, setAccount] = useState<MoneyAccount | null>(null);
  const [rows, setRows] = useState<ReconciliationSummary[] | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState<ReconciliationSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const { show: showToast, toast } = useEntityToast();

  const load = useCallback(async () => {
    try {
      const [accounts, list, settings] = await Promise.all([
        apiClient.get<MoneyAccount[]>("/money-accounts"),
        apiClient.get<ReconciliationSummary[]>(`/money-accounts/${accountId}/reconciliations`),
        apiClient.get<{ value: { code: string } | null }>("/org/settings/currency").catch(() => ({ value: null })),
      ]);
      setAccount(accounts.find((a) => a.id === accountId) ?? null);
      setRows(list);
      if (settings.value?.code) setCurrency(settings.value.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the reconciliations. Refresh to try again.");
    }
  }, [accountId]);

  useEffect(() => {
    if (canReconcile) void load();
  }, [canReconcile, load]);

  async function undo() {
    if (!undoing) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/bank-reconciliations/${undoing.id}/undo`);
      showToast("Reconciliation undone", `Entries to ${formatDay(undoing.statementEndDate)} are unreconciled again.`);
      setUndoing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't undo this reconciliation. Try again.");
      setUndoing(null);
    } finally {
      setBusy(false);
    }
  }

  if (!canReconcile) return <NoAccess pageName="Reconciliations" />;

  const name = account?.name ?? "Account";
  const latest = rows?.[0];
  const totalMatched = (rows ?? []).reduce((sum, r) => sum + r.entriesMatched, 0);
  const oldest = rows?.length ? rows[rows.length - 1]! : null;

  const columns: TableColumn<ReconciliationSummary>[] = [
    { key: "end", header: "Statement end date", render: (r) => formatDay(r.statementEndDate), sortValue: (r) => r.statementEndDate },
    { key: "closing", header: "Closing balance", align: "right", render: (r) => <span className="tabular-nums">{formatMoney(BigInt(r.statementClosingBalance), currency)}</span> },
    { key: "matched", header: "Entries matched", align: "right", render: (r) => <span className="tabular-nums">{r.entriesMatched}</span> },
    { key: "by", header: "Finished by", render: (r) => r.finishedBy?.name ?? <span className="text-on-surface-muted">—</span> },
    { key: "at", header: "Finished", render: (r) => (r.finishedAt ? finishedAt(r.finishedAt) : "—") },
    { key: "status", header: "Status", render: (r) => (r.isLatest ? <Badge className="bg-primary/10 text-primary">Latest</Badge> : <StatusChip status="paid">Finished</StatusChip>) },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) =>
        r.isLatest ? (
          <Button variant="ghost" size="sm" aria-label={`Undo the reconciliation to ${formatDay(r.statementEndDate)}`} onClick={() => setUndoing(r)}>
            Undo
          </Button>
        ) : (
          <span className="text-[12px] text-on-surface-muted">Undo the later reconciliations first.</span>
        ),
    },
  ];

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Money" }, { label: "Banking", href: "/banking" }, { label: name, href: `/banking/${accountId}` }, { label: "Reconciliations" }]}
        title="Reconciliations"
        description={`Every finished reconciliation of ${name}. Only the latest can be undone.`}
      />
      <div className="flex flex-col gap-6">
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Reconciled to" value={latest ? formatDay(latest.statementEndDate) : "Never"} trend={{ direction: "neutral", label: latest ? `closing ${formatMoney(BigInt(latest.statementClosingBalance), currency)}` : "no reconciliation yet" }} />
          <StatCard label="Reconciliations" value={rows ? String(rows.length) : "—"} trend={{ direction: "neutral", label: oldest ? `since ${formatDay(oldest.statementEndDate)}` : "—" }} />
          <StatCard label="Entries matched" value={rows ? String(totalMatched) : "—"} trend={{ direction: "neutral", label: "across all reconciliations" }} />
        </div>
        {rows && rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState icon={<History />} title="No reconciliations yet" description={`Reconcile ${name} against its bank statement and it's listed here.`} />
          </div>
        ) : (
          rows && <DataTable columns={columns} data={rows} rowKey={(r) => r.id} searchPlaceholder="Search reconciliations" searchKey={(r) => `${r.statementEndDate} ${r.finishedBy?.name ?? ""}`} configurablePageSize />
        )}
      </div>
      <AlertDialog open={undoing !== null} onOpenChange={(open) => !open && setUndoing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this reconciliation?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoing ? `Statement to ${formatDay(undoing.statementEndDate)} · ${undoing.entriesMatched} entries. ` : ""}Its entries go back to unreconciled; nothing is deleted. Its statement lines go back to unmatched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-[13px] text-on-surface-muted">Only the most recent reconciliation of an account can be undone.</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void undo();
              }}
            >
              Undo reconciliation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {toast}
    </>
  );
}
