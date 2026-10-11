"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import type { VendorBill } from "./types";

/**
 * US-PUR-04/US-PUR-32 — voiding a recorded bill asks first (D-218) and needs
 * a reason, kept with the bill; the error stays in the dialog. Used from the
 * bill's page and a row's menu.
 */
export function VoidBillDialog({ bill, open, onOpenChange, onVoided }: { bill: VendorBill; open: boolean; onOpenChange: (open: boolean) => void; onVoided: (bill: VendorBill) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (!reason.trim()) {
      setError("Give a reason for voiding this bill.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<VendorBill>(`/vendor-bills/${bill.id}/void`, { reason: reason.trim() });
      onOpenChange(false);
      onVoided(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not void this vendor bill.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void {bill.billNumber}?</DialogTitle>
          <DialogDescription>
            {formatMoney(BigInt(bill.totalAmount), bill.currency)} owed to {bill.contactName ?? "the vendor"} comes off your books with a reversing entry. The bill stays, marked void. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label="Reason" required>
            {(field) => <Input {...field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this bill being voided?" />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Go back
          </Button>
          <Button type="button" variant="danger" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner size="sm" /> : "Void bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
