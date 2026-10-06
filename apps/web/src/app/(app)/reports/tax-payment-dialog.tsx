"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
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
import { inputTaxOverMessage, type MoneyAccount, type TaxPayment } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { MoneyAccountPicker } from "../../../components/money-account-picker";
import { prefillDate, type StatementPrefill } from "../../../components/statement-prefill";
import type { TaxSummaryReport } from "./types";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);
const short = (s: string) => parse(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** "Jul 1 – Sep 30, 2026". */
export function periodLabel(from: string, to: string): string {
  const year = parse(to).toLocaleDateString(undefined, { year: "numeric" });
  return `${short(from)} – ${short(to)}, ${year}`;
}

/** The report's range, then the last full quarter and month before today. */
function periodOptions(reportFrom: string, reportTo: string): { from: string; to: string }[] {
  const today = new Date();
  const q = Math.floor(today.getMonth() / 3);
  const lastQuarter = { from: iso(new Date(today.getFullYear(), q * 3 - 3, 1)), to: iso(new Date(today.getFullYear(), q * 3, 0)) };
  const lastMonth = { from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) };
  const all = [{ from: reportFrom, to: reportTo }, lastQuarter, lastMonth];
  return all.filter((p, i) => all.findIndex((o) => o.from === p.from && o.to === p.to) === i);
}

/**
 * US-TAX-08 (D-143) — `TaxPaymentDialog`: what was paid to the tax
 * authority for a period, using input tax first (P26), or a refund from it
 * (P27). Owner-only, opened from Reports › Tax Summary.
 */
export function TaxPaymentDialog({
  open,
  onOpenChange,
  reportFrom,
  reportTo,
  currency,
  onRecorded,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportFrom: string;
  reportTo: string;
  currency: string;
  onRecorded: (payment: TaxPayment) => void;
  /** US-BANK-09 — from a statement line: a payment of that amount, on that date, from that account. */
  prefill?: StatementPrefill;
}) {
  const [mode, setMode] = useState<"payment" | "refund">("payment");
  const options = useMemo(() => periodOptions(reportFrom, reportTo), [reportFrom, reportTo]);
  const [period, setPeriod] = useState(0);
  const [date, setDate] = useState<Date>(new Date());
  const [collected, setCollected] = useState<bigint | null>(null);
  const [available, setAvailable] = useState<bigint | null>(null);
  const [inputUsed, setInputUsed] = useState(0n);
  const [amount, setAmount] = useState(0n);
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = options[period] ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    setMode("payment");
    setPeriod(0);
    setDate(prefill ? prefillDate(prefill) : new Date());
    setReference(prefill?.reference ?? "");
    setError(null);
  }, [open, prefill]);

  // Tax collected for the period, and the input tax there is on the date.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCollected(null);
    setAvailable(null);
    Promise.all([
      apiClient.get<TaxSummaryReport>(`/org/tax/summary?from=${chosen.from}&to=${chosen.to}`),
      apiClient.get<{ amount: string }>(`/tax-payments/input-tax-available?date=${iso(date)}`),
    ])
      .then(([summary, input]) => {
        if (cancelled) return;
        const c = BigInt(summary.taxCollected);
        const a = BigInt(input.amount);
        setCollected(c);
        setAvailable(a);
        const use = a < c ? a : c;
        setInputUsed(use);
        setAmount(prefill ? prefill.amount : mode === "refund" ? a : c - use);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't load the tax figures."));
    return () => {
      cancelled = true;
    };
  }, [open, chosen.from, chosen.to, date, mode, prefill]);

  useEffect(() => {
    if (prefill) setMoneyAccountId(prefill.moneyAccountId);
  }, [prefill, open]);

  useEffect(() => {
    if (!moneyAccountId) return;
    apiClient
      .get<MoneyAccount[]>("/money-accounts")
      .then((list) => setAccountName(list.find((a) => a.id === moneyAccountId)?.name ?? ""))
      .catch(() => {});
  }, [moneyAccountId]);

  // Collected less the input tax that can be set against it; never below zero.
  const netPayable = collected !== null && available !== null ? collected - (available < collected ? available : collected) : null;
  const m = (v: bigint) => formatMoney(v, currency);

  async function handleSave() {
    setError(null);
    const used = mode === "payment" ? inputUsed : amount;
    if (available !== null && used > available) {
      setError(inputTaxOverMessage(m(available)));
      return;
    }
    if (mode === "payment" && amount + inputUsed <= 0n) {
      setError("Enter the amount paid or the input tax used.");
      return;
    }
    if (mode === "refund" && amount <= 0n) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      const payment =
        mode === "payment"
          ? await apiClient.post<TaxPayment>("/tax-payments", { periodFrom: chosen.from, periodTo: chosen.to, inputTaxUsed: inputUsed.toString(), amount: amount.toString(), moneyAccountId: moneyAccountId || null, date: iso(date), reference: reference.trim() || null })
          : await apiClient.post<TaxPayment>("/tax-refunds", { amount: amount.toString(), moneyAccountId, date: iso(date), reference: reference.trim() || null });
      onOpenChange(false);
      onRecorded(payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record this. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const account = accountName || "the money account";
  const preview =
    mode === "payment"
      ? [`Posts Dr Output Tax Payable ${m(amount + inputUsed)}`, inputUsed > 0n ? `Cr Input Tax Receivable ${m(inputUsed)}` : null, amount > 0n ? `Cr ${account} ${m(amount)}` : null].filter(Boolean).join(" / ") + "."
      : `Posts Dr ${account} ${m(amount)} / Cr Input Tax Receivable ${m(amount)}.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{mode === "payment" ? "Record tax payment" : "Record tax refund"}</DialogTitle>
          <DialogDescription>
            {mode === "payment" ? `What you paid the tax authority for ${periodLabel(chosen.from, chosen.to)}. Input tax is used first.` : "Input tax the tax authority paid back to you."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {mode === "payment" && (
            <div className="grid grid-cols-1 overflow-hidden rounded-md border border-border sm:grid-cols-3" data-testid="tax-payment-figures">
              {[
                { label: "Tax collected", value: collected },
                { label: "Input tax available", value: available },
                { label: "Net payable", value: netPayable },
              ].map((f, i) => (
                <div key={f.label} className={`bg-surface-sunken p-3 ${i > 0 ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
                  <p className="text-[12px] text-on-surface-muted">{f.label}</p>
                  <p className={`text-[18px] font-semibold tabular-nums ${f.label === "Net payable" ? "text-primary" : "text-on-surface"}`}>{f.value === null ? "—" : m(f.value)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mode === "payment" && (
              <FormField label="Period" required>
                {(field) => (
                  <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o, i) => (
                        <SelectItem key={`${o.from}-${o.to}`} value={String(i)}>
                          {periodLabel(o.from, o.to)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
            <FormField label="Date" required>
              {() => <DatePicker value={date} onChange={setDate} disabled={Boolean(prefill)} />}
            </FormField>
            {mode === "payment" && (
              <FormField label="Input tax used" required helperText={available === null ? undefined : `You have ${m(available)} to use.`}>
                {(field) => <MoneyInput id={field.id} aria-describedby={field["aria-describedby"]} value={inputUsed} onValueChange={setInputUsed} currency={currency} />}
              </FormField>
            )}
            <FormField label={mode === "payment" ? "Amount paid" : "Amount"} required helperText={mode === "refund" && available !== null ? `You have ${m(available)} of input tax to claim back.` : undefined}>
              {(field) => <MoneyInput id={field.id} aria-describedby={field["aria-describedby"]} value={amount} onValueChange={setAmount} currency={currency} disabled={Boolean(prefill)} />}
            </FormField>
            {prefill ? (
              <FormField label="Paid from" required>
                {() => <p className="py-2 text-[14px] text-on-surface">{prefill.moneyAccountName}</p>}
              </FormField>
            ) : (
              <MoneyAccountPicker key={mode} form="tax_payment" direction={mode === "payment" ? "out" : "in"} value={moneyAccountId} onValueChange={setMoneyAccountId} />
            )}
            <FormField label="Reference">
              {(field) => <Input {...field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. the challan or return number" maxLength={120} />}
            </FormField>
          </div>
          <p className="text-[13px] text-on-surface-muted" data-testid="tax-payment-preview">
            {preview}
          </p>
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" className={prefill ? "invisible" : "text-primary"} onClick={() => setMode(mode === "payment" ? "refund" : "payment")} disabled={saving || Boolean(prefill)}>
            {mode === "payment" ? "Record a tax refund instead" : "Record a tax payment instead"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || collected === null}>
              {saving ? <Spinner size="sm" /> : mode === "payment" ? "Record payment" : "Record refund"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tax payments and refunds for the report's range (paid in it, or covering it), each deletable by the Owner. */
export function TaxPaymentsList({ from, to, currency, version, onChanged }: { from: string; to: string; currency: string; version: number; onChanged: () => void }) {
  const [rows, setRows] = useState<TaxPayment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<TaxPayment[]>(`/tax-payments?from=${from}&to=${to}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [from, to, version]);

  if (!rows || rows.length === 0) return null;

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/tax-payments/${id}`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4" data-testid="tax-payments">
      <h3 className="text-[15px] font-semibold text-on-surface">Tax payments and refunds</h3>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {rows.map((r) => {
        const what = r.kind === "payment" ? `Tax payment for ${periodLabel(r.periodFrom!, r.periodTo!)}` : "Tax refund";
        const total = BigInt(r.amount) + BigInt(r.inputTaxUsed);
        return (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[13px] first-of-type:border-0">
            <span className={r.deletedAt ? "text-on-surface-muted line-through" : "text-on-surface"}>
              {parse(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {what}
              {r.moneyAccount ? ` · ${r.moneyAccount.name}` : ""}
              {r.reference ? ` · ${r.reference}` : ""}
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-on-surface">
                {formatMoney(r.amount, currency)}
                {BigInt(r.inputTaxUsed) > 0n && <span className="text-on-surface-muted"> + {formatMoney(r.inputTaxUsed, currency)} input tax</span>}
              </span>
              {r.deletedAt ? (
                <span className="text-on-surface-muted">Deleted</span>
              ) : (
                <Button variant="ghost" size="sm" aria-label={`Delete ${what.toLowerCase()} of ${formatMoney(total, currency)}`} onClick={() => remove(r.id)} disabled={busy}>
                  Delete
                </Button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
