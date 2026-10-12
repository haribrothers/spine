"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  AlertDescription,
  Button,
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
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  useConfirm,
} from "@spine/ui";
import { Check, Info, TriangleAlert } from "lucide-react";
import type { PossibleDuplicateVendorPayment } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { localIsoDate, prefillDate, type StatementPrefill } from "../../../components/statement-prefill";
import { MoneyAccountPicker } from "../../../components/money-account-picker";
import { calendarDate } from "../quotes/quotes-list-state";
import { ContactPicker } from "./contact-picker";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "./types";
import { paysSentence, spreadOldestFirst } from "./vendor-payments-state";

const METHOD_OPTIONS = (Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([value, label]) => ({ value, label }));
const DAY_MS = 24 * 60 * 60 * 1000;

interface OpenBill {
  id: string;
  billNumber: string;
  date: string;
  dueDate: string | null;
  balance: bigint;
  currency: string;
}

/**
 * US-PUR-52, US-PUR-53 (D-229) — one dialog everywhere (the list, a bill's
 * Pay bill, the dashboard and a bank statement line): the vendor's open
 * bills oldest due first with how late they are, ticked to pay; a typed
 * amount is spread oldest first. A line before the button says what the
 * payment pays (or by how much it doesn't add up), and Record asks first
 * with the same line (D-218). The same vendor and amount within 3 days, or
 * the same reference, is flagged with a link; it can still be recorded.
 */
export function RecordVendorPaymentDialog({
  open,
  onOpenChange,
  onRecorded,
  prefill,
  initialContactId,
  initialBillId,
  initialBillIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gets the recorded payment (US-BANK-09 matches it to a statement line). */
  onRecorded: (payment: { id: string; number: string | null }) => void;
  /** US-BANK-09 — from a statement line: amount, date and account are fixed. */
  prefill?: StatementPrefill;
  /** US-DASH-13 — "Pay bill" opens on that bill's vendor. */
  initialContactId?: string;
  /** US-PUR-33 — and with that bill ticked for its balance. */
  initialBillId?: string;
  /** US-PUR-58 — Payables' "Pay (n)": several of the vendor's bills ticked for their balances. */
  initialBillIds?: readonly string[];
}) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [contactId, setContactId] = useState("");
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  const [bills, setBills] = useState<OpenBill[] | null>(null);
  const [pay, setPay] = useState<Map<string, bigint>>(new Map());
  // Ticking sets the amount; typing the amount spreads it.
  const [amountTyped, setAmountTyped] = useState(false);
  const [openCredit, setOpenCredit] = useState<{ total: bigint; vendor: string; href: string } | null>(null);
  const [duplicates, setDuplicates] = useState<PossibleDuplicateVendorPayment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = orgLocaleTag();
  const money = (v: bigint) => formatMoney(v, currency);

  useEffect(() => {
    if (!open) return;
    setContactId(initialContactId ?? "");
    setAmount(prefill?.amount ?? 0n);
    setAmountTyped(Boolean(prefill));
    setDate(prefill ? prefillDate(prefill) : new Date());
    setMethod("bank_transfer");
    setReference(prefill?.reference ?? "");
    setBills(null);
    setPay(new Map());
    setDuplicates([]);
    setError(null);
  }, [open, initialContactId, prefill]);

  // The vendor's open bills, oldest due first.
  useEffect(() => {
    if (!open || !contactId) {
      setBills(null);
      setPay(new Map());
      return;
    }
    apiClient
      .get<{ id: string; billNumber: string; date: string; dueDate: string | null; balanceDue: string; currency: string; contactName?: string | null }[]>(`/vendor-bills?contactId=${contactId}&status=recorded`)
      .then((rows) => {
        const open = rows
          .map((b) => ({ id: b.id, billNumber: b.billNumber, date: b.date.slice(0, 10), dueDate: b.dueDate ? b.dueDate.slice(0, 10) : null, balance: BigInt(b.balanceDue), currency: b.currency }))
          .filter((b) => b.balance > 0n)
          .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.date.localeCompare(b.date));
        setBills(open);
        if (rows[0]?.contactName) setVendorName(rows[0].contactName);
        if (open[0]) setCurrency(open[0].currency);
        const wanted = new Set([...(initialBillIds ?? []), ...(initialBillId ? [initialBillId] : [])]);
        const preset = contactId === initialContactId ? open.filter((b) => wanted.has(b.id)) : [];
        if (preset.length && !prefill) {
          setPay(new Map(preset.map((b) => [b.id, b.balance])));
          setAmount(preset.reduce((s, b) => s + b.balance, 0n));
          setAmountTyped(false);
        } else if (prefill) {
          setPay(spreadOldestFirst(open, prefill.amount));
        } else {
          setPay(new Map());
        }
      })
      .catch(() => setBills([]));
  }, [open, contactId, initialBillId, initialBillIds, initialContactId, prefill]);

  // US-PUR-25: the vendor's open credit, offered first.
  useEffect(() => {
    if (!open || !contactId) {
      setOpenCredit(null);
      return;
    }
    apiClient
      .get<{ id: string; balanceAmount: string; contactName: string | null }[]>(`/vendor-credits?contactId=${contactId}&status=open`)
      .then((credits) => {
        const total = credits.reduce((sum, c) => sum + BigInt(c.balanceAmount), 0n);
        if (credits[0]?.contactName) setVendorName(credits[0].contactName);
        setOpenCredit(total > 0n ? { total, vendor: credits[0]!.contactName ?? "This vendor", href: credits.length === 1 ? `/vendor-credits/${credits[0]!.id}` : "/vendor-credits" } : null);
      })
      .catch(() => setOpenCredit(null));
  }, [open, contactId]);

  // US-PUR-53: the same vendor and amount within 3 days, or the same reference.
  useEffect(() => {
    if (!open || !contactId || amount <= 0n || !date) {
      setDuplicates([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const q = new URLSearchParams({ contactId, amount: amount.toString(), date: localIsoDate(date) });
      if (reference.trim()) q.set("reference", reference.trim());
      apiClient
        .get<PossibleDuplicateVendorPayment[]>(`/vendor-payments/possible-duplicates?${q.toString()}`)
        .then(setDuplicates)
        .catch(() => setDuplicates([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, contactId, amount, date, reference]);

  const lines = useMemo(() => (bills ?? []).map((b) => ({ ...b, amount: pay.get(b.id) ?? 0n })), [bills, pay]);
  const ticked = lines.reduce((s, l) => s + l.amount, 0n);
  const diff = amount - ticked;
  const sentence = paysSentence(
    lines.map((l) => ({ number: l.billNumber, amount: l.amount, balance: l.balance })),
    money,
  );
  const canRecord = Boolean(contactId) && amount > 0n && diff === 0n && !saving;

  function changeAmount(next: bigint) {
    setAmount(next);
    setAmountTyped(true);
    setPay(spreadOldestFirst(bills ?? [], next));
  }

  function setLine(billId: string, value: bigint) {
    const bill = bills?.find((b) => b.id === billId);
    if (!bill) return;
    const clamped = value > bill.balance ? bill.balance : value < 0n ? 0n : value;
    const next = new Map(pay);
    if (clamped > 0n) next.set(billId, clamped);
    else next.delete(billId);
    setPay(next);
    if (!amountTyped && !prefill) setAmount([...next.values()].reduce((s, v) => s + v, 0n));
  }

  function toggle(billId: string, on: boolean) {
    const bill = bills?.find((b) => b.id === billId);
    if (!bill) return;
    if (!on) return setLine(billId, 0n);
    // Ticking takes the bill's balance — or, with a typed amount, what's left of it.
    const room = amountTyped || prefill ? (diff > 0n ? diff : 0n) : bill.balance;
    setLine(billId, room > 0n && room < bill.balance ? room : bill.balance);
  }

  function payAll() {
    const next = new Map((bills ?? []).map((b) => [b.id, b.balance] as const));
    setPay(next);
    if (!prefill) {
      setAmountTyped(false);
      setAmount([...next.values()].reduce((s, v) => s + v, 0n));
    }
  }

  const dueText = (b: OpenBill) => {
    if (!b.dueDate) return { due: `Billed ${calendarDate(b.date, new Date(), locale)}`, late: null };
    const days = Math.floor((new Date(new Date().toISOString().slice(0, 10)).getTime() - new Date(b.dueDate).getTime()) / DAY_MS);
    return { due: `Due ${calendarDate(b.dueDate, new Date(), locale)}`, late: days > 0 ? `${days} day${days === 1 ? "" : "s"} late` : null };
  };

  async function record() {
    setError(null);
    if (!canRecord) return;
    const methodLabel = PAYMENT_METHOD_LABELS[method].toLowerCase();
    const ok = await confirm({
      title: "Record this payment?",
      description: `${money(amount)} to ${vendorName ?? "the vendor"} by ${methodLabel}${prefill ? ` from ${prefill.moneyAccountName}` : ""}. It pays ${sentence.replace(/^.*? pays /, "").replace(/\.$/, "")}, and is posted to your books.`,
      confirmLabel: "Record payment",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const recorded = await apiClient.post<{ id: string; number: string | null }>("/vendor-payments", {
        contactId,
        date: localIsoDate(date ?? new Date()),
        method,
        reference: reference.trim() || null,
        moneyAccountId: prefill?.moneyAccountId ?? (moneyAccountId || null),
        currency,
        amount: amount.toString(),
        allocations: lines.filter((l) => l.amount > 0n).map((l) => ({ billId: l.id, amount: l.amount.toString() })),
      });
      onOpenChange(false);
      onRecorded(recorded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record this payment. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const dup = duplicates[0];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Record a vendor payment</DialogTitle>
            <DialogDescription>Tick the bills it pays, oldest due first; a typed amount is spread over them.</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {openCredit && (
              <Alert variant="info" data-testid="vendor-credit-note">
                <AlertDescription>
                  {openCredit.vendor} has {formatMoney(openCredit.total, currency)} of credit.{" "}
                  <a href={openCredit.href} className="font-medium text-primary underline">
                    Apply it first?
                  </a>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Vendor" required>
                {() => <ContactPicker value={contactId} onValueChange={setContactId} />}
              </FormField>
              <FormField label="Amount" required>
                {() => <MoneyInput value={amount} onValueChange={changeAmount} currency={currency} disabled={!contactId || Boolean(prefill)} aria-label="Amount" />}
              </FormField>
              <FormField label="Date" required>
                {() => <DatePicker value={date} onChange={setDate} disabled={Boolean(prefill)} />}
              </FormField>
              <FormField label="Method" required>
                {() => (
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    <SelectTrigger aria-label="Method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHOD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              {prefill ? (
                <FormField label="Paid from" required>
                  {() => <p className="py-2 text-[14px] text-on-surface">{prefill.moneyAccountName}</p>}
                </FormField>
              ) : (
                <MoneyAccountPicker form="vendor_payment" direction="out" value={moneyAccountId} onValueChange={setMoneyAccountId} />
              )}
              <FormField label="Reference" helperText="Cheque number, transaction ID…">
                {(field) => <Input {...field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />}
              </FormField>
            </div>

            {dup && (
              <div className="flex items-start gap-2 rounded-md border border-due-soon/40 bg-due-soon-bg px-3 py-2 text-[13px] text-on-surface" data-testid="vendor-payment-duplicate-warning">
                <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0 text-due-soon" />
                <span>
                  <span className="font-semibold">This looks like {dup.number ?? "a payment already recorded"}</span> — {formatMoney(BigInt(dup.amount), dup.currency)} to {vendorName ?? "this vendor"} on{" "}
                  {calendarDate(dup.date, new Date(), locale)} ({[PAYMENT_METHOD_LABELS[dup.method as PaymentMethod] ?? dup.method, dup.reference].filter(Boolean).join(" · ")}). Record it anyway if it&apos;s a second payment.{" "}
                  <Link href={`/vendor-payments/${dup.id}`} className="font-medium text-primary hover:underline">
                    Open {dup.number ?? "it"} →
                  </Link>
                </span>
              </div>
            )}

            {contactId && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-on-surface">What it pays</h3>
                  {bills && bills.length > 1 && (
                    <button type="button" className="text-[12.5px] font-medium text-primary hover:underline" onClick={payAll}>
                      Pay all
                    </button>
                  )}
                </div>
                {bills === null ? (
                  <div className="flex justify-center py-6">
                    <Spinner size="sm" />
                  </div>
                ) : bills.length === 0 ? (
                  <p className="rounded-lg border border-border px-3 py-3 text-[13px] text-on-surface-muted">This vendor has no recorded bills with a balance to pay.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border" data-testid="vendor-payment-bills">
                    <div className="grid grid-cols-[28px_minmax(0,1fr)_150px_120px_140px] items-center gap-x-2.5 bg-surface-sunken px-3 py-1.5 text-[12px] font-medium text-on-surface-muted">
                      <span />
                      <span>Bill</span>
                      <span>Due</span>
                      <span className="text-right">Balance</span>
                      <span className="text-right">Pay</span>
                    </div>
                    {lines.map((l) => {
                      const { due, late } = dueText(l);
                      return (
                        <div key={l.id} className="grid grid-cols-[28px_minmax(0,1fr)_150px_120px_140px] items-center gap-x-2.5 border-t border-border px-3 py-2 text-[13px]" data-testid="vendor-payment-bill">
                          <Checkbox checked={l.amount > 0n} onCheckedChange={(v) => toggle(l.id, v === true)} aria-label={`Pay ${l.billNumber}`} />
                          <span className="min-w-0">
                            <span className="block font-semibold text-on-surface">{l.billNumber}</span>
                            <span className="block text-[12px] text-on-surface-muted">Billed {calendarDate(l.date, new Date(), locale)}</span>
                          </span>
                          <span>
                            {due}
                            {late && <span className="block text-[12px] font-medium text-overdue">{late}</span>}
                          </span>
                          <span className="text-right tabular-nums">{money(l.balance)}</span>
                          <MoneyInput value={l.amount} onValueChange={(v) => setLine(l.id, v)} currency={currency} aria-label={`Pay on ${l.billNumber}`} />
                        </div>
                      );
                    })}
                  </div>
                )}
                {amount > 0n && bills && bills.length > 0 && (
                  <div
                    className={`flex items-start gap-2 rounded-md px-3 py-2 text-[13px] ${diff === 0n ? "bg-info-bg text-on-surface" : "bg-overdue-bg text-on-surface"}`}
                    data-testid="vendor-payment-summary"
                    role="status"
                  >
                    <Info size={15} aria-hidden className={`mt-0.5 shrink-0 ${diff === 0n ? "text-primary" : "text-overdue"}`} />
                    <span>
                      {diff === 0n
                        ? sentence
                        : diff > 0n
                          ? `${money(diff)} more than the ticked bills — tick another or lower the amount.`
                          : `The ticked bills come to ${money(-diff)} more than the amount — raise it or lower a line.`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </DialogBody>

          <DialogFooter className="items-center">
            <p className="mr-auto text-[12px] text-on-surface-muted">It gets a number and is posted to your books when recorded.</p>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void record()} disabled={!canRecord}>
              {saving ? <Spinner size="sm" /> : <Check size={14} aria-hidden />}
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
