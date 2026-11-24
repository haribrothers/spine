"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { useT } from "../../../lib/i18n";
import type { VendorCredit } from "./types";

/**
 * US-PUR-27/US-PUR-37 — voiding a recorded credit asks first (D-218) and
 * needs a reason, kept with the credit; the error stays in the dialog.
 * Used from the credit's page and a row's menu.
 */
export function VoidCreditDialog({ credit, open, onOpenChange, onVoided }: { credit: VendorCredit; open: boolean; onOpenChange: (open: boolean) => void; onVoided: (credit: VendorCredit) => void }) {
  const t = useT();
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
      setError(t("vendorCredits.voidDialog.reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<VendorCredit>(`/vendor-credits/${credit.id}/void`, { reason: reason.trim() });
      onOpenChange(false);
      onVoided(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vendorCredits.voidDialog.voidFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("vendorCredits.voidDialog.title", { number: credit.number ?? t("vendorCredits.voidDialog.thisCredit") })}</DialogTitle>
          <DialogDescription>
            {t("vendorCredits.voidDialog.description", { amount: formatMoney(BigInt(credit.totalAmount), credit.currency), vendor: credit.contactName ?? t("vendorCredits.voidDialog.theVendor") })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("vendorCredits.voidDialog.reason")} required>
            {(field) => <Input {...field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={t("vendorCredits.voidDialog.reasonPlaceholder")} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("vendorCredits.voidDialog.goBack")}
          </Button>
          <Button type="button" variant="danger" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner size="sm" /> : t("vendorCredits.voidDialog.voidCredit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
