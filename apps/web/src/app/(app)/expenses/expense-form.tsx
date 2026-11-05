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
import { LABOUR_NEEDS_JOB, LABOUR_ROW_INCOMPLETE, aiCategoryFromMerchant, aiPausedMessage, computeLineTax, money, type PossibleDuplicateExpense, type ReceiptSuggestion } from "@spine/shared";
import Link from "next/link";
import { ImagePlus, Plus, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
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
import { AiActionButton } from "../../../components/ai-action-button";
import { AiField } from "../../../components/ai-suggested-tag";
import { AiUnavailableNotice } from "../../../components/ai-unavailable-notice";
import { useAiRequest } from "../../../lib/use-ai-request";
import { useAiStatus } from "../../../lib/use-ai-status";
import { planExpenseFill, receiptTaxNote, type ExpenseField, type ExpenseValues } from "./expense-ai-fill";
import { useT } from "../../../lib/i18n";

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
  const t = useT();
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
  // US-AI-09 — "Read receipt": AI fills what the person hasn't entered, each field marked until they change it.
  const aiStatus = useAiStatus();
  // Field may read only their own receipt (D-245); everyone else needs "Use AI features".
  const aiReceipt = Boolean(aiStatus?.features.readDocuments && (aiStatus.canUse || aiStatus.canReadOwnReceipt));
  const ai = useAiRequest<ReceiptSuggestion>();
  const [aiFields, setAiFields] = useState<Set<ExpenseField>>(new Set());
  const [aiAssisted, setAiAssisted] = useState(false);
  const [readFileId, setReadFileId] = useState<string | null>(null);
  const [categoryNote, setCategoryNote] = useState<string | null>(null);
  const [taxNote, setTaxNote] = useState<string | null>(null);
  const [replaceOffer, setReplaceOffer] = useState<{ values: Partial<ExpenseValues>; count: number } | null>(null);
  const entered = useRef<Set<ExpenseField>>(new Set());
  /** A field the person sets: it's theirs now, so its AI mark (and the note under it) goes. */
  function markMine(field: ExpenseField) {
    entered.current.add(field);
    setAiFields((prev) => (prev.has(field) ? new Set([...prev].filter((f) => f !== field)) : prev));
    if (field === "category") setCategoryNote(null);
    if (field === "taxAmount" || field === "taxRate") setTaxNote(null);
  }
  function resetAi() {
    ai.cancel();
    setAiFields(new Set());
    setAiAssisted(false);
    setReadFileId(null);
    setCategoryNote(null);
    setTaxNote(null);
    setReplaceOffer(null);
  }

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
    resetAi();
    // A rejected expense's values are the person's entries (US-PUR-45); a new one has none yet.
    entered.current = new Set(
      expense
        ? (
            [
              ["category", expense.categoryId],
              ["date", expense.date],
              ["currency", expense.currency],
              ["amount", expense.amount !== "0"],
              ["taxRate", expense.taxRateId],
              ["taxAmount", expense.taxAmount !== "0"],
              ["description", expense.description],
            ] as const
          )
            .filter(([, v]) => Boolean(v))
            .map(([k]) => k)
        : [],
    );
  }, [open, expense]);

  useEffect(() => {
    if (!open) return;
    apiClient.get<ExpenseCategory[]>("/expense-categories").then(setCategories).catch(() => {});
    apiClient.get<JobOption[]>("/jobs?picker=1").then(setJobs).catch(() => {});
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
    () => [{ value: NO_JOB, label: t("expenses.form.noJob") }, ...jobs.map((j) => ({ value: j.id, label: j.name }))],
    [jobs, t],
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
    () => [{ value: NO_TAX, label: t("expenses.form.noTax") }, ...taxRates.filter((r) => !r.archivedAt).map((r) => ({ value: r.id, label: `${r.name} (${r.rate}%)` }))],
    [taxRates, t],
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
      setError(err instanceof Error ? err.message : t("expenses.form.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** US-AI-09 — puts what AI read into the fields still empty, marks them, and offers the rest. */
  function applyReceipt(suggestion: ReceiptSuggestion) {
    const current: ExpenseValues = { categoryId, date, currency, amount, taxRateId: taxRateSelection, taxAmount, description };
    const plan = planExpenseFill(current, entered.current, suggestion);
    putValues(plan.values, suggestion);
    setAiFields(new Set(plan.filled));
    if (plan.values.categoryId && suggestion.categoryFrom === "merchant" && suggestion.merchant) setCategoryNote(aiCategoryFromMerchant(suggestion.merchantExpenses, suggestion.merchant));
    const keptCount = Object.keys(plan.kept).length;
    setReplaceOffer(keptCount ? { values: plan.kept, count: keptCount } : null);
    setAiAssisted(true);
  }

  function putValues(values: Partial<ExpenseValues>, suggestion: ReceiptSuggestion) {
    if (values.currency !== undefined) setCurrency(values.currency);
    if (values.date !== undefined) setDate(values.date);
    if (values.amount !== undefined) setAmount(values.amount);
    if (values.description !== undefined) setDescription(values.description);
    // The category brings its usual rate (US-PUR-48) — unless the receipt shows its own tax, set next.
    if (values.categoryId !== undefined) chooseCategory(values.categoryId);
    if (values.taxRateId !== undefined) {
      setTaxRateSelection(values.taxRateId);
      setRateChosen(true);
      setRateFromCategory(null);
    }
    if (values.taxAmount !== undefined) {
      setTaxTouched(true);
      setTaxAmount(values.taxAmount);
      setTaxNote(receiptTaxNote(suggestion, (a) => formatMoney(a, values.currency ?? currency)));
    }
  }

  /** "Replace my entries (<n>)": AI's values for the fields the person had filled. */
  const lastSuggestion = useRef<ReceiptSuggestion | null>(null);
  function replaceMine() {
    if (!replaceOffer || !lastSuggestion.current) return;
    putValues(replaceOffer.values, lastSuggestion.current);
    const fields = Object.keys(replaceOffer.values).map((k) => ({ categoryId: "category", taxRateId: "taxRate" })[k as "categoryId" | "taxRateId"] ?? k) as ExpenseField[];
    for (const f of fields) entered.current.delete(f);
    setAiFields((prev) => new Set([...prev, ...fields]));
    setReplaceOffer(null);
  }

  // The answer arrives later: it's applied with the form as it is then (US-AI-07).
  const applyRef = useRef(applyReceipt);
  applyRef.current = applyReceipt;
  function readReceipt() {
    if (!receiptFileId) return;
    const fileId = receiptFileId;
    void ai.run(
      (signal) => apiClient.post<ReceiptSuggestion>("/ai/read-document", { fileId, target: "expense" }, { signal }),
      (suggestion) => {
        lastSuggestion.current = suggestion;
        setReadFileId(fileId);
        applyRef.current(suggestion);
      },
    );
  }

  async function handleSubmit(addAnother = false) {
    setError(null);
    if (!categoryId) {
      setError(t("expenses.form.selectCategoryFirst"));
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
      setError(t("expenses.form.amountRequired"));
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
        // US-AI-06 — the expense says it was filled in with AI.
        ...(aiAssisted ? { aiAssisted: true } : {}),
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
        // The fresh form starts with nothing from AI.
        resetAi();
        entered.current = new Set();
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("expenses.form.saveFailed"));
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
          <DialogTitle>{resubmitting ? t("expenses.common.fixAndResubmit") : expense ? t("expenses.form.editTitle") : t("expenses.form.newTitle")}</DialogTitle>
          <DialogDescription>
            {resubmitting
              ? t("expenses.form.resubmitDescription", { by: expense?.reviewerName ? t("expenses.common.byName", { name: expense.reviewerName }) : "", comment: expense?.reviewComment ?? "" })
              : expense
                ? entryMode === "labour"
                  ? t("expenses.form.editLabourDescription")
                  : t("expenses.form.editDescription")
                : entryMode === "labour"
                  ? t("expenses.form.newLabourDescription")
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
              <span className="text-[12.5px] font-medium text-on-surface">{t("expenses.form.receiptAndFiles")}</span>
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
                {t("expenses.form.addFiles")}
              </Button>
            </div>
            {receiptFileId ? (
              <div className="flex flex-col items-center gap-2">
                <ReceiptPreview key={receiptFileId} fileId={receiptFileId} mimeType={receiptMime} className="h-56 w-full shrink-0" />
                {aiReceipt && entryMode === "amount" && (
                  <div className="flex w-full flex-col items-center gap-1" data-testid="expense-ai-read">
                    <AiActionButton
                      label={readFileId === receiptFileId ? t("expenses.form.readAgain") : t("expenses.form.readReceipt")}
                      workingLabel={t("expenses.form.reading")}
                      working={ai.working}
                      disabled={Boolean(aiStatus?.pausedUntil)}
                      onClick={readReceipt}
                      onCancel={ai.cancel}
                    />
                    {aiStatus?.pausedUntil && <p className="text-center text-[11.5px] text-on-surface-muted">{aiPausedMessage(aiStatus.pausedUntil)}</p>}
                  </div>
                )}
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
                    {t("expenses.form.replace")}
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
                    {t("expenses.form.remove")}
                  </Button>
                </div>
                <p className="text-center text-[11.5px] text-on-surface-muted">
                  {receiptFilename ? `${receiptFilename} · ` : ""}{t("expenses.form.theReceipt")}{readFileId === receiptFileId ? t("expenses.form.readByAi") : ""}
                </p>
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
                <ImagePlus size={26} aria-hidden className="text-on-surface-muted" />
                <p className="text-[12px] text-on-surface-muted">
                  {entryMode === "labour" ? t("expenses.form.dropLabour") : t("expenses.form.dropReceipt")}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => fileInputRef.current?.click()}>
                    {t("expenses.form.chooseFiles")}
                  </button>
                  {entryMode === "labour" ? t("expenses.form.optionalForLabour") : "."}
                </p>
              </div>
            )}
            {extraFiles.length > 0 && (
              <ul className="flex flex-col gap-1.5" aria-label={t("expenses.form.moreFilesAria")} data-testid="expense-extra-files">
                {extraFiles.map((f) => (
                  <li key={f.fileId} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-on-surface">
                    <FileIcon size={14} aria-hidden className="shrink-0 text-on-surface-muted" />
                    <span className="min-w-0 flex-1 truncate" title={f.name}>
                      {f.name}
                    </span>
                    <button type="button" aria-label={t("expenses.form.removeFileAria", { name: f.name })} className="flex h-6 w-6 items-center justify-center rounded text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface" onClick={() => setExtraFiles((current) => current.filter((x) => x.fileId !== f.fileId))}>
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
            {receiptFileId && <p className="text-center text-[11.5px] text-on-surface-muted">{t("expenses.form.dropMore")}</p>}
            <input ref={fileInputRef} type="file" multiple accept={PHOTO_OR_PDF_ACCEPT} className="hidden" aria-label={t("expenses.form.chooseFilesAria")} onChange={handleFileChange} />
          </div>
          <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:overflow-y-auto md:pr-1">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {ai.state.status === "failed" && <AiUnavailableNotice message={ai.state.message} detail={t("expenses.form.aiDetail")} onRetry={ai.state.canRetry ? ai.retry : undefined} />}
          {aiFields.size > 0 && (
            <Alert variant="info" icon={<Sparkles className="text-primary" />} data-testid="expense-ai-filled">
              <AlertDescription>
                {t("expenses.form.aiFilledBefore")}<span className="font-semibold">{t("expenses.form.aiFilledMark")}</span>{t("expenses.form.aiFilledAfter")}
              </AlertDescription>
            </Alert>
          )}
          {replaceOffer && (
            <Alert variant="info" data-testid="ai-replace-offer">
              <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex-1">{t("expenses.form.aiDifferent")}</span>
                <Button type="button" variant="secondary" size="sm" onClick={replaceMine}>
                  {t("expenses.form.replaceMine", { n: replaceOffer.count })}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <span id="entry-mode-label" className="text-[13px] font-medium text-on-surface">
              {t("expenses.form.enterAs")}
            </span>
            <ToggleGroup type="single" value={entryMode} onValueChange={changeEntryMode} aria-labelledby="entry-mode-label" className="w-full">
              <ToggleGroupItem value="amount" className="flex-1">
                {t("expenses.form.amount")}
              </ToggleGroupItem>
              <ToggleGroupItem value="labour" className="flex-1">
                {t("expenses.form.headcountDayRate")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AiField suggested={aiFields.has("category")}>
              <FormField
                label={t("expenses.form.category")}
                required
                helperText={
                  entryMode === "labour" && labourCategory && categoryId === labourCategory.id
                    ? t("expenses.form.preselected", { code: labourCategory.accountCode ?? "", name: labourCategory.accountName ?? "" })
                    : (categoryNote ?? chosenCategory?.description ?? undefined)
                }
              >
                {(field) => (
                  <Combobox
                    id={field.id}
                    options={categoryOptions}
                    value={categoryId}
                    onValueChange={(id) => {
                      markMine("category");
                      chooseCategory(id);
                    }}
                    placeholder={t("expenses.form.selectCategory")}
                  />
                )}
              </FormField>
            </AiField>
            {/* US-SET-24: no jobs while Jobs & field is switched off. */}
            {jobsOn && (
              <FormField label={t("expenses.form.job")} required={entryMode === "labour"} helperText={entryMode === "labour" ? t("expenses.form.labourNeedsJob") : t("expenses.form.jobOptional")}>
                {(field) => <Combobox id={field.id} options={jobOptions} value={jobId} onValueChange={setJobId} />}
              </FormField>
            )}
            <AiField suggested={aiFields.has("date")}>
              <FormField label={t("expenses.form.date")} required>
                {() => (
                  <DatePicker
                    value={date}
                    onChange={(v) => {
                      markMine("date");
                      setDate(v);
                    }}
                  />
                )}
              </FormField>
            </AiField>
            <AiField suggested={aiFields.has("currency")}>
              <FormField label={t("expenses.form.currency")} required>
                {(field) => (
                  <Combobox
                    id={field.id}
                    options={currencyOptions}
                    value={currency}
                    onValueChange={(v) => {
                      markMine("currency");
                      setCurrency(v);
                    }}
                    aria-label={t("expenses.form.currency")}
                  />
                )}
              </FormField>
            </AiField>
            {entryMode === "amount" && (
              <AiField suggested={aiFields.has("amount")}>
                <FormField label={t("expenses.form.amount")} required>
                  {(field) => (
                    <MoneyInput
                      id={field.id}
                      aria-describedby={field["aria-describedby"]}
                      value={amount}
                      onValueChange={(v) => {
                        markMine("amount");
                        setAmount(v);
                      }}
                      currency={currency}
                    />
                  )}
                </FormField>
              </AiField>
            )}
            <AiField suggested={aiFields.has("taxRate")}>
              <FormField label={t("expenses.form.taxRate")} helperText={rateFromCategory && taxRateSelection ? t("expenses.form.usualRate", { owner: possessive(rateFromCategory) }) : undefined}>
                {(field) => (
                  <Combobox
                    id={field.id}
                    options={taxOptions}
                    value={taxRateSelection}
                    onValueChange={(v) => {
                      markMine("taxRate");
                      setTaxRateSelection(v);
                      setRateChosen(true);
                      setRateFromCategory(null);
                    }}
                    placeholder={t("expenses.form.noTax")}
                  />
                )}
              </FormField>
            </AiField>
            <AiField suggested={aiFields.has("taxAmount")}>
              <FormField label={t("expenses.form.taxAmount")} helperText={taxNote ?? (!taxTouched && chosenRate ? t("expenses.form.workedOut", { rate: chosenRate.name }) : t("expenses.form.includedAbove"))}>
                {(field) => (
                  <MoneyInput
                    id={field.id}
                    aria-describedby={field["aria-describedby"]}
                    value={taxAmount}
                    onValueChange={(v) => {
                      markMine("taxAmount");
                      setTaxTouched(true);
                      setTaxAmount(v);
                    }}
                    currency={currency}
                  />
                )}
              </FormField>
            </AiField>
            <FormField label={t("expenses.form.paidBy")} required>
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
                <AlertDescription>{t("expenses.labour.privacyNote")}</AlertDescription>
              </Alert>
            </>
          )}

          {duplicates[0] && (
            <Alert variant="warning" data-testid="expense-duplicate-warning">
              <AlertDescription>
                <span className="font-semibold">
                  {t("expenses.form.duplicate", { amount: formatMoney(BigInt(duplicates[0].amount), duplicates[0].currency), date: calendarDate(duplicates[0].date, new Date(), orgLocaleTag()) })}
                </span>{" "}
                {t("expenses.form.duplicateDetail", { category: duplicates[0].categoryName ?? t("expenses.form.anExpense"), status: duplicates[0].status === "submitted" ? t("expenses.form.waitingForApproval") : t("expenses.form.approved") })}{" "}
                <Link href={`/expenses/${duplicates[0].id}`} target="_blank" className="font-medium text-primary hover:underline">
                  {t("expenses.form.openIt")}
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <AiField suggested={aiFields.has("description")}>
            <FormField label={t("expenses.form.description")}>
              {(field) => (
                <Input
                  {...field}
                  value={description}
                  onChange={(e) => {
                    markMine("description");
                    setDescription(e.target.value);
                  }}
                  placeholder={t("expenses.form.descriptionPlaceholder")}
                />
              )}
            </FormField>
          </AiField>

          <label className="flex w-fit cursor-pointer items-center gap-2">
            <Checkbox checked={isBillable} onCheckedChange={(v) => setIsBillable(v === true)} />
            <span className="text-[13px] text-on-surface">{t("expenses.form.billableToCustomer")}</span>
          </label>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("expenses.common.cancel")}
          </Button>
          {!expense && (
            <Button type="button" variant="secondary" onClick={() => void handleSubmit(true)} disabled={saving || uploading}>
              <Plus size={14} aria-hidden />
              {t("expenses.form.submitAndAddAnother")}
            </Button>
          )}
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving || uploading}>
            {saving ? <Spinner size="sm" /> : <Send size={14} aria-hidden />}
            {resubmitting ? t("expenses.form.resubmit") : expense ? t("expenses.common.saveChanges") : t("expenses.common.submitExpense")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
