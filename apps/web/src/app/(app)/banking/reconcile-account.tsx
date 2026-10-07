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
} from "@spine/ui";
import { MATCH_SUM_MISMATCH, parseStatementAmount, type MoneyAccount, type ReconciliationView, type StatementLine } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { NoAccess } from "../../../components/no-access";
import { formatDay, fromIsoDate, toIsoDate } from "./dates";
import { StatementImportDialog } from "./statement-import-dialog";
import { ReconcileCreateDrawer } from "./reconcile-create-drawer";

type Matches = ReconciliationView["matches"];
type Exclusions = { statementLineId: string; note: string }[];

const shortDay = (iso: string) => fromIsoDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * US-BANK-08 (D-158, D-176) — `ReconcileAccount`: statement lines on the
 * left, unreconciled Spine entries on the right, matched one line to one or
 * more entries. Every match and exclusion is saved as it's made.
 */
export function ReconcileAccount({ accountId }: { accountId: string }) {
  const canReconcile = useCapability("banking.reconcile");
  const [account, setAccount] = useState<MoneyAccount | null>(null);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  // US-BANK-09
  const [creating, setCreating] = useState<StatementLine | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const [excluding, setExcluding] = useState<StatementLine | null>(null);
  const [excludeNote, setExcludeNote] = useState("");
  const [importOpen, setImportOpen] = useState(false);

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
      else setRec(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this reconciliation. Refresh to try again.");
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
      setError("Enter the closing balance shown on the statement.");
      return;
    }
    setBusy(true);
    setError(null);
    setFinished(null);
    try {
      applyView(await apiClient.post<ReconciliationView>("/bank-reconciliations", { moneyAccountId: accountId, statementEndDate: toIsoDate(nextEnd), statementClosingBalance: closing.toString() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
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
      setError(err instanceof Error ? err.message : "Couldn't save that match. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /** US-BANK-10 — saves the reconciliation once Spine agrees with the statement. */
  async function finish() {
    if (!rec) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/bank-reconciliations/${rec.id}/finish`);
      setFinished({ endDate: rec.statementEndDate });
      setNotice(null);
      setRec(null);
      setClosingText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't finish this reconciliation. Try again.");
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
        setNotice(`Recorded. Spine couldn't find its entry on this account up to ${formatDay(view.statementEndDate)}, so match it by hand.`);
        return;
      }
      await save([...view.matches, { statementLineId: line.id, journalLineIds: [entry.journalLineId] }], exclusionsOf(view));
      setNotice(`Recorded and matched to ${line.description}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recorded, but the match didn't save. Match it by hand.");
    }
  }

  const entryById = useMemo(() => new Map((rec?.entries ?? []).map((e) => [e.journalLineId, e])), [rec]);
  const suggestionFor = useMemo(() => new Map((rec?.suggestions ?? []).filter((s) => !dismissed.has(s.statementLineId)).map((s) => [s.statementLineId, s.journalLineId])), [rec, dismissed]);
  const openEntries = (rec?.entries ?? []).filter((e) => !e.statementLineId);
  const selected = rec?.statementLines.find((l) => l.id === selectedLine) ?? null;
  const tickedSum = [...ticked].reduce((sum, id) => sum + BigInt(entryById.get(id)?.amount ?? "0"), 0n);
  const canMatch = selected !== null && ticked.size > 0 && tickedSum === BigInt(selected.amount);

  if (!canReconcile) return <NoAccess pageName="Reconcile" />;

  const name = account?.name ?? rec?.moneyAccount.name ?? "account";
  const difference = rec ? BigInt(rec.difference) : 0n;
  const matchedCount = rec ? rec.matches.length : 0;

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Money" }, { label: "Banking", href: "/banking" }, { label: name, href: `/banking/${accountId}` }, { label: "Reconcile" }]}
        title={`Reconcile ${name}`}
        description="Match each statement line to an entry in Spine until the difference is zero."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" asChild>
              <Link href={`/banking/${accountId}/reconciliations`}>Reconciliations</Link>
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              Import statement
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
                {name} is reconciled to {formatDay(finished.endDate)}. Its entries show the Reconciled tick in the{" "}
                <Link href={`/banking/${accountId}`} className="font-medium underline">
                  register
                </Link>
                .
              </AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert variant="success">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <FormField label="Statement end date" required>
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
            <FormField label="Closing balance on the statement" required>
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
            {!rec && (
              <Button onClick={() => start()} disabled={busy || !closingText.trim()}>
                {busy ? <Spinner size="sm" /> : "Start reconciling"}
              </Button>
            )}
          </div>

          {rec && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="reconcile-cards">
                <StatCard label="Statement closing balance" value={money(rec.statementClosingBalance)} trend={{ direction: "neutral", label: formatDay(rec.statementEndDate) }} />
                <StatCard label="Cleared in Spine" value={money(rec.clearedBalance)} trend={{ direction: "neutral", label: `opening ${money(rec.openingBalance)} + ${rec.matchedCount} matched` }} />
                <div className="rounded-lg border border-border bg-surface p-5" data-testid="reconcile-difference">
                  <p className="text-[14px] font-medium text-on-surface">Difference</p>
                  <p className={`mt-2 text-[28px] font-semibold tabular-nums ${difference === 0n ? "text-on-surface" : "text-overdue"}`}>{money(rec.difference)}</p>
                  <p className="mt-1 text-[13px] text-on-surface-muted">{difference === 0n ? "Spine agrees with the statement" : "match or create entries until it's zero"}</p>
                </div>
              </div>
              {rec.broughtForwardBefore && (
                <p className="text-[13px] text-on-surface-muted">
                  First reconciliation of this account: the opening balance is Spine&apos;s balance before {formatDay(rec.broughtForwardBefore)}, the first statement line.
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="flex flex-col gap-0 p-0">
                  <div className="border-b border-border p-4">
                    <h2 className="text-[15px] font-semibold text-on-surface">Statement lines</h2>
                    <p className="text-[13px] text-on-surface-muted">
                      {rec.fileNames.length ? `From ${rec.fileNames.join(", ")} · ` : ""}
                      {rec.statementLines.length} lines to {shortDay(rec.statementEndDate)}
                    </p>
                  </div>
                  {rec.statementLines.length === 0 ? (
                    <div className="flex flex-col items-start gap-3 p-4">
                      <p className="text-[13px] text-on-surface-muted">No statement lines up to {formatDay(rec.statementEndDate)}. Import the statement to start matching.</p>
                      <Button variant="secondary" onClick={() => setImportOpen(true)}>
                        Import statement
                      </Button>
                    </div>
                  ) : (
                    <ul data-testid="statement-lines">
                      {rec.statementLines.map((line) => {
                        const suggestion = line.status === "unmatched" ? suggestionFor.get(line.id) : undefined;
                        const isSelected = selectedLine === line.id;
                        const status =
                          line.status === "matched"
                            ? { text: "Matched", tone: "text-paid" }
                            : line.status === "excluded"
                              ? { text: `Excluded${line.excludeNote ? ` — ${line.excludeNote}` : ""}`, tone: "text-on-surface-muted" }
                              : suggestion
                                ? { text: "Suggested match", tone: "text-due-soon" }
                                : { text: "Unmatched", tone: "text-on-surface-muted" };
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
                              <p className={`text-[12px] font-medium ${status.tone}`}>{status.text}</p>
                            </div>
                            <span className="text-[14px] tabular-nums text-on-surface">{signed(line.amount)}</span>
                            <div className="flex items-center gap-1">
                              {suggestion && (
                                <>
                                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => save([...rec.matches, { statementLineId: line.id, journalLineIds: [suggestion] }], exclusionsOf(rec))}>
                                    Match
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-primary" onClick={() => setDismissed((d) => new Set(d).add(line.id))}>
                                    Not this one
                                  </Button>
                                </>
                              )}
                              {line.status === "unmatched" && !suggestion && (
                                <Button size="sm" variant="secondary" onClick={() => setCreating(line)}>
                                  Create
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
                                  Exclude
                                </Button>
                              )}
                              {line.status === "matched" && (
                                <Button size="sm" variant="ghost" className="text-primary" disabled={busy} aria-label={`Unmatch ${line.description}`} onClick={() => save(rec.matches.filter((m) => m.statementLineId !== line.id), exclusionsOf(rec))}>
                                  Unmatch
                                </Button>
                              )}
                              {line.status === "excluded" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-primary"
                                  disabled={busy}
                                  aria-label={`Include ${line.description}`}
                                  onClick={() => save(rec.matches, exclusionsOf(rec).filter((x) => x.statementLineId !== line.id))}
                                >
                                  Include
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {selected && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-sunken p-4" data-testid="match-bar">
                      <p className="text-[13px] text-on-surface" role="status">
                        {ticked.size === 0
                          ? `Tick the entries in Spine that make up ${signed(selected.amount)}.`
                          : tickedSum === BigInt(selected.amount)
                            ? `${ticked.size} ${ticked.size === 1 ? "entry adds" : "entries add"} up to the line.`
                            : MATCH_SUM_MISMATCH(money(tickedSum), money(selected.amount))}
                      </p>
                      <Button disabled={!canMatch || busy} onClick={() => save([...rec.matches, { statementLineId: selected.id, journalLineIds: [...ticked] }], exclusionsOf(rec))}>
                        Match
                      </Button>
                    </div>
                  )}
                </Card>

                <Card className="flex flex-col gap-0 p-0">
                  <div className="border-b border-border p-4">
                    <h2 className="text-[15px] font-semibold text-on-surface">Unreconciled in Spine</h2>
                    <p className="text-[13px] text-on-surface-muted">
                      {selected ? "Tick the entries that make up the selected line." : `Entries on this account up to ${shortDay(rec.statementEndDate)}`}
                    </p>
                  </div>
                  {openEntries.length === 0 ? (
                    <p className="p-4 text-[13px] text-on-surface-muted">Every entry up to {formatDay(rec.statementEndDate)} is matched.</p>
                  ) : (
                    <ul data-testid="spine-entries">
                      {openEntries.map((entry) => {
                        const label = `${entry.what}${entry.contact ? ` · ${entry.contact.name}` : ""}`;
                        return (
                          <li key={entry.journalLineId} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                            <Checkbox
                              aria-label={`${label}, ${signed(entry.amount)}`}
                              disabled={!selected}
                              checked={ticked.has(entry.journalLineId)}
                              onCheckedChange={(on) =>
                                setTicked((t) => {
                                  const next = new Set(t);
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
                  {difference === 0n ? `Spine agrees with the statement · ${matchedCount} lines matched.` : `Difference ${money(rec.difference)} — match or create entries until it's zero.`}
                </p>
                <Button onClick={finish} disabled={difference !== 0n || busy}>
                  {busy ? <Spinner size="sm" /> : "Finish reconciliation"}
                </Button>
              </Card>
            </>
          )}
        </div>
      )}

      <Dialog open={excluding !== null} onOpenChange={(open) => !open && setExcluding(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Exclude this line?</DialogTitle>
            <DialogDescription>
              {excluding ? `${shortDay(excluding.date)} · ${excluding.description} · ${signed(excluding.amount)}. ` : ""}It leaves the list and counts as matched, with your note. Use it for lines that shouldn&apos;t be in the books, like a bank reversal that cancels out.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label="Note">
              {(field) => <Input {...field} value={excludeNote} onChange={(e) => setExcludeNote(e.target.value)} maxLength={200} placeholder="e.g. Reversed by the bank on Oct 5" />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setExcluding(null)}>
              Cancel
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
              Exclude line
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
    </>
  );
}
