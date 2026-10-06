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
} from "@spine/ui";
import type { OpeningCustomerCredit } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";

/**
 * US-RPT-17 — opening customer credit: what each customer had paid ahead or
 * been credited in the old system and not yet used. It can be applied to
 * their invoices or refunded like any other credit (P19).
 */
export function CustomerCreditTab({ currency, locked, onChanged }: { currency: string; locked: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<OpeningCustomerCredit[] | null>(null);
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
      setError(err instanceof Error ? err.message : "Couldn't add this credit.");
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
      setError(err instanceof Error ? err.message : "Couldn't remove this credit.");
    }
  }

  const money = (v: string) => formatMoney(BigInt(v), currency);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-on-surface-muted">Money customers had paid ahead, or credit they hadn&apos;t used, on the cutover date. They can use it against invoices or have it refunded.</p>
        {!locked && (
          <Button
            onClick={() => {
              setContactId("");
              setAmount(0n);
              setError(null);
              setAdding(true);
            }}
          >
            Add credit
          </Button>
        )}
      </div>
      {error && !adding && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-[14px]" data-testid="opening-credits">
          <thead>
            <tr className="border-b border-border text-left text-on-surface-muted">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 text-right font-medium">Credit</th>
              <th className="px-4 py-3 text-right font-medium">Still to use</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[13px] text-on-surface-muted">
                  No opening customer credit.
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
                    <Button variant="ghost" size="sm" aria-label={`Remove ${r.contactName}'s credit`} onClick={() => remove(r.id)}>
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Add opening customer credit</DialogTitle>
            <DialogDescription>Credit the customer held on the cutover date.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField label="Customer" required>
              {(field) => (
                <Select value={contactId || undefined} onValueChange={setContactId}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder="Choose a customer" />
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
            <FormField label="Amount" required>
              {(field) => <MoneyInput id={field.id} value={amount} onValueChange={setAmount} currency={currency} />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={add} disabled={busy || !contactId || amount <= 0n}>
              {busy ? <Spinner size="sm" /> : "Add credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
