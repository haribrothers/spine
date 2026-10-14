"use client";

import { useModule } from "../../../lib/modules-context";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, Button, Card, Combobox, DatePicker, FormField, Input, Spinner, Textarea, useConfirm } from "@spine/ui";
import type { PossibleDuplicateVendorCredit } from "@spine/shared";
import { FileCheck } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { useUnsavedGuard } from "../../../lib/use-unsaved-guard";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { useToast } from "../../../components/toast-host";
import { DocumentBuilderBar, LeaveWithoutSavingDialog } from "../../../components/document-builder-bar";
import { PlaceOfSupplyField, PlaceOfSupplyNotice, usePlaceOfSupply } from "../../../components/place-of-supply";
import { AttachmentsSection, attachPending, type PendingAttachment } from "../../../components/attachments-section";
import { calendarDate } from "../quotes/quotes-list-state";
import { ContactPicker } from "../vendor-bills/contact-picker";
import { blankLine, computeLinePreview, newKey, type EditableVendorBillLine } from "../vendor-bills/vendor-bill-line-editor";
import { VendorBillLines } from "../vendor-bills/vendor-bill-lines";
import type { JobOption, TaxGroupOption, TaxRateOption, VendorBill, VendorBillLine } from "../vendor-bills/types";
import { CREDIT_STATE_LABELS, creditRecordedToast, creditState } from "./vendor-credit-state";
import type { VendorCredit } from "./types";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];
const NO_JOB = "__none__";
const NO_BILL = "__none__";

type LineSource = Pick<VendorBillLine, "id" | "sortOrder" | "type" | "catalogItemId" | "name" | "description" | "quantity" | "unitPriceAmount" | "accountId" | "taxRatePercentage" | "taxRateId" | "taxGroupId" | "isTaxInclusive" | "supplyClass" | "hsnSac">;

function toEditable(lines: LineSource[]): EditableVendorBillLine[] {
  return lines
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => ({
      key: newKey(),
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

/** Whether any line has something typed in, so copying a bill's lines would lose it. */
const hasEntered = (lines: EditableVendorBillLine[]) => lines.some((l) => l.name.trim() || l.unitPriceAmount > 0n || l.description.trim());

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * US-PUR-24/US-PUR-39 (D-226) — `VendorCreditBuilder`, on the bill
 * builder's layout (D-225): the header fields in one card, compact item
 * rows with Account (`VendorBillLines`), notes and attachments below, and
 * the bar at the bottom with Cancel, Save draft and Save and record, which
 * asks first. "Against bill" copies that bill's lines in to edit down —
 * asking first when lines were already entered. It warns when the vendor
 * already has a credit with the same credit note number, and still saves.
 * US-PUR-40: `fromBill` opens it filled from a bill's More menu.
 */
export function VendorCreditBuilder({ credit, fromBill }: { credit?: VendorCredit; fromBill?: VendorBill }) {
  const router = useRouter();
  const jobsOn = useModule("jobsField");
  const canRecord = useCapability("vendor_credits.record");
  const showToast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { dirty, touch, interactionProps, markSaved, leaveTo, setLeaveTo, leave } = useUnsavedGuard("vendorCreditBuilderGuard");
  const [contactId, setContactId] = useState(credit?.contactId ?? fromBill?.contactId ?? "");
  const [vendorReference, setVendorReference] = useState(credit?.vendorReference ?? "");
  const [billId, setBillId] = useState(credit?.billId ?? fromBill?.id ?? NO_BILL);
  const [jobId, setJobId] = useState(credit?.jobId ?? fromBill?.jobId ?? NO_JOB);
  const [currency, setCurrency] = useState(credit?.currency ?? fromBill?.currency ?? "USD");
  const [date, setDate] = useState<Date | undefined>(credit?.date ? new Date(`${credit.date.slice(0, 10)}T00:00:00`) : new Date());
  const [notes, setNotes] = useState(credit?.notes ?? "");
  const [lines, setLines] = useState<EditableVendorBillLine[]>(credit?.lines?.length ? toEditable(credit.lines) : fromBill?.lines?.length ? toEditable(fromBill.lines) : [blankLine()]);
  // US-TAX-13 — the place of supply follows the contact and switches item lines between CGST + SGST and IGST.
  const pos = usePlaceOfSupply({ contactId, initial: credit ? credit.placeOfSupply : fromBill ? fromBill.placeOfSupply : undefined, lines, setLines, direction: "purchase" });
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [duplicates, setDuplicates] = useState<PossibleDuplicateVendorCredit[]>([]);
  // A draft "Save and record" saved before recording failed: later saves update it.
  const [savedId, setSavedId] = useState<string | null>(credit?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contactName = vendors.find((v) => v.id === contactId)?.name ?? credit?.contactName ?? fromBill?.contactName ?? null;

  useEffect(() => {
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
    apiClient.get<TaxGroupOption[]>("/tax-groups").then(setTaxGroups).catch(() => {});
    apiClient.get<JobOption[]>("/jobs?picker=1").then(setJobs).catch(() => {});
    apiClient.get<{ id: string; name: string }[]>("/contacts?picker=1&type=vendor&type=both").then(setVendors).catch(() => {});
    if (!credit && !fromBill) {
      apiClient
        .get<{ value: { code: string } | null }>("/org/settings/currency")
        .then((res) => res.value?.code && setCurrency(res.value.code))
        .catch(() => {});
    }
  }, [credit, fromBill]);

  useEffect(() => {
    if (!contactId) {
      setBills([]);
      return;
    }
    apiClient
      .get<VendorBill[]>(`/vendor-bills?picker=1&contactId=${contactId}&status=recorded`)
      .then(setBills)
      .catch(() => setBills([]));
  }, [contactId]);

  // US-PUR-39: a credit this vendor already has with this credit note number.
  useEffect(() => {
    const number = vendorReference.trim();
    if (!contactId || !number) return setDuplicates([]);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ contactId, vendorReference: number });
      if (savedId) params.set("excludeId", savedId);
      apiClient
        .get<PossibleDuplicateVendorCredit[]>(`/vendor-credits/possible-duplicates?${params}`)
        .then(setDuplicates)
        .catch(() => setDuplicates([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [contactId, vendorReference, savedId]);

  /** Copies the bill's lines in to edit down — asking first when lines were already entered. */
  async function chooseBill(id: string) {
    touch(setBillId)(id);
    if (id === NO_BILL) return;
    const bill = await apiClient.get<VendorBill>(`/vendor-bills/${id}?picker=1`);
    if (!bill.lines?.length) return;
    if (hasEntered(lines)) {
      const entered = lines.filter((l) => l.name.trim() || l.unitPriceAmount > 0n).length;
      const ok = await confirm({
        title: `Replace your lines with ${bill.billNumber}'s?`,
        description: `The ${entered === 1 ? "line" : `${entered} lines`} you've entered ${entered === 1 ? "is" : "are"} replaced by ${bill.billNumber}'s ${bill.lines.length === 1 ? "line" : `${bill.lines.length} lines`}, for you to edit down. Keep yours to leave the lines as they are.`,
        confirmLabel: "Replace lines",
        cancelLabel: "Keep my lines",
      });
      if (!ok) return;
    }
    touch(setLines)(toEditable(bill.lines));
    setCurrency(bill.currency);
    if (bill.jobId) setJobId(bill.jobId);
  }

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

  const locale = orgLocaleTag();
  const today = new Date();
  const billOptions = [{ value: NO_BILL, label: "No bill" }, ...bills.map((b) => ({ value: b.id, label: `${b.billNumber} · ${calendarDate(b.date.slice(0, 10), today, locale)}` }))];
  if (fromBill && !bills.some((b) => b.id === fromBill.id)) billOptions.push({ value: fromBill.id, label: `${fromBill.billNumber} · ${calendarDate(fromBill.date.slice(0, 10), today, locale)}` });
  const jobOptions = [{ value: NO_JOB, label: "No job" }, ...jobs.map((j) => ({ value: j.id, label: j.name }))];
  const currencyOptions = (COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES]).map((c) => ({ value: c, label: c }));

  function validate(): boolean {
    setError(null);
    if (!contactId) {
      setError("Choose the vendor.");
      return false;
    }
    if (!vendorReference.trim()) {
      setError("Enter the vendor's credit note number.");
      return false;
    }
    return true;
  }

  async function save(): Promise<VendorCredit> {
    const payload = {
      contactId,
      placeOfSupply: pos.active ? pos.placeOfSupply : undefined,
      vendorReference: vendorReference.trim(),
      billId: billId === NO_BILL ? null : billId,
      jobId: jobId === NO_JOB ? null : jobId,
      currency,
      date: iso(date ?? new Date()),
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
    const saved = savedId ? await apiClient.put<VendorCredit>(`/vendor-credits/${savedId}`, payload) : await apiClient.post<VendorCredit>("/vendor-credits", payload);
    if (!savedId && pendingFiles.length) await attachPending("vendor_credit", saved.id, pendingFiles);
    setSavedId(saved.id);
    return saved;
  }

  async function handleSaveDraft() {
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = await save();
      markSaved();
      router.push(`/vendor-credits/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this vendor credit.");
      setSaving(false);
    }
  }

  /** US-PUR-39 — asks as Record does, then saves the draft and records it; the credit's page opens with its toast. */
  async function handleSaveAndRecord() {
    if (!validate()) return;
    const ok = await confirm({
      title: "Record this vendor credit?",
      description: `${formatMoney(totals.total, currency)} from ${contactName ?? "the vendor"} is saved and posted to your books, lowering what you owe them. After that it can't be edited — only voided.`,
      confirmLabel: "Save and record",
    });
    if (!ok) return;
    setSaving(true);
    let saved: VendorCredit | null = null;
    try {
      saved = await save();
      const recorded = await apiClient.post<VendorCredit>(`/vendor-credits/${saved.id}/record`);
      showToast(...creditRecordedToast({ ...recorded, contactName: recorded.contactName ?? contactName }));
      markSaved();
      router.push(`/vendor-credits/${saved.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Try again.";
      setError(saved ? `Saved as a draft, but it couldn't be recorded: ${message}` : message);
      setSaving(false);
    }
  }

  function cancel() {
    const back = credit ? `/vendor-credits/${credit.id}` : fromBill ? `/vendor-bills/${fromBill.id}` : "/vendor-credits";
    if (dirty) setLeaveTo(back);
    else router.back();
  }

  const dup = duplicates[0];

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
        <FormField label="Vendor's credit note number" required helperText="The vendor's own number.">
          {(field) => <Input {...field} value={vendorReference} onChange={(e) => touch(setVendorReference)(e.target.value)} placeholder="e.g. CN-4471" />}
        </FormField>
        <FormField label="Against bill" helperText="Copies its lines to edit down.">
          {() => <Combobox aria-label="Against bill" options={billOptions} value={billId} onValueChange={(v) => void chooseBill(v)} disabled={!contactId} />}
        </FormField>
        <FormField label="Currency" required>
          {() => <Combobox options={currencyOptions} value={currency} onValueChange={touch(setCurrency)} aria-label="Currency" />}
        </FormField>
        {dup && (
          <Alert variant="warning" className="sm:col-span-2 xl:col-span-4" data-testid="credit-duplicate-warning">
            <AlertDescription className="flex flex-wrap items-center gap-x-1">
              <span className="font-semibold">
                {contactName ?? "This vendor"} already has credit note {dup.vendorReference}
              </span>
              — {dup.number ?? "a draft"}, {calendarDate(dup.date, today, locale)}, {formatMoney(BigInt(dup.totalAmount), dup.currency)}, {CREDIT_STATE_LABELS[dup.status === "void" ? "void" : creditState({ status: dup.status, totalAmount: dup.totalAmount, balanceAmount: dup.totalAmount })].toLowerCase()}. Check it isn&apos;t the same credit note before you save.{" "}
              <Link href={`/vendor-credits/${dup.id}`} target="_blank" className="font-medium text-primary hover:underline">
                Open {dup.number ?? dup.vendorReference}
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <FormField label="Date" required>
          {() => <DatePicker value={date} onChange={touch(setDate)} aria-label="Date" />}
        </FormField>
        {/* US-SET-24: no jobs while Jobs & field is switched off. */}
        {jobsOn && (
          <FormField label="Job" helperText="Lowers this job's cost once recorded.">
            {() => <Combobox options={jobOptions} value={jobId} onValueChange={touch(setJobId)} aria-label="Job" />}
          </FormField>
        )}
        {pos.active && <PlaceOfSupplyField value={pos.placeOfSupply} onChange={touch(pos.setPlaceOfSupply)} source={pos.source} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} />}
      </Card>

      <PlaceOfSupplyNotice notice={pos.notice} />

      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold text-on-surface">Lines</h2>
          <a href="#credit-notes" className="text-[12.5px] font-medium text-primary hover:underline">
            Notes and attachments ↓
          </a>
        </div>
        <VendorBillLines lines={lines} onChange={touch(setLines)} currency={currency} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} flaggedKeys={pos.flagged} showHsn={pos.active} />
      </Card>

      <Card id="credit-notes" className="flex flex-col gap-4">
        <FormField label="Notes" helperText="For your team; the vendor never sees them.">
          {(field) => <Textarea {...field} value={notes} onChange={(e) => touch(setNotes)(e.target.value)} placeholder="Internal notes…" />}
        </FormField>
      </Card>

      <AttachmentsSection entityType="vendor_credit" entityId={credit?.id ?? null} pending={pendingFiles} onPendingChange={touch(setPendingFiles)} />

      {/* US-PUR-39: totals and actions stay in view, as on bills. */}
      <DocumentBuilderBar totals={{ ...totals }} currency={currency} taxLabel={pos.active ? "GST" : "Tax"} dirty={dirty} testIdPrefix="credit">
        <Button type="button" variant="secondary" onClick={cancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" variant={canRecord ? "secondary" : "primary"} onClick={() => void handleSaveDraft()} disabled={saving}>
          {saving ? <Spinner size="sm" /> : credit ? "Save draft" : "Save as draft"}
        </Button>
        {canRecord && (
          <Button type="button" onClick={() => void handleSaveAndRecord()} disabled={saving}>
            <FileCheck size={14} aria-hidden />
            Save and record
          </Button>
        )}
      </DocumentBuilderBar>

      <LeaveWithoutSavingDialog open={leaveTo !== null} document="credit" onLeave={leave} onStay={() => setLeaveTo(null)} />
      {confirmDialog}
    </div>
  );
}

/** Loads a draft for editing; a recorded credit can't be edited. */
export function VendorCreditEditLoader({ creditId }: { creditId: string }) {
  const [credit, setCredit] = useState<VendorCredit | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiClient
      .get<VendorCredit>(`/vendor-credits/${creditId}`)
      .then((c) => (c.status === "draft" ? setCredit(c) : setError("A recorded vendor credit can't be edited. Void it and record a new one.")))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this vendor credit."));
  }, [creditId]);
  if (error)
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (!credit)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  return <VendorCreditBuilder credit={credit} />;
}

/** US-PUR-40 — `/vendor-credits/new?billId=<id>` opens the builder filled from that bill; without it, an empty one. */
export function VendorCreditNewLoader({ billId }: { billId?: string }) {
  const [bill, setBill] = useState<VendorBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!billId) return;
    apiClient
      .get<VendorBill>(`/vendor-bills/${billId}?picker=1`)
      .then(setBill)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't open the bill."));
  }, [billId]);
  if (!billId) return <VendorCreditBuilder />;
  if (error)
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (!bill)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  return <VendorCreditBuilder fromBill={bill} />;
}
