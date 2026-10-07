"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  Combobox,
  DatePicker,
  FormField,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { PlaceOfSupplyField, PlaceOfSupplyNotice, usePlaceOfSupply } from "../../../components/place-of-supply";
import { ContactPicker } from "./contact-picker";
import { blankLine, computeLinePreview, InvoiceLineEditor, type EditableInvoiceLine } from "./invoice-line-editor";
import type { Invoice, InvoiceType, TaxGroupOption, TaxRateOption } from "./types";
import { formatMoney } from "../../../lib/money";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];

interface CurrencyLocaleValue {
  code: string;
  locale: string;
}

function toEditableLines(invoice: Invoice): EditableInvoiceLine[] {
  if (!invoice.lines?.length) return [];
  return invoice.lines
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
      discountPercentage: line.discountPercentage,
      taxRatePercentage: line.taxRatePercentage,
      taxRateId: line.taxRateId,
      taxGroupId: line.taxGroupId,
      isTaxInclusive: line.isTaxInclusive,
      supplyClass: line.supplyClass,
    }));
}

/**
 * The invoice builder — a full page (not a Drawer), mirroring
 * quotes/quote-builder.tsx exactly: a multi-line editable table with add/
 * remove/reorder, a contact picker, and live totals need real width and
 * vertical space. Used for both `/invoices/new` (no `invoice` prop) and
 * `/invoices/:id/edit` (a draft only — see InvoicesService.update's own
 * guard; an issued invoice is immutable and has no edit route at all).
 *
 * There's no "valid until" concept here (that's quotes-only) — `dueDate`
 * drives S-05.9's overdue flag, and `issueDate` is optional (defaults to
 * the moment of issue if left blank, per InvoicesService.issue's own
 * fallback).
 *
 * Totals shown here are computed client-side via the SAME shared tax
 * engine the server uses, purely for instant feedback — every save
 * re-fetches the server-computed invoice afterward, since the server is
 * the sole source of truth for stored totals per CLAUDE.md.
 */
export function InvoiceBuilder({ invoice }: { invoice?: Invoice }) {
  const router = useRouter();
  const [contactId, setContactId] = useState(invoice?.contactId ?? "");
  const [type, setType] = useState<InvoiceType>(invoice?.type ?? "standard");
  const [currency, setCurrency] = useState(invoice?.currency ?? "USD");
  const [issueDate, setIssueDate] = useState<Date | undefined>(invoice?.issueDate ? new Date(invoice.issueDate) : undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(invoice?.dueDate ? new Date(invoice.dueDate) : undefined);
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [terms, setTerms] = useState(invoice?.termsAndConditions ?? "");
  const [lines, setLines] = useState<EditableInvoiceLine[]>(invoice ? toEditableLines(invoice) : [blankLine()]);
  // US-TAX-13 — the place of supply follows the contact and switches item lines between CGST + SGST and IGST.
  const pos = usePlaceOfSupply({ contactId, initial: invoice ? invoice.placeOfSupply : undefined, lines, setLines });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);

  useEffect(() => {
    if (invoice) return; // only pre-fill the org default currency for a brand-new invoice
    apiClient
      .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, [invoice]);

  useEffect(() => {
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setTaxRates).catch(() => {});
    apiClient.get<TaxGroupOption[]>("/tax-groups").then(setTaxGroups).catch(() => {});
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

  function buildPayload() {
    return {
      contactId,
      placeOfSupply: pos.active ? pos.placeOfSupply : undefined,
      type,
      currency,
      issueDate: issueDate ? issueDate.toISOString().slice(0, 10) : null,
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
      notes: notes || null,
      termsAndConditions: terms || null,
      lines: lines.map((line, index) => ({
        type: line.type,
        catalogItemId: line.catalogItemId,
        name: line.name,
        description: line.description || null,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount.toString(),
        unitPriceCurrency: currency,
        discountPercentage: line.discountPercentage,
        taxRatePercentage: line.taxRatePercentage,
        taxRateId: line.taxRateId,
        taxGroupId: line.taxGroupId,
        isTaxInclusive: line.isTaxInclusive,
        supplyClass: line.supplyClass,
        sortOrder: index,
      })),
    };
  }

  async function handleSaveDraft() {
    setError(null);
    if (!contactId) {
      setError("Select a contact before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = invoice
        ? await apiClient.put<Invoice>(`/invoices/${invoice.id}`, payload)
        : await apiClient.post<Invoice>("/invoices", payload);
      router.push(`/invoices/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save invoice.");
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
          <FormField label="Contact" required>
            {() => <ContactPicker value={contactId} onValueChange={setContactId} />}
          </FormField>
          <FormField label="Currency" required>
            {() => <Combobox options={currencyOptions} value={currency} onValueChange={setCurrency} />}
          </FormField>
          <FormField label="Type">
            {() => (
              <Select value={type} onValueChange={(v) => setType(v as InvoiceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Issue date" helperText="Defaults to today if left blank when issued.">
            {() => <DatePicker value={issueDate} onChange={setIssueDate} />}
          </FormField>
          <FormField label="Due date" helperText="Drives the overdue flag once issued.">
            {() => <DatePicker value={dueDate} onChange={setDueDate} />}
          </FormField>
          {pos.active && <PlaceOfSupplyField value={pos.placeOfSupply} onChange={pos.setPlaceOfSupply} source={pos.source} supplyType={pos.supplyType} />}
        </div>
      </Card>

      <PlaceOfSupplyNotice notice={pos.notice} />

      <Card className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-on-surface">Lines</h2>
        <InvoiceLineEditor lines={lines} onChange={setLines} currency={currency} supplyType={pos.supplyType} flaggedKeys={pos.flagged} />
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Notes" helperText="Visible to the customer on the invoice.">
            {(field) => <RichTextEditor {...field} value={notes} onValueChange={setNotes} placeholder="Notes for the customer…" />}
          </FormField>
          <FormField label="Terms & conditions">
            {(field) => <RichTextEditor {...field} value={terms} onValueChange={setTerms} placeholder="Payment terms, etc…" />}
          </FormField>
        </div>
      </Card>

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
          {saving ? <Spinner size="sm" /> : invoice ? "Save draft" : "Save as draft"}
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
