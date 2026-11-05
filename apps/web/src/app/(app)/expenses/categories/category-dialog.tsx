"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Combobox, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner, Textarea } from "@spine/ui";
import { Check, Info, Plus } from "lucide-react";
import { EXPENSE_CATEGORY_DESCRIPTION_MAX } from "@spine/shared";
import { ApiError, apiClient } from "../../../../lib/api-client";
import type { ExpenseCategory } from "../types";
import { t as translate, useT } from "../../../../lib/i18n";

export interface AccountOption {
  id: string;
  code: string;
  name: string;
}

export interface TaxRateOption {
  id: string;
  name: string;
}

const DEFAULT_ACCOUNT = "";
const NO_RATE = "";
/** The account a category without one posts to (the posting rule's fallback). */
export const FALLBACK_ACCOUNT_LABEL = translate("expenses.categories.fallbackAccountDefault");

interface NameTaken {
  message: string;
  existingId: string;
  archived: boolean;
}

/**
 * US-PUR-47 (D-228) — one form for adding and editing a category: Name,
 * What it's for (optional, up to 120 characters, counted), Posts to and
 * Default tax rate. Changing the account says what happens to expenses
 * already approved. A name that's taken is caught under the field, with
 * Restore for an archived one. Problems stay in the form.
 */
export function ExpenseCategoryDialog({
  category,
  accounts,
  taxRates,
  open,
  onOpenChange,
  onSaved,
  onRestored,
}: {
  category: ExpenseCategory | null;
  accounts: AccountOption[];
  taxRates: TaxRateOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: ExpenseCategory, mode: "created" | "updated") => void;
  onRestored: (id: string, name: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState(DEFAULT_ACCOUNT);
  const [rateId, setRateId] = useState(NO_RATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [taken, setTaken] = useState<NameTaken | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setAccountId(category?.accountId ?? DEFAULT_ACCOUNT);
    setRateId(category?.defaultTaxRateId ?? NO_RATE);
    setError(null);
    setNameError(null);
    setTaken(null);
  }, [open, category]);

  const accountOptions = useMemo(() => [{ value: DEFAULT_ACCOUNT, label: FALLBACK_ACCOUNT_LABEL }, ...accounts.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))], [accounts]);
  // A rate saved before it was archived still shows; only active ones can be newly chosen.
  const rateOptions = useMemo(() => {
    const options = [{ value: NO_RATE, label: t("expenses.categories.none") }, ...taxRates.map((r) => ({ value: r.id, label: r.name }))];
    if (category?.defaultTaxRateId && !taxRates.some((r) => r.id === category.defaultTaxRateId)) options.push({ value: category.defaultTaxRateId, label: category.defaultTaxRateName ?? t("expenses.categories.archivedRate") });
    return options;
  }, [taxRates, category, t]);

  const label = (id: string | null) => (id ? (accounts.find((a) => a.id === id) ? `${accounts.find((a) => a.id === id)!.code} ${accounts.find((a) => a.id === id)!.name}` : t("expenses.categories.itsAccount")) : t("expenses.categories.fallbackAccount"));
  const accountChanged = category !== null && (category.accountId ?? DEFAULT_ACCOUNT) !== accountId;

  async function save() {
    setError(null);
    setNameError(null);
    setTaken(null);
    if (!name.trim()) {
      setNameError(t("expenses.categories.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const body = { name: name.trim(), description: description.trim() || null, accountId: accountId || null, defaultTaxRateId: rateId || null };
      const saved = category ? await apiClient.put<ExpenseCategory>(`/expense-categories/${category.id}`, body) : await apiClient.post<ExpenseCategory>("/expense-categories", body);
      onSaved(saved, category ? "updated" : "created");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as NameTaken;
        setTaken(body);
        setNameError(body.archived ? t("expenses.categories.nameArchived", { message: body.message.replace(/\.$/, "") }) : body.message);
      } else {
        setError(err instanceof Error ? err.message : t("expenses.categories.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function restoreTaken() {
    if (!taken) return;
    setSaving(true);
    try {
      await apiClient.post(`/expense-categories/${taken.existingId}/restore`);
      onRestored(taken.existingId, taken.message.replace(/ is already a category\.$/, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("expenses.categories.restoreItFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? t("expenses.categories.editTitle") : t("expenses.categories.addTitle")}</DialogTitle>
          {!category && <DialogDescription>{t("expenses.categories.addDescription")}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1">
            <FormField label={t("expenses.categories.name")} required errorText={nameError ?? undefined}>
              {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("expenses.categories.namePlaceholder")} />}
            </FormField>
            {taken?.archived && (
              <Button variant="ghost" size="sm" className="self-start px-1 text-primary hover:underline" disabled={saving} onClick={() => void restoreTaken()}>
                {t("expenses.categories.restoreIt")}
              </Button>
            )}
          </div>
          <FormField label={t("expenses.categories.whatFor")} helperText={t("expenses.categories.whatForHelper", { length: description.trim().length, max: EXPENSE_CATEGORY_DESCRIPTION_MAX })}>
            {(field) => (
              <Textarea
                {...field}
                value={description}
                maxLength={EXPENSE_CATEGORY_DESCRIPTION_MAX}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("expenses.categories.whatForPlaceholder")}
              />
            )}
          </FormField>
          <FormField label={t("expenses.categories.postsTo")}>
            {(field) => <Combobox id={field.id} options={accountOptions} value={accountId} onValueChange={setAccountId} aria-label={t("expenses.categories.postsTo")} />}
          </FormField>
          {accountChanged && (
            <div className="flex items-start gap-2 rounded-md bg-info-bg px-3 py-2 text-[12.5px] text-on-surface" data-testid="category-account-note">
              <Info size={14} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              <span>
                {t("expenses.categories.accountChanged", { before: label(category!.accountId), after: label(accountId || null) })}
              </span>
            </div>
          )}
          <FormField label={t("expenses.categories.defaultTaxRate")} helperText={t("expenses.categories.defaultTaxRateHelper")}>
            {(field) => <Combobox id={field.id} options={rateOptions} value={rateId} onValueChange={setRateId} aria-label={t("expenses.categories.defaultTaxRate")} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("expenses.common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner size="sm" /> : category ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
            {category ? t("expenses.common.saveChanges") : t("expenses.categories.addTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
