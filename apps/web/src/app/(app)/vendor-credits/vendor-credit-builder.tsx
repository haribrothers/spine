"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, Button, Card, Combobox, DatePicker, FormField, Input, Spinner, Textarea } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { PlaceOfSupplyField, PlaceOfSupplyNotice, usePlaceOfSupply } from "../../../components/place-of-supply";
import { formatMoney } from "../../../lib/money";
import { AttachmentsSection, attachPending, type PendingAttachment } from "../../../components/attachments-section";
import { ContactPicker } from "../vendor-bills/contact-picker";
import { blankLine, computeLinePreview, VendorBillLineEditor, type EditableVendorBillLine } from "../vendor-bills/vendor-bill-line-editor";
import type { JobOption, TaxGroupOption, TaxRateOption, VendorBill, VendorBillLine } from "../vendor-bills/types";
import type { VendorCredit } from "./types";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];
const NO_JOB = "__none__";
const NO_BILL = "__none__";

function toEditable(lines: Pick<VendorBillLine, "id" | "sortOrder" | "type" | "catalogItemId" | "name" | "description" | "quantity" | "unitPriceAmount" | "accountId" | "taxRatePercentage" | "taxRateId" | "taxGroupId" | "isTaxInclusive" | "supplyClass" | "hsnSac">[]): EditableVendorBillLine[] {
  return lines
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => ({
      key: `${line.id}-${Math.random().toString(36).slice(2)}`,
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

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * US-PUR-24 — `VendorCreditBuilder`: a vendor's credit note, with lines
 * shaped like a bill's. "Against bill" copies that bill's lines in to edit
 * down. It saves as a draft; recording happens from the credit's page.
 */
export function VendorCreditBuilder({ credit }: { credit?: VendorCredit }) {
  const router = useRouter();
  const [contactId, setContactId] = useState(credit?.contactId ?? "");
  const [vendorReference, setVendorReference] = useState(credit?.vendorReference ?? "");
  const [billId, setBillId] = useState(credit?.billId ?? NO_BILL);
  const [jobId, setJobId] = useState(credit?.jobId ?? NO_JOB);
  const [currency, setCurrency] = useState(credit?.currency ?? "USD");
  const [date, setDate] = useState<Date | undefined>(credit?.date ? new Date(`${credit.date.slice(0, 10)}T00:00:00`) : new Date());
  const [notes, setNotes] = useState(credit?.notes ?? "");
  const [lines, setLines] = useState<EditableVendorBillLine[]>(credit?.lines?.length ? toEditable(credit.lines) : [blankLine()]);
  // US-TAX-13 — the place of supply follows the contact and switches item lines between CGST + SGST and IGST.
  const pos = usePlaceOfSupply({ contactId, initial: credit ? credit.placeOfSupply : undefined, lines, setLines, direction: "purchase" });
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
    apiClient.get<TaxGroupOption[]>("/tax-groups").then(setTaxGroups).catch(() => {});
    apiClient.get<JobOption[]>("/jobs").then(setJobs).catch(() => {});
    if (!credit) {
      apiClient
        .get<{ value: { code: string } | null }>("/org/settings/currency")
        .then((res) => res.value?.code && setCurrency(res.value.code))
        .catch(() => {});
    }
  }, [credit]);

  useEffect(() => {
    if (!contactId) {
      setBills([]);
      return;
    }
    apiClient
      .get<VendorBill[]>(`/vendor-bills?contactId=${contactId}&status=recorded`)
      .then(setBills)
      .catch(() => setBills([]));
  }, [contactId]);

  async function chooseBill(id: string) {
    setBillId(id);
    if (id === NO_BILL) return;
    // Copy the bill's lines in to edit down.
    const bill = await apiClient.get<VendorBill>(`/vendor-bills/${id}`);
    if (bill.lines?.length) setLines(toEditable(bill.lines));
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

  const billOptions = [{ value: NO_BILL, label: "No bill" }, ...bills.map((b) => ({ value: b.id, label: `Bill ${b.billNumber} · ${new Date(b.date).toLocaleDateString()}` }))];
  const jobOptions = [{ value: NO_JOB, label: "No job" }, ...jobs.map((j) => ({ value: j.id, label: j.name }))];
  const currencyOptions = (COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES]).map((c) => ({ value: c, label: c }));

  async function handleSave() {
    setError(null);
    if (!contactId) {
      setError("Choose the vendor.");
      return;
    }
    if (!vendorReference.trim()) {
      setError("Enter the vendor's credit note number.");
      return;
    }
    setSaving(true);
    try {
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
      const saved = credit ? await apiClient.put<VendorCredit>(`/vendor-credits/${credit.id}`, payload) : await apiClient.post<VendorCredit>("/vendor-credits", payload);
      if (!credit && pendingFiles.length) await attachPending("vendor_credit", saved.id, pendingFiles);
      router.push(`/vendor-credits/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this vendor credit.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Vendor" required>
            {() => <ContactPicker value={contactId} onValueChange={setContactId} />}
          </FormField>
          <FormField label="Vendor's credit note number" required helperText="The vendor's own number — Spine gives it a VCR number when recorded.">
            {(field) => <Input {...field} value={vendorReference} onChange={(e) => setVendorReference(e.target.value)} placeholder="e.g. CN-4471" />}
          </FormField>
          <FormField label="Against bill" helperText="Optional — copy its lines, then edit them down.">
            {() => <Combobox aria-label="Against bill" options={billOptions} value={billId} onValueChange={(v) => void chooseBill(v)} disabled={!contactId} />}
          </FormField>
          <FormField label="Currency" required>
            {() => <Combobox options={currencyOptions} value={currency} onValueChange={setCurrency} />}
          </FormField>
          <FormField label="Date" required>
            {() => <DatePicker value={date} onChange={setDate} />}
          </FormField>
          <FormField label="Job" helperText="Lowers this job's cost once recorded.">
            {() => <Combobox options={jobOptions} value={jobId} onValueChange={setJobId} />}
          </FormField>
          {pos.active && <PlaceOfSupplyField value={pos.placeOfSupply} onChange={pos.setPlaceOfSupply} source={pos.source} supplyType={pos.supplyType} />}
        </div>
      </Card>

      <PlaceOfSupplyNotice notice={pos.notice} />

      <Card className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-on-surface">Lines</h2>
        <VendorBillLineEditor lines={lines} onChange={setLines} currency={currency} supplyType={pos.supplyType} flaggedKeys={pos.flagged} showHsn={pos.active} />
      </Card>

      <Card className="flex flex-col gap-4">
        <FormField label="Notes">
          {(field) => <Textarea {...field} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes…" />}
        </FormField>
      </Card>

      <AttachmentsSection entityType="vendor_credit" entityId={credit?.id ?? null} pending={pendingFiles} onPendingChange={setPendingFiles} />

      <Card className="ml-auto flex w-full max-w-sm flex-col gap-2 sm:w-80">
        <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
        <Row label="Tax" value={formatMoney(totals.tax, currency)} />
        <div className="border-t border-border pt-2">
          <Row label="Total credit" value={formatMoney(totals.total, currency)} emphasize />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size="sm" /> : credit ? "Save draft" : "Save as draft"}
        </Button>
      </div>
    </div>
  );
}

export function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? "text-[14px] font-semibold text-on-surface" : "text-[13px] text-on-surface-muted"}>{label}</span>
      <span className={`tabular-nums ${emphasize ? "text-[16px] font-bold text-on-surface" : "text-[14px] text-on-surface"}`}>{value}</span>
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
