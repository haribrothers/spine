"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  StatCard,
  StatusChip,
  type TableColumn,
} from "@spine/ui";
import { History, MoreHorizontal } from "lucide-react";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { filenameFrom, saveBlob } from "../../../lib/save-file";
import type { MoneyAccount, ReconciliationSummary } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { NoAccess } from "../../../components/no-access";
import { formatDay } from "./dates";
import { useToast } from "../../../components/toast-host";

const finishedAt = (iso: string) => new Date(iso).toLocaleString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * US-BANK-11 — `ReconciliationsHistory`: every finished reconciliation of an
 * account, newest first. Only the latest can be undone; undoing takes the
 * tick off its entries and unmatches its statement lines, and deletes nothing.
 */
export function ReconciliationsHistory({ accountId }: { accountId: string }) {
  const t = useT();
  const canReconcile = useCapability("banking.reconcile");
  const [account, setAccount] = useState<MoneyAccount | null>(null);
  const [rows, setRows] = useState<ReconciliationSummary[] | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState<ReconciliationSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const showToast = useToast();
  const router = useRouter();

  /** US-BANK-17 — the reconciliation's PDF report. */
  async function download(r: ReconciliationSummary) {
    try {
      const { blob, headers } = await apiClient.download(`/bank-reconciliations/${r.id}/report.pdf`);
      saveBlob(blob, filenameFrom(headers, `reconciliation-${r.statementEndDate}.pdf`));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.history.downloadError"));
    }
  }

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
      setError(err instanceof Error ? err.message : t("banking.history.loadError"));
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
      showToast(t("banking.history.undoneTitle"), t("banking.history.undoneBody", { date: formatDay(undoing.statementEndDate) }));
      setUndoing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.history.undoError"));
      setUndoing(null);
    } finally {
      setBusy(false);
    }
  }

  if (!canReconcile) return <NoAccess pageName={t("banking.history.title")} />;

  const name = account?.name ?? t("banking.register.breadcrumbAccount");
  const latest = rows?.[0];
  const totalMatched = (rows ?? []).reduce((sum, r) => sum + r.entriesMatched, 0);
  const oldest = rows?.length ? rows[rows.length - 1]! : null;

  const columns: TableColumn<ReconciliationSummary>[] = [
    {
      key: "end",
      header: t("banking.history.colEnd"),
      render: (r) => (
        <Link href={`/banking/${accountId}/reconciliations/${r.id}`} className="font-medium text-primary hover:underline">
          {formatDay(r.statementEndDate)}
        </Link>
      ),
      sortValue: (r) => r.statementEndDate,
    },
    { key: "closing", header: t("banking.history.colClosing"), align: "right", render: (r) => <span className="tabular-nums">{formatMoney(BigInt(r.statementClosingBalance), currency)}</span> },
    { key: "matched", header: t("banking.history.colMatched"), align: "right", render: (r) => <span className="tabular-nums">{r.entriesMatched}</span> },
    { key: "by", header: t("banking.history.colBy"), render: (r) => r.finishedBy?.name ?? <span className="text-on-surface-muted">—</span> },
    { key: "at", header: t("banking.history.colAt"), render: (r) => (r.finishedAt ? finishedAt(r.finishedAt) : "—") },
    {
      key: "status",
      header: t("banking.history.colStatus"),
      render: (r) => (r.isLatest ? <Badge className="bg-primary/10 text-primary">{t("banking.history.latest")}</Badge> : <StatusChip status="paid">{t("banking.history.finished")}</StatusChip>),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("banking.history.actionsFor", { date: formatDay(r.statementEndDate) })}
                className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onSelect={() => router.push(`/banking/${accountId}/reconciliations/${r.id}`)}>
                <MENU_ICONS.view aria-hidden />
                {t("banking.history.view")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download(r)}>
                <MENU_ICONS.download aria-hidden />
                {t("banking.history.downloadReport")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!r.isLatest} onSelect={() => setUndoing(r)}>
                <MENU_ICONS.moveOff aria-hidden />
                <span className="flex flex-1 flex-col">
                  {t("banking.history.undo")}
                  {!r.isLatest && <span className="text-[11.5px] text-on-surface-muted">{t("banking.history.undoLaterFirst")}</span>}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <AppShellHeader
        breadcrumb={[
          { label: t("banking.page.breadcrumbMoney") },
          { label: t("banking.page.title"), href: "/banking" },
          { label: name, href: `/banking/${accountId}` },
          { label: t("banking.history.title") },
        ]}
        title={t("banking.history.title")}
        description={t("banking.history.description", { name })}
      />
      <div className="flex flex-col gap-6">
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={t("banking.history.reconciledTo")}
            value={latest ? formatDay(latest.statementEndDate) : t("banking.explorer.never")}
            trend={{ direction: "neutral", label: latest ? t("banking.history.closing", { amount: formatMoney(BigInt(latest.statementClosingBalance), currency) }) : t("banking.history.noneYet") }}
          />
          <StatCard label={t("banking.history.title")} value={rows ? String(rows.length) : "—"} trend={{ direction: "neutral", label: oldest ? t("banking.history.since", { date: formatDay(oldest.statementEndDate) }) : "—" }} />
          <StatCard label={t("banking.history.colMatched")} value={rows ? String(totalMatched) : "—"} trend={{ direction: "neutral", label: t("banking.history.acrossAll") }} />
        </div>
        {rows && rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState icon={<History />} title={t("banking.history.emptyTitle")} description={t("banking.history.emptyBody", { name })} />
          </div>
        ) : (
          rows && <DataTable columns={columns} data={rows} rowKey={(r) => r.id} searchPlaceholder={t("banking.history.searchPlaceholder")} searchKey={(r) => `${r.statementEndDate} ${r.finishedBy?.name ?? ""}`} configurablePageSize />
        )}
      </div>
      <AlertDialog open={undoing !== null} onOpenChange={(open) => !open && setUndoing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("banking.history.undoConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {undoing ? t("banking.history.undoConfirmSummary", { date: formatDay(undoing.statementEndDate), n: undoing.entriesMatched }) : ""}
              {t("banking.history.undoConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-[13px] text-on-surface-muted">{t("banking.history.undoOnlyLatest")}</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("banking.reconcile.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void undo();
              }}
            >
              {t("banking.history.undoReconciliation")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
