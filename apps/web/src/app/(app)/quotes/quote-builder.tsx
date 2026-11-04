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
  Input,
  RichTextEditor,
  Spinner,
  cn,
} from "@spine/ui";
import { DEFAULT_QUOTE_VALID_DAYS, QUOTE_TITLE_MAX, resolveDocumentLayout, type DocumentLayout } from "@spine/shared";
import { Eye, Send } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { useDocumentDefaults } from "../../../lib/document-defaults";
import { PlaceOfSupplyField, PlaceOfSupplyNotice, usePlaceOfSupply } from "../../../components/place-of-supply";
import { ContactPicker } from "./contact-picker";
import { blankLine, computeLinePreview, QuoteLineEditor, type EditableQuoteLine } from "./quote-line-editor";
import type { Quote, TaxGroupOption, TaxRateOption } from "./types";
import { useUnsavedGuard } from "../../../lib/use-unsaved-guard";
import { DocumentBuilderBar, LeaveWithoutSavingDialog } from "../../../components/document-builder-bar";

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
export async function saveOneOffLinesToCatalogue(lines: EditableQuoteLine[], currency: string): Promise<EditableQuoteLine[]> {
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

/** US-QUO-36 — today plus a number of days, at midnight. */
export function daysFromToday(days: number, today = new Date()): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** US-QUO-36 — which quick pick (if any) the date is. */
export function pickedDays(validUntil: Date | undefined, picks: number[], today = new Date()): number | null {
  if (!validUntil) return null;
  return picks.find((n) => daysFromToday(n, today).getTime() === new Date(validUntil.getFullYear(), validUntil.getMonth(), validUntil.getDate()).getTime()) ?? null;
}

const VALIDITY_PICKS = [15, 30, 60];

/** US-CRM-26 — the lead a new quote is started from ("Create quote" on the pipeline). */
interface QuoteLead {
  id: string;
  title: string | null;
  contactId: string;
  valueCurrency: string;
}

export function QuoteBuilder({ quote, leadId }: { quote?: Quote; leadId?: string }) {
  const router = useRouter();
  const canSend = useCapability("quotes.send");
  // US-QUO-35: changes since the page opened; leaving asks first.
  const { dirty, touch, interactionProps, markSaved, leaveTo, setLeaveTo, leave } = useUnsavedGuard("quoteBuilderGuard");
  const [title, setTitle] = useState(quote?.title ?? "");
  const [contactId, setContactId] = useState(quote?.contactId ?? "");
  const [lead, setLead] = useState<QuoteLead | null>(null);
  const [currency, setCurrency] = useState(quote?.currency ?? "USD");
  const [validUntil, setValidUntil] = useState<Date | undefined>(quote?.validUntil ? new Date(quote.validUntil) : undefined);
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [terms, setTerms] = useState(quote?.termsAndConditions ?? "");
  // US-SET-18 — a new quote starts with the default terms and notes.
  useDocumentDefaults("quote", !quote, setNotes, setTerms);
  const [lines, setLines] = useState<EditableQuoteLine[]>(quote ? toEditableLines(quote) : [blankLine()]);
  // US-AI-13: rows "Draft lines with AI" added, until each is changed; the quote then saves as filled in with AI (D-166).
  const [aiLineKeys, setAiLineKeys] = useState<Set<string>>(new Set());
  const [aiAssisted, setAiAssisted] = useState(false);
  /** A row keeps its AI mark while it's the very row AI added — any edit (a new object) or removal drops it; moving keeps it. */
  function changeLines(next: EditableQuoteLine[]) {
    const before = new Map(lines.map((l) => [l.key, l]));
    setAiLineKeys((keys) => (keys.size ? new Set([...keys].filter((key) => next.some((l) => l.key === key && l === before.get(key)))) : keys));
    setLines(next);
  }
  function addedAiLines(keys: string[]) {
    setAiLineKeys((prev) => new Set([...prev, ...keys]));
    setAiAssisted(true);
  }
  // US-TAX-13 — the place of supply follows the contact and switches item lines between CGST + SGST and IGST.
  const pos = usePlaceOfSupply({ contactId, initial: quote ? quote.placeOfSupply : undefined, lines, setLines });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);

  // US-CRM-26: a quote started from a lead takes its contact and currency, and is linked to it.
  useEffect(() => {
    if (quote || !leadId) return;
    apiClient
      .get<QuoteLead>(`/leads/${leadId}`)
      .then((row) => {
        setLead(row);
        setContactId(row.contactId);
        setCurrency(row.valueCurrency);
        // US-QUO-30: a quote from a lead starts with the lead's title.
        if (row.title) setTitle((current) => current || row.title!);
      })
      .catch(() => setLead(null));
  }, [quote, leadId]);
  // The link holds while the quote stays with the lead's contact.
  const linkedLead = lead && lead.contactId === contactId ? lead : null;

  useEffect(() => {
    if (quote || leadId) return; // only pre-fill the org default currency for a brand-new quote (a lead's quote uses the lead's)
    apiClient
      .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, [quote]);

  // US-QUO-36: a new quote is valid for the business's usual number of days.
  useEffect(() => {
    if (quote) return;
    apiClient
      .get<{ value: DocumentLayout | null }>("/org/settings/document_layout")
      .then((res) => {
        const days = resolveDocumentLayout(res.value, "quote").validDays;
        setValidUntil((current) => current ?? daysFromToday(days));
      })
      .catch(() => setValidUntil((current) => current ?? daysFromToday(DEFAULT_QUOTE_VALID_DAYS)));
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
      title: title.trim() || null,
      ...(!quote && linkedLead ? { leadId: linkedLead.id } : {}),
      placeOfSupply: pos.active ? pos.placeOfSupply : undefined,
      currency,
      validUntil: validUntil ? validUntil.toISOString().slice(0, 10) : null,
      notes: notes || null,
      termsAndConditions: terms || null,
      ...(aiAssisted ? { aiAssisted: true } : {}),
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

  /**
   * US-QUO-35 — "Preview PDF": the quote as it is on screen, in a new tab.
   * Nothing is saved; the draft (and "Unsaved changes") stay as they were.
   */
  async function preview() {
    setError(null);
    if (!contactId) {
      setError("Select a contact to preview the quote.");
      return;
    }
    // Opened before the request so the browser doesn't block it as a pop-up.
    const tab = window.open("", "_blank");
    setPreviewing(true);
    try {
      const { blob } = await apiClient.download("/quotes/preview-pdf", { ...buildPayload(lines), ...(quote ? { quoteId: quote.id } : {}) });
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch (err) {
      tab?.close();
      setError(err instanceof Error ? err.message : "Couldn't make the preview. Try again.");
    } finally {
      setPreviewing(false);
    }
  }

  /** Saves the draft; "send" then opens the send dialog on the quote's page. */
  async function save(then: "view" | "send" = "view") {
    setError(null);
    if (!contactId) {
      setError("Select a contact before saving.");
      return;
    }
    if (title.trim().length > QUOTE_TITLE_MAX) {
      setError("Keep the title under 120 characters.");
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
      markSaved();
      const sendNow = then === "send" && !saved.discountRequiresApproval;
      router.push(`/quotes/${saved.id}${sendNow ? "?action=send" : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save quote.");
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty) setLeaveTo(quote ? `/quotes/${quote.id}` : "/quotes");
    else router.back();
  }

  const picked = pickedDays(validUntil, VALIDITY_PICKS);

  return (
    <div className="flex flex-col gap-4" {...interactionProps}>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FormField label="Title (optional)" className="sm:col-span-2" helperText={title.length > QUOTE_TITLE_MAX - 20 ? `${title.length} of ${QUOTE_TITLE_MAX} characters` : undefined}>
          {(field) => (
            <Input {...field} value={title} maxLength={QUOTE_TITLE_MAX} onChange={(e) => touch(setTitle)(e.target.value)} placeholder="For example, Bathroom refit — 2nd floor" />
          )}
        </FormField>
        <FormField label="Contact" required>
          {(field) => <ContactPicker id={field.id} aria-describedby={field["aria-describedby"]} aria-invalid={field["aria-invalid"]} aria-required={field["aria-required"]} value={contactId} onValueChange={touch(setContactId)} />}
        </FormField>
        <div className="flex flex-col gap-1.5">
          <FormField label="Valid until" helperText="Quote shows as expired after this date.">
            {() => <DatePicker value={validUntil} onChange={touch(setValidUntil)} />}
          </FormField>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Valid for">
            {VALIDITY_PICKS.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={picked === days}
                onClick={() => touch(setValidUntil)(daysFromToday(days))}
                className={cn(
                  "h-7 rounded-md border px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  picked === days ? "border-primary bg-info-bg text-primary" : "border-border bg-surface-sunken text-on-surface hover:border-border-strong",
                )}
              >
                +{days} days
              </button>
            ))}
          </div>
        </div>
        <FormField label="Currency" required>
          {() => <Combobox options={currencyOptions} value={currency} onValueChange={touch(setCurrency)} />}
        </FormField>
        {pos.active && <PlaceOfSupplyField value={pos.placeOfSupply} onChange={touch(pos.setPlaceOfSupply)} source={pos.source} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} />}
        {linkedLead && (
          <p className="self-end text-[13px] text-on-surface-muted sm:col-span-2" data-testid="quote-lead">
            For lead <span className="font-medium text-on-surface">{linkedLead.title || "Untitled lead"}</span>. It&apos;s linked to the lead, so it shows in the lead&apos;s Quotes.
          </p>
        )}
      </Card>

      <PlaceOfSupplyNotice notice={pos.notice} />

      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold text-on-surface">Lines</h2>
          <a href="#quote-notes" className="text-[12.5px] font-medium text-primary hover:underline">
            Notes and terms ↓
          </a>
        </div>
        <QuoteLineEditor
          lines={lines}
          onChange={touch(changeLines)}
          currency={currency}
          supplyType={pos.supplyType}
          exportUnderLut={pos.exportUnderLut}
          flaggedKeys={pos.flagged}
          showHsn={pos.active}
          aiKeys={aiLineKeys}
          aiDraft={{ quoteId: quote?.id, onAdded: addedAiLines }}
        />
      </Card>

      <Card id="quote-notes" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Notes" helperText="Visible to the customer on the quote.">
            {(field) => <RichTextEditor {...field} value={notes} onValueChange={touch(setNotes)} placeholder="Notes for the customer…" />}
          </FormField>
          <FormField label="Terms & conditions">
            {(field) => <RichTextEditor {...field} value={terms} onValueChange={touch(setTerms)} placeholder="Payment terms, validity, etc…" />}
          </FormField>
        </div>
      </Card>

      {/* US-QUO-35: totals and actions stay in view. */}
      <DocumentBuilderBar totals={totals} currency={currency} dirty={dirty} testIdPrefix="quote">
          <Button type="button" variant="secondary" onClick={cancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={() => void preview()} disabled={saving || previewing} aria-busy={previewing}>
            {previewing ? <Spinner size="sm" /> : <Eye size={14} aria-hidden />}
            Preview PDF
          </Button>
          <Button type="button" variant={canSend ? "secondary" : "primary"} onClick={() => void save("view")} disabled={saving}>
            {saving ? <Spinner size="sm" /> : quote ? "Save draft" : "Save as draft"}
          </Button>
          {canSend && (
            <Button type="button" onClick={() => void save("send")} disabled={saving}>
              <Send size={14} aria-hidden />
              Save and send
            </Button>
          )}
      </DocumentBuilderBar>

      <LeaveWithoutSavingDialog open={leaveTo !== null} document="quote" onLeave={leave} onStay={() => setLeaveTo(null)} />
    </div>
  );
}

