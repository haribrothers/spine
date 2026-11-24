"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AppShellHeader,
  Button,
  Card,
  Checkbox,
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
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useConfirm,
} from "@spine/ui";
import { AI_BANK_MAX_LINES, AI_NOT_IN_MATCH_ALL, MATCH_SUM_MISMATCH, aiPausedMessage, parseStatementAmount, type AiBankSuggestions, type MoneyAccount, type ReconciliationView, type StatementLine } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { useToast } from "../../../components/toast-host";
import { CircleCheck, FileText, Search, Sparkles } from "lucide-react";
import { AiActionButton } from "../../../components/ai-action-button";
import { AiUnavailableNotice } from "../../../components/ai-unavailable-notice";
import { aiFeatureShown, useAiStatus } from "../../../lib/use-ai-status";
import { useAiRequest } from "../../../lib/use-ai-request";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { aiCreateLabel, lineTab, orderEntries, searchLines, type LineTab } from "./reconcile-state";
import { NoAccess } from "../../../components/no-access";
import { formatDay, fromIsoDate, toIsoDate } from "./dates";
import { StatementImportDialog } from "./statement-import-dialog";
import { ReconcileCreateDrawer } from "./reconcile-create-drawer";

type Matches = ReconciliationView["matches"];
type Exclusions = { statementLineId: string; note: string }[];

/** A statement line's status colour. */
const STATUS_TONE = { matched: "text-paid", excluded: "text-on-surface-muted", suggested: "text-due-soon", unmatched: "text-on-surface-muted" } as const;

const shortDay = (iso: string) => fromIsoDate(iso).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric" });

/**
 * US-BANK-08 (D-158, D-176) — `ReconcileAccount`: statement lines on the
 * left, unreconciled Spine entries on the right, matched one line to one or
 * more entries. Every match and exclusion is saved as it's made. US-AI-14
 * (D-173) — "Suggest with AI" for the lines the rules couldn't settle; its
 * suggestions are kept, never in "Match all", and matched one at a time.
 */
export function ReconcileAccount({ accountId }: { accountId: string }) {
  const t = useT();
  const canReconcile = useCapability("banking.reconcile");
  const [account, setAccount] = useState<MoneyAccount | null>(null);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  // US-BANK-09
  const [creating, setCreating] = useState<StatementLine | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  // US-BANK-10
  const [finished, setFinished] = useState<{ endDate: string } | null>(null);
  const [rec, setRec] = useState<ReconciliationView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [closingText, setClosingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // US-AI-14
  const [aiDismissed, setAiDismissed] = useState<Set<string>>(new Set());
  const aiStatus = useAiStatus();
  const aiShown = aiFeatureShown(aiStatus, "bankSuggestions");
  const aiRequest = useAiRequest<AiBankSuggestions>();
  const [excluding, setExcluding] = useState<StatementLine | null>(null);
  const [excludeNote, setExcludeNote] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  // US-BANK-16
  const [tab, setTab] = useState<LineTab>("todo");
  const [lineQuery, setLineQuery] = useState("");
  const [entryQuery, setEntryQuery] = useState("");
  const [statementEnd, setStatementEnd] = useState<{ date: string; closingBalance: string; fileName: string } | null>(null);
  const showToast = useToast();

  const money = useCallback((amount: string | bigint) => formatMoney(BigInt(amount), currency), [currency]);
  const signed = (amount: string) => (BigInt(amount) > 0n ? `+${money(amount)}` : money(amount));

  const applyView = useCallback(
    (view: ReconciliationView) => {
      setRec(view);
      setEndDate(fromIsoDate(view.statementEndDate));
      setClosingText(formatMoney(BigInt(view.statementClosingBalance), currency));
    },
    [currency],
  );

  const load = useCallback(async () => {
    try {
      const [accounts, open, settings] = await Promise.all([
        apiClient.get<MoneyAccount[]>("/money-accounts"),
        apiClient.get<{ id: string }[]>(`/bank-reconciliations?moneyAccountId=${accountId}&status=in_progress`),
        apiClient.get<{ value: { code: string } | null }>("/org/settings/currency").catch(() => ({ value: null })),
      ]);
      setAccounts(accounts);
      setAccount(accounts.find((a) => a.id === accountId) ?? null);
      if (settings.value?.code) setCurrency(settings.value.code);
      if (open[0]) applyView(await apiClient.get<ReconciliationView>(`/bank-reconciliations/${open[0].id}`));
      else {
        setRec(null);
        // US-BANK-16: start from where the imported statement ends.
        const end = await apiClient.get<{ date: string; closingBalance: string; fileName: string } | null>(`/money-accounts/${accountId}/statement-end`).catch(() => null);
        setStatementEnd(end);
        if (end) {
          setEndDate(fromIsoDate(end.date));
          setClosingText(formatMoney(BigInt(end.closingBalance), settings.value?.code ?? "USD"));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.reconcile.loadError"));
    } finally {
      setLoaded(true);
    }
  }, [accountId, applyView]);

  useEffect(() => {
    if (canReconcile) void load();
  }, [canReconcile, load]);

  async function start(nextEnd = endDate, nextClosing = closingText) {
    const closing = parseStatementAmount(nextClosing, currency);
    if (closing === null) {
      setError(t("banking.reconcile.closingRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    setFinished(null);
    try {
      applyView(await apiClient.post<ReconciliationView>("/bank-reconciliations", { moneyAccountId: accountId, statementEndDate: toIsoDate(nextEnd), statementClosingBalance: closing.toString() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.reconcile.saveError"));
    } finally {
      setBusy(false);
    }
  }

  const exclusionsOf = (view: ReconciliationView): Exclusions =>
    view.statementLines.filter((l) => l.status === "excluded").map((l) => ({ statementLineId: l.id, note: l.excludeNote ?? "" }));

  async function save(matches: Matches, exclusions: Exclusions) {
    if (!rec) return;
    setBusy(true);
    setError(null);
    try {
      setRec(await apiClient.put<ReconciliationView>(`/bank-reconciliations/${rec.id}/matches`, { matches, exclusions }));
      setSelectedLine(null);
      setTicked(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.reconcile.saveMatchError"));
    } finally {
      setBusy(false);
    }
  }

  /** US-BANK-10 — saves the reconciliation once Spine agrees with the statement. */
  async function finish() {
    if (!rec) return;
    const ok = await confirm({
      title: t("banking.reconcile.finishConfirmTitle"),
      description: t("banking.reconcile.finishConfirmBody", { account: account?.name ?? rec.moneyAccount.name, date: formatDay(rec.statementEndDate) }),
      confirmLabel: t("banking.reconcile.finishReconciliation"),
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/bank-reconciliations/${rec.id}/finish`);
      setFinished({ endDate: rec.statementEndDate });
      setNotice(null);
      setRec(null);
      setClosingText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.reconcile.finishError"));
    } finally {
      setBusy(false);
    }
  }

  /** US-BANK-09 — after recording the missing entry, match the line to it. */
  async function matchCreated(line: StatementLine, sourceId: string) {
    if (!rec) return;
    setNotice(null);
    try {
      const view = await apiClient.get<ReconciliationView>(`/bank-reconciliations/${rec.id}`);
      setRec(view);
      const entry = view.entries.find((e) => e.sourceId === sourceId && !e.statementLineId && e.amount === line.amount);
      if (!entry) {
        setNotice(t("banking.reconcile.createdNotFound", { date: formatDay(view.statementEndDate) }));
        return;
      }
      // An entry created as AI suggested is matched as suggested by AI.
      const fromAi = Boolean(view.aiSuggestions?.suggestions.some((s) => s.statementLineId === line.id && s.create));
      await save([...view.matches, { statementLineId: line.id, journalLineIds: [entry.journalLineId], suggestedBy: fromAi ? "ai" : "person" }], exclusionsOf(view));
      setNotice(t("banking.reconcile.createdMatched", { line: line.description }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.reconcile.createdMatchFailed"));
    }
  }

  const entryById = useMemo(() => new Map((rec?.entries ?? []).map((e) => [e.journalLineId, e])), [rec]);
  const suggestionFor = useMemo(() => new Map((rec?.suggestions ?? []).filter((s) => !dismissed.has(s.statementLineId)).map((s) => [s.statementLineId, s.journalLineId])), [rec, dismissed]);
  // US-AI-14: AI's kept suggestions, less the ones dismissed here.
  const aiFor = useMemo(() => new Map((rec?.aiSuggestions?.suggestions ?? []).filter((s) => !aiDismissed.has(s.statementLineId)).map((s) => [s.statementLineId, s])), [rec, aiDismissed]);
  const openEntries = (rec?.entries ?? []).filter((e) => !e.statementLineId);
  const selected = rec?.statementLines.find((l) => l.id === selectedLine) ?? null;
  const tickedSum = [...ticked].reduce((sum, id) => sum + BigInt(entryById.get(id)?.amount ?? "0"), 0n);
  const canMatch = selected !== null && ticked.size > 0 && tickedSum === BigInt(selected.amount);

  // US-BANK-16: progress, tabs and search over the statement lines; same-amount entries first.
  const suggestedIds = new Set([...suggestionFor.keys(), ...aiFor.keys()]);
  const lines = rec?.statementLines ?? [];
  // US-AI-14: the lines the rules couldn't settle, which AI looks at (at most 30 a time).
  const ruleLineIds = new Set((rec?.suggestions ?? []).map((s) => s.statementLineId));
  const unsettled = Math.min(lines.filter((l) => l.status === "unmatched" && !ruleLineIds.has(l.id)).length, AI_BANK_MAX_LINES);
  const selectedAi = selected ? aiFor.get(selected.id) : undefined;
  const counts = {
    todo: lines.filter((l) => l.status === "unmatched").length,
    suggested: lines.filter((l) => l.status === "unmatched" && suggestedIds.has(l.id)).length,
    matched: lines.filter((l) => l.status === "matched").length,
    excluded: lines.filter((l) => l.status === "excluded").length,
  };
  const done = counts.matched + counts.excluded;
  const shownLines = searchLines(
    lines.filter((l) => lineTab(l, suggestedIds.has(l.id)).includes(tab)),
    lineQuery,
  );
  const shownEntries = orderEntries(openEntries, selected, entryQuery, selectedAi?.rankedJournalLineIds ?? []);

  function askAi() {
    if (!rec) return;
    const id = rec.id;
    void aiRequest.run(
      (signal) => apiClient.post<AiBankSuggestions>("/ai/bank-suggestions", { reconciliationId: id }, { signal }),
      (answer) => {
        setAiDismissed(new Set());
        setRec((current) => (current && current.id === id ? { ...current, aiSuggestions: answer } : current));
        setTab("suggested");
      },
    );
  }
  const pendingSuggestions = (rec?.suggestions ?? []).filter((x) => !dismissed.has(x.statementLineId) && lines.some((l) => l.id === x.statementLineId && l.status === "unmatched"));

  /** US-BANK-16 — every suggestion at once, after asking; one save. */
  async function matchAllSuggested() {
    if (!rec || !pendingSuggestions.length) return;
    const n = pendingSuggestions.length;
    const ok = await confirm({
      title: t("banking.reconcile.matchAllTitle", { count: n }),
      description: (
        <span className="flex flex-col gap-2">
          <span>{t("banking.reconcile.matchAllBody")}</span>
          <ul className="flex flex-col divide-y divide-dashed divide-border text-[13px]" data-testid="match-all-pairs">
            {pendingSuggestions.map((x) => {
              const line = lines.find((l) => l.id === x.statementLineId)!;
              const entry = entryById.get(x.journalLineId);
              return (
                <li key={x.statementLineId} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 py-1.5">
                  <span className="truncate">{line.description}</span>
                  <span aria-hidden>→</span>
                  <span className="truncate">{entry?.what ?? t("banking.reconcile.entryFallback")}</span>
                  <b className="tabular-nums">{signed(line.amount)}</b>
                </li>
              );
            })}
          </ul>
        </span>
      ),
      confirmLabel: t("banking.reconcile.matchAllConfirm", { count: n }),
      cancelLabel: t("banking.explorer.goBack"),
    });
    if (!ok) return;
    await save([...rec.matches, ...pendingSuggestions.map((x) => ({ statementLineId: x.statementLineId, journalLineIds: [x.journalLineId], suggestedBy: "rules" as const }))], exclusionsOf(rec));
    showToast(t("banking.reconcile.matchedToast", { count: n }), t("banking.reconcile.matchedToastBody"));
  }

  if (!canReconcile) return <NoAccess pageName={t("banking.reconcile.pageName")} />;

  const lineTabs = [
    ["todo", t("banking.reconcile.tabTodo")],
    ["suggested", t("banking.reconcile.tabSuggested")],
    ["matched", t("banking.reconcile.tabMatched")],
    ["excluded", t("banking.reconcile.tabExcluded")],
  ] as const;
  const name = account?.name ?? rec?.moneyAccount.name ?? t("banking.reconcile.accountFallback");
  const difference = rec ? BigInt(rec.difference) : 0n;
  const matchedCount = rec ? rec.matches.length : 0;

  return (
    <>
      <AppShellHeader
        breadcrumb={[
          { label: t("banking.page.breadcrumbMoney") },
          { label: t("banking.page.title"), href: "/banking" },
          { label: name, href: `/banking/${accountId}` },
          { label: t("banking.reconcile.pageName") },
        ]}
        title={t("banking.reconcile.title", { name })}
        description={t("banking.reconcile.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" asChild>
              <Link href={`/banking/${accountId}/reconciliations`}>{t("banking.register.reconciliations")}</Link>
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              {t("banking.explorer.importStatement")}
            </Button>
          </div>
        }
      />
      {!loaded ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {finished && (
            <Alert variant="success">
              <AlertDescription>
                {t("banking.reconcile.finishedBefore", { name, date: formatDay(finished.endDate) })}
                <Link href={`/banking/${accountId}`} className="font-medium underline">
                  {t("banking.reconcile.finishedLink")}
                </Link>
                {t("banking.reconcile.finishedAfter")}
              </AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert variant="success">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <FormField label={t("banking.reconcile.statementEndDate")} required>
              {() => (
                <div className="w-44">
                  <DatePicker
                    value={endDate}
                    onChange={(d) => {
                      if (!d) return;
                      setEndDate(d);
                      if (rec) void start(d);
                    }}
                  />
                </div>
              )}
            </FormField>
            <FormField label={t("banking.reconcile.closingBalance")} required>
              {(field) => (
                <Input
                  {...field}
                  className="w-52 text-right tabular-nums"
                  inputMode="decimal"
                  value={closingText}
                  placeholder="0.00"
                  onChange={(e) => setClosingText(e.target.value)}
                  onBlur={() => {
                    if (rec && closingText.trim()) void start();
                  }}
                />
              )}
            </FormField>
            {!rec && statementEnd && (
              <p className="flex items-center gap-1.5 pb-2.5 text-[12.5px] text-on-surface-muted" data-testid="statement-end">
                <FileText size={13} aria-hidden />
                {t("banking.reconcile.fromStatement", { file: statementEnd.fileName, date: formatDay(statementEnd.date) })}
              </p>
            )}
            {rec && (
              <p className="ml-auto flex items-center gap-1.5 pb-2.5 text-[13px] text-on-surface-muted">
                <CircleCheck size={14} aria-hidden className="text-paid" />
                {t("banking.reconcile.savedAsYouGo")}
              </p>
            )}
            {!rec && (
              <Button onClick={() => start()} disabled={busy || !closingText.trim()}>
                {busy ? <Spinner size="sm" /> : t("banking.reconcile.startReconciling")}
              </Button>
            )}
          </div>

          {rec && (
            <>
              {lines.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4" data-testid="reconcile-progress">
                  <p className="text-[14px] font-semibold text-on-surface">
                    {t("banking.reconcile.linesDone", { done, total: lines.length })}
                    <span className="ml-2 font-normal text-on-surface-muted">
                      {t("banking.reconcile.progressDetail", { matched: counts.matched, excluded: counts.excluded, suggested: counts.suggested, todo: counts.todo - counts.suggested })}
                    </span>
                  </p>
                  <div className="flex h-2 overflow-hidden rounded bg-surface-sunken" role="progressbar" aria-label={t("banking.reconcile.linesDoneAria")} aria-valuemin={0} aria-valuemax={lines.length} aria-valuenow={done}>
                    <span className="block h-full bg-paid" style={{ flex: counts.matched }} />
                    <span className="block h-full bg-on-surface-muted/50" style={{ flex: counts.excluded }} />
                    <span className="block h-full" style={{ flex: Math.max(lines.length - done, 0) }} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="reconcile-cards">
                <StatCard label={t("banking.reconcile.closingCard")} value={money(rec.statementClosingBalance)} trend={{ direction: "neutral", label: formatDay(rec.statementEndDate) }} />
                <StatCard
                  label={t("banking.reconcile.clearedCard")}
                  value={money(rec.clearedBalance)}
                  trend={{ direction: "neutral", label: t("banking.reconcile.clearedTrend", { amount: money(rec.openingBalance), n: rec.matchedCount }) }}
                />
                <div className="rounded-lg border border-border bg-surface p-5" data-testid="reconcile-difference">
                  <p className="text-[14px] font-medium text-on-surface">{t("banking.reconcile.difference")}</p>
                  <p className={`mt-2 text-[28px] font-semibold tabular-nums ${difference === 0n ? "text-on-surface" : "text-overdue"}`}>{money(rec.difference)}</p>
                  <p className="mt-1 text-[13px] text-on-surface-muted">{difference === 0n ? t("banking.reconcile.agrees") : t("banking.reconcile.untilZero")}</p>
                </div>
              </div>
              {rec.broughtForwardBefore && (
                <p className="text-[13px] text-on-surface-muted">
                  {t("banking.reconcile.broughtForward", { date: formatDay(rec.broughtForwardBefore) })}
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="flex flex-col gap-0 p-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-0">
                    <div>
                      <h2 className="text-[15px] font-semibold text-on-surface">{t("banking.reconcile.statementLines")}</h2>
                      <p className="text-[13px] text-on-surface-muted">
                        {rec.fileNames.length ? t("banking.reconcile.fromFiles", { files: rec.fileNames.join(", ") }) : ""}
                        {t("banking.reconcile.linesTo", { n: rec.statementLines.length, date: shortDay(rec.statementEndDate) })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {aiShown && (unsettled > 0 || rec.aiSuggestions) && (
                        <AiActionButton
                          label={rec.aiSuggestions ? t("banking.reconcile.suggestAgain") : t("banking.reconcile.suggestWithAi", { count: unsettled })}
                          workingLabel={t("banking.reconcile.suggesting")}
                          working={aiRequest.working}
                          disabled={unsettled === 0 || Boolean(aiStatus?.pausedUntil)}
                          onClick={askAi}
                          onCancel={aiRequest.cancel}
                        />
                      )}
                      {pendingSuggestions.length > 0 && (
                        <Button size="sm" disabled={busy} onClick={() => void matchAllSuggested()}>
                          <MENU_ICONS.reconcile size={14} aria-hidden />
                          {t("banking.reconcile.matchAllSuggested", { n: pendingSuggestions.length })}
                        </Button>
                      )}
                    </div>
                  </div>
                  {aiShown && aiStatus?.pausedUntil && <p className="px-4 pt-2 text-[12.5px] text-on-surface-muted">{aiPausedMessage(aiStatus.pausedUntil)}</p>}
                  {aiRequest.state.status === "failed" && (
                    <div className="px-4 pt-3">
                      <AiUnavailableNotice message={aiRequest.state.message} detail={t("banking.reconcile.nothingMatched")} onRetry={aiRequest.state.canRetry ? aiRequest.retry : undefined} />
                    </div>
                  )}
                  <Tabs value={tab} onValueChange={(v) => setTab(v as LineTab)}>
                    <TabsList className="mx-4 mt-2">
                      {lineTabs.map(([key, label]) => (
                        <TabsTrigger key={key} value={key} aria-label={t("banking.reconcile.tabAria", { label, n: counts[key] })}>
                          {label}
                          <span className="ml-1.5 rounded-full bg-surface-sunken px-1.5 text-[11px] font-semibold tabular-nums">{counts[key]}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <TabsContent value={tab} className="pt-0">
                      <div className="relative border-b border-border p-3">
                        <Search size={15} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
                        <Input type="search" aria-label={t("banking.reconcile.searchLines")} placeholder={t("banking.reconcile.searchLinesPlaceholder")} value={lineQuery} onChange={(e) => setLineQuery(e.target.value)} className="pl-9" />
                      </div>
                      {tab === "suggested" && rec.aiSuggestions && (
                        <p className="flex items-start gap-2 border-b border-border bg-info-bg/40 px-4 py-2.5 text-[12.5px] text-on-surface" data-testid="ai-suggestions-note">
                          <Sparkles size={14} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                          <span>
                            {t("banking.reconcile.aiLooked", { count: rec.aiSuggestions.looked })}
                            {t("banking.reconcile.aiSuggestionCount", { count: aiFor.size })}
                            {AI_NOT_IN_MATCH_ALL}
                          </span>
                        </p>
                      )}
                      {rec.statementLines.length === 0 ? (
                        <div className="flex flex-col items-start gap-3 p-4">
                          <p className="text-[13px] text-on-surface-muted">{t("banking.reconcile.noLines", { date: formatDay(rec.statementEndDate) })}</p>
                          <Button variant="secondary" onClick={() => setImportOpen(true)}>
                            {t("banking.explorer.importStatement")}
                          </Button>
                        </div>
                      ) : (
                        <ul data-testid="statement-lines">
                          {shownLines.length === 0 && <li className="p-4 text-[13px] text-on-surface-muted">{lineQuery.trim() ? t("banking.reconcile.noLinesMatch") : tab === "todo" ? t("banking.reconcile.allLinesDone") : t("banking.reconcile.noneHere")}</li>}
                          {shownLines.map((line) => {
                            const ruled = line.status === "unmatched" ? suggestionFor.get(line.id) : undefined;
                            // US-AI-14: AI's suggestion for a line the rules couldn't settle — an entry to match, or something to create.
                            const ai = line.status === "unmatched" && !ruled ? aiFor.get(line.id) : undefined;
                            const aiEntry = ai?.rankedJournalLineIds[0] ? entryById.get(ai.rankedJournalLineIds[0]) : undefined;
                            const suggestion = ruled ?? aiEntry?.journalLineId;
                            const isSelected = selectedLine === line.id;
                            const fromAi = line.status === "matched" && rec.matches.some((m) => m.statementLineId === line.id && m.suggestedBy === "ai");
                            const status =
                              line.status === "matched"
                                ? { text: fromAi ? t("banking.reconcile.statusMatchedAi") : t("banking.reconcile.statusMatched"), tone: STATUS_TONE.matched }
                                : line.status === "excluded"
                                  ? { text: line.excludeNote ? t("banking.reconcile.statusExcludedNote", { note: line.excludeNote }) : t("banking.reconcile.statusExcluded"), tone: STATUS_TONE.excluded }
                                  : suggestion
                                    ? { text: t("banking.reconcile.statusSuggested"), tone: STATUS_TONE.suggested }
                                    : { text: t("banking.reconcile.statusUnmatched"), tone: STATUS_TONE.unmatched };
                            return (
                              <li
                                key={line.id}
                                data-testid="statement-line"
                                className={`flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${isSelected ? "bg-primary/5" : ""}`}
                              >
                                <span className="w-14 shrink-0 text-[13px] text-on-surface-muted">{shortDay(line.date)}</span>
                                <div className="min-w-0 flex-1">
                                  {line.status === "unmatched" ? (
                                    <button
                                      type="button"
                                      aria-pressed={isSelected}
                                      className="text-left text-[14px] text-on-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                      onClick={() => {
                                        setSelectedLine(isSelected ? null : line.id);
                                        setTicked(new Set());
                                      }}
                                    >
                                      {line.description}
                                      {line.reference ? ` · ${line.reference}` : ""}
                                    </button>
                                  ) : (
                                    <p className="text-[14px] text-on-surface">
                                      {line.description}
                                      {line.reference ? ` · ${line.reference}` : ""}
                                    </p>
                                  )}
                                  {ai && (aiEntry || ai.create) ? (
                                    <>
                                      <p className="flex items-center gap-1 text-[12px] font-medium text-primary" data-testid="ai-line-suggestion">
                                        <Sparkles size={12} aria-hidden />
                                        {aiEntry
                                          ? t("banking.reconcile.aiSuggestsEntry", { what: `${aiEntry.what}${aiEntry.contact ? ` · ${aiEntry.contact.name}` : ""}` })
                                          : t("banking.reconcile.aiSuggestsCreate", { what: aiCreateLabel(ai.create!) })}
                                      </p>
                                      <p className="text-[12px] text-on-surface-muted">{aiEntry ? ai.reason : ai.create!.reason}</p>
                                    </>
                                  ) : (
                                    <p className={`text-[12px] font-medium ${status.tone}`}>{status.text}</p>
                                  )}
                                </div>
                                <span className="text-[14px] tabular-nums text-on-surface">{signed(line.amount)}</span>
                                <div className="flex items-center gap-1">
                                  {suggestion && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={busy}
                                        onClick={() => save([...rec.matches, { statementLineId: line.id, journalLineIds: [suggestion], suggestedBy: ruled ? "rules" : "ai" }], exclusionsOf(rec))}
                                      >
                                        {t("banking.reconcile.match")}
                                      </Button>
                                      <Button size="sm" variant="ghost" className="text-primary" onClick={() => (ruled ? setDismissed : setAiDismissed)((d) => new Set(d).add(line.id))}>
                                        {t("banking.reconcile.notThisOne")}
                                      </Button>
                                    </>
                                  )}
                                  {line.status === "unmatched" && !suggestion && (
                                    <Button size="sm" variant="secondary" onClick={() => setCreating(line)}>
                                      {t("banking.reconcile.create")}
                                    </Button>
                                  )}
                                  {line.status === "unmatched" && !suggestion && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-primary"
                                      onClick={() => {
                                        setExcludeNote("");
                                        setExcluding(line);
                                      }}
                                    >
                                      {t("banking.reconcile.exclude")}
                                    </Button>
                                  )}
                                  {line.status === "matched" && (
                                    <Button size="sm" variant="ghost" className="text-primary" disabled={busy} aria-label={t("banking.reconcile.unmatchAria", { name: line.description })} onClick={() => save(rec.matches.filter((m) => m.statementLineId !== line.id), exclusionsOf(rec))}>
                                      {t("banking.reconcile.unmatch")}
                                    </Button>
                                  )}
                                  {line.status === "excluded" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-primary"
                                      disabled={busy}
                                      aria-label={t("banking.reconcile.includeAria", { name: line.description })}
                                      onClick={() => save(rec.matches, exclusionsOf(rec).filter((x) => x.statementLineId !== line.id))}
                                    >
                                      {t("banking.reconcile.include")}
                                    </Button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </TabsContent>
                  </Tabs>
                  {selected && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-sunken p-4" data-testid="match-bar">
                      <p className="text-[13px] text-on-surface" role="status">
                        {ticked.size === 0
                          ? t("banking.reconcile.tickHint", { amount: signed(selected.amount) })
                          : tickedSum === BigInt(selected.amount)
                            ? t("banking.reconcile.entriesAddUp", { count: ticked.size })
                            : MATCH_SUM_MISMATCH(money(tickedSum), money(selected.amount))}
                      </p>
                      <Button
                        disabled={!canMatch || busy}
                        onClick={() =>
                          save(
                            [...rec.matches, { statementLineId: selected.id, journalLineIds: [...ticked], suggestedBy: ticked.size === 1 && selectedAi?.rankedJournalLineIds[0] && ticked.has(selectedAi.rankedJournalLineIds[0]) ? "ai" : "person" }],
                            exclusionsOf(rec),
                          )
                        }
                      >
                        {t("banking.reconcile.match")}
                      </Button>
                    </div>
                  )}
                </Card>

                <Card className="flex flex-col gap-0 p-0">
                  <div className="border-b border-border p-4">
                    <h2 className="text-[15px] font-semibold text-on-surface">{t("banking.reconcile.unreconciledInSpine")}</h2>
                    <p className="text-[13px] text-on-surface-muted">
                      {selected
                        ? selectedAi?.rankedJournalLineIds.length
                          ? t("banking.reconcile.entriesHintAi")
                          : t("banking.reconcile.entriesHint")
                        : t("banking.reconcile.entriesUpTo", { date: shortDay(rec.statementEndDate) })}
                    </p>
                  </div>
                  <div className="relative border-b border-border p-3">
                    <Search size={15} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
                    <Input type="search" aria-label={t("banking.register.searchLabel")} placeholder={t("banking.register.searchLabel")} value={entryQuery} onChange={(e) => setEntryQuery(e.target.value)} className="pl-9" />
                  </div>
                  {openEntries.length === 0 ? (
                    <p className="p-4 text-[13px] text-on-surface-muted">{t("banking.reconcile.allEntriesMatched", { date: formatDay(rec.statementEndDate) })}</p>
                  ) : (
                    <ul data-testid="spine-entries">
                      {shownEntries.map(({ entry, sameAmount, ai }) => {
                        const label = `${entry.what}${entry.contact ? ` · ${entry.contact.name}` : ""}`;
                        return (
                          <li key={entry.journalLineId} data-testid="spine-entry" className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${ai ? "bg-info-bg/50" : sameAmount ? "bg-paid-bg/40" : ""}`}>
                            <Checkbox
                              aria-label={`${label}, ${signed(entry.amount)}`}
                              disabled={!selected}
                              checked={ticked.has(entry.journalLineId)}
                              onCheckedChange={(on) =>
                                setTicked((prev) => {
                                  const next = new Set(prev);
                                  if (on) next.add(entry.journalLineId);
                                  else next.delete(entry.journalLineId);
                                  return next;
                                })
                              }
                            />
                            <span className="w-14 shrink-0 text-[13px] text-on-surface-muted">{shortDay(entry.date)}</span>
                            <span className="min-w-0 flex-1 text-[14px] text-on-surface">
                              {label}
                              {entry.reference ? <span className="text-on-surface-muted"> · {entry.reference}</span> : null}
                              {ai && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-primary" data-testid="ai-entry">
                                  <Sparkles size={11} aria-hidden />
                                  {t("banking.reconcile.aiSuggestsBadge")}
                                </span>
                              )}
                              {sameAmount && !ai && <span className="ml-2 rounded-full bg-paid-bg px-2 py-0.5 text-[11px] font-semibold text-paid">{t("banking.reconcile.sameAmount")}</span>}
                            </span>
                            <span className="text-[14px] tabular-nums text-on-surface">{signed(entry.amount)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </div>

              <Card className="flex flex-wrap items-center justify-between gap-3" data-testid="reconcile-footer">
                <p className={`text-[14px] font-medium ${difference === 0n ? "text-paid" : "text-overdue"}`}>
                  {difference === 0n ? t("banking.reconcile.footerAgrees", { n: matchedCount }) : t("banking.reconcile.footerDifference", { amount: money(rec.difference) })}
                </p>
                <Button onClick={finish} disabled={difference !== 0n || busy}>
                  {busy ? <Spinner size="sm" /> : t("banking.reconcile.finishReconciliation")}
                </Button>
              </Card>
            </>
          )}
        </div>
      )}

      <Dialog open={excluding !== null} onOpenChange={(open) => !open && setExcluding(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t("banking.reconcile.excludeTitle")}</DialogTitle>
            <DialogDescription>
              {excluding ? `${shortDay(excluding.date)} · ${excluding.description} · ${signed(excluding.amount)}. ` : ""}
              {t("banking.reconcile.excludeBody")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label={t("banking.reconcile.note")}>
              {(field) => <Input {...field} value={excludeNote} onChange={(e) => setExcludeNote(e.target.value)} maxLength={200} placeholder={t("banking.reconcile.notePlaceholder")} />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setExcluding(null)}>
              {t("banking.reconcile.cancel")}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (!rec || !excluding) return;
                const line = excluding;
                setExcluding(null);
                void save(rec.matches, [...exclusionsOf(rec), { statementLineId: line.id, note: excludeNote.trim() }]);
              }}
            >
              {t("banking.reconcile.excludeLine")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {rec && (
        <ReconcileCreateDrawer
          line={creating}
          onOpenChange={(open) => !open && setCreating(null)}
          account={{ id: accountId, name }}
          accounts={accounts}
          currency={currency}
          aiCreate={creating ? (aiFor.get(creating.id)?.create ?? undefined) : undefined}
          onCreated={(line, sourceId) => void matchCreated(line, sourceId)}
        />
      )}
      <StatementImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        accountId={accountId}
        accountName={name}
        onImported={() => {
          if (rec) void apiClient.get<ReconciliationView>(`/bank-reconciliations/${rec.id}`).then(setRec);
        }}
      />
      {confirmDialog}
    </>
  );
}
