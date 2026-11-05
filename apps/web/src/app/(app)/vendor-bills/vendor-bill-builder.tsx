"use client";

import { useModule } from "../../../lib/modules-context";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, Button, Card, Combobox, DatePicker, FormField, Input, Spinner, Textarea, cn, useConfirm } from "@spine/ui";
import { FILE_TOO_LARGE, MAX_ATTACHMENT_BYTES, type DocumentSuggestion, type PossibleDuplicateVendorBill } from "@spine/shared";
import { FileCheck, Plus } from "lucide-react";
import { useCapability } from "../../../lib/capabilities-context";
import { useToast } from "../../../components/toast-host";
import { t as translate, useT } from "../../../lib/i18n";
import { useUnsavedGuard } from "../../../lib/use-unsaved-guard";
import { DocumentBuilderBar, LeaveWithoutSavingDialog } from "../../../components/document-builder-bar";
import { DUE_PICKS, daysAfter, pickedDueDays } from "../invoices/due-terms";
import { orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";
import { BILL_STATE_LABELS, billRecordedToast, billState, suggestedDueDays } from "./vendor-bill-state";
import { newKey } from "./vendor-bill-line-editor";
import { apiClient } from "../../../lib/api-client";
import { PlaceOfSupplyField, PlaceOfSupplyNotice, usePlaceOfSupply } from "../../../components/place-of-supply";
import { ContactPicker } from "./contact-picker";
import { blankLine, computeLinePreview, type EditableVendorBillLine } from "./vendor-bill-line-editor";
import { VendorBillLines } from "./vendor-bill-lines";
import type { JobOption, TaxGroupOption, TaxRateOption, VendorBill } from "./types";
import { formatMoney } from "../../../lib/money";
import { AttachmentsSection, attachPending, type PendingAttachment } from "../../../components/attachments-section";
import { AiField } from "../../../components/ai-suggested-tag";
import { useAiRequest } from "../../../lib/use-ai-request";
import { aiFeatureShown, useAiStatus } from "../../../lib/use-ai-status";
import { BillAiReader, type BillReadState } from "./bill-ai-reader";
import { isBlankLine, planBillFill, type BillField, type BillHeader } from "./bill-ai-fill";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];
const NO_JOB = "__none__";
const NO_DUE_DATE = translate("vendorBills.builder.noDueDate");

interface CurrencyLocaleValue {
  code: string;
  locale: string;
}

function toEditableLines(bill: VendorBill): EditableVendorBillLine[] {
  if (!bill.lines?.length) return [];
  return bill.lines
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => ({
      key: line.id,
      type: line.type,
      catalogItemId: line.catalogItemId,
      name: line.name,
      description: line.description ?? "",
      quantity: line.quantity,
      unitPriceAmount: BigInt(line.unitPriceAmount),
      accountId: line.accountId,
      taxRatePercentage: line.taxRatePercentage,
      taxRateId: line.taxRateId,
      taxGroupId: line.taxGroupId,
      isTaxInclusive: line.isTaxInclusive,
      supplyClass: line.supplyClass,
      hsnSac: line.hsnSac ?? "",
    }));
}

/**
 * The vendor bill builder — a full page (not a Drawer). US-PUR-35 (D-225):
 * the invoice and quote builders' layout — the header fields in one card,
 * compact item rows with an Account column (vendor-bill-lines.tsx), notes
 * and attachments below, and the bar at the bottom with the totals,
 * Cancel, Save draft and Save and record, guarded against leaving unsaved
 * changes. Used for both `/vendor-bills/new`
 * (no `bill` prop) and `/vendor-bills/:id/edit` (a draft only — see
 * VendorBillsService.update's own guard; a recorded bill is immutable).
 *
 * Unlike InvoiceBuilder, `billNumber` is a required free-text field (the
 * vendor's own number, never system-allocated — see vendorBills' own
 * schema doc comment) and there's an optional job picker (S-07.5, flows
 * straight into journal_lines.jobId on record() so job costing picks it
 * up automatically).
 *
 * Totals shown here are computed client-side via the SAME shared tax
 * engine the server uses, purely for instant feedback — every save
 * re-fetches the server-computed bill afterward, since the server is the
 * sole source of truth for stored totals per CLAUDE.md.
 */
export function VendorBillBuilder({ bill, source }: { bill?: VendorBill; source?: VendorBill }) {
  const t = useT();
  const router = useRouter();
  const jobsOn = useModule("jobsField");
  const canRecord = useCapability("vendor_bills.record");
  const showToast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { dirty, touch, interactionProps, markSaved, leaveTo, setLeaveTo, leave } = useUnsavedGuard("vendorBillBuilderGuard");
  // US-PUR-35: Duplicate copies vendor, job, currency, place of supply and lines; the date is today and the number is the vendor's, so it's empty.
  const from = bill ?? source;
  const [contactId, setContactId] = useState(from?.contactId ?? "");
  const [jobId, setJobId] = useState(from?.jobId ?? NO_JOB);
  const [billNumber, setBillNumber] = useState(bill?.billNumber ?? "");
  const [currency, setCurrency] = useState(from?.currency ?? "USD");
  const [date, setDate] = useState<Date | undefined>(bill?.date ? new Date(bill.date) : new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(bill?.dueDate ? new Date(bill.dueDate) : undefined);
  const [notes, setNotes] = useState(from?.notes ?? "");
  const [lines, setLines] = useState<EditableVendorBillLine[]>(bill ? toEditableLines(bill) : source ? toEditableLines(source).map((l) => ({ ...l, key: newKey() })) : [blankLine()]);
  // US-TAX-13 — the place of supply follows the contact and switches item lines between CGST + SGST and IGST.
  const pos = usePlaceOfSupply({ contactId, initial: from ? from.placeOfSupply : undefined, lines, setLines, direction: "purchase" });
  // US-PUR-35 — a bill this vendor already has with this number; the due date suggested from their last bill.
  const [duplicates, setDuplicates] = useState<PossibleDuplicateVendorBill[]>([]);
  const [suggestedDays, setSuggestedDays] = useState<number | null>(null);
  const dueTouched = useRef(Boolean(bill?.dueDate));
  // A draft "Save and record" saved before recording failed: later saves update it.
  const [savedId, setSavedId] = useState<string | null>(bill?.id ?? null);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const contactName = vendors.find((v) => v.id === contactId)?.name ?? from?.contactName ?? null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);

  // US-AI-08 — "Read from document": AI fills what the person hasn't entered, each field marked until they change it.
  const aiStatus = useAiStatus();
  const canAddVendor = useCapability("contacts.edit_own");
  const canEditBills = useCapability("vendor_bills.edit_own");
  const aiShown = aiFeatureShown(aiStatus, "readDocuments") && canEditBills;
  const ai = useAiRequest<DocumentSuggestion>();
  const [reading, setReading] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<{ fileName: string; readMs: number; asImage: boolean } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const readName = useRef<string | null>(null);
  const readToken = useRef(0);
  const [aiFields, setAiFields] = useState<Set<BillField>>(new Set());
  const [aiLineKeys, setAiLineKeys] = useState<Set<string>>(new Set());
  const [aiAssisted, setAiAssisted] = useState(false);
  const [newVendor, setNewVendor] = useState<string | null>(null);
  const [documentTotal, setDocumentTotal] = useState<bigint | null>(null);
  const [dueNote, setDueNote] = useState<string | null>(null);
  const [linesNote, setLinesNote] = useState<string | null>(null);
  const [replaceOffer, setReplaceOffer] = useState<{ header: Partial<BillHeader>; lines: EditableVendorBillLine[] | null; count: number } | null>(null);
  const [vendorsVersion, setVendorsVersion] = useState(0);
  const [attachmentsVersion, setAttachmentsVersion] = useState(0);
  // What the person has entered themselves — a saved draft's values count; today's date and the default currency don't.
  const entered = useRef<Set<BillField>>(
    new Set(
      bill
        ? ([["vendor", bill.contactId], ["billNumber", bill.billNumber], ["currency", bill.currency], ["date", bill.date], ["dueDate", bill.dueDate], ["placeOfSupply", bill.placeOfSupply]] as const).filter(([, v]) => Boolean(v)).map(([k]) => k)
        : source
          ? (["vendor", "currency"] as const)
          : [],
    ),
  );
  /** A header field the person sets: it's theirs now, so its AI mark goes. */
  const mine =
    <V,>(field: BillField, set: (value: V) => void) =>
    (value: V) => {
      entered.current.add(field);
      setAiFields((prev) => (prev.has(field) ? new Set([...prev].filter((f) => f !== field)) : prev));
      if (field === "vendor") setNewVendor(null);
      if (field === "dueDate") setDueNote(null);
      touch(set)(value);
    };

  useEffect(() => {
    if (from) return; // only pre-fill the org default currency for a brand-new bill, not a copy
    apiClient
      .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, [from]);

  useEffect(() => {
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
    apiClient.get<TaxGroupOption[]>("/tax-groups").then(setTaxGroups).catch(() => {});
    apiClient.get<JobOption[]>("/jobs?picker=1").then(setJobs).catch(() => {});
    apiClient.get<{ id: string; name: string }[]>("/contacts?picker=1&type=vendor&type=both").then(setVendors).catch(() => {});
  }, []);

  const totals = useMemo(() => {
    let subtotal = 0n;
    let tax = 0n;
    let total = 0n;
    for (const line of lines) {
      const preview = computeLinePreview(line, currency, taxRates, taxGroups);
      subtotal += preview.subtotal;
      tax += preview.tax;
      total += preview.total;
    }
    return { subtotal, tax, total };
  }, [lines, currency, taxRates, taxGroups]);

  const currencyOptions = useMemo(() => {
    const codes = COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES];
    return codes.map((code) => ({ value: code, label: code }));
  }, [currency]);

  const jobOptions = useMemo(
    () => [{ value: NO_JOB, label: t("vendorBills.builder.noJob") }, ...jobs.map((j) => ({ value: j.id, label: j.name }))],
    [jobs],
  );

  function buildPayload() {
    return {
      contactId,
      placeOfSupply: pos.active ? pos.placeOfSupply : undefined,
      jobId: jobId === NO_JOB ? null : jobId,
      billNumber,
      currency,
      date: date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
      notes: notes || null,
      // US-AI-06 — the bill says it was filled in with AI.
      aiAssisted: aiAssisted || undefined,
      lines: lines.map((line, index) => ({
        type: line.type,
        catalogItemId: line.catalogItemId,
        name: line.name,
        description: line.description || null,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount.toString(),
        unitPriceCurrency: currency,
        accountId: line.accountId,
        taxRatePercentage: line.taxRatePercentage,
        taxRateId: line.taxRateId,
        taxGroupId: line.taxGroupId,
        isTaxInclusive: line.isTaxInclusive,
        supplyClass: line.supplyClass,
        hsnSac: line.hsnSac || null,
        sortOrder: index,
      })),
    };
  }

  // US-OPS-33: files dropped on a new bill are uploaded now and attached once it's saved.
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);

  useEffect(() => {
    const number = billNumber.trim();
    if (!contactId || !number) return setDuplicates([]);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ contactId, billNumber: number });
      if (savedId) params.set("excludeId", savedId);
      apiClient
        .get<PossibleDuplicateVendorBill[]>(`/vendor-bills/possible-duplicates?${params}`)
        .then(setDuplicates)
        .catch(() => setDuplicates([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [contactId, billNumber, savedId]);

  useEffect(() => {
    if (bill || !contactId) return setSuggestedDays(null);
    apiClient
      .get<VendorBill[]>(`/vendor-bills?contactId=${contactId}`)
      .then((rows) => setSuggestedDays(suggestedDueDays(rows)))
      .catch(() => setSuggestedDays(null));
  }, [bill, contactId]);

  // The suggestion follows the bill date until the due date is chosen by hand.
  useEffect(() => {
    if (dueTouched.current || suggestedDays === null || !date) return;
    setDueDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + suggestedDays));
  }, [suggestedDays, date]);

  // The form as it is now — an answer arriving later fills only what's still empty then (US-AI-07).
  const latest = useRef({ contactId, billNumber, currency, date, dueDate, placeOfSupply: pos.placeOfSupply, lines });
  latest.current = { contactId, billNumber, currency, date, dueDate, placeOfSupply: pos.placeOfSupply, lines };

  /** US-AI-08 — puts what AI read into the fields still empty, marks them, and offers the rest. */
  function applySuggestion(suggestion: DocumentSuggestion) {
    const plan = planBillFill(latest.current, entered.current, suggestion);
    putHeader(plan.header);
    if (plan.lines) {
      setLines(plan.lines);
      setAiLineKeys(new Set(plan.lines.map((l) => l.key)));
      const fromLastBill = suggestion.lines.some((l) => l.accountFrom === "last_bill");
      setLinesNote(fromLastBill ? t("vendorBills.builder.accountsFromLastBill") : t("vendorBills.builder.ratesMatched"));
    }
    setAiFields((prev) => new Set([...prev, ...plan.filled]));
    setNewVendor(plan.newVendor);
    setDocumentTotal(suggestion.documentTotal ? BigInt(suggestion.documentTotal) : null);
    if (plan.header.dueDate && suggestion.dueNote) setDueNote(t("vendorBills.builder.fromDocument", { note: suggestion.dueNote }));
    else if (!suggestion.dueDate && !entered.current.has("dueDate")) setDueNote(NO_DUE_DATE);
    setReplaceOffer(plan.replaceCount ? { header: plan.kept, lines: plan.keptLines, count: plan.replaceCount } : null);
    touch(setAiAssisted)(true);
  }

  function putHeader(header: Partial<BillHeader>) {
    if (header.contactId !== undefined) setContactId(header.contactId);
    if (header.billNumber !== undefined) setBillNumber(header.billNumber);
    if (header.currency !== undefined) setCurrency(header.currency);
    if (header.date !== undefined) setDate(header.date);
    if (header.dueDate !== undefined) {
      dueTouched.current = true;
      setDueDate(header.dueDate);
    }
    // The lines already carry the tax for this place of supply (the API matched them).
    if (header.placeOfSupply !== undefined && pos.active) pos.adopt(header.placeOfSupply, header.contactId ?? null);
  }

  /** "Replace my entries (<n>)": AI's values for the fields the person had filled, and its lines for theirs. */
  function replaceMine() {
    if (!replaceOffer) return;
    putHeader(replaceOffer.header);
    const fields = (Object.keys(replaceOffer.header) as (keyof BillHeader)[]).map((k) => (k === "contactId" ? "vendor" : k) as BillField);
    for (const f of fields) entered.current.delete(f);
    setAiFields((prev) => new Set([...prev, ...fields]));
    if (replaceOffer.lines) {
      setLines(replaceOffer.lines);
      setAiLineKeys(new Set(replaceOffer.lines.map((l) => l.key)));
    }
    setReplaceOffer(null);
    touch(setAiAssisted)(true);
  }

  /** Reads a file already uploaded: one just chosen, or one in Attachments. */
  function readStored(fileId: string, fileName: string) {
    readName.current = fileName;
    setReadError(null);
    void ai.run(
      (signal) => apiClient.post<DocumentSuggestion>("/ai/read-document", { fileId, target: "vendor_bill" }, { signal }),
      (suggestion) => {
        setLastRead({ fileName, readMs: suggestion.readMs, asImage: suggestion.readAsImages });
        applySuggestion(suggestion);
      },
    );
  }

  /** "Read from document": the file is attached (or held until the bill is saved), then read. */
  async function readFile(file: File) {
    setReadError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) return setReadError(FILE_TOO_LARGE);
    const token = ++readToken.current;
    setReading(file.name);
    try {
      const stored = await apiClient.upload<{ id: string; originalFilename: string; sizeBytes: number; mimeType: string }>("/files", file);
      if (bill) {
        await apiClient.post("/attachments", { entityType: "vendor_bill", entityId: bill.id, fileId: stored.id });
        setAttachmentsVersion((v) => v + 1);
      } else {
        touch(setPendingFiles)((files: PendingAttachment[]) => [...files, { fileId: stored.id, name: stored.originalFilename, size: Number(stored.sizeBytes), contentType: stored.mimeType }]);
      }
      if (token === readToken.current) readStored(stored.id, stored.originalFilename);
    } catch (err) {
      if (token === readToken.current) setReadError(err instanceof Error ? err.message : t("vendorBills.builder.addFileFailed"));
    } finally {
      if (token === readToken.current) setReading(null);
    }
  }

  function cancelRead() {
    readToken.current += 1;
    setReading(null);
    ai.cancel();
  }

  /** "+ New vendor: <name>" — added only when the person confirms (US-AI-08). */
  async function addNewVendor() {
    if (!newVendor) return;
    const name = newVendor;
    const ok = await confirm({ title: t("vendorBills.builder.addVendorTitle", { name }), description: t("vendorBills.builder.addVendorDescription", { name }), confirmLabel: t("vendorBills.builder.addVendor") });
    if (!ok) return;
    try {
      const created = await apiClient.post<{ id: string }>("/contacts", { type: "vendor", name });
      showToast(t("vendorBills.builder.vendorAdded"), t("vendorBills.builder.vendorAddedDescription", { name }));
      setVendorsVersion((v) => v + 1);
      mine("vendor", setContactId)(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vendorBills.builder.addVendorFailed"));
    }
  }

  /** A line the person changes is theirs now: its AI mark goes. */
  function changeLines(next: EditableVendorBillLine[]) {
    if (aiLineKeys.size) {
      const before = new Map(lines.map((l) => [l.key, l]));
      setAiLineKeys(new Set([...aiLineKeys].filter((key) => next.some((l) => l.key === key && l === before.get(key)))));
    }
    touch(setLines)(next);
  }

  function validate(): boolean {
    setError(null);
    if (!contactId) {
      setError(t("vendorBills.builder.selectVendor"));
      return false;
    }
    if (!billNumber.trim()) {
      setError(t("vendorBills.builder.enterBillNumber"));
      return false;
    }
    return true;
  }

  async function save(): Promise<VendorBill> {
    const payload = buildPayload();
    const saved = savedId ? await apiClient.put<VendorBill>(`/vendor-bills/${savedId}`, payload) : await apiClient.post<VendorBill>("/vendor-bills", payload);
    if (!savedId && pendingFiles.length) await attachPending("vendor_bill", saved.id, pendingFiles);
    setSavedId(saved.id);
    return saved;
  }

  async function handleSaveDraft() {
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = await save();
      markSaved();
      router.push(`/vendor-bills/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vendorBills.builder.saveFailed"));
      setSaving(false);
    }
  }

  /** US-PUR-35 — asks as Record does, then saves the draft and records it; the bill's page opens with its toast. */
  async function handleSaveAndRecord() {
    if (!validate()) return;
    const vendor = contactName ?? t("vendorBills.builder.theVendor");
    const ok = await confirm({
      title: t("vendorBills.builder.saveRecordTitle"),
      description: t("vendorBills.builder.saveRecordDescription", { vendor, number: billNumber.trim(), amount: formatMoney(totals.total, currency) }),
      confirmLabel: t("vendorBills.builder.saveAndRecord"),
    });
    if (!ok) return;
    setSaving(true);
    let saved: VendorBill | null = null;
    try {
      saved = await save();
      const recorded = await apiClient.post<VendorBill>(`/vendor-bills/${saved.id}/record`);
      showToast(...billRecordedToast({ ...recorded, contactName: recorded.contactName ?? contactName }));
      markSaved();
      router.push(`/vendor-bills/${saved.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("vendorBills.builder.tryAgain");
      setError(saved ? t("vendorBills.builder.savedNotRecorded", { message }) : message);
      setSaving(false);
    }
  }

  function cancel() {
    const back = bill ? `/vendor-bills/${bill.id}` : "/vendor-bills";
    if (dirty) setLeaveTo(back);
    else router.back();
  }

  function pickDue(next: Date | undefined) {
    dueTouched.current = true;
    mine("dueDate", setDueDate)(next);
  }

  const locale = orgLocaleTag();
  const today = new Date();
  const picked = pickedDueDays(date, dueDate);
  const suggesting = !dueTouched.current && suggestedDays !== null && Boolean(dueDate);
  const dueHelper = suggesting ? t("vendorBills.builder.suggestedDue", { count: suggestedDays ?? 0 }) : (dueNote ?? undefined);
  const readView: BillReadState = readError
    ? { status: "failed", fileName: null, message: readError, canRetry: false }
    : ai.state.status === "failed"
      ? { status: "failed", fileName: readName.current, message: ai.state.message, canRetry: ai.state.canRetry }
      : reading || ai.working
        ? { status: "working", fileName: reading ?? readName.current ?? t("vendorBills.builder.theDocument") }
        : lastRead
          ? { status: "done", ...lastRead }
          : { status: "idle" };
  const vendorHelper = aiFields.has("vendor") && contactId ? t("vendorBills.builder.matchedVendor") : undefined;
  const totalDiffers = documentTotal !== null && lines.some((l) => !isBlankLine(l)) && documentTotal !== totals.total;

  return (
    <div className="flex flex-col gap-4" {...interactionProps}>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {aiShown && <BillAiReader state={readView} pausedUntil={aiStatus?.pausedUntil ?? null} attachedNote={t("vendorBills.builder.attachedToBill")} onChoose={(file) => void readFile(file)} onCancel={cancelRead} onRetry={ai.retry} />}
        {replaceOffer && (
          <Alert variant="info" className="sm:col-span-2 xl:col-span-4" data-testid="ai-replace-offer">
            <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex-1">{t("vendorBills.builder.replaceOffer")}</span>
              <Button type="button" variant="secondary" size="sm" onClick={replaceMine}>
                {t("vendorBills.builder.replaceMine", { count: replaceOffer.count })}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <AiField suggested={aiFields.has("vendor")}>
          <FormField label={t("vendorBills.builder.vendor")} required helperText={vendorHelper}>
            {(field) => <ContactPicker id={field.id} value={contactId} onValueChange={mine("vendor", setContactId)} refreshKey={vendorsVersion} />}
          </FormField>
          {newVendor && (
            <p className="mt-1.5 text-[12.5px] text-on-surface-muted" data-testid="ai-new-vendor">
              {canAddVendor ? (
                <button type="button" onClick={() => void addNewVendor()} className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Plus size={12} aria-hidden />
                  {t("vendorBills.builder.newVendor", { name: newVendor })}
                </button>
              ) : (
                <span className="font-medium text-on-surface">{t("vendorBills.builder.notYourVendor", { name: newVendor })}</span>
              )}{" "}
              {t("vendorBills.builder.addedOnlyIfChosen")}
            </p>
          )}
        </AiField>
        <AiField suggested={aiFields.has("billNumber")}>
          <FormField label={t("vendorBills.builder.billNumber")} required helperText={t("vendorBills.builder.billNumberHelper")}>
            {(field) => <Input {...field} value={billNumber} onChange={(e) => mine("billNumber", setBillNumber)(e.target.value)} placeholder={t("vendorBills.builder.billNumberPlaceholder")} />}
          </FormField>
        </AiField>
        {/* US-SET-24: no jobs while Jobs & field is switched off. */}
        {jobsOn && (
          <FormField label={t("vendorBills.builder.job")} helperText={t("vendorBills.builder.jobHelper")}>
            {(field) => <Combobox id={field.id} options={jobOptions} value={jobId} onValueChange={touch(setJobId)} aria-label={t("vendorBills.builder.job")} />}
          </FormField>
        )}
        <AiField suggested={aiFields.has("currency")}>
          <FormField label={t("vendorBills.builder.currency")} required>
            {(field) => <Combobox id={field.id} options={currencyOptions} value={currency} onValueChange={mine("currency", setCurrency)} aria-label={t("vendorBills.builder.currency")} />}
          </FormField>
        </AiField>
        {totalDiffers && (
          <Alert variant="warning" className="sm:col-span-2 xl:col-span-4" data-testid="bill-total-differs">
            <AlertDescription>
              <span className="font-semibold">
                {t("vendorBills.builder.totalDiffers", { documentTotal: formatMoney(documentTotal, currency), linesTotal: formatMoney(totals.total, currency) })}
              </span>{" "}
              {t("vendorBills.builder.checkLines")}
            </AlertDescription>
          </Alert>
        )}
        {duplicates[0] && (
          <Alert variant="warning" className="sm:col-span-2 xl:col-span-4" data-testid="bill-duplicate-warning">
            <AlertDescription className="flex flex-wrap items-center gap-x-1">
              <span className="font-semibold">
                {t("vendorBills.builder.duplicateLead", { vendor: contactName ?? t("vendorBills.builder.thisVendor"), number: duplicates[0].billNumber })}
              </span>
              {t("vendorBills.builder.duplicateBody", {
                date: calendarDate(duplicates[0].date, today, locale),
                amount: formatMoney(BigInt(duplicates[0].totalAmount), duplicates[0].currency),
                state: BILL_STATE_LABELS[duplicates[0].status === "draft" ? "draft" : billState({ status: duplicates[0].status, dueDate: null, balanceDue: duplicates[0].totalAmount, amountPaid: "0" }, today)].toLowerCase(),
              })}{" "}
              <Link href={`/vendor-bills/${duplicates[0].id}`} target="_blank" className="font-medium text-primary hover:underline">
                {t("vendorBills.builder.openBill", { number: duplicates[0].billNumber })}
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <AiField suggested={aiFields.has("date")}>
          <FormField label={t("vendorBills.builder.billDate")} required>
            {() => <DatePicker value={date} onChange={mine("date", setDate)} aria-label={t("vendorBills.builder.billDate")} />}
          </FormField>
        </AiField>
        {/* The tag ends where the date input (w-48) does, as on the canvas. */}
        <AiField suggested={aiFields.has("dueDate")} className="flex flex-col gap-1.5 sm:col-span-2" tagClassName="left-48 right-auto -translate-x-full">
          <FormField label={t("vendorBills.builder.dueDate")} helperText={dueHelper}>
            {() => (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-48">
                  <DatePicker value={dueDate} onChange={pickDue} aria-label={t("vendorBills.builder.dueDate")} />
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("vendorBills.builder.dueIn")}>
                  {DUE_PICKS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={picked === days}
                      onClick={() => pickDue(daysAfter(date, days))}
                      className={cn(
                        "h-7 rounded-md border px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        picked === days ? "border-primary bg-info-bg text-primary" : "border-border bg-surface-sunken text-on-surface hover:border-border-strong",
                      )}
                    >
                      {days === 0 ? t("vendorBills.builder.onReceipt") : t("vendorBills.builder.plusDays", { days })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FormField>
        </AiField>
        {pos.active && (
          <AiField suggested={aiFields.has("placeOfSupply")}>
            <PlaceOfSupplyField value={pos.placeOfSupply} onChange={mine("placeOfSupply", pos.setPlaceOfSupply)} source={pos.source} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} />
          </AiField>
        )}
      </Card>

      <PlaceOfSupplyNotice notice={pos.notice} />

      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold text-on-surface">{t("vendorBills.builder.lines")}</h2>
          <a href="#bill-notes" className="text-[12.5px] font-medium text-primary hover:underline">
            {t("vendorBills.builder.notesAndAttachments")}
          </a>
        </div>
        <VendorBillLines
          lines={lines}
          onChange={changeLines}
          currency={currency}
          supplyType={pos.supplyType}
          exportUnderLut={pos.exportUnderLut}
          flaggedKeys={pos.flagged}
          showHsn={pos.active}
          aiKeys={aiLineKeys}
          footerNote={aiLineKeys.size ? (linesNote ?? undefined) : undefined}
        />
      </Card>

      <Card id="bill-notes" className="flex flex-col gap-4">
        <FormField label={t("vendorBills.builder.notes")} helperText={t("vendorBills.builder.notesHelper")}>
          {(field) => <Textarea {...field} value={notes} onChange={(e) => touch(setNotes)(e.target.value)} placeholder={t("vendorBills.builder.notesPlaceholder")} />}
        </FormField>
      </Card>

      <AttachmentsSection
        key={attachmentsVersion}
        entityType="vendor_bill"
        entityId={bill?.id ?? null}
        pending={pendingFiles}
        onPendingChange={touch(setPendingFiles)}
        onRead={aiShown && !aiStatus?.pausedUntil ? (file) => readStored(file.fileId, file.name) : undefined}
        readBusy={ai.working || reading !== null}
      />

      {/* US-PUR-35: totals and actions stay in view, as on invoices. */}
      <DocumentBuilderBar totals={totals} currency={currency} taxLabel={pos.active ? "GST" : t("vendorBills.builder.tax")} dirty={dirty} testIdPrefix="bill">
        <Button type="button" variant="secondary" onClick={cancel} disabled={saving}>
          {t("vendorBills.builder.cancel")}
        </Button>
        <Button type="button" variant={canRecord ? "secondary" : "primary"} onClick={handleSaveDraft} disabled={saving}>
          {saving ? <Spinner size="sm" /> : bill ? t("vendorBills.builder.saveDraft") : t("vendorBills.builder.saveAsDraft")}
        </Button>
        {canRecord && (
          <Button type="button" onClick={() => void handleSaveAndRecord()} disabled={saving}>
            <FileCheck size={14} aria-hidden />
            {t("vendorBills.builder.saveAndRecord")}
          </Button>
        )}
      </DocumentBuilderBar>

      <LeaveWithoutSavingDialog open={leaveTo !== null} document="bill" onLeave={leave} onStay={() => setLeaveTo(null)} />
      {confirmDialog}
    </div>
  );
}
