"use client";

import { useModule } from "../../../lib/modules-context";
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
  ToggleGroup,
  ToggleGroupItem,
} from "@spine/ui";
import { LABOUR_NEEDS_JOB, LABOUR_ROW_INCOMPLETE, computeLineTax, money, type PossibleDuplicateExpense } from "@spine/shared";
import Link from "next/link";
import { ImagePlus, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";
import { ReceiptPreview } from "./receipt-preview";
import { attachPending, type PendingAttachment } from "../../../components/attachments-section";
import { File as FileIcon, X as XIcon } from "lucide-react";
import { MoneyAccountPicker } from "../../../components/money-account-picker";
import { useMyRole } from "../../../lib/role-context";
import { LabourRows, blankLabourRow, headcountOf, rowsTotal, type LabourRow } from "./labour-rows";
import { apiClient } from "../../../lib/api-client";
import { EXPENSE_PAID_BY_LABELS, type Expense, type ExpenseCategory, type ExpensePaidBy, type JobOption, type SpineFile, type TaxRateOption } from "./types";
import { expensesDescription, useCanManageExpenseCategories } from "./expenses-header";
import { PHOTO_OR_PDF_ACCEPT } from "../../../lib/upload-types";

const NO_JOB = "__none__";
const NO_TAX = "";

/** "Materials’", "Fuel & freight’s". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];

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
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense;
  onSaved: (expense: Expense, mode: "created" | "updated" | "resubmitted") => void;
  /** Where focus goes when the form closes — for a form opened from a menu item, which is gone by then. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const jobsOn = useModule("jobsField");
  const [categoryId, setCategoryId] = useState("");
  const [jobId, setJobId] = useState(NO_JOB);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState<bigint>(0n);
  const [taxRateSelection, setTaxRateSelection] = useState(NO_TAX);
  const [taxAmount, setTaxAmount] = useState<bigint>(0n);
  const canManageCategories = useCanManageExpenseCategories();
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState<ExpensePaidBy>("company");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  // US-BANK-03: Field don't see accounts; their expenses start on the default and the approver picks.
  const choosesAccount = useMyRole() !== "field";
  const [receiptFileId, setReceiptFileId] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState<string | null>(null);
  const [receiptMime, setReceiptMime] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // US-PUR-44: more files beyond the receipt (a muster sheet, a delivery docket), attached when it's saved.
  const [extraFiles, setExtraFiles] = useState<PendingAttachment[]>([]);
  // US-PUR-44: the tax is worked out from the rate until it's typed over.
  const [taxTouched, setTaxTouched] = useState(false);
  // US-PUR-48: a category's default rate fills in on a new expense until the person picks a rate themselves.
  const [rateChosen, setRateChosen] = useState(false);
  const [rateFromCategory, setRateFromCategory] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<PossibleDuplicateExpense[]>([]);
  const resubmitting = expense?.status === "rejected";
  const [isBillable, setIsBillable] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // US-PUR-23 — "Headcount × day rate" entry.
  const [entryMode, setEntryMode] = useState<"amount" | "labour">("amount");
  const [labourRows, setLabourRows] = useState<LabourRow[]>([blankLabourRow()]);
  const [trades, setTrades] = useState<{ trade: string; lastDayRateAmount: string }[]>([]);

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
    setReceiptMime(null);
    setExtraFiles([]);
    setTaxTouched(Boolean(expense));
    setRateChosen(Boolean(expense));
    setRateFromCategory(null);
    setDuplicates([]);
    setIsBillable(expense?.isBillable ?? false);
    setEntryMode(expense?.entryMode ?? "amount");
    setLabourRows(
      expense?.labourLines?.length
        ? expense.labourLines.map((l) => ({ key: l.id, trade: l.trade, headcount: String(l.headcount), dayRateAmount: BigInt(l.dayRateAmount) }))
        : [blankLabourRow()],
    );
    setError(null);
  }, [open, expense]);

  useEffect(() => {
    if (!open) return;
    apiClient.get<ExpenseCategory[]>("/expense-categories").then(setCategories).catch(() => {});
    apiClient.get<JobOption[]>("/jobs").then(setJobs).catch(() => {});
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
    apiClient.get<{ trade: string; lastDayRateAmount: string }[]>("/expenses/labour-trades").then(setTrades).catch(() => {});
  }, [open]);

  const labourCategory = categories.find((c) => !c.archivedAt && c.accountCode === "5200");

  function changeEntryMode(next: string) {
    if (next !== "amount" && next !== "labour") return;
    setEntryMode(next);
    setError(null);
    // A category posting to 5200 Direct Labour is preselected; it can be changed.
    if (next === "labour" && labourCategory && (!categoryId || !expense)) setCategoryId(labourCategory.id);
  }

  // US-PUR-23 — if "Headcount × day rate" was chosen before the categories arrived, preselect once they do.
  useEffect(() => {
    if (entryMode === "labour" && labourCategory && !categoryId && !expense) setCategoryId(labourCategory.id);
  }, [entryMode, labourCategory, categoryId, expense]);

  useEffect(() => {
    if (expense) return; // only pre-fill the org default currency for a brand-new expense
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, [expense]);

  // US-PUR-48: each category says what it's for, under its name, and search looks at both.
  const categoryOptions = useMemo(
    () => categories.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name, description: c.description })),
    [categories],
  );
  const chosenCategory = categories.find((c) => c.id === categoryId) ?? null;

  /** US-PUR-48 — choosing a category fills in its default rate on a new expense, never over a rate the person chose. */
  function chooseCategory(id: string) {
    setCategoryId(id);
    if (expense || rateChosen) return;
    const next = categories.find((c) => c.id === id);
    const rate = next?.defaultTaxRateId && taxRates.some((r) => r.id === next.defaultTaxRateId) ? next.defaultTaxRateId : null;
    if (rate) {
      setTaxRateSelection(rate);
      setRateFromCategory(next!.name);
    } else if (rateFromCategory) {
      setTaxRateSelection(NO_TAX);
      setRateFromCategory(null);
    }
  }
  const jobOptions = useMemo(
    () => [{ value: NO_JOB, label: "No job" }, ...jobs.map((j) => ({ value: j.id, label: j.name }))],
    [jobs],
  );
  const currencyOptions = useMemo(() => (COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES]).map((c) => ({ value: c, label: c })), [currency]);
  const total = entryMode === "labour" ? rowsTotal(labourRows) : amount;
  const chosenRate = taxRates.find((r) => r.id === taxRateSelection) ?? null;

  // US-PUR-44: tax included in the amount, worked out from the rate (rounded once, half-up) until it's typed over.
  useEffect(() => {
    if (taxTouched) return;
    if (!chosenRate || total <= 0n) return setTaxAmount(0n);
    const result = computeLineTax(money(total, currency), [{ id: chosenRate.id, name: chosenRate.name, percent: chosenRate.rate, isCompound: chosenRate.isCompound }], true);
    setTaxAmount(result.taxAmount.amount);
  }, [taxTouched, chosenRate, total, currency]);

  // US-PUR-44: my own expense with this amount on this day (not rejected) — a warning; it still submits.
  useEffect(() => {
    if (!open || total <= 0n || !date) return setDuplicates([]);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ amount: total.toString(), date: day });
      if (expense) params.set("excludeId", expense.id);
      apiClient
        .get<PossibleDuplicateExpense[]>(`/expenses/possible-duplicates?${params}`)
        .then(setDuplicates)
        .catch(() => setDuplicates([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [open, total, date, expense]);

  const taxOptions = useMemo(
    () => [{ value: NO_TAX, label: "No tax" }, ...taxRates.filter((r) => !r.archivedAt).map((r) => ({ value: r.id, label: `${r.name} (${r.rate}%)` }))],
    [taxRates],
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) await uploadFiles(files, replaceNext.current);
    replaceNext.current = false;
  }

  /** "Replace" swaps the receipt; "Add files" adds more after it. */
  const replaceNext = useRef(false);

  /**
   * US-PUR-44 — dropped or chosen photos and PDFs upload at once: the first
   * becomes the receipt (previewed) unless there is one, the rest are added
   * as files, attached when the expense is saved.
   */
  async function uploadFiles(files: File[], replaceReceipt = false) {
    setUploading(true);
    setError(null);
    try {
      let needsReceipt = replaceReceipt || !receiptFileId;
      for (const file of files) {
        const uploaded = await apiClient.upload<SpineFile>("/files", file);
        if (needsReceipt) {
          setReceiptFileId(uploaded.id);
          setReceiptFilename(uploaded.originalFilename);
          setReceiptMime(uploaded.mimeType);
          needsReceipt = false;
        } else {
          setExtraFiles((current) => [...current, { fileId: uploaded.id, name: uploaded.originalFilename, size: uploaded.sizeBytes, contentType: uploaded.mimeType }]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the receipt.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(addAnother = false) {
    setError(null);
    if (!categoryId) {
      setError("Select a category before saving.");
      return;
    }
    const labour = entryMode === "labour";
    if (labour) {
      if (labourRows.some((r) => !r.trade.trim() || headcountOf(r) < 1 || r.dayRateAmount <= 0n)) {
        setError(LABOUR_ROW_INCOMPLETE);
        return;
      }
      if (jobId === NO_JOB) {
        setError(LABOUR_NEEDS_JOB);
        return;
      }
    } else if (amount <= 0n) {
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
        amount: (labour ? rowsTotal(labourRows) : amount).toString(),
        entryMode,
        ...(labour ? { labourLines: labourRows.map((r) => ({ trade: r.trade.trim(), headcount: headcountOf(r), dayRateAmount: r.dayRateAmount.toString() })) } : {}),
        taxAmount: taxAmount.toString(),
        taxRateId: taxRateSelection || null,
        description: description || null,
        paidBy,
        ...(choosesAccount && moneyAccountId ? { moneyAccountId } : {}),
        receiptFileId,
        isBillable,
      };
      const saved = expense
        ? await apiClient.put<Expense>(`/expenses/${expense.id}`, payload)
        : await apiClient.post<Expense>("/expenses", payload);
      if (extraFiles.length) await attachPending("expense", saved.id, extraFiles);
      onSaved(saved, expense ? (resubmitting ? "resubmitted" : "updated") : "created");
      if (addAnother) {
        // US-PUR-44: the next receipt starts with the same date, currency, who paid and job.
        setAmount(0n);
        setTaxAmount(0n);
        setTaxTouched(false);
        setDescription("");
        setReceiptFileId(null);
        setReceiptFilename(null);
        setReceiptMime(null);
        setExtraFiles([]);
        setLabourRows([blankLabourRow()]);
        setDuplicates([]);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo?.current) return;
          event.preventDefault();
          returnFocusTo.current.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{resubmitting ? "Fix and resubmit" : expense ? "Edit expense" : "Submit an expense"}</DialogTitle>
          <DialogDescription>
            {resubmitting
              ? `Rejected${expense?.reviewerName ? ` by ${expense.reviewerName}` : ""}: “${expense?.reviewComment ?? ""}” Fix it, then resubmit — it goes back for approval.`
              : expense
                ? entryMode === "labour"
                  ? "It stays waiting for approval. Changing the rows changes the amount."
                  : "It stays waiting for approval. Only a waiting or rejected expense can be edited — an approved expense has already posted to the ledger."
                : entryMode === "labour"
                  ? "A day's labour on site: workers per trade × their day rate."
                  : expensesDescription(canManageCategories)}
          </DialogDescription>
        </DialogHeader>

        {/* US-PUR-44: the files pane and the form scroll on their own on wider screens. */}
        <DialogBody className="grid grid-cols-1 gap-5 md:grid-cols-[230px_minmax(0,1fr)] md:overflow-hidden">
          <div
            className={`flex flex-col gap-2.5 rounded-lg border-[1.5px] border-dashed p-2.5 md:min-h-0 md:overflow-y-auto ${dragging ? "border-primary bg-info-bg" : "border-border bg-surface-sunken"}`}
            data-testid="receipt-drop"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const files = Array.from(e.dataTransfer.files ?? []);
              if (files.length) void uploadFiles(files);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-on-surface">Receipt and files</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => {
                  replaceNext.current = false;
                  fileInputRef.current?.click();
                }}
              >
                <Plus size={13} aria-hidden />
                Add files
              </Button>
            </div>
            {receiptFileId ? (
              <div className="flex flex-col items-center gap-2">
                <ReceiptPreview key={receiptFileId} fileId={receiptFileId} mimeType={receiptMime} className="h-56 w-full shrink-0" />
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      replaceNext.current = true;
                      fileInputRef.current?.click();
                    }}
                  >
                    <RefreshCw size={13} aria-hidden />
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      // The next file takes its place as the receipt.
                      const [next, ...rest] = extraFiles;
                      setReceiptFileId(next?.fileId ?? null);
                      setReceiptFilename(next?.name ?? null);
                      setReceiptMime(next?.contentType ?? null);
                      setExtraFiles(rest);
                    }}
                  >
                    <Trash2 size={13} aria-hidden />
                    Remove
                  </Button>
                </div>
                <p className="text-center text-[11.5px] text-on-surface-muted">{receiptFilename ? `${receiptFilename} · ` : ""}the receipt</p>
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
                <ImagePlus size={26} aria-hidden className="text-on-surface-muted" />
                <p className="text-[12px] text-on-surface-muted">
                  {entryMode === "labour" ? "Drop a muster sheet or site photo here, or " : "Drop the receipt here, or "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => fileInputRef.current?.click()}>
                    choose files
                  </button>
                  {entryMode === "labour" ? ". Optional for labour." : "."}
                </p>
              </div>
            )}
            {extraFiles.length > 0 && (
              <ul className="flex flex-col gap-1.5" aria-label="More files" data-testid="expense-extra-files">
                {extraFiles.map((f) => (
                  <li key={f.fileId} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-on-surface">
                    <FileIcon size={14} aria-hidden className="shrink-0 text-on-surface-muted" />
                    <span className="min-w-0 flex-1 truncate" title={f.name}>
                      {f.name}
                    </span>
                    <button type="button" aria-label={`Remove ${f.name}`} className="flex h-6 w-6 items-center justify-center rounded text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface" onClick={() => setExtraFiles((current) => current.filter((x) => x.fileId !== f.fileId))}>
                      <XIcon size={13} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {uploading && (
              <div className="flex justify-center py-2">
                <Spinner size="sm" />
              </div>
            )}
            {receiptFileId && <p className="text-center text-[11.5px] text-on-surface-muted">Drop more photos or PDFs to add them.</p>}
            <input ref={fileInputRef} type="file" multiple accept={PHOTO_OR_PDF_ACCEPT} className="hidden" aria-label="Choose receipt and files" onChange={handleFileChange} />
          </div>
          <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:overflow-y-auto md:pr-1">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <span id="entry-mode-label" className="text-[13px] font-medium text-on-surface">
              Enter as
            </span>
            <ToggleGroup type="single" value={entryMode} onValueChange={changeEntryMode} aria-labelledby="entry-mode-label" className="w-full">
              <ToggleGroupItem value="amount" className="flex-1">
                Amount
              </ToggleGroupItem>
              <ToggleGroupItem value="labour" className="flex-1">
                Headcount × day rate
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Category"
              required
              helperText={entryMode === "labour" && labourCategory && categoryId === labourCategory.id ? `Preselected: posts to ${labourCategory.accountCode} ${labourCategory.accountName}.` : (chosenCategory?.description ?? undefined)}
            >
              {() => <Combobox options={categoryOptions} value={categoryId} onValueChange={chooseCategory} placeholder="Select a category…" />}
            </FormField>
            {/* US-SET-24: no jobs while Jobs & field is switched off. */}
            {jobsOn && (
              <FormField label="Job" required={entryMode === "labour"} helperText={entryMode === "labour" ? "Labour is always for a job." : "Optional — flows into job costing once approved."}>
                {() => <Combobox options={jobOptions} value={jobId} onValueChange={setJobId} />}
              </FormField>
            )}
            <FormField label="Date" required>
              {() => <DatePicker value={date} onChange={setDate} />}
            </FormField>
            <FormField label="Currency" required>
              {() => <Combobox options={currencyOptions} value={currency} onValueChange={setCurrency} aria-label="Currency" />}
            </FormField>
            {entryMode === "amount" && (
              <FormField label="Amount" required>
                {(field) => <MoneyInput id={field.id} aria-describedby={field["aria-describedby"]} value={amount} onValueChange={setAmount} currency={currency} />}
              </FormField>
            )}
            <FormField label="Tax rate" helperText={rateFromCategory && taxRateSelection ? `${possessive(rateFromCategory)} usual rate — change it if this receipt differs.` : undefined}>
              {() => (
                <Combobox
                  options={taxOptions}
                  value={taxRateSelection}
                  onValueChange={(v) => {
                    setTaxRateSelection(v);
                    setRateChosen(true);
                    setRateFromCategory(null);
                  }}
                  placeholder="No tax"
                />
              )}
            </FormField>
            <FormField label="Tax amount" helperText={!taxTouched && chosenRate ? `Worked out from ${chosenRate.name}, included in the amount.` : "Included in the amount above, not added on top."}>
              {(field) => (
                <MoneyInput
                  id={field.id}
                  aria-describedby={field["aria-describedby"]}
                  value={taxAmount}
                  onValueChange={(v) => {
                    setTaxTouched(true);
                    setTaxAmount(v);
                  }}
                  currency={currency}
                />
              )}
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
            {choosesAccount && <MoneyAccountPicker form="expense" direction="out" value={moneyAccountId} onValueChange={setMoneyAccountId} initialId={expense?.moneyAccountId} />}
          </div>

          {entryMode === "labour" && (
            <>
              <LabourRows rows={labourRows} onChange={setLabourRows} currency={currency} trades={trades} />
              <Alert variant="info">
                <AlertDescription>Only headcounts and day rates are recorded — no names, attendance or hours.</AlertDescription>
              </Alert>
            </>
          )}

          {duplicates[0] && (
            <Alert variant="warning" data-testid="expense-duplicate-warning">
              <AlertDescription>
                <span className="font-semibold">
                  You submitted {formatMoney(BigInt(duplicates[0].amount), duplicates[0].currency)} on {calendarDate(duplicates[0].date, new Date(), orgLocaleTag())} already
                </span>{" "}
                — {duplicates[0].categoryName ?? "an expense"}, {duplicates[0].status === "submitted" ? "waiting for approval" : "approved"}. Check it isn&apos;t the same receipt before you submit.{" "}
                <Link href={`/expenses/${duplicates[0].id}`} target="_blank" className="font-medium text-primary hover:underline">
                  Open it
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <FormField label="Description">
            {(field) => <Input {...field} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" />}
          </FormField>

          <label className="flex w-fit cursor-pointer items-center gap-2">
            <Checkbox checked={isBillable} onCheckedChange={(v) => setIsBillable(v === true)} />
            <span className="text-[13px] text-on-surface">Billable to a customer</span>
          </label>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {!expense && (
            <Button type="button" variant="secondary" onClick={() => void handleSubmit(true)} disabled={saving || uploading}>
              <Plus size={14} aria-hidden />
              Submit and add another
            </Button>
          )}
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving || uploading}>
            {saving ? <Spinner size="sm" /> : <Send size={14} aria-hidden />}
            {resubmitting ? "Resubmit" : expense ? "Save changes" : "Submit expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
