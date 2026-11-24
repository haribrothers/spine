"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AppShellHeader, Button, Card, Spinner, StatCard, useConfirm } from "@spine/ui";
import type { ReconciliationEntry, ReconciliationView } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { filenameFrom, saveBlob } from "../../../lib/save-file";
import { NoAccess } from "../../../components/no-access";
import { useToast } from "../../../components/toast-host";
import { formatDay } from "./dates";
import { sourceHref } from "./register-state";

/** The sums the page and the PDF state: what's outstanding, split into money in and out, in the account's own sense. */
export function reconciliationSummary(view: Pick<ReconciliationView, "outstanding" | "moneyAccount">) {
  const sense = view.moneyAccount.kind === "card" ? -1n : 1n;
  const amounts = view.outstanding.map((e) => sense * BigInt(e.amount));
  return {
    deposits: amounts.filter((a) => a > 0n).reduce((s, a) => s + a, 0n),
    payments: -amounts.filter((a) => a < 0n).reduce((s, a) => s + a, 0n),
  };
}

/**
 * US-BANK-17 (D-231) — `ReconciliationReport`: a finished reconciliation,
 * read-only — how the statement and Spine agree, the opening and cleared
 * balances, what's outstanding, the matched lines and the excluded ones —
 * with Download report and, for the newest, Undo (asks first).
 */
export function ReconciliationReport({ accountId, reconciliationId }: { accountId: string; reconciliationId: string }) {
  const t = useT();
  const router = useRouter();
  const canReconcile = useCapability("banking.reconcile");
  const [view, setView] = useState<ReconciliationView | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { confirm, dialog } = useConfirm();
  const showToast = useToast();

  const load = useCallback(async () => {
    try {
      const [rec, settings] = await Promise.all([
        apiClient.get<ReconciliationView>(`/bank-reconciliations/${reconciliationId}`),
        apiClient.get<{ value: { code: string } | null }>("/org/settings/currency").catch(() => ({ value: null })),
      ]);
      setView(rec);
      if (settings.value?.code) setCurrency(settings.value.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.reconcile.loadError"));
    }
  }, [reconciliationId]);

  useEffect(() => {
    if (canReconcile) void load();
  }, [canReconcile, load]);

  if (!canReconcile) return <NoAccess pageName={t("banking.report.pageName")} />;

  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const signed = (v: bigint) => (v > 0n ? `+${money(v)}` : money(v));
  const sense = view?.moneyAccount.kind === "card" ? -1n : 1n;
  const name = view?.moneyAccount.name ?? t("banking.register.breadcrumbAccount");
  const end = view ? formatDay(view.statementEndDate) : "";

  async function download() {
    setBusy(true);
    try {
      const { blob, headers } = await apiClient.download(`/bank-reconciliations/${reconciliationId}/report.pdf`);
      saveBlob(blob, filenameFrom(headers, `reconciliation-${view?.statementEndDate ?? "report"}.pdf`));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.history.downloadError"));
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!view) return;
    const ok = await confirm({
      title: t("banking.history.undoConfirmTitle"),
      description: t("banking.history.undoConfirmSummary", { date: end, n: view.entriesMatched }) + t("banking.history.undoConfirmBody"),
      confirmLabel: t("banking.history.undoReconciliation"),
      cancelLabel: t("banking.explorer.goBack"),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiClient.post(`/bank-reconciliations/${reconciliationId}/undo`);
      showToast(t("banking.history.undoneTitle"), t("banking.history.undoneBody", { date: end }));
      router.push(`/banking/${accountId}/reconciliations`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.history.undoError"));
      setBusy(false);
    }
  }

  const header = (
    <AppShellHeader
      breadcrumb={[
        { label: t("banking.page.breadcrumbMoney") },
        { label: t("banking.page.title"), href: "/banking" },
        { label: name, href: `/banking/${accountId}` },
        { label: t("banking.history.title"), href: `/banking/${accountId}/reconciliations` },
        { label: end || t("banking.report.pageName") },
      ]}
      title={view ? t("banking.report.title", { date: end }) : t("banking.report.pageName")}
      description={
        view
          ? [
              name,
              view.finishedBy
                ? `${t("banking.report.finishedBy", { name: view.finishedBy.name })}${view.finishedAt ? ` · ${formatDay(view.finishedAt.slice(0, 10))}` : ""}`
                : view.status === "in_progress"
                  ? t("banking.report.inProgress")
                  : null,
              view.fileNames.join(", ") || null,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      action={
        view ? (
          <div className="flex flex-wrap gap-2">
            {view.status === "finished" && view.isLatest && (
              <Button variant="secondary" onClick={() => void undo()} disabled={busy}>
                <MENU_ICONS.moveOff size={14} aria-hidden />
                {t("banking.history.undo")}
              </Button>
            )}
            <Button onClick={() => void download()} disabled={busy}>
              <MENU_ICONS.download size={14} aria-hidden />
              {t("banking.history.downloadReport")}
            </Button>
          </div>
        ) : undefined
      }
    />
  );

  if (!view) {
    return (
      <>
        {header}
        {error ? (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}
      </>
    );
  }

  const { deposits, payments } = reconciliationSummary(view);
  const excluded = BigInt(view.excludedTotal);
  const entryById = new Map(view.entries.map((e) => [e.journalLineId, e]));
  const matchedLines = view.statementLines.filter((l) => l.status === "matched");
  const excludedLines = view.statementLines.filter((l) => l.status === "excluded");
  const entryLink = (e: ReconciliationEntry | undefined) => {
    if (!e) return <span className="text-on-surface-muted">—</span>;
    const href = sourceHref(e);
    return href ? (
      <Link href={href} className="text-primary hover:underline">
        {e.what}
      </Link>
    ) : (
      <span>{e.what}</span>
    );
  };
  const th = "px-4 py-2 text-left text-[12.5px] font-medium text-on-surface-muted";
  const td = "px-4 py-2.5 text-[13.5px] text-on-surface";

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Card className="flex flex-wrap items-center gap-x-5 gap-y-3" data-testid="reconciliation-summary">
          <Figure label={t("banking.report.statementClosing")} value={money(view.statementClosingBalance)} />
          <Op>+</Op>
          <Figure label={t("banking.report.depositsOutstanding")} value={money(deposits)} />
          {/* eslint-disable-next-line i18next/no-literal-string -- a maths symbol, hidden from screen readers */}
          <Op>−</Op>
          <Figure label={t("banking.report.paymentsOutstanding")} value={money(payments)} />
          {excluded !== 0n && (
            <>
              {/* eslint-disable-next-line i18next/no-literal-string -- a maths symbol, hidden from screen readers */}
              <Op>−</Op>
              <Figure label={t("banking.report.excludedFromBooks")} value={money(excluded)} />
            </>
          )}
          <Op>=</Op>
          <Figure label={t("banking.report.balanceOn", { date: end })} value={money(view.spineBalance)} strong />
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={t("banking.report.openingBalance")}
            value={money(view.openingBalance)}
            trend={{
              direction: "neutral",
              label:
                view.lastReconciledOn && view.lastReconciledOn !== view.statementEndDate
                  ? t("banking.report.reconciledTo", { date: formatDay(view.lastReconciledOn) })
                  : view.broughtForwardBefore
                    ? t("banking.report.broughtForward", { date: formatDay(view.broughtForwardBefore) })
                    : "—",
            }}
          />
          <StatCard label={t("banking.reconcile.clearedCard")} value={money(view.clearedBalance)} trend={{ direction: "neutral", label: t("banking.reconcile.matchedToast", { count: matchedLines.length }) }} />
          <StatCard
            label={t("banking.report.excluded")}
            value={t("banking.report.lineCount", { count: excludedLines.length })}
            trend={{ direction: "neutral", label: excludedLines.length ? t("banking.report.withNotes") : t("banking.report.none") }}
          />
        </div>

        <Section title={t("banking.report.outstanding")} testId="reconciliation-outstanding">
          {view.outstanding.length === 0 ? (
            <p className="px-4 py-3 text-[13.5px] text-on-surface-muted">{t("banking.report.nothingOutstanding", { date: end })}</p>
          ) : (
            <table className="w-full">
              <thead className="bg-surface-sunken">
                <tr>
                  <th className={th}>{t("banking.report.colDate")}</th>
                  <th className={th}>{t("banking.report.colEntry")}</th>
                  <th className={th}>{t("banking.report.colContact")}</th>
                  <th className={`${th} text-right`}>{t("banking.report.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {view.outstanding.map((e) => {
                  const amount = sense * BigInt(e.amount);
                  return (
                    <tr key={e.journalLineId} className="border-t border-border">
                      <td className={td}>{formatDay(e.date)}</td>
                      <td className={td}>
                        {entryLink(e)} <span className="text-[12.5px] text-on-surface-muted">{amount > 0n ? t("banking.report.depositNotYet") : t("banking.report.paymentNotYet")}</span>
                      </td>
                      <td className={td}>{e.contact?.name ?? "—"}</td>
                      <td className={`${td} text-right tabular-nums`}>{signed(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section title={t("banking.report.matchedLines")} testId="reconciliation-matched">
          <table className="w-full">
            <thead className="bg-surface-sunken">
              <tr>
                <th className={th}>{t("banking.report.colDate")}</th>
                <th className={th}>{t("banking.report.colStatementLine")}</th>
                <th className={th}>{t("banking.report.colMatchedTo")}</th>
                <th className={`${th} text-right`}>{t("banking.report.colAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? matchedLines : matchedLines.slice(0, 10)).map((l) => {
                const ids = view.matches.find((m) => m.statementLineId === l.id)?.journalLineIds ?? [];
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className={td}>{formatDay(l.date)}</td>
                    <td className={td}>{[l.description, l.reference].filter(Boolean).join(" · ")}</td>
                    <td className={td}>
                      {ids.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          {entryLink(entryById.get(id))}
                        </span>
                      ))}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{signed(sense * BigInt(l.amount))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {matchedLines.length > 10 && !showAll && (
            <button type="button" className="w-full border-t border-border px-4 py-2.5 text-left text-[13px] font-medium text-primary hover:underline" onClick={() => setShowAll(true)}>
              {t("banking.report.showAll", { n: matchedLines.length })}
            </button>
          )}
        </Section>

        {excludedLines.length > 0 && (
          <Section title={t("banking.report.excluded")} testId="reconciliation-excluded">
            <table className="w-full">
              <thead className="bg-surface-sunken">
                <tr>
                  <th className={th}>{t("banking.report.colDate")}</th>
                  <th className={th}>{t("banking.report.colStatementLine")}</th>
                  <th className={th}>{t("banking.report.colNote")}</th>
                  <th className={`${th} text-right`}>{t("banking.report.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {excludedLines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className={td}>{formatDay(l.date)}</td>
                    <td className={td}>{l.description}</td>
                    <td className={`${td} text-on-surface-muted`}>{l.excludeNote || "—"}</td>
                    <td className={`${td} text-right tabular-nums`}>{signed(sense * BigInt(l.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>
      {dialog}
    </>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[12.5px] text-on-surface-muted">{label}</span>
      <span className={`text-[19px] font-semibold tabular-nums ${strong ? "text-paid" : "text-on-surface"}`}>{value}</span>
    </div>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="text-[22px] text-on-surface-muted">
      {children}
    </span>
  );
}

function Section({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface" data-testid={testId}>
      <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold text-on-surface">{title}</h2>
      {children}
    </section>
  );
}
