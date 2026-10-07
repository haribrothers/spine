"use client";

import { useEffect, useState } from "react";
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
  Input,
  MoneyInput,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";

/**
 * S-05.6 — "issue a credit note against an invoice for a return or
 * correction, so I never edit an issued document." Deliberately a single
 * free-form line (name + one total amount), not a full multi-line builder
 * like invoices/quotes — a credit note is a small, one-off correction, and
 * the PRD's own story wording never asks for a multi-line credit note
 * editor. Create + issue happen as one action here (not a separate draft-
 * then-issue step the user has to remember) — S-05.6's framing is a single
 * atomic "issue a credit note," closer to how a payment is recorded in one
 * step than how an invoice is built as a draft first.
 *
 * `amount` is the credit's TOTAL (what the customer's balance actually
 * drops by), submitted with `taxRatePercentage: 0` — deliberately not
 * exposing a separate tax-rate field, since the server's line-tax
 * computation treats its own `unitPriceAmount` as pre-tax and adds tax on
 * top (correct for invoices/quotes building up from a catalogue price, but
 * would silently inflate a credit beyond what the user typed if this
 * dialog tried to back-calculate a pre-tax amount from a tax-inclusive
 * total the user has in mind). A future revision that needs a tax-bearing
 * credit line should let the user pick a catalogue item (whose price/tax
 * are already known and correctly split) rather than reintroducing manual
 * tax-rate entry here.
 */
export function CreateCreditNoteDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  customerName,
  currency,
  invoiceTotal,
  balanceDue,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string | null;
  customerName: string | null;
  currency: string;
  /** With the issued credit notes, the most this one can be (all credits ≤ the invoice). */
  invoiceTotal: bigint;
  /** What's left to pay; anything above becomes customer credit (US-PAY-16, D-142). */
  balanceDue: bigint;
  onIssued: () => void;
}) {
  const [name, setName] = useState("Credit note");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyCredited, setAlreadyCredited] = useState<bigint>(0n);

  useEffect(() => {
    if (!open) return;
    apiClient
      .get<{ status: string; totalAmount: string }[]>(`/credit-notes?invoiceId=${invoiceId}`)
      .then((notes) => setAlreadyCredited(notes.filter((n) => n.status === "issued").reduce((sum, n) => sum + BigInt(n.totalAmount), 0n)))
      .catch(() => setAlreadyCredited(0n));
  }, [open, invoiceId]);

  const maxAmount = invoiceTotal - alreadyCredited;
  const owed = balanceDue > 0n ? balanceDue : 0n;
  const excess = amount > owed ? amount - owed : 0n;

  async function handleSubmit() {
    setError(null);
    if (amount <= 0n) {
      setError("Enter a credit amount greater than zero.");
      return;
    }
    if (amount > maxAmount) {
      setError(`You can credit up to ${formatMoney(maxAmount > 0n ? maxAmount : 0n, currency)} on this invoice.`);
      return;
    }

    setSaving(true);
    try {
      const created = await apiClient.post<{ id: string }>("/credit-notes", {
        invoiceId,
        reason: reason || null,
        lines: [
          {
            type: "item",
            name,
            quantity: 1,
            unitPriceAmount: amount.toString(),
            taxRatePercentage: 0,
          },
        ],
      });
      await apiClient.post(`/credit-notes/${created.id}/issue`);
      onOpenChange(false);
      onIssued();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue this credit note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue a credit note</DialogTitle>
          <DialogDescription>Reduces what's owed on this invoice without editing the issued document. Anything above what's owed becomes credit for the customer.</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField label="Description" required>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Reason" helperText="Shown to the customer on the credit note.">
            {(field) => <Input {...field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />}
          </FormField>
          <FormField label="Amount" required>
            {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} />}
          </FormField>
          {excess > 0n && (
            <Alert variant="info" data-testid="credit-split">
              <AlertDescription>
                {formatMoney(owed, currency)} reduces what's owed on {invoiceNumber ?? "this invoice"}; {formatMoney(excess, currency)} becomes credit for {customerName ?? "the customer"}.
              </AlertDescription>
            </Alert>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Issue credit note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
