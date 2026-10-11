"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, MoneyInput, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";
import type { Invoice } from "../invoices/types";

/**
 * US-INV-38 (D-219) — "Apply credit" on a credit note: the customer's open
 * invoices with their balances, prefilled oldest first up to the credit
 * left; applying posts P6 through `POST /credit-notes/:id/apply-credit`
 * (US-PAY-16). The amounts and the total shown before the button are the
 * confirmation (D-218).
 */
export function ApplyCreditNoteDialog({
  open,
  onOpenChange,
  creditNoteId,
  creditNoteNumber,
  contactId,
  contactName,
  currency,
  creditLeft,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string;
  creditNoteNumber: string | null;
  contactId: string;
  contactName: string | null;
  currency: string;
  creditLeft: bigint;
  onApplied: (total: bigint, invoices: number) => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, bigint>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setInvoices(null);
    apiClient
      .get<Invoice[]>(`/invoices?contactId=${contactId}`)
      .then((list) => {
        const owed = list
          .filter((i) => i.status === "issued" && i.type !== "advance" && i.currency === currency && BigInt(i.balanceDue) > 0n)
          .sort((a, b) => (a.dueDate ?? a.issueDate ?? "").localeCompare(b.dueDate ?? b.issueDate ?? ""));
        setInvoices(owed);
        let left = creditLeft;
        const prefill: Record<string, bigint> = {};
        for (const inv of owed) {
          const balance = BigInt(inv.balanceDue);
          const take = balance < left ? balance : left;
          prefill[inv.id] = take > 0n ? take : 0n;
          left -= prefill[inv.id]!;
        }
        setAmounts(prefill);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this customer's invoices."));
  }, [open, contactId, currency, creditLeft]);

  const total = useMemo(() => Object.values(amounts).reduce((sum, a) => sum + a, 0n), [amounts]);
  const money = (v: bigint) => formatMoney(v, currency);
  const today = new Date();

  async function apply() {
    setError(null);
    if (total <= 0n) {
      setError("Enter an amount to apply.");
      return;
    }
    if (total > creditLeft) {
      setError(`This credit note has ${money(creditLeft)} of credit to apply.`);
      return;
    }
    setSaving(true);
    try {
      const allocations = Object.entries(amounts)
        .filter(([, amount]) => amount > 0n)
        .map(([invoiceId, amount]) => ({ invoiceId, amount: amount.toString() }));
      await apiClient.post(`/credit-notes/${creditNoteId}/apply-credit`, { allocations });
      onOpenChange(false);
      onApplied(total, allocations.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't apply the credit. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Apply credit</DialogTitle>
          <DialogDescription>
            Use {creditNoteNumber ?? "this credit note"}&apos;s {money(creditLeft)} of credit against {contactName ?? "the customer"}&apos;s open invoices. It comes off what they owe; nothing is paid out.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!invoices ? (
            !error && (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            )
          ) : invoices.length === 0 ? (
            <p className="text-[13px] text-on-surface-muted">{contactName ?? "This customer"} has no open invoices in this credit note’s currency to apply it to. You can refund it instead.</p>
          ) : (
            invoices.map((inv) => {
              const balance = BigInt(inv.balanceDue);
              return (
                <div key={inv.id} className="flex flex-wrap items-center gap-3" data-testid="apply-to-invoice">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-on-surface">{inv.number}</p>
                    <p className="text-[12px] text-on-surface-muted">
                      {money(balance)} owed{inv.dueDate ? ` · due ${calendarDate(inv.dueDate, today, orgLocaleTag())}` : ""}
                    </p>
                  </div>
                  <div className="w-36">
                    <MoneyInput
                      aria-label={`Amount to apply to ${inv.number ?? "this invoice"}`}
                      value={amounts[inv.id] ?? 0n}
                      onValueChange={(v) => setAmounts((prev) => ({ ...prev, [inv.id]: v > balance ? balance : v }))}
                      currency={currency}
                    />
                  </div>
                </div>
              );
            })
          )}
          {invoices && invoices.length > 0 && (
            <p className="text-[13px] text-on-surface-muted" data-testid="apply-total">
              Applying {money(total)}; {money(creditLeft - total > 0n ? creditLeft - total : 0n)} of credit stays to use later.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={saving || !invoices?.length || total <= 0n}>
            {saving ? <Spinner size="sm" /> : "Apply credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
