"use client";

import { useEffect, useState } from "react";
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
  Button,
  StatCard,
  StatusChip,
} from "@spine/ui";
import type { OpeningBalancesView, OpeningBill, OpeningCustomerCredit, OpeningInvoice, OpeningVendorCredit } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";

const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

interface TrialBalance {
  lines: { accountId: string; code: string; name: string; debit: string; credit: string }[];
  totalDebit: string;
  totalCredit: string;
}

/**
 * US-RPT-19 — `OpeningBalancesReview`: the trial balance on the day before
 * the cutover date, the opening documents' totals and Opening Balance
 * Adjustments, then "Lock opening balances". An Owner can unlock later;
 * both are audited.
 */
export function ReviewTab({ view, currency, onChanged }: { view: OpeningBalancesView; currency: string; onChanged: (view: OpeningBalancesView) => void }) {
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [docs, setDocs] = useState<{ invoices: OpeningInvoice[]; bills: OpeningBill[]; credits: OpeningCustomerCredit[]; vendorCredits: OpeningVendorCredit[] } | null>(null);
  const [confirm, setConfirm] = useState<"lock" | "unlock" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<TrialBalance>(`/reports/trial-balance?asOf=${view.balancesAsOf}`)
      .then(setTb)
      .catch(() => setTb(null));
    Promise.all([
      apiClient.get<OpeningInvoice[]>("/opening-balances/invoices"),
      apiClient.get<OpeningBill[]>("/opening-balances/bills"),
      apiClient.get<OpeningCustomerCredit[]>("/opening-balances/customer-credits"),
      apiClient.get<OpeningVendorCredit[]>("/opening-balances/vendor-credits"),
    ])
      .then(([invoices, bills, credits, vendorCredits]) => setDocs({ invoices, bills, credits, vendorCredits }))
      .catch(() => setDocs(null));
  }, [view]);

  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const sum = <T,>(rows: T[] | undefined, pick: (r: T) => string) => (rows ?? []).reduce((s, r) => s + BigInt(pick(r)), 0n);
  const adjustment = BigInt(view.adjustment);
  const abs = adjustment < 0n ? -adjustment : adjustment;
  const locked = view.status === "locked";

  async function act(kind: "lock" | "unlock") {
    setBusy(true);
    setError(null);
    try {
      onChanged(await apiClient.post<OpeningBalancesView>(`/opening-balances/${kind}`));
      setConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  function onConfirm(e: React.MouseEvent) {
    e.preventDefault();
    void act(confirm!);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Opening invoices"
          value={money(sum(docs?.invoices, (r) => r.amountDue))}
          trend={{ direction: "neutral", label: `${docs?.invoices.length ?? 0} invoices · ${money(sum(docs?.invoices, (r) => r.retentionHeld))} retention` }}
        />
        <StatCard label="Opening bills" value={money(sum(docs?.bills, (r) => r.amountDue))} trend={{ direction: "neutral", label: `${docs?.bills.length ?? 0} bills` }} />
        <StatCard
          label="Credits"
          value={money(sum(docs?.credits, (r) => r.amount) + sum(docs?.vendorCredits, (r) => r.amount))}
          trend={{ direction: "neutral", label: `customers ${money(sum(docs?.credits, (r) => r.amount))} · vendors ${money(sum(docs?.vendorCredits, (r) => r.amount))}` }}
        />
        <div className={`rounded-lg border p-5 ${adjustment === 0n ? "border-border bg-surface" : "border-due-soon bg-due-soon-bg"}`} data-testid="review-adjustment">
          <p className="text-[14px] font-medium text-on-surface">Opening Balance Adjustments</p>
          <p className={`mt-2 text-[28px] font-semibold tabular-nums ${adjustment === 0n ? "text-paid" : "text-due-soon"}`}>{money(abs)}</p>
          <p className="mt-1 text-[13px] text-on-surface-muted">{adjustment === 0n ? "nothing left to explain" : "your old books don't balance yet"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-on-surface">Trial balance on {day(view.balancesAsOf)}</h2>
        {locked ? (
          <div className="flex items-center gap-2">
            <StatusChip status="paid">Locked{view.lockedAt ? ` on ${new Date(view.lockedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}</StatusChip>
            <Button variant="secondary" onClick={() => setConfirm("unlock")}>
              Unlock
            </Button>
          </div>
        ) : (
          <Button onClick={() => setConfirm("lock")} disabled={view.status === "not_started"}>
            Lock opening balances
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-[14px]" data-testid="review-trial-balance">
          <thead>
            <tr className="border-b border-border text-left text-on-surface-muted">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 text-right font-medium">Debit</th>
              <th className="px-4 py-3 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {(tb?.lines ?? []).map((l) => (
              <tr key={l.accountId} className={`border-b border-border last:border-0 ${l.code === "3900" && adjustment !== 0n ? "bg-due-soon-bg" : ""}`}>
                <td className="px-4 py-2 tabular-nums text-on-surface">{l.code}</td>
                <td className="px-4 py-2 text-on-surface">{l.name}</td>
                <td className="px-4 py-2 text-right tabular-nums">{BigInt(l.debit) > 0n ? money(l.debit) : ""}</td>
                <td className="px-4 py-2 text-right tabular-nums">{BigInt(l.credit) > 0n ? money(l.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
          {tb && (
            <tfoot>
              <tr className="border-t border-border-strong font-semibold text-on-surface">
                <td />
                <td className="px-4 py-3">Totals</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(tb.totalDebit)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(tb.totalCredit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "unlock" ? "Unlock opening balances?" : "Lock opening balances?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "unlock"
                ? `Everything up to ${day(view.balancesAsOf)} opens again so the opening balances can be changed. This is recorded in the audit log.`
                : `Spine closes everything up to ${day(view.balancesAsOf)} so nobody changes your starting point. An owner can unlock it later; both are recorded in the audit log.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm === "lock" && adjustment !== 0n && (
            <Alert variant="warning">
              <AlertDescription>Opening Balance Adjustments still holds {money(abs)}. Lock anyway?</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{confirm === "lock" && adjustment !== 0n ? "Go back" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={onConfirm}>
              {confirm === "unlock" ? "Unlock" : adjustment !== 0n ? "Lock anyway" : "Lock opening balances"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
