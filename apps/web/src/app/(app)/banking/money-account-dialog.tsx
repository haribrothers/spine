"use client";

import { useEffect, useState } from "react";
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
  RadioGroup,
  RadioGroupItem,
  Spinner,
} from "@spine/ui";
import { MONEY_ACCOUNT_KIND_LABELS, MONEY_ACCOUNT_KINDS, type MoneyAccount, type MoneyAccountKind, type MoneyAccountNextCodes } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";

/**
 * US-BANK-01 — `MoneyAccountDialog`: add a bank account, cash box or card
 * (or edit one, when `account` is given). Spine creates the ledger account;
 * the hint names the code it will get.
 */
export function MoneyAccountDialog({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: MoneyAccount | null;
  onSaved: (saved: MoneyAccount, created: boolean) => void;
}) {
  const [kind, setKind] = useState<MoneyAccountKind>("bank");
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [last4, setLast4] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [nextCodes, setNextCodes] = useState<MoneyAccountNextCodes | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(account?.kind ?? "bank");
    setName(account?.name ?? "");
    setBankName(account?.bankName ?? "");
    setLast4(account?.last4 ?? "");
    setIsDefault(account?.isDefault ?? false);
    setError(null);
    if (!account) {
      apiClient
        .get<MoneyAccountNextCodes>("/money-accounts/next-codes")
        .then(setNextCodes)
        .catch(() => setNextCodes(null));
    }
  }, [open, account]);

  const hasBankDetails = kind !== "cash";
  const code = account ? account.code : nextCodes?.[kind];
  const ledgerType = kind === "card" ? "Liability — its balance is what's owed on the card" : "Asset";

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Give the account a name.");
      return;
    }
    setSaving(true);
    try {
      const body = { kind, name: name.trim(), bankName: hasBankDetails ? bankName.trim() || null : null, last4: hasBankDetails ? last4.trim() || null : null, isDefault };
      const saved = account ? await apiClient.put<MoneyAccount>(`/money-accounts/${account.id}`, body) : await apiClient.post<MoneyAccount>("/money-accounts", body);
      onOpenChange(false);
      onSaved(saved, !account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this account. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "Add account"}</DialogTitle>
          <DialogDescription>A bank account, cash box or business card. Spine creates its ledger account for you.</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-on-surface">
              Type <span className="text-overdue" aria-hidden="true">*</span>
            </legend>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as MoneyAccountKind)} className="flex flex-row flex-wrap gap-5" disabled={Boolean(account)}>
              {MONEY_ACCOUNT_KINDS.map((k) => (
                <label key={k} htmlFor={`money-kind-${k}`} className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-on-surface sm:min-h-0">
                  <RadioGroupItem value={k} id={`money-kind-${k}`} />
                  {MONEY_ACCOUNT_KIND_LABELS[k]}
                </label>
              ))}
            </RadioGroup>
          </fieldset>

          <FormField label="Name" required>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Current" maxLength={120} />}
          </FormField>

          {hasBankDetails && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Bank name">
                {(field) => <Input {...field} value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={120} />}
              </FormField>
              <FormField label="Last 4 digits">
                {(field) => (
                  <Input {...field} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} />
                )}
              </FormField>
            </div>
          )}

          <label htmlFor="money-default" className="flex cursor-pointer items-start gap-3">
            <Checkbox id="money-default" checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} className="mt-0.5" disabled={Boolean(account?.isDefault)} />
            <span>
              <span className="block text-[14px] text-on-surface">Use as default for new payments</span>
              <span className="block text-[12px] text-on-surface-muted">Payments and expenses start with this account. You can change it on each one.</span>
            </span>
          </label>

          <p className="text-[13px] text-on-surface-muted">
            {code ? `Ledger account ${code} · ${ledgerType}.` : `${ledgerType}.`}
            {!account && " Enter its balance on your cutover date in Opening balances."}
          </p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : account ? "Save changes" : "Add account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
