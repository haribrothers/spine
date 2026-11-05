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
import { useT } from "../../../lib/i18n";

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
  const t = useT();
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
  const ledgerType = kind === "card" ? t("banking.accountDialog.liability") : t("banking.accountDialog.asset");

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError(t("banking.accountDialog.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const body = { kind, name: name.trim(), bankName: hasBankDetails ? bankName.trim() || null : null, last4: hasBankDetails ? last4.trim() || null : null, isDefault };
      const saved = account ? await apiClient.put<MoneyAccount>(`/money-accounts/${account.id}`, body) : await apiClient.post<MoneyAccount>("/money-accounts", body);
      onOpenChange(false);
      onSaved(saved, !account);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.accountDialog.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{account ? t("banking.accountDialog.editTitle") : t("banking.accountDialog.addTitle")}</DialogTitle>
          <DialogDescription>{t("banking.accountDialog.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-on-surface">
              {t("banking.accountDialog.type")} <span className="text-overdue" aria-hidden="true">*</span>
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

          <FormField label={t("banking.accountDialog.name")} required>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("banking.accountDialog.namePlaceholder")} maxLength={120} />}
          </FormField>

          {hasBankDetails && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label={t("banking.accountDialog.bankName")}>
                {(field) => <Input {...field} value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={120} />}
              </FormField>
              <FormField label={t("banking.accountDialog.last4")}>
                {(field) => (
                  <Input {...field} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} />
                )}
              </FormField>
            </div>
          )}

          <label htmlFor="money-default" className="flex cursor-pointer items-start gap-3">
            <Checkbox id="money-default" checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} className="mt-0.5" disabled={Boolean(account?.isDefault)} />
            <span>
              <span className="block text-[14px] text-on-surface">{t("banking.accountDialog.useDefault")}</span>
              <span className="block text-[12px] text-on-surface-muted">{t("banking.accountDialog.useDefaultHint")}</span>
            </span>
          </label>

          <p className="text-[13px] text-on-surface-muted">
            {code ? t("banking.accountDialog.ledgerAccount", { code, type: ledgerType }) : `${ledgerType}.`}
            {!account && t("banking.accountDialog.openingHint")}
          </p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("banking.accountDialog.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : account ? t("banking.accountDialog.saveChanges") : t("banking.accountDialog.addTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
