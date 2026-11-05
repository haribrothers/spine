"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MoneyInput,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { loadCustomerCredit, type CustomerCredit } from "../../../lib/customer-credit";
import { useT } from "../../../lib/i18n";

/**
 * US-PAY-16 — "Apply credit" on an invoice: the customer's credit from
 * unallocated payments and from credit notes, side by side, prefilled
 * oldest first up to what's owed. Each source posts P6 through its own
 * route.
 */
export function ApplyCustomerCreditDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  contactId,
  currency,
  balanceDue,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string | null;
  contactId: string;
  currency: string;
  balanceDue: bigint;
  onApplied: (total: bigint) => void;
}) {
  const t = useT();
  const [credits, setCredits] = useState<CustomerCredit[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, bigint>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCredits(null);
    loadCustomerCredit(contactId).then((list) => {
      setCredits(list);
      let left = balanceDue;
      const prefill: Record<string, bigint> = {};
      for (const c of list) {
        const take = c.available < left ? c.available : left;
        prefill[c.id] = take > 0n ? take : 0n;
        left -= prefill[c.id]!;
      }
      setAmounts(prefill);
    });
  }, [open, contactId, balanceDue]);

  const total = useMemo(() => Object.values(amounts).reduce((sum, a) => sum + a, 0n), [amounts]);

  async function handleSubmit() {
    setError(null);
    if (total <= 0n) {
      setError(t("invoices.applyCredit.enterAmount"));
      return;
    }
    if (total > balanceDue) {
      setError(t("invoices.applyCredit.tooMuch", { amount: formatMoney(balanceDue, currency), number: invoiceNumber ?? t("invoices.applyCredit.thisInvoice") }));
      return;
    }
    setSaving(true);
    try {
      for (const c of credits ?? []) {
        const amount = amounts[c.id] ?? 0n;
        if (amount <= 0n) continue;
        const path = c.kind === "payment" ? `/payments/${c.id}/apply-credit` : `/credit-notes/${c.id}/apply-credit`;
        await apiClient.post(path, { allocations: [{ invoiceId, amount: amount.toString() }] });
      }
      onOpenChange(false);
      onApplied(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invoices.applyCredit.failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("invoices.applyCredit.title")}</DialogTitle>
          <DialogDescription>
            {t("invoices.applyCredit.description", { number: invoiceNumber ?? t("invoices.applyCredit.thisInvoice"), amount: formatMoney(balanceDue, currency) })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!credits ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : credits.length === 0 ? (
            <p className="text-[13px] text-on-surface-muted">{t("invoices.applyCredit.noCredit")}</p>
          ) : (
            credits.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3" data-testid="credit-source">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-on-surface">{c.label}</p>
                  <p className="text-[12px] text-on-surface-muted">{t("invoices.applyCredit.available", { amount: formatMoney(c.available, currency) })}</p>
                </div>
                <div className="w-36">
                  <MoneyInput
                    aria-label={t("invoices.applyCredit.amountFrom", { label: c.label })}
                    value={amounts[c.id] ?? 0n}
                    onValueChange={(v) => setAmounts((prev) => ({ ...prev, [c.id]: v > c.available ? c.available : v }))}
                    currency={currency}
                  />
                </div>
              </div>
            ))
          )}
          {credits && credits.length > 0 && <p className="text-[13px] text-on-surface-muted">{t("invoices.applyCredit.applying", { amount: formatMoney(total, currency) })}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("invoices.applyCredit.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !credits?.length}>
            {saving ? <Spinner size="sm" /> : t("invoices.applyCredit.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
