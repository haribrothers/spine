"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import type { VendorCredit } from "./types";

/**
 * US-PUR-27/US-PUR-37 — voiding a recorded credit asks first (D-218) and
 * needs a reason, kept with the credit; the error stays in the dialog.
 * Used from the credit's page and a row's menu.
 */
export function VoidCreditDialog({ credit, open, onOpenChange, onVoided }: { credit: VendorCredit; open: boolean; onOpenChange: (open: boolean) => void; onVoided: (credit: VendorCredit) => void }) {
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
      setError("Give a reason for voiding this credit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<VendorCredit>(`/vendor-credits/${credit.id}/void`, { reason: reason.trim() });
      onOpenChange(false);
      onVoided(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not void this vendor credit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void {credit.number ?? "this credit"}?</DialogTitle>
          <DialogDescription>
            A reversing entry takes the {formatMoney(BigInt(credit.totalAmount), credit.currency)} credit off your books, so what you owe {credit.contactName ?? "the vendor"} goes back up. The credit stays, marked void. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label="Reason" required>
            {(field) => <Input {...field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Why is this credit being voided?" />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Go back
          </Button>
          <Button type="button" variant="danger" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner size="sm" /> : "Void credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
