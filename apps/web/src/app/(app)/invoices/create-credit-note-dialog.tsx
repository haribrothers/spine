"use client";

import { useEffect, useMemo, useState } from "react";
import { spreadCreditAmount } from "@spine/shared";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
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
  Skeleton,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  cn, ScrollX } from "@spine/ui";
import { Info, Send } from "lucide-react";
import { apiClient, ApiError } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import type { CreditNote, Creditable, CreditNotePreview } from "./types";
import { t, useT } from "../../../lib/i18n";
import { useIsPhone } from "../../../lib/use-is-phone";

type Mode = "lines" | "amount";

/** A quantity as people type it: "12", "2.5". */
const asQuantity = (text: string) => {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** US-INV-36 — what `POST /credit-notes` gets for the dialog's choices; null while nothing is chosen. */
export function creditNoteLines(creditable: Creditable, mode: Mode, quantities: Record<string, string>, ticked: Set<string>, amount: bigint) {
  if (mode === "lines") {
    const lines = creditable.lines
      .filter((l) => ticked.has(l.invoiceLineId) && asQuantity(quantities[l.invoiceLineId] ?? "") > 0)
      .map((l) => ({ invoiceLineId: l.invoiceLineId, quantity: asQuantity(quantities[l.invoiceLineId] ?? ""), name: l.name }));
    return lines.length ? lines : null;
  }
  if (amount <= 0n) return null;
  const parts = spreadCreditAmount(creditable.lines.map((l) => BigInt(l.leftAmount)), amount);
  if (!parts) return "too-much" as const;
  return creditable.lines.flatMap((l, i) => (parts[i]! > 0n ? [{ invoiceLineId: l.invoiceLineId, creditAmount: parts[i]!.toString(), name: l.name }] : []));
}

/** US-OPS-38 — what an issued credit note's toast says, from the invoice or the credit notes list. */
export function creditNoteIssuedToast(note: CreditNote, customerName: string | null): [string, string] {
  const left = BigInt(note.creditRemainingAmount ?? "0");
  return [
    t("invoices.createCreditNote.issuedToastTitle", { number: note.number ?? t("invoices.createCreditNote.creditNote") }),
    left > 0n ? t("invoices.createCreditNote.becameCredit", { amount: formatMoney(left, note.currency), name: customerName ?? t("invoices.createCreditNote.theCustomer") }) : t("invoices.createCreditNote.balanceUpdated"),
  ];
}

/**
 * US-INV-36 (D-219) — issue a credit note against an invoice, taking the
 * tax back with the amount. "Credit lines" ticks the invoice's item lines
 * and how many of each, up to what's left; "Credit an amount" spreads an
 * amount (tax included) over the lines by what's left on each. The totals,
 * the tax by name and the split — what comes off the invoice, what becomes
 * the customer's credit (D-142) — come from `POST /credit-notes/preview`,
 * worked out exactly as issuing will. The dialog is the confirmation
 * (D-218): it shows what will be issued before the button.
 */
export function CreateCreditNoteDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  customerName,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string | null;
  customerName: string | null;
  onIssued: (note: CreditNote) => void;
}) {
  const t = useT();
  const [creditable, setCreditable] = useState<Creditable | null>(null);
  const [mode, setMode] = useState<Mode>("lines");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState<bigint>(0n);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<CreditNotePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // US-OPS-59: on a phone the invoice's lines are cards, one under another, not a wide table.
  const phone = useIsPhone();

  useEffect(() => {
    if (!open) return;
    setCreditable(null);
    setMode("lines");
    setTicked(new Set());
    setQuantities({});
    setAmount(0n);
    setReason("");
    setPreview(null);
    setError(null);
    apiClient
      .get<Creditable>(`/credit-notes/creditable?invoiceId=${invoiceId}`)
      .then((c) => {
        setCreditable(c);
        setQuantities(Object.fromEntries(c.lines.map((l) => [l.invoiceLineId, String(l.leftQuantity)])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("invoices.createCreditNote.loadFailed")));
  }, [open, invoiceId]);

  const currency = creditable?.currency ?? "USD";
  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const lines = useMemo(() => (creditable ? creditNoteLines(creditable, mode, quantities, ticked, amount) : null), [creditable, mode, quantities, ticked, amount]);
  const payloadKey = JSON.stringify(lines);

  // The preview follows the choices, a moment after typing stops.
  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (!lines) return;
    if (lines === "too-much") {
      setPreviewError(t("invoices.createCreditNote.tooMuch", { amount: money(creditable!.leftToCredit) }));
      return;
    }
    const timer = window.setTimeout(() => {
      apiClient
        .post<CreditNotePreview>("/credit-notes/preview", { invoiceId, lines })
        .then(setPreview)
        .catch((err) => setPreviewError(err instanceof ApiError || err instanceof Error ? err.message : t("invoices.createCreditNote.previewFailed")));
    }, 250);
    return () => window.clearTimeout(timer);
    // payloadKey stands for `lines` (a new array each render).
  }, [payloadKey, invoiceId]);

  const partFor = (lineId: string) => preview?.lines.find((l) => l.invoiceLineId === lineId);

  async function issue() {
    if (!lines || lines === "too-much" || !preview) return;
    setSaving(true);
    setError(null);
    try {
      const draft = await apiClient.post<{ id: string }>("/credit-notes", { invoiceId, reason: reason.trim() || null, lines });
      const note = await apiClient.post<CreditNote>(`/credit-notes/${draft.id}/issue`);
      onOpenChange(false);
      onIssued(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invoices.createCreditNote.issueFailed"));
    } finally {
      setSaving(false);
    }
  }

  const leftOnInvoice = creditable ? BigInt(creditable.leftToCredit) : 0n;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("invoices.createCreditNote.title")}</DialogTitle>
          <DialogDescription>
            {t("invoices.createCreditNote.against")} <span className="font-semibold text-on-surface">{invoiceNumber ?? t("invoices.createCreditNote.thisInvoice")}</span>
            {customerName ? ` · ${customerName}` : ""}
            {creditable ? t("invoices.createCreditNote.stillOwed", { amount: money(creditable.balanceDue) }) : ""}
            {t("invoices.createCreditNote.descriptionTail")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!creditable ? (
            !error && (
              <div className="flex flex-col gap-2" aria-busy="true">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-32 w-full" />
              </div>
            )
          ) : leftOnInvoice <= 0n ? (
            <p className="text-[13.5px] text-on-surface-muted">{t("invoices.createCreditNote.allCredited")}</p>
          ) : (
            <>
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList aria-label={t("invoices.createCreditNote.howToCredit")}>
                  <TabsTrigger value="lines" aria-controls={undefined}>{t("invoices.createCreditNote.creditLines")}</TabsTrigger>
                  <TabsTrigger value="amount" aria-controls={undefined}>{t("invoices.createCreditNote.creditAmount")}</TabsTrigger>
                </TabsList>
              </Tabs>

              {mode === "amount" && (
                <div className="flex flex-wrap items-end gap-4">
                  <FormField label={t("invoices.createCreditNote.amount")} helperText={t("invoices.createCreditNote.taxIncluded")} className="w-60 max-md:w-full">
                    {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} aria-label={t("invoices.createCreditNote.amountToCredit")} />}
                  </FormField>
                  <p className="mb-6 max-w-sm flex-1 text-[12.5px] leading-snug text-on-surface-muted max-md:mb-0">
                    {t("invoices.createCreditNote.spreadNote")}
                  </p>
                </div>
              )}

              {phone ? (
                <ul className="flex flex-col gap-2" data-testid="credit-lines">
                  {creditable.lines.map((line) => {
                    const done = BigInt(line.leftAmount) <= 0n;
                    const part = partFor(line.invoiceLineId);
                    const on = ticked.has(line.invoiceLineId);
                    const sub = done ? t("invoices.createCreditNote.fullyCredited") : [mode === "amount" ? `${line.taxRatePercentage}%` : null, line.hsnSac ? t("invoices.createCreditNote.hsnSac", { code: line.hsnSac }) : null].filter(Boolean).join(" · ");
                    return (
                      <li key={line.invoiceLineId} className={cn("flex flex-col gap-2 rounded-lg border border-border px-3.5 py-3", done && "text-on-surface-muted")}>
                        <div className="flex items-start gap-3">
                          {mode === "lines" && (
                            <Checkbox
                              checked={on}
                              disabled={done}
                              className="mt-0.5"
                              aria-label={t("invoices.createCreditNote.creditLine", { name: line.name })}
                              onCheckedChange={(v) =>
                                setTicked((current) => {
                                  const next = new Set(current);
                                  if (v === true) next.add(line.invoiceLineId);
                                  else next.delete(line.invoiceLineId);
                                  return next;
                                })
                              }
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={cn("block text-[15px] font-semibold leading-snug", done ? "text-on-surface-muted" : "text-on-surface")}>{line.name}</span>
                            {sub && <span className="block text-[12.5px] text-on-surface-muted">{sub}</span>}
                          </span>
                          <span className="shrink-0 text-[15px] font-semibold tabular-nums text-on-surface">{part ? money(part.lineTotalAmount) : "—"}</span>
                        </div>
                        {mode === "lines" ? (
                          done ? (
                            <span className="text-[13px]">{t("invoices.createCreditNote.leftOf", { left: 0, total: line.quantity })}</span>
                          ) : on ? (
                            <span className="flex items-center gap-2 text-[13px] text-on-surface-muted">
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={line.leftQuantity}
                                step="any"
                                value={quantities[line.invoiceLineId] ?? ""}
                                onChange={(e) => setQuantities((q) => ({ ...q, [line.invoiceLineId]: e.target.value }))}
                                aria-label={t("invoices.createCreditNote.howMany", { name: line.name })}
                                className="w-24 text-right tabular-nums"
                              />
                              {t("invoices.createCreditNote.ofLeft", { n: line.leftQuantity })}
                            </span>
                          ) : (
                            <span className="text-[13px] text-on-surface-muted">{t("invoices.createCreditNote.leftOf", { left: line.leftQuantity, total: line.quantity })}</span>
                          )
                        ) : null}
                        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[13px] tabular-nums text-on-surface-muted">
                          {mode === "amount" && (
                            <>
                              <dt>{t("invoices.createCreditNote.colLeftToCredit")}</dt>
                              <dd className="text-right">{money(line.leftAmount)}</dd>
                            </>
                          )}
                          <dt>{mode === "lines" ? t("invoices.createCreditNote.colRate") : t("invoices.createCreditNote.colBeforeTax")}</dt>
                          <dd className="text-right">{mode === "lines" ? money(line.unitPriceAmount) : part ? money(part.lineSubtotalAmount) : "—"}</dd>
                          <dt>{t("invoices.createCreditNote.colTax")}</dt>
                          <dd className="text-right">{mode === "lines" ? `${line.taxRatePercentage}%` : part ? money(part.lineTaxAmount) : "—"}</dd>
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              ) : (
              <ScrollX label={t("ui.scrollX.label")} className="rounded-md border border-border" data-testid="credit-lines">
                <table className="w-full min-w-155 border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-surface-sunken text-left text-[12px] text-on-surface-muted">
                      <th scope="col" className="w-9 px-3 py-2 font-medium">
                        <span className="sr-only">{t("invoices.createCreditNote.colCredit")}</span>
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">{t("invoices.createCreditNote.colInvoiceLine")}</th>
                      <th scope="col" className="w-36 px-2 py-2 font-medium">{mode === "lines" ? t("invoices.createCreditNote.colCredit") : t("invoices.createCreditNote.colLeftToCredit")}</th>
                      <th scope="col" className="w-28 px-2 py-2 text-right font-medium">{mode === "lines" ? t("invoices.createCreditNote.colRate") : t("invoices.createCreditNote.colBeforeTax")}</th>
                      <th scope="col" className="w-20 px-2 py-2 text-right font-medium">{t("invoices.createCreditNote.colTax")}</th>
                      <th scope="col" className="w-28 px-3 py-2 text-right font-medium">{mode === "lines" ? t("invoices.createCreditNote.colAmount") : t("invoices.createCreditNote.colPart")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditable.lines.map((line) => {
                      const done = BigInt(line.leftAmount) <= 0n;
                      const part = partFor(line.invoiceLineId);
                      const on = ticked.has(line.invoiceLineId);
                      return (
                        <tr key={line.invoiceLineId} className={cn("border-t border-border align-middle", done && "text-on-surface-muted")}>
                          <td className="px-3 py-2.5">
                            {mode === "lines" && (
                              <Checkbox
                                checked={on}
                                disabled={done}
                                aria-label={t("invoices.createCreditNote.creditLine", { name: line.name })}
                                onCheckedChange={(v) =>
                                  setTicked((current) => {
                                    const next = new Set(current);
                                    if (v === true) next.add(line.invoiceLineId);
                                    else next.delete(line.invoiceLineId);
                                    return next;
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            <span className={cn("block font-medium", done ? "text-on-surface-muted" : "text-on-surface")}>{line.name}</span>
                            <span className="block text-[12px] text-on-surface-muted">
                              {done ? t("invoices.createCreditNote.fullyCredited") : [mode === "amount" ? `${line.taxRatePercentage}%` : null, line.hsnSac ? t("invoices.createCreditNote.hsnSac", { code: line.hsnSac }) : null].filter(Boolean).join(" · ")}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            {mode === "lines" ? (
                              done ? (
                                <span className="text-[12px]">{t("invoices.createCreditNote.leftOf", { left: 0, total: line.quantity })}</span>
                              ) : on ? (
                                <span className="flex items-center gap-1.5 text-[12px] text-on-surface-muted">
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    max={line.leftQuantity}
                                    step="any"
                                    value={quantities[line.invoiceLineId] ?? ""}
                                    onChange={(e) => setQuantities((q) => ({ ...q, [line.invoiceLineId]: e.target.value }))}
                                    aria-label={t("invoices.createCreditNote.howMany", { name: line.name })}
                                    className="h-8 w-16 text-right tabular-nums"
                                  />
                                  {t("invoices.createCreditNote.ofLeft", { n: line.leftQuantity })}
                                </span>
                              ) : (
                                <span className="text-[12px] text-on-surface-muted">
                                  {t("invoices.createCreditNote.leftOf", { left: line.leftQuantity, total: line.quantity })}
                                </span>
                              )
                            ) : (
                              <span className="text-[12px] tabular-nums text-on-surface-muted">{money(line.leftAmount)}</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{mode === "lines" ? money(line.unitPriceAmount) : part ? money(part.lineSubtotalAmount) : "—"}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{mode === "lines" ? `${line.taxRatePercentage}%` : part ? money(part.lineTaxAmount) : "—"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{part ? money(part.lineTotalAmount) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollX>
              )}

              <FormField label={t("invoices.createCreditNote.reason")} helperText={t("invoices.createCreditNote.reasonHelp")}>
                {(field) => <Input {...field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("invoices.createCreditNote.reasonPlaceholder")} />}
              </FormField>

              {previewError && (
                <Alert variant="critical">
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-[16rem] flex-1">
                  {preview && BigInt(preview.creditPart) > 0n && (
                    <div className="flex items-start gap-2.5 rounded-md bg-info-bg px-3 py-2.5 text-[13px] leading-snug text-on-surface" data-testid="credit-split">
                      <Info size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                      <span>
                        {t("invoices.createCreditNote.split", { owed: money(preview.owedPart), number: invoiceNumber ?? t("invoices.createCreditNote.thisInvoice"), credit: money(preview.creditPart), name: customerName ?? t("invoices.createCreditNote.theCustomer") })}
                      </span>
                    </div>
                  )}
                </div>
                <dl className="ml-auto grid w-72 grid-cols-[1fr_auto] max-md:w-full gap-x-6 gap-y-1.5 text-[13px]" data-testid="credit-totals">
                  <dt className="text-on-surface-muted">{t("invoices.createCreditNote.subtotal")}</dt>
                  <dd className="text-right tabular-nums">{preview ? money(preview.subtotalAmount) : "—"}</dd>
                  {(preview?.taxLines.length ? preview.taxLines : [{ label: t("invoices.createCreditNote.tax"), amount: preview?.taxAmount ?? "0" }]).map((taxLine) => (
                    <div key={taxLine.label} className="contents">
                      <dt className="text-on-surface-muted">{taxLine.label}</dt>
                      <dd className="text-right tabular-nums">{preview ? money(taxLine.amount) : "—"}</dd>
                    </div>
                  ))}
                  <dt className="mt-1 border-t border-border pt-2 text-[14px] font-semibold text-on-surface">{t("invoices.createCreditNote.total")}</dt>
                  <dd className="mt-1 border-t border-border pt-2 text-right text-[15px] font-bold tabular-nums text-on-surface">{preview ? money(preview.totalAmount) : "—"}</dd>
                </dl>
              </div>
            </>
          )}
          {/* On a phone the footer is the bar at the top, with room only for its buttons. */}
          {phone && <p className="text-[12px] text-on-surface-muted">{t("invoices.createCreditNote.footerNote")}</p>}
        </DialogBody>

        <DialogFooter className="flex-wrap items-center">
          {!phone && <span className="mr-auto max-w-xs text-[12px] text-on-surface-muted">{t("invoices.createCreditNote.footerNote")}</span>}
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("invoices.createCreditNote.cancel")}
          </Button>
          <Button type="button" onClick={() => void issue()} disabled={saving || !preview || BigInt(preview.totalAmount) <= 0n}>
            {saving ? <Spinner size="sm" /> : <Send size={14} aria-hidden />}
            {t("invoices.createCreditNote.issue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
