"use client";

import { useCallback, useEffect, useState } from "react";
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
  FormField,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  useConfirm, ScrollX } from "@spine/ui";
import type { OpeningCustomerCredit } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { formatMoney } from "../../../lib/money";

/**
 * US-RPT-17 — opening customer credit: what each customer had paid ahead or
 * been credited in the old system and not yet used. It can be applied to
 * their invoices or refunded like any other credit (P19).
 */
export function CustomerCreditTab({ currency, locked, onChanged }: { currency: string; locked: boolean; onChanged: () => void }) {
  const t = useT();
  const [rows, setRows] = useState<OpeningCustomerCredit[] | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient.get<OpeningCustomerCredit[]>("/opening-balances/customer-credits").then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
    apiClient
      .get<{ id: string; name: string; type: string }[]>("/contacts")
      .then((list) => setCustomers(list.filter((c) => c.type !== "vendor")))
      .catch(() => {});
  }, [load]);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/opening-balances/customer-credits", { contactId, amount: amount.toString() });
      setAdding(false);
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("openingBalances.customerCredit.addError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await apiClient.delete(`/opening-balances/customer-credits/${id}`);
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("openingBalances.common.removeCreditError"));
    }
  }

  const money = (v: string) => formatMoney(BigInt(v), currency);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-on-surface-muted">{t("openingBalances.customerCredit.intro")}</p>
        {!locked && (
          <Button
            onClick={() => {
              setContactId("");
              setAmount(0n);
              setError(null);
              setAdding(true);
            }}
          >
            {t("openingBalances.common.addCredit")}
          </Button>
        )}
      </div>
      {error && !adding && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ScrollX label={t("ui.scrollX.label")} className="rounded-lg border border-border bg-surface">
        <table className="w-full text-[14px]" data-testid="opening-credits">
          <thead>
            <tr className="border-b border-border text-left text-on-surface-muted">
              <th className="px-4 py-3 font-medium">{t("openingBalances.customerCredit.colCustomer")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("openingBalances.common.colCredit")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("openingBalances.common.stillToUse")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("openingBalances.common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[13px] text-on-surface-muted">
                  {t("openingBalances.customerCredit.empty")}
                </td>
              </tr>
            )}
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-on-surface">{r.contactName}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.amount)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.available)}</td>
                <td className="px-4 py-3 text-right">
                  {!locked && r.available === r.amount && (
                    <Button variant="ghost" size="sm" aria-label={t("openingBalances.customerCredit.removeAria", { name: r.contactName })} onClick={async () => {
                      if (await confirm({ title: t("openingBalances.customerCredit.removeTitle", { name: r.contactName }), description: t("openingBalances.common.removeBody"), confirmLabel: t("openingBalances.common.remove"), danger: true })) void remove(r.id);
                    }}>
                      {t("openingBalances.common.remove")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t("openingBalances.customerCredit.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("openingBalances.customerCredit.dialogBody")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField label={t("openingBalances.customerCredit.customer")} required>
              {(field) => (
                <Select value={contactId || undefined} onValueChange={setContactId}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder={t("openingBalances.customerCredit.chooseCustomer")} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label={t("openingBalances.common.amount")} required>
              {(field) => <MoneyInput id={field.id} value={amount} onValueChange={setAmount} currency={currency} />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={busy}>
              {t("openingBalances.common.cancel")}
            </Button>
            <Button onClick={add} disabled={busy || !contactId || amount <= 0n}>
              {busy ? <Spinner size="sm" /> : t("openingBalances.common.addCredit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
