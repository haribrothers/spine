"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Switch,
} from "@spine/ui";
import type { PossibleDuplicatePayment } from "@spine/shared";
import { Info, TriangleAlert } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { formatMoney, orgLocaleTag } from "../lib/money";
import { ContactPicker } from "../app/(app)/payments/contact-picker";
import { PAYMENT_METHOD_LABELS, type Payment, type PaymentMethod } from "../app/(app)/payments/types";
import { MoneyAccountPicker } from "./money-account-picker";
import { localIsoDate, prefillDate, type StatementPrefill } from "./statement-prefill";
import { AiField } from "./ai-suggested-tag";

import { SectionLink } from "./section-link";
import { t, useT } from "../lib/i18n";
const METHOD_OPTIONS = (Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([value, label]) => ({ value, label }));
const DAY_MS = 86_400_000;

interface OpenInvoice {
  id: string;
  number: string | null;
  balance: bigint;
  dueDate: string | null;
  type: string;
}

interface InvoiceRow {
  id: string;
  number: string | null;
  balanceDue: string;
  dueDate: string | null;
  type: string;
  currency: string;
  status: string;
}

/** What `POST /payments` returns — the payment as its page shows it. */
export type RecordedPayment = Pick<Payment, "id" | "number" | "contactName" | "currency" | "unallocatedAmount" | "appliedTo">;

/** US-OPS-38 — "RCP-0032 recorded", then the credit left or what it paid. */
export function paymentRecordedToast(payment: RecordedPayment): [string, string] {
  const left = BigInt(payment.unallocatedAmount);
  const paid = (payment.appliedTo ?? []).map((a) => a.number).filter(Boolean);
  const description =
    left > 0n
      ? t("payments.record.toastCredit", { amount: formatMoney(left, payment.currency), name: payment.contactName ?? t("payments.record.theCustomer") })
      : paid.length === 1
        ? t("payments.record.toastPaidOne", { number: paid[0] })
        : t("payments.record.toastPaidMany", { n: paid.length });
  return [t("payments.record.toastTitle", { number: payment.number ?? t("payments.record.payment") }), description];
}

/** Oldest due first; no due date last. */
function byDue(a: OpenInvoice, b: OpenInvoice) {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

/** `amount` spread oldest first over the invoices, each up to its balance. */
export function spreadOldestFirst(invoices: OpenInvoice[], amount: bigint): Map<string, bigint> {
  const lines = new Map<string, bigint>();
  let left = amount;
  for (const inv of invoices) {
    if (left <= 0n) break;
    const take = left < inv.balance ? left : inv.balance;
    lines.set(inv.id, take);
    left -= take;
  }
  return lines;
}

/** "13 days late", or nothing when it isn't late. */
function lateness(dueDate: string | null, today: Date): string | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const days = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - due.getTime()) / DAY_MS);
  return days > 0 ? t("payments.record.daysLate", { count: days }) : null;
}

/**
 * US-PAY-23/24 (D-221) — the one "Record payment" dialog: from the payments
 * list (any customer), a contact, an invoice (its customer chosen and the
 * invoice ticked) or a bank statement line (amount, date and account fixed,
 * US-BANK-09). The customer's open invoices are a checklist oldest due
 * first; ticking fills a line with its balance and, until an amount is
 * typed, the amount is what's ticked; a typed amount is spread oldest first.
 * What goes on the invoices and what becomes credit is said before the
 * button, which is the confirmation (D-218). A payment that looks already
 * recorded is flagged but can still be recorded.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  contactId: presetContactId,
  contactName: presetContactName,
  presetInvoiceId,
  prefill,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** From a contact or an invoice: the customer, fixed. */
  contactId?: string;
  contactName?: string | null;
  /** From an invoice: ticked with its balance. */
  presetInvoiceId?: string;
  /** US-BANK-09 — from a statement line: amount, date and account are fixed. */
  prefill?: StatementPrefill;
  onRecorded: (payment: RecordedPayment) => void;
}) {
  const t = useT();
  const [contactId, setContactId] = useState(presetContactId ?? "");
  const [contactName, setContactName] = useState<string | null>(presetContactName ?? null);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  /** The amount was typed (or fixed by a statement line), so ticking doesn't change it. */
  const [typed, setTyped] = useState(false);
  const [invoices, setInvoices] = useState<OpenInvoice[] | null>(null);
  const [lines, setLines] = useState<Map<string, bigint>>(new Map());
  const [sendReceipt, setSendReceipt] = useState(true);
  const [duplicates, setDuplicates] = useState<PossibleDuplicatePayment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orgCurrency = useRef("USD");
  // The latest amount and whether it was typed, for the invoices' loader (which outlives a render).
  const current = useRef({ amount: 0n, typed: false });
  current.current = { amount, typed };

  useEffect(() => {
    if (!open) return;
    setContactId(presetContactId ?? prefill?.ai?.contactId ?? "");
    setContactName(presetContactName ?? null);
    setAmount(prefill?.amount ?? 0n);
    setTyped(Boolean(prefill));
    setDate(prefill ? prefillDate(prefill) : new Date());
    setMethod("bank_transfer");
    setReference(prefill?.reference ?? "");
    setInvoices(null);
    setLines(new Map());
    setSendReceipt(true);
    setDuplicates([]);
    setError(null);
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => {
        orgCurrency.current = res.value?.code ?? "USD";
      })
      .catch(() => {});
  }, [open, prefill, presetContactId, presetContactName]);

  // The customer's open invoices, their email and currency.
  useEffect(() => {
    if (!open || !contactId) {
      setInvoices(null);
      return;
    }
    let cancelled = false;
    apiClient
      .get<{ name: string; email: string | null }>(`/contacts/${contactId}?picker=1`)
      .then((c) => {
        if (cancelled) return;
        setContactName(c.name);
        setContactEmail(c.email);
      })
      .catch(() => setContactEmail(null));
    apiClient
      .get<InvoiceRow[]>(`/invoices?picker=1&contactId=${contactId}&status=issued`)
      .then((rows) => {
        if (cancelled) return;
        const open_ = rows
          .filter((r) => BigInt(r.balanceDue) > 0n)
          .map((r) => ({ id: r.id, number: r.number, balance: BigInt(r.balanceDue), dueDate: r.dueDate ? r.dueDate.slice(0, 10) : null, type: r.type }))
          .sort(byDue);
        setInvoices(open_);
        setCurrency(rows[0]?.currency ?? orgCurrency.current);
        const preset = presetInvoiceId ? open_.find((i) => i.id === presetInvoiceId) : null;
        if (prefill) {
          setLines(spreadOldestFirst(open_, prefill.amount));
        } else if (preset) {
          setLines(new Map([[preset.id, preset.balance]]));
          setAmount(preset.balance);
          setTyped(false);
        } else if (current.current.typed) {
          // Typed before the invoices arrived: spread it over them.
          setLines(spreadOldestFirst(open_, current.current.amount));
        } else {
          setLines(new Map());
          setAmount(0n);
        }
      })
      .catch(() => !cancelled && setInvoices([]));
    return () => {
      cancelled = true;
    };
    // Reloads only when the customer changes.
  }, [open, contactId]);

  // US-PAY-24 — does it look already recorded?
  const day = date ? localIsoDate(date) : "";
  useEffect(() => {
    if (!open || !contactId || amount <= 0n || !day) {
      setDuplicates([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ contactId, amount: amount.toString(), date: day });
      if (reference.trim()) params.set("reference", reference.trim());
      apiClient
        .get<PossibleDuplicatePayment[]>(`/payments/possible-duplicates?${params.toString()}`)
        .then(setDuplicates)
        .catch(() => setDuplicates([]));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open, contactId, amount, day, reference]);

  const applied = useMemo(() => [...lines.values()].reduce((sum, v) => sum + v, 0n), [lines]);
  const ticked = useMemo(() => [...lines.entries()].filter(([, v]) => v > 0n), [lines]);
  const credit = amount - applied;
  const money = (v: bigint) => formatMoney(v, currency);
  const today = new Date();

  function setLinesAndAmount(next: Map<string, bigint>) {
    setLines(next);
    if (!typed) setAmount([...next.values()].reduce((s, v) => s + v, 0n));
  }

  function toggle(inv: OpenInvoice, on: boolean) {
    const next = new Map(lines);
    if (!on) next.delete(inv.id);
    else {
      const room = amount - applied;
      next.set(inv.id, typed && room > 0n && room < inv.balance ? room : inv.balance);
    }
    setLinesAndAmount(next);
  }

  function setLine(inv: OpenInvoice, value: bigint) {
    const next = new Map(lines);
    const capped = value > inv.balance ? inv.balance : value;
    if (capped > 0n) next.set(inv.id, capped);
    else next.delete(inv.id);
    setLinesAndAmount(next);
  }

  function payAll() {
    if (!invoices) return;
    const next = new Map(invoices.map((i) => [i.id, i.balance]));
    setLines(next);
    if (!prefill) {
      setTyped(false);
      setAmount([...next.values()].reduce((s, v) => s + v, 0n));
    }
  }

  function typeAmount(value: bigint) {
    setAmount(value);
    setTyped(true);
    if (invoices) setLines(spreadOldestFirst(invoices, value));
  }

  async function handleSubmit() {
    setError(null);
    if (!contactId) return setError(t("payments.record.chooseCustomer"));
    if (amount <= 0n) return setError(t("payments.record.enterAmount"));
    if (applied > amount) return setError(t("payments.record.overApplied"));
    setSaving(true);
    try {
      const recorded = await apiClient.post<RecordedPayment>("/payments", {
        contactId,
        date: localIsoDate(date ?? new Date()),
        method,
        reference: reference || null,
        moneyAccountId: prefill?.moneyAccountId ?? (moneyAccountId || null),
        currency,
        amount: amount.toString(),
        allocations: ticked.map(([invoiceId, value]) => ({ invoiceId, amount: value.toString() })),
        sendReceipt: Boolean(contactEmail) && sendReceipt,
      });
      onOpenChange(false);
      onRecorded(recorded);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("payments.record.failed"));
    } finally {
      setSaving(false);
    }
  }

  const who = contactName ?? t("payments.record.theCustomer");
  const summary =
    amount <= 0n
      ? null
      : applied > amount
        ? null
        : applied === 0n
          ? t("payments.record.allCredit", { amount: money(amount), who })
          : (() => {
              const target = ticked.length === 1 ? (invoices?.find((i) => i.id === ticked[0]![0])?.number ?? t("payments.record.oneInvoice")) : t("payments.record.nInvoices", { n: ticked.length });
              return credit > 0n ? t("payments.record.goesOnWithCredit", { applied: money(applied), target, credit: money(credit), who }) : t("payments.record.goesOnNoCredit", { applied: money(applied), target });
            })();
  const duplicate = duplicates[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("payments.record.title")}</DialogTitle>
          <DialogDescription>{t("payments.record.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AiField suggested={!presetContactId && Boolean(prefill?.ai?.contactId) && contactId === prefill?.ai?.contactId}>
            <FormField label={t("payments.record.customer")} required>
              {() =>
                presetContactId ? (
                  <p className="flex min-h-10 items-center text-[14px] font-medium text-on-surface" data-testid="record-payment-customer">
                    {presetContactName ?? contactName}
                  </p>
                ) : (
                  <ContactPicker value={contactId} onValueChange={setContactId} />
                )
              }
            </FormField>
            </AiField>
            <FormField label={t("payments.record.amount")} required>
              {() => <MoneyInput aria-label={t("payments.record.amount")} value={amount} onValueChange={typeAmount} currency={currency} disabled={!contactId || Boolean(prefill)} />}
            </FormField>
            <FormField label={t("payments.record.date")} required>
              {() => <DatePicker value={date} onChange={setDate} disabled={Boolean(prefill)} />}
            </FormField>
            <FormField label={t("payments.record.method")} required>
              {() => (
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger aria-label={t("payments.record.method")}>
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
              <FormField label={t("payments.record.paidInto")} required>
                {() => <p className="py-2 text-[14px] text-on-surface">{prefill.moneyAccountName}</p>}
              </FormField>
            ) : (
              <MoneyAccountPicker form="payment" direction="in" value={moneyAccountId} onValueChange={setMoneyAccountId} />
            )}
            <FormField label={t("payments.record.reference")}>
              {(field) => <Input {...field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("payments.record.referencePlaceholder")} />}
            </FormField>
          </div>

          {duplicate && (
            <div className="flex items-start gap-2.5 rounded-md border border-due-soon/30 bg-due-soon-bg px-3 py-2.5 text-[13px] text-on-surface" role="status" data-testid="possible-duplicate">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-due-soon" aria-hidden />
              <span>
                <strong className="font-semibold">{t("payments.record.dupTitle", { number: duplicate.number ?? t("payments.record.dupAlready") })}</strong>
                {t("payments.record.dupBody", {
                  amount: formatMoney(BigInt(duplicate.amount), duplicate.currency),
                  who,
                  date: new Date(`${duplicate.date}T00:00:00`).toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short" }),
                  details: [PAYMENT_METHOD_LABELS[duplicate.method as PaymentMethod] ?? duplicate.method, duplicate.reference].filter(Boolean).join(" · "),
                })}{" "}
                <SectionLink href={`/payments/${duplicate.id}`} target="_blank" className="font-medium text-primary hover:underline">
                  {t("payments.record.dupOpen", { number: duplicate.number ?? t("payments.record.dupIt") })}
                </SectionLink>
              </span>
            </div>
          )}

          {contactId && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-on-surface">{t("payments.record.whatItPays")}</h3>
                {invoices && invoices.length > 0 && (
                  <button type="button" onClick={payAll} className="text-[13px] font-medium text-primary hover:underline">
                    {t("payments.record.payAll")}
                  </button>
                )}
              </div>
              {invoices === null ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : invoices.length === 0 ? (
                <p className="rounded-md border border-border px-3 py-3 text-[13px] text-on-surface-muted">{t("payments.record.noOpenInvoices", { who })}</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-border" data-testid="record-payment-invoices">
                  <div className="grid grid-cols-[28px_minmax(0,1fr)_150px_120px_140px] items-center gap-2 bg-surface-sunken px-3 py-2 text-[12px] font-medium text-on-surface-muted">
                    <span />
                    <span>{t("payments.record.colInvoice")}</span>
                    <span>{t("payments.record.colDue")}</span>
                    <span className="text-right">{t("payments.record.colBalance")}</span>
                    <span className="text-right">{t("payments.record.colPay")}</span>
                  </div>
                  {invoices.map((inv) => {
                    const value = lines.get(inv.id) ?? 0n;
                    const late = lateness(inv.dueDate, today);
                    return (
                      <div key={inv.id} className="grid grid-cols-[28px_minmax(0,1fr)_150px_120px_140px] items-center gap-2 border-t border-border px-3 py-2 text-[13px]" data-testid="record-payment-invoice">
                        <Checkbox checked={value > 0n} onCheckedChange={(c) => toggle(inv, c === true)} aria-label={t("payments.record.payAria", { number: inv.number ?? t("payments.record.thisInvoice") })} />
                        <span className="font-semibold text-on-surface">{inv.number ?? t("payments.record.invoice")}</span>
                        <span className="flex flex-col">
                          <span className="text-on-surface">{inv.type === "advance" ? t("payments.record.deposit") : inv.dueDate ? t("payments.record.dueOn", { date: new Date(`${inv.dueDate}T00:00:00`).toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short" }) }) : t("payments.record.noDueDate")}</span>
                          {late && <span className="text-[12px] font-medium text-overdue">{late}</span>}
                        </span>
                        <span className="text-right tabular-nums text-on-surface">{money(inv.balance)}</span>
                        <MoneyInput aria-label={t("payments.record.amountToPay", { number: inv.number ?? t("payments.record.thisInvoice") })} value={value} onValueChange={(v) => setLine(inv, v)} currency={currency} />
                      </div>
                    );
                  })}
                </div>
              )}
              {applied > amount && amount > 0n && <p className="text-[13px] text-overdue">{t("payments.record.overApplied")}</p>}
              {summary && (
                <p className="flex items-start gap-2 rounded-md bg-info-bg px-3 py-2.5 text-[13px] text-on-surface" data-testid="record-payment-summary">
                  <Info size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  {summary}
                </p>
              )}
              {contactEmail && (
                <label className="flex items-center gap-2.5 text-[13px] text-on-surface">
                  <Switch checked={sendReceipt} onCheckedChange={setSendReceipt} aria-label={t("payments.record.emailReceipt", { email: contactEmail })} />
                  {t("payments.record.emailReceipt", { email: contactEmail })}
                </label>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter className="items-center">
          <span className="mr-auto hidden text-[12px] text-on-surface-muted sm:block">{t("payments.record.footerNote")}</span>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("payments.record.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving || (applied > amount && amount > 0n)}>
            {saving ? <Spinner size="sm" /> : t("payments.record.record")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
