"use client";

import { useState } from "react";
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
  currency,
  maxAmount,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  currency: string;
  maxAmount: bigint;
  onIssued: () => void;
}) {
  const [name, setName] = useState("Credit note");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState<bigint>(0n);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (amount <= 0n) {
      setError("Enter a credit amount greater than zero.");
      return;
    }
    if (amount > maxAmount) {
      setError("Credit amount cannot exceed the invoice's remaining balance.");
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
          <DialogDescription>Reduces what's owed on this invoice without editing the issued document.</DialogDescription>
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
          <FormField label="Amount" required helperText="Up to this invoice's remaining balance.">
            {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} />}
          </FormField>
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
