"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, Button, Card, Combobox, DatePicker, FormField, RichTextEditor, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { PlaceOfSupplyField, PlaceOfSupplyNotice, usePlaceOfSupply } from "../../../components/place-of-supply";
import { ContactPicker } from "./contact-picker";
import { blankLine, computeLinePreview, QuoteLineEditor, type EditableQuoteLine } from "./quote-line-editor";
import type { Quote, TaxGroupOption, TaxRateOption } from "./types";
import { formatMoney } from "../../../lib/money";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];

interface CurrencyLocaleValue {
  code: string;
  locale: string;
}

function toEditableLines(quote: Quote): EditableQuoteLine[] {
  if (!quote.lines?.length) return [];
  return quote.lines
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
      hsnSac: line.hsnSac ?? "",
    }));
}

/**
 * The quote builder — a full page (not a Drawer), per the task brief's own
 * reasoning: a multi-line editable table with add/remove/reorder, a
 * contact picker, and live totals needs real width and vertical space that
 * a Drawer's fixed-width panel would cramp, unlike Catalogue's flat
 * single-entity form. Used for both `/quotes/new` (no `quote` prop) and
 * `/quotes/:id/edit` (a draft only — see quotes.service.ts's own guard;
 * this page is never reachable for a sent quote, which instead offers
 * "Revise" from the detail page).
 *
 * Totals shown here are computed client-side via the SAME shared tax
 * engine the server uses (see quote-line-editor.tsx's computeLinePreview)
 * purely for instant feedback — every Save/Send/"Mark as sent" action
 * re-fetches the server-computed quote afterward, since the server is the
 * sole source of truth for stored totals per CLAUDE.md.
 */
/**
 * US-CAT-06 — creates a catalogue item for each one-off line marked "Also
 * save to catalogue" that has a price (name, price and tax from the line;
 * unit "each", editable in the catalogue later) and links the line to it.
 * Lines without a price stay one-off. Returns the same array when nothing
 * was created.
 */
async function saveOneOffLinesToCatalogue(lines: EditableQuoteLine[], currency: string): Promise<EditableQuoteLine[]> {
  if (!lines.some((l) => l.saveToCatalogue && !l.catalogItemId && l.unitPriceAmount > 0n)) return lines;
  const next: EditableQuoteLine[] = [];
  for (const line of lines) {
    if (!line.saveToCatalogue || line.catalogItemId || line.unitPriceAmount <= 0n) {
      next.push(line);
      continue;
    }
    const item = await apiClient.post<{ id: string }>("/catalog-items", {
      name: line.name.trim(),
      description: line.description || null,
      unit: "each",
      defaultPriceAmount: line.unitPriceAmount.toString(),
      defaultPriceCurrency: currency,
      defaultTaxRatePercentage: line.taxRateId || line.taxGroupId ? 0 : line.taxRatePercentage,
      defaultTaxRateId: line.taxRateId,
      defaultTaxGroupId: line.taxGroupId,
    });
    next.push({ ...line, catalogItemId: item.id, saveToCatalogue: false });
  }
  return next;
}

export function QuoteBuilder({ quote }: { quote?: Quote }) {
  const router = useRouter();
  const [contactId, setContactId] = useState(quote?.contactId ?? "");
  const [currency, setCurrency] = useState(quote?.currency ?? "USD");
  const [validUntil, setValidUntil] = useState<Date | undefined>(quote?.validUntil ? new Date(quote.validUntil) : undefined);
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [terms, setTerms] = useState(quote?.termsAndConditions ?? "");
  const [lines, setLines] = useState<EditableQuoteLine[]>(quote ? toEditableLines(quote) : [blankLine()]);
  // US-TAX-13 — the place of supply follows the contact and switches item lines between CGST + SGST and IGST.
  const pos = usePlaceOfSupply({ contactId, initial: quote ? quote.placeOfSupply : undefined, lines, setLines });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);

  useEffect(() => {
    if (quote) return; // only pre-fill the org default currency for a brand-new quote
    apiClient
      .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, [quote]);

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

  function buildPayload(lines: EditableQuoteLine[]) {
    return {
      contactId,
      placeOfSupply: pos.active ? pos.placeOfSupply : undefined,
      currency,
      validUntil: validUntil ? validUntil.toISOString().slice(0, 10) : null,
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
        hsnSac: line.hsnSac || null,
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
      // US-CAT-06: one-off lines marked "Also save to catalogue" become items first, so the quote links to them.
      const withItems = await saveOneOffLinesToCatalogue(lines, currency);
      if (withItems !== lines) setLines(withItems);
      const payload = buildPayload(withItems);
      const saved = quote
        ? await apiClient.put<Quote>(`/quotes/${quote.id}`, payload)
        : await apiClient.post<Quote>("/quotes", payload);
      router.push(`/quotes/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save quote.");
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
          <FormField label="Valid until" helperText="Quote shows as expired after this date.">
            {() => <DatePicker value={validUntil} onChange={setValidUntil} />}
          </FormField>
          {pos.active && <PlaceOfSupplyField value={pos.placeOfSupply} onChange={pos.setPlaceOfSupply} source={pos.source} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} />}
        </div>
      </Card>

      <PlaceOfSupplyNotice notice={pos.notice} />

      <Card className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-on-surface">Lines</h2>
        <QuoteLineEditor lines={lines} onChange={setLines} currency={currency} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} flaggedKeys={pos.flagged} showHsn={pos.active} />
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Notes" helperText="Visible to the customer on the quote.">
            {(field) => <RichTextEditor {...field} value={notes} onValueChange={setNotes} placeholder="Notes for the customer…" />}
          </FormField>
          <FormField label="Terms & conditions">
            {(field) => <RichTextEditor {...field} value={terms} onValueChange={setTerms} placeholder="Payment terms, validity, etc…" />}
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
          {saving ? <Spinner size="sm" /> : quote ? "Save draft" : "Save as draft"}
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
