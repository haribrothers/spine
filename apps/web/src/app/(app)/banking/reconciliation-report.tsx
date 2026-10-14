"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AppShellHeader, Button, Card, Spinner, StatCard, useConfirm } from "@spine/ui";
import type { ReconciliationEntry, ReconciliationView } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
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
      setError(err instanceof Error ? err.message : "Couldn't load this reconciliation. Refresh to try again.");
    }
  }, [reconciliationId]);

  useEffect(() => {
    if (canReconcile) void load();
  }, [canReconcile, load]);

  if (!canReconcile) return <NoAccess pageName="Reconciliation" />;

  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const signed = (v: bigint) => (v > 0n ? `+${money(v)}` : money(v));
  const sense = view?.moneyAccount.kind === "card" ? -1n : 1n;
  const name = view?.moneyAccount.name ?? "Account";
  const end = view ? formatDay(view.statementEndDate) : "";

  async function download() {
    setBusy(true);
    try {
      const { blob, headers } = await apiClient.download(`/bank-reconciliations/${reconciliationId}/report.pdf`);
      saveBlob(blob, filenameFrom(headers, `reconciliation-${view?.statementEndDate ?? "report"}.pdf`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't download the report. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!view) return;
    const ok = await confirm({
      title: "Undo this reconciliation?",
      description: `Statement to ${end} · ${view.entriesMatched} entries. Its entries go back to unreconciled; nothing is deleted. Its statement lines go back to unmatched.`,
      confirmLabel: "Undo reconciliation",
      cancelLabel: "Go back",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiClient.post(`/bank-reconciliations/${reconciliationId}/undo`);
      showToast("Reconciliation undone", `Entries to ${end} are unreconciled again.`);
      router.push(`/banking/${accountId}/reconciliations`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't undo this reconciliation. Try again.");
      setBusy(false);
    }
  }

  const header = (
    <AppShellHeader
      breadcrumb={[
        { label: "Money" },
        { label: "Banking", href: "/banking" },
        { label: name, href: `/banking/${accountId}` },
        { label: "Reconciliations", href: `/banking/${accountId}/reconciliations` },
        { label: end || "Reconciliation" },
      ]}
      title={view ? `Reconciliation to ${end}` : "Reconciliation"}
      description={
        view
          ? [name, view.finishedBy ? `Finished by ${view.finishedBy.name}${view.finishedAt ? ` · ${formatDay(view.finishedAt.slice(0, 10))}` : ""}` : view.status === "in_progress" ? "In progress" : null, view.fileNames.join(", ") || null].filter(Boolean).join(" · ")
          : undefined
      }
      action={
        view ? (
          <div className="flex flex-wrap gap-2">
            {view.status === "finished" && view.isLatest && (
              <Button variant="secondary" onClick={() => void undo()} disabled={busy}>
                <MENU_ICONS.moveOff size={14} aria-hidden />
                Undo
              </Button>
            )}
            <Button onClick={() => void download()} disabled={busy}>
              <MENU_ICONS.download size={14} aria-hidden />
              Download report
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
          <Figure label="Statement closing balance" value={money(view.statementClosingBalance)} />
          <Op>+</Op>
          <Figure label="Deposits not yet on the statement" value={money(deposits)} />
          <Op>−</Op>
          <Figure label="Payments not yet on the statement" value={money(payments)} />
          {excluded !== 0n && (
            <>
              <Op>−</Op>
              <Figure label="Statement lines excluded from the books" value={money(excluded)} />
            </>
          )}
          <Op>=</Op>
          <Figure label={`Balance in Spine on ${end}`} value={money(view.spineBalance)} strong />
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Opening balance" value={money(view.openingBalance)} trend={{ direction: "neutral", label: view.lastReconciledOn && view.lastReconciledOn !== view.statementEndDate ? `Reconciled to ${formatDay(view.lastReconciledOn)}` : view.broughtForwardBefore ? `Brought forward before ${formatDay(view.broughtForwardBefore)}` : "—" }} />
          <StatCard label="Cleared in Spine" value={money(view.clearedBalance)} trend={{ direction: "neutral", label: `${matchedLines.length} ${matchedLines.length === 1 ? "line" : "lines"} matched` }} />
          <StatCard label="Excluded" value={`${excludedLines.length} ${excludedLines.length === 1 ? "line" : "lines"}`} trend={{ direction: "neutral", label: excludedLines.length ? "with your notes" : "none" }} />
        </div>

        <Section title="What's outstanding" testId="reconciliation-outstanding">
          {view.outstanding.length === 0 ? (
            <p className="px-4 py-3 text-[13.5px] text-on-surface-muted">Nothing — every entry up to {end} is on the statement.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-surface-sunken">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Entry</th>
                  <th className={th}>Contact</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {view.outstanding.map((e) => {
                  const amount = sense * BigInt(e.amount);
                  return (
                    <tr key={e.journalLineId} className="border-t border-border">
                      <td className={td}>{formatDay(e.date)}</td>
                      <td className={td}>
                        {entryLink(e)} <span className="text-[12.5px] text-on-surface-muted">· {amount > 0n ? "deposit" : "payment"} not yet on the statement</span>
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

        <Section title="Matched lines" testId="reconciliation-matched">
          <table className="w-full">
            <thead className="bg-surface-sunken">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Statement line</th>
                <th className={th}>Matched to</th>
                <th className={`${th} text-right`}>Amount</th>
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
              Show all {matchedLines.length} matched lines
            </button>
          )}
        </Section>

        {excludedLines.length > 0 && (
          <Section title="Excluded" testId="reconciliation-excluded">
            <table className="w-full">
              <thead className="bg-surface-sunken">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Statement line</th>
                  <th className={th}>Note</th>
                  <th className={`${th} text-right`}>Amount</th>
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
