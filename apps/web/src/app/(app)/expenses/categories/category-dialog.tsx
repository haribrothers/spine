"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Combobox, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner, Textarea } from "@spine/ui";
import { Check, Info, Plus } from "lucide-react";
import { EXPENSE_CATEGORY_DESCRIPTION_MAX } from "@spine/shared";
import { ApiError, apiClient } from "../../../../lib/api-client";
import type { ExpenseCategory } from "../types";

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
export const FALLBACK_ACCOUNT_LABEL = "6900 Other Expenses · default";

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
    const options = [{ value: NO_RATE, label: "None" }, ...taxRates.map((r) => ({ value: r.id, label: r.name }))];
    if (category?.defaultTaxRateId && !taxRates.some((r) => r.id === category.defaultTaxRateId)) options.push({ value: category.defaultTaxRateId, label: category.defaultTaxRateName ?? "Archived rate" });
    return options;
  }, [taxRates, category]);

  const label = (id: string | null) => (id ? (accounts.find((a) => a.id === id) ? `${accounts.find((a) => a.id === id)!.code} ${accounts.find((a) => a.id === id)!.name}` : "its account") : "6900 Other Expenses");
  const accountChanged = category !== null && (category.accountId ?? DEFAULT_ACCOUNT) !== accountId;

  async function save() {
    setError(null);
    setNameError(null);
    setTaken(null);
    if (!name.trim()) {
      setNameError("Give the category a name.");
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
        setNameError(body.archived ? `${body.message.replace(/\.$/, "")} — it's archived.` : body.message);
      } else {
        setError(err instanceof Error ? err.message : "Couldn't save the category. Try again.");
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
      setError(err instanceof Error ? err.message : "Couldn't restore it. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
          {!category && <DialogDescription>Name it, say what it&apos;s for, and choose where it posts.</DialogDescription>}
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1">
            <FormField label="Name" required errorText={nameError ?? undefined}>
              {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fuel & freight" />}
            </FormField>
            {taken?.archived && (
              <Button variant="ghost" size="sm" className="self-start px-1 text-primary hover:underline" disabled={saving} onClick={() => void restoreTaken()}>
                Restore it
              </Button>
            )}
          </div>
          <FormField label="What it's for" helperText={`Shown under the name when people pick a category. ${description.trim().length} / ${EXPENSE_CATEGORY_DESCRIPTION_MAX}`}>
            {(field) => (
              <Textarea
                {...field}
                value={description}
                maxLength={EXPENSE_CATEGORY_DESCRIPTION_MAX}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Diesel, petrol, tolls and parking for site vehicles"
              />
            )}
          </FormField>
          <FormField label="Posts to">
            {() => <Combobox options={accountOptions} value={accountId} onValueChange={setAccountId} aria-label="Posts to" />}
          </FormField>
          {accountChanged && (
            <div className="flex items-start gap-2 rounded-md bg-info-bg px-3 py-2 text-[12.5px] text-on-surface" data-testid="category-account-note">
              <Info size={14} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              <span>
                Expenses already approved stay in {label(category!.accountId)}. Expenses approved from now on post to {label(accountId || null)}.
              </span>
            </div>
          )}
          <FormField label="Default tax rate" helperText="Filled in on the expense form when this category is chosen — people can still change it.">
            {() => <Combobox options={rateOptions} value={rateId} onValueChange={setRateId} aria-label="Default tax rate" />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner size="sm" /> : category ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
            {category ? "Save changes" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
