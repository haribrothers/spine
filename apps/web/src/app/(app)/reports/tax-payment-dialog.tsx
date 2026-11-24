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
  useConfirm,
} from "@spine/ui";
import { inputTaxOverMessage, type MoneyAccount, type TaxPayment } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MoneyAccountPicker } from "../../../components/money-account-picker";
import { prefillDate, type StatementPrefill } from "../../../components/statement-prefill";
import type { TaxSummaryReport } from "./types";
import { useT } from "../../../lib/i18n";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);
const short = (s: string) => parse(s).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric" });

/** "Jul 1 – Sep 30, 2026". */
export function periodLabel(from: string, to: string): string {
  const year = parse(to).toLocaleDateString(orgLocaleTag(), { year: "numeric" });
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
  const t = useT();
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
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : t("reports.taxPayment.loadFailed")));
    return () => {
      cancelled = true;
    };
  }, [open, chosen.from, chosen.to, date, mode, prefill, t]);

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
      setError(t("reports.taxPayment.enterPaidOrUsed"));
      return;
    }
    if (mode === "refund" && amount <= 0n) {
      setError(t("reports.taxPayment.enterAmount"));
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
      setError(err instanceof Error ? err.message : t("reports.taxPayment.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const account = accountName || t("reports.taxPayment.theMoneyAccount");
  const preview =
    mode === "payment"
      ? [t("reports.taxPayment.previewPaymentDebit", { amount: m(amount + inputUsed) }), inputUsed > 0n ? t("reports.taxPayment.previewPaymentInputCredit", { amount: m(inputUsed) }) : null, amount > 0n ? t("reports.taxPayment.previewPaymentAccountCredit", { account, amount: m(amount) }) : null].filter(Boolean).join(" / ") + "."
      : t("reports.taxPayment.previewRefund", { account, amount: m(amount) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{mode === "payment" ? t("reports.taxPayment.titlePayment") : t("reports.taxPayment.titleRefund")}</DialogTitle>
          <DialogDescription>
            {mode === "payment" ? t("reports.taxPayment.descriptionPayment", { period: periodLabel(chosen.from, chosen.to) }) : t("reports.taxPayment.descriptionRefund")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {mode === "payment" && (
            <div className="grid grid-cols-1 overflow-hidden rounded-md border border-border md:grid-cols-3" data-testid="tax-payment-figures">
              {[
                { label: t("reports.taxPayment.taxCollected"), value: collected },
                { label: t("reports.taxPayment.inputTaxAvailable"), value: available },
                { label: t("reports.taxPayment.netPayable"), value: netPayable },
              ].map((f, i) => (
                <div key={f.label} className={`bg-surface-sunken p-3 ${i > 0 ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
                  <p className="text-[12px] text-on-surface-muted">{f.label}</p>
                  <p className={`text-[18px] font-semibold tabular-nums ${i === 2 ? "text-primary" : "text-on-surface"}`}>{f.value === null ? "—" : m(f.value)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mode === "payment" && (
              <FormField label={t("reports.taxPayment.period")} required>
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
            <FormField label={t("reports.common.date")} required>
              {() => <DatePicker value={date} onChange={setDate} disabled={Boolean(prefill)} />}
            </FormField>
            {mode === "payment" && (
              <FormField label={t("reports.taxPayment.inputTaxUsed")} required helperText={available === null ? undefined : t("reports.taxPayment.youHave", { amount: m(available) })}>
                {(field) => <MoneyInput id={field.id} aria-describedby={field["aria-describedby"]} value={inputUsed} onValueChange={setInputUsed} currency={currency} />}
              </FormField>
            )}
            <FormField label={mode === "payment" ? t("reports.taxPayment.amountPaid") : t("reports.common.amount")} required helperText={mode === "refund" && available !== null ? t("reports.taxPayment.youHaveToClaim", { amount: m(available) }) : undefined}>
              {(field) => <MoneyInput id={field.id} aria-describedby={field["aria-describedby"]} value={amount} onValueChange={setAmount} currency={currency} disabled={Boolean(prefill)} />}
            </FormField>
            {prefill ? (
              <FormField label={t("reports.taxPayment.paidFrom")} required>
                {() => <p className="py-2 text-[14px] text-on-surface">{prefill.moneyAccountName}</p>}
              </FormField>
            ) : (
              <MoneyAccountPicker key={mode} form="tax_payment" direction={mode === "payment" ? "out" : "in"} value={moneyAccountId} onValueChange={setMoneyAccountId} />
            )}
            <FormField label={t("reports.common.reference")}>
              {(field) => <Input {...field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("reports.taxPayment.referencePlaceholder")} maxLength={120} />}
            </FormField>
          </div>
          <p className="text-[13px] text-on-surface-muted" data-testid="tax-payment-preview">
            {preview}
          </p>
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" className={prefill ? "invisible" : "text-primary"} onClick={() => setMode(mode === "payment" ? "refund" : "payment")} disabled={saving || Boolean(prefill)}>
            {mode === "payment" ? t("reports.taxPayment.switchToRefund") : t("reports.taxPayment.switchToPayment")}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("reports.common.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || collected === null}>
              {saving ? <Spinner size="sm" /> : mode === "payment" ? t("reports.taxPayment.recordPayment") : t("reports.taxPayment.recordRefund")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tax payments and refunds for the report's range (paid in it, or covering it), each deletable by the Owner. */
export function TaxPaymentsList({ from, to, currency, version, onChanged }: { from: string; to: string; currency: string; version: number; onChanged: () => void }) {
  const t = useT();
  const [rows, setRows] = useState<TaxPayment[] | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
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
      setError(err instanceof Error ? err.message : t("reports.taxPayments.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4" data-testid="tax-payments">
      <h3 className="text-[15px] font-semibold text-on-surface">{t("reports.taxPayments.title")}</h3>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {rows.map((r) => {
        const what = r.kind === "payment" ? t("reports.taxPayments.paymentFor", { period: periodLabel(r.periodFrom!, r.periodTo!) }) : t("reports.taxPayments.refund");
        const total = BigInt(r.amount) + BigInt(r.inputTaxUsed);
        return (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[13px] first-of-type:border-0">
            <span className={r.deletedAt ? "text-on-surface-muted line-through" : "text-on-surface"}>
              {/* eslint-disable-next-line i18next/no-literal-string -- date format options, not copy */}
              {parse(r.date).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" })} · {what}
              {r.moneyAccount ? ` · ${r.moneyAccount.name}` : ""}
              {r.reference ? ` · ${r.reference}` : ""}
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-on-surface">
                {formatMoney(r.amount, currency)}
                {BigInt(r.inputTaxUsed) > 0n && <span className="text-on-surface-muted">{t("reports.taxPayments.inputTaxSuffix", { amount: formatMoney(r.inputTaxUsed, currency) })}</span>}
              </span>
              {r.deletedAt ? (
                <span className="text-on-surface-muted">{t("reports.common.deleted")}</span>
              ) : (
                <Button variant="ghost" size="sm" aria-label={t("reports.taxPayments.deleteAria", { what: what.toLowerCase(), amount: formatMoney(total, currency) })} onClick={async () => {
                    const noun = r.kind === "payment" ? t("reports.taxPayments.nounPayment") : t("reports.taxPayments.nounRefund");
                    const ok = await confirm({
                      title: t("reports.taxPayments.deleteTitle", { noun }),
                      description: t("reports.taxPayments.deleteDescription", { what, amount: formatMoney(total, currency), effect: r.kind === "payment" ? t("reports.taxPayments.effectPayment") : t("reports.taxPayments.effectRefund") }),
                      confirmLabel: t("reports.taxPayments.deleteConfirm", { noun }),
                      danger: true,
                    });
                    if (ok) void remove(r.id);
                  }}
                  disabled={busy}
                >
                  {t("reports.common.delete")}
                </Button>
              )}
            </span>
          </div>
        );
      })}
      {confirmDialog}
    </div>
  );
}
