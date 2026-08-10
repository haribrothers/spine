"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Combobox,
  DatePicker,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { EXPENSE_PAID_BY_LABELS, type Expense, type ExpenseCategory, type ExpensePaidBy, type JobOption, type SpineFile, type TaxRateOption } from "./types";

const NO_JOB = "__none__";
const NO_TAX = "";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const PAID_BY_OPTIONS: { value: ExpensePaidBy; label: string }[] = (
  Object.entries(EXPENSE_PAID_BY_LABELS) as [ExpensePaidBy, string][]
).map(([value, label]) => ({ value, label }));

/**
 * Create-or-edit Dialog for an expense — an expense is one amount, not a
 * multi-line document, so this is a Dialog (not a full-page builder like
 * invoice-builder.tsx), mirroring catalog-item-drawer.tsx's create-or-edit-
 * in-one-overlay composition (minus the Drawer wrapper — Dialog fits an
 * expense's shorter field list better, matching new-payment-dialog.tsx's
 * own choice for a similarly compact record).
 *
 * Tax here is a single rate picker (not the full line-editor tax UI vendor
 * bills/invoices use) plus a raw tax-amount MoneyInput — an expense has ONE
 * tax rate and the org enters the tax amount directly rather than it being
 * computed from a rate, per createExpenseSchema's own shape (`amount`,
 * `taxAmount` both raw inputs, no per-line breakdown to sum).
 *
 * Receipt upload reuses `apiClient.upload`, the same multipart pattern
 * contacts/contact-logo.tsx already established for `POST /files` — upload
 * happens immediately on file selection (not deferred to submit) so a
 * failed upload surfaces before the rest of the form is lost.
 */
export function ExpenseForm({
  open,
  onOpenChange,
  expense,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense;
  onSaved: (expense: Expense, mode: "created" | "updated") => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [jobId, setJobId] = useState(NO_JOB);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState<bigint>(0n);
  const [taxRateSelection, setTaxRateSelection] = useState(NO_TAX);
  const [taxAmount, setTaxAmount] = useState<bigint>(0n);
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState<ExpensePaidBy>("company");
  const [receiptFileId, setReceiptFileId] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState<string | null>(null);
  const [isBillable, setIsBillable] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCategoryId(expense?.categoryId ?? "");
    setJobId(expense?.jobId ?? NO_JOB);
    setDate(expense?.date ? new Date(expense.date) : new Date());
    setCurrency(expense?.currency ?? "USD");
    setAmount(expense ? BigInt(expense.amount) : 0n);
    setTaxRateSelection(expense?.taxRateId ?? NO_TAX);
    setTaxAmount(expense ? BigInt(expense.taxAmount) : 0n);
    setDescription(expense?.description ?? "");
    setPaidBy(expense?.paidBy ?? "company");
    setReceiptFileId(expense?.receiptFileId ?? null);
    setReceiptFilename(null);
    setIsBillable(expense?.isBillable ?? false);
    setError(null);
  }, [open, expense]);

  useEffect(() => {
    if (!open) return;
    apiClient.get<ExpenseCategory[]>("/expense-categories").then(setCategories).catch(() => {});
    apiClient.get<JobOption[]>("/jobs").then(setJobs).catch(() => {});
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (expense) return; // only pre-fill the org default currency for a brand-new expense
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, [expense]);

  const categoryOptions = useMemo(
    () => categories.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );
  const jobOptions = useMemo(
    () => [{ value: NO_JOB, label: "No job" }, ...jobs.map((j) => ({ value: j.id, label: j.name }))],
    [jobs],
  );
  const taxOptions = useMemo(
    () => [{ value: NO_TAX, label: "No tax" }, ...taxRates.filter((r) => !r.archivedAt).map((r) => ({ value: r.id, label: `${r.name} (${r.rate}%)` }))],
    [taxRates],
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await apiClient.upload<SpineFile>("/files", file);
      setReceiptFileId(uploaded.id);
      setReceiptFilename(uploaded.originalFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the receipt.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!categoryId) {
      setError("Select a category before saving.");
      return;
    }
    if (amount <= 0n) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        categoryId,
        jobId: jobId === NO_JOB ? null : jobId,
        date: date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        currency,
        amount: amount.toString(),
        taxAmount: taxAmount.toString(),
        taxRateId: taxRateSelection || null,
        description: description || null,
        paidBy,
        receiptFileId,
        isBillable,
      };
      const saved = expense
        ? await apiClient.put<Expense>(`/expenses/${expense.id}`, payload)
        : await apiClient.post<Expense>("/expenses", payload);
      onOpenChange(false);
      onSaved(saved, expense ? "updated" : "created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Submit an expense"}</DialogTitle>
          <DialogDescription>
            {expense
              ? "Only a submitted expense can be edited — an approved expense has already posted to the ledger."
              : "A submitted expense doesn't post to the ledger until an owner or staff member approves it."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Category" required>
              {() => <Combobox options={categoryOptions} value={categoryId} onValueChange={setCategoryId} placeholder="Select a category…" />}
            </FormField>
            <FormField label="Job" helperText="Optional — flows into job costing once approved.">
              {() => <Combobox options={jobOptions} value={jobId} onValueChange={setJobId} />}
            </FormField>
            <FormField label="Date" required>
              {() => <DatePicker value={date} onChange={setDate} />}
            </FormField>
            <FormField label="Currency" required>
              {() => <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />}
            </FormField>
            <FormField label="Amount" required>
              {() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} />}
            </FormField>
            <FormField label="Tax rate">
              {() => <Combobox options={taxOptions} value={taxRateSelection} onValueChange={setTaxRateSelection} placeholder="No tax" />}
            </FormField>
            <FormField label="Tax amount" helperText="Included in the amount above, not added on top.">
              {() => <MoneyInput value={taxAmount} onValueChange={setTaxAmount} currency={currency} />}
            </FormField>
            <FormField label="Paid by" required>
              {() => (
                <Select value={paidBy} onValueChange={(v) => setPaidBy(v as ExpensePaidBy)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAID_BY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>

          <FormField label="Description">
            {(field) => <Input {...field} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" />}
          </FormField>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-on-surface">Receipt</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Spinner size="sm" /> : receiptFileId ? "Replace receipt" : "Upload receipt"}
              </Button>
              {receiptFileId && (
                <a href={`${API_URL}/files/${receiptFileId}`} target="_blank" rel="noreferrer" className="text-[13px] text-primary hover:underline">
                  {receiptFilename ?? "View current receipt"}
                </a>
              )}
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2">
            <Checkbox checked={isBillable} onCheckedChange={(v) => setIsBillable(v === true)} />
            <span className="text-[13px] text-on-surface">Billable to a customer</span>
          </label>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || uploading}>
            {saving ? <Spinner size="sm" /> : "Save expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
