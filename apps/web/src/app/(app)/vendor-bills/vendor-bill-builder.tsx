"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, Button, Card, Combobox, DatePicker, FormField, Input, Spinner, Textarea } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { ContactPicker } from "./contact-picker";
import { blankLine, computeLinePreview, VendorBillLineEditor, type EditableVendorBillLine } from "./vendor-bill-line-editor";
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
    }));
}

/**
 * The vendor bill builder — a full page (not a Drawer), mirroring
 * invoices/invoice-builder.tsx exactly. Used for both `/vendor-bills/new`
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
export function VendorBillBuilder({ bill }: { bill?: VendorBill }) {
  const router = useRouter();
  const [contactId, setContactId] = useState(bill?.contactId ?? "");
  const [jobId, setJobId] = useState(bill?.jobId ?? NO_JOB);
  const [billNumber, setBillNumber] = useState(bill?.billNumber ?? "");
  const [currency, setCurrency] = useState(bill?.currency ?? "USD");
  const [date, setDate] = useState<Date | undefined>(bill?.date ? new Date(bill.date) : new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(bill?.dueDate ? new Date(bill.dueDate) : undefined);
  const [notes, setNotes] = useState(bill?.notes ?? "");
  const [lines, setLines] = useState<EditableVendorBillLine[]>(bill ? toEditableLines(bill) : [blankLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);

  useEffect(() => {
    if (bill) return; // only pre-fill the org default currency for a brand-new bill
    apiClient
      .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, [bill]);

  useEffect(() => {
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
    apiClient.get<TaxGroupOption[]>("/tax-groups").then(setTaxGroups).catch(() => {});
    apiClient.get<JobOption[]>("/jobs").then(setJobs).catch(() => {});
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
        sortOrder: index,
      })),
    };
  }

  // US-OPS-33: files dropped on a new bill are uploaded now and attached once it's saved.
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);

  async function handleSaveDraft() {
    setError(null);
    if (!contactId) {
      setError("Select a vendor before saving.");
      return;
    }
    if (!billNumber.trim()) {
      setError("Enter the vendor's bill number before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = bill
        ? await apiClient.put<VendorBill>(`/vendor-bills/${bill.id}`, payload)
        : await apiClient.post<VendorBill>("/vendor-bills", payload);
      if (!bill && pendingFiles.length) await attachPending("vendor_bill", saved.id, pendingFiles);
      router.push(`/vendor-bills/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vendor bill.");
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
          <FormField label="Bill number" required helperText="The vendor's own number — not system-generated.">
            {(field) => <Input {...field} value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="e.g. INV-1042" />}
          </FormField>
          <FormField label="Job" helperText="Optional — flows into job costing once recorded.">
            {() => <Combobox options={jobOptions} value={jobId} onValueChange={setJobId} />}
          </FormField>
          <FormField label="Currency" required>
            {() => <Combobox options={currencyOptions} value={currency} onValueChange={setCurrency} />}
          </FormField>
          <FormField label="Date" required>
            {() => <DatePicker value={date} onChange={setDate} />}
          </FormField>
          <FormField label="Due date">
            {() => <DatePicker value={dueDate} onChange={setDueDate} />}
          </FormField>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-on-surface">Lines</h2>
        <VendorBillLineEditor lines={lines} onChange={setLines} currency={currency} />
      </Card>

      <Card className="flex flex-col gap-4">
        <FormField label="Notes">
          {(field) => <Textarea {...field} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes…" />}
        </FormField>
      </Card>

      <AttachmentsSection entityType="vendor_bill" entityId={bill?.id ?? null} pending={pendingFiles} onPendingChange={setPendingFiles} />

      <Card className="ml-auto flex w-full max-w-sm flex-col gap-2 sm:w-80">
        <TotalRow label="Subtotal" value={totals.subtotal} currency={currency} />
        <TotalRow label="Tax" value={totals.tax} currency={currency} />
        <div className="border-t border-border pt-2">
          <TotalRow label="Total" value={totals.total} currency={currency} emphasize />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSaveDraft} disabled={saving}>
          {saving ? <Spinner size="sm" /> : bill ? "Save draft" : "Save as draft"}
        </Button>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  currency,
  emphasize,
}: {
  label: string;
  value: bigint;
  currency: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? "text-[14px] font-semibold text-on-surface" : "text-[13px] text-on-surface-muted"}>
        {label}
      </span>
      <span className={`tabular-nums ${emphasize ? "text-[16px] font-bold text-on-surface" : "text-[14px] text-on-surface"}`}>
        {formatMoney(value, currency)}
      </span>
    </div>
  );
}
