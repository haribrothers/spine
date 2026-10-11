"use client";

import { useModule } from "../../../lib/modules-context";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, Button, Card, Combobox, DatePicker, FormField, Input, Spinner, Textarea, cn, useConfirm } from "@spine/ui";
import type { PossibleDuplicateVendorBill } from "@spine/shared";
import { FileCheck } from "lucide-react";
import { useCapability } from "../../../lib/capabilities-context";
import { useToast } from "../../../components/toast-host";
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

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];
const NO_JOB = "__none__";

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
    apiClient.get<JobOption[]>("/jobs").then(setJobs).catch(() => {});
    apiClient.get<{ id: string; name: string }[]>("/contacts?type=vendor&type=both").then(setVendors).catch(() => {});
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
    () => [{ value: NO_JOB, label: "No job" }, ...jobs.map((j) => ({ value: j.id, label: j.name }))],
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

  function validate(): boolean {
    setError(null);
    if (!contactId) {
      setError("Select a vendor before saving.");
      return false;
    }
    if (!billNumber.trim()) {
      setError("Enter the vendor's bill number before saving.");
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
      setError(err instanceof Error ? err.message : "Could not save vendor bill.");
      setSaving(false);
    }
  }

  /** US-PUR-35 — asks as Record does, then saves the draft and records it; the bill's page opens with its toast. */
  async function handleSaveAndRecord() {
    if (!validate()) return;
    const vendor = contactName ?? "the vendor";
    const ok = await confirm({
      title: "Record this bill?",
      description: `${vendor}'s bill ${billNumber.trim()} for ${formatMoney(totals.total, currency)} is saved and posted to your books as owed. After that it can't be edited — only voided.`,
      confirmLabel: "Save and record",
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
      const message = err instanceof Error ? err.message : "Try again.";
      setError(saved ? `Saved as a draft, but it couldn't be recorded: ${message}` : message);
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
    touch(setDueDate)(next);
  }

  const locale = orgLocaleTag();
  const today = new Date();
  const picked = pickedDueDays(date, dueDate);
  const suggesting = !dueTouched.current && suggestedDays !== null && Boolean(dueDate);

  return (
    <div className="flex flex-col gap-4" {...interactionProps}>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FormField label="Vendor" required>
          {() => <ContactPicker value={contactId} onValueChange={touch(setContactId)} />}
        </FormField>
        <FormField label="Bill number" required helperText="The vendor's own number.">
          {(field) => <Input {...field} value={billNumber} onChange={(e) => touch(setBillNumber)(e.target.value)} placeholder="e.g. INV-1042" />}
        </FormField>
        {/* US-SET-24: no jobs while Jobs & field is switched off. */}
        {jobsOn && (
          <FormField label="Job" helperText="Flows into job costing once recorded.">
            {() => <Combobox options={jobOptions} value={jobId} onValueChange={touch(setJobId)} aria-label="Job" />}
          </FormField>
        )}
        <FormField label="Currency" required>
          {() => <Combobox options={currencyOptions} value={currency} onValueChange={touch(setCurrency)} aria-label="Currency" />}
        </FormField>
        {duplicates[0] && (
          <Alert variant="warning" className="sm:col-span-2 xl:col-span-4" data-testid="bill-duplicate-warning">
            <AlertDescription className="flex flex-wrap items-center gap-x-1">
              <span className="font-semibold">
                {contactName ?? "This vendor"} already has bill {duplicates[0].billNumber}
              </span>
              — {calendarDate(duplicates[0].date, today, locale)}, {formatMoney(BigInt(duplicates[0].totalAmount), duplicates[0].currency)},{" "}
              {BILL_STATE_LABELS[duplicates[0].status === "draft" ? "draft" : billState({ status: duplicates[0].status, dueDate: null, balanceDue: duplicates[0].totalAmount, amountPaid: "0" }, today)].toLowerCase()}. Check it isn&apos;t the same bill before you save.{" "}
              <Link href={`/vendor-bills/${duplicates[0].id}`} target="_blank" className="font-medium text-primary hover:underline">
                Open {duplicates[0].billNumber}
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <FormField label="Bill date" required>
          {() => <DatePicker value={date} onChange={touch(setDate)} aria-label="Bill date" />}
        </FormField>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <FormField label="Due date" helperText={suggesting ? `Suggested: ${suggestedDays} ${suggestedDays === 1 ? "day" : "days"}, as on this vendor's last bill` : undefined}>
            {() => (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-48">
                  <DatePicker value={dueDate} onChange={pickDue} aria-label="Due date" />
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Due in">
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
                      {days === 0 ? "On receipt" : `+${days} days`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FormField>
        </div>
        {pos.active && <PlaceOfSupplyField value={pos.placeOfSupply} onChange={touch(pos.setPlaceOfSupply)} source={pos.source} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} />}
      </Card>

      <PlaceOfSupplyNotice notice={pos.notice} />

      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold text-on-surface">Lines</h2>
          <a href="#bill-notes" className="text-[12.5px] font-medium text-primary hover:underline">
            Notes and attachments ↓
          </a>
        </div>
        <VendorBillLines lines={lines} onChange={touch(setLines)} currency={currency} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} flaggedKeys={pos.flagged} showHsn={pos.active} />
      </Card>

      <Card id="bill-notes" className="flex flex-col gap-4">
        <FormField label="Notes" helperText="For your team; the vendor never sees them.">
          {(field) => <Textarea {...field} value={notes} onChange={(e) => touch(setNotes)(e.target.value)} placeholder="Internal notes…" />}
        </FormField>
      </Card>

      <AttachmentsSection entityType="vendor_bill" entityId={bill?.id ?? null} pending={pendingFiles} onPendingChange={touch(setPendingFiles)} />

      {/* US-PUR-35: totals and actions stay in view, as on invoices. */}
      <DocumentBuilderBar totals={totals} currency={currency} taxLabel={pos.active ? "GST" : "Tax"} dirty={dirty} testIdPrefix="bill">
        <Button type="button" variant="secondary" onClick={cancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" variant={canRecord ? "secondary" : "primary"} onClick={handleSaveDraft} disabled={saving}>
          {saving ? <Spinner size="sm" /> : bill ? "Save draft" : "Save as draft"}
        </Button>
        {canRecord && (
          <Button type="button" onClick={() => void handleSaveAndRecord()} disabled={saving}>
            <FileCheck size={14} aria-hidden />
            Save and record
          </Button>
        )}
      </DocumentBuilderBar>

      <LeaveWithoutSavingDialog open={leaveTo !== null} document="bill" onLeave={leave} onStay={() => setLeaveTo(null)} />
      {confirmDialog}
    </div>
  );
}
