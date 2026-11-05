"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  cn,
} from "@spine/ui";
import { DEFAULT_INVOICE_DUE_DAYS, resolveDocumentLayout, type DocumentLayout } from "@spine/shared";
import { Eye, Send } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { useDocumentDefaults } from "../../../lib/document-defaults";
import { useUnsavedGuard } from "../../../lib/use-unsaved-guard";
import { DocumentBuilderBar, LeaveWithoutSavingDialog } from "../../../components/document-builder-bar";
import { PlaceOfSupplyField, PlaceOfSupplyNotice, usePlaceOfSupply } from "../../../components/place-of-supply";
import { ContactPicker } from "../quotes/contact-picker";
import { useToast } from "../../../components/toast-host";
import { DUE_PICKS, daysAfter, pickedDueDays } from "./due-terms";
import { saveOneOffLinesToCatalogue } from "../quotes/quote-builder";
import { blankLine, computeLinePreview, QuoteLineEditor, type EditableQuoteLine } from "../quotes/quote-line-editor";
import type { Invoice, InvoiceType, TaxGroupOption, TaxRateOption } from "./types";
import { useT } from "../../../lib/i18n";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];

/** US-INV-33 — the due-date quick picks, in days after the issue date (0 is on receipt). */

interface CurrencyLocaleValue {
  code: string;
  locale: string;
}

function toEditableLines(invoice: Invoice): EditableQuoteLine[] {
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
      hsnSac: line.hsnSac ?? "",
    }));
}

/** A picked day as "2026-11-09", without shifting it across time zones. */
function toDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The invoice builder (`/invoices/new`, and `/invoices/:id/edit` for a
 * draft). US-INV-33, US-INV-34 (D-217): the quote builder's compact rows
 * (bundles and "Also save to catalogue" included) and its bar at the
 * bottom — totals, Cancel, Preview PDF (nothing saved, watermarked),
 * Save draft and Save and issue — with the same guard against leaving
 * unsaved changes. The due date starts from Settings › Documents ›
 * "Invoices due in" with On receipt, +15, +30 and +60.
 *
 * Totals here come from the same shared tax engine the server uses, for
 * instant feedback; the server's totals are the ones stored.
 */
export function InvoiceBuilder({ invoice }: { invoice?: Invoice }) {
  const t = useT();
  const router = useRouter();
  const canIssue = useCapability("invoices.issue");
  const { dirty, touch, interactionProps, markSaved, leaveTo, setLeaveTo, leave } = useUnsavedGuard("invoiceBuilderGuard");
  const [contactId, setContactId] = useState(invoice?.contactId ?? "");
  const [type, setType] = useState<InvoiceType>(invoice?.type ?? "standard");
  const [currency, setCurrency] = useState(invoice?.currency ?? "USD");
  const [issueDate, setIssueDate] = useState<Date | undefined>(invoice?.issueDate ? new Date(invoice.issueDate) : undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(invoice?.dueDate ? new Date(invoice.dueDate) : undefined);
  const [dueDays, setDueDays] = useState(DEFAULT_INVOICE_DUE_DAYS);
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [terms, setTerms] = useState(invoice?.termsAndConditions ?? "");
  // US-SET-18 — a new invoice starts with the default terms and notes.
  useDocumentDefaults("invoice", !invoice, setNotes, setTerms);
  const [lines, setLines] = useState<EditableQuoteLine[]>(invoice ? toEditableLines(invoice) : [blankLine()]);
  // US-TAX-13 — the place of supply follows the contact and switches item lines between CGST + SGST and IGST.
  const pos = usePlaceOfSupply({ contactId, initial: invoice ? invoice.placeOfSupply : undefined, lines, setLines });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroupOption[]>([]);
  const showToast = useToast();
  // US-INV-35: a duplicate opens here with ?duplicated=INV-0012 — dated today, due on the terms, and says where it came from.
  const duplicatedFrom = useRef(useSearchParams().get("duplicated"));

  useEffect(() => {
    if (invoice) return; // only pre-fill the org default currency for a brand-new invoice
    apiClient
      .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, [invoice]);

  // US-INV-33: the business's payment terms; a new invoice starts due that many days after today.
  useEffect(() => {
    apiClient
      .get<{ value: DocumentLayout | null }>("/org/settings/document_layout")
      .then((res) => {
        const days = resolveDocumentLayout(res.value, "invoice").dueDays;
        setDueDays(days);
        if (!invoice || duplicatedFrom.current !== null) setDueDate((current) => current ?? daysAfter(undefined, days));
      })
      .catch(() => {
        if (!invoice || duplicatedFrom.current !== null) setDueDate((current) => current ?? daysAfter(undefined, DEFAULT_INVOICE_DUE_DAYS));
      });
  }, [invoice]);

  useEffect(() => {
    const from = duplicatedFrom.current;
    if (from === null) return;
    setIssueDate((current) => current ?? new Date());
    if (from) showToast(t("invoices.builder.duplicatedTitle"), t("invoices.builder.duplicatedBody", { from }));
    router.replace(window.location.pathname, { scroll: false });
    // Once, on open: duplicatedFrom is read from the address the builder opened with.
  }, []);

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

  function buildPayload(rows: EditableQuoteLine[]) {
    return {
      contactId,
      placeOfSupply: pos.active ? pos.placeOfSupply : undefined,
      type,
      currency,
      issueDate: issueDate ? toDay(issueDate) : null,
      dueDate: dueDate ? toDay(dueDate) : null,
      notes: notes || null,
      termsAndConditions: terms || null,
      lines: rows.map((line, index) => ({
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

  /** US-INV-34 — the invoice as it is on screen, in a new tab; nothing is saved. */
  async function preview() {
    setError(null);
    if (!contactId) {
      setError(t("invoices.builder.previewNeedsContact"));
      return;
    }
    // Opened before the request so the browser doesn't block it as a pop-up.
    const tab = window.open("", "_blank");
    setPreviewing(true);
    try {
      const { blob } = await apiClient.download("/invoices/preview-pdf", { ...buildPayload(lines), ...(invoice ? { invoiceId: invoice.id } : {}) });
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch (err) {
      tab?.close();
      setError(err instanceof Error ? err.message : t("invoices.builder.previewFailed"));
    } finally {
      setPreviewing(false);
    }
  }

  /** Saves the draft; "issue" then opens Issue invoice on its page, with the same checks as there. */
  async function save(then: "view" | "issue" = "view") {
    setError(null);
    if (!contactId) {
      setError(t("invoices.builder.saveNeedsContact"));
      return;
    }
    setSaving(true);
    try {
      // US-CAT-06: one-off lines marked "Also save to catalogue" become items first, so the invoice links to them.
      const withItems = await saveOneOffLinesToCatalogue(lines, currency);
      if (withItems !== lines) setLines(withItems);
      const payload = buildPayload(withItems);
      const saved = invoice ? await apiClient.put<Invoice>(`/invoices/${invoice.id}`, payload) : await apiClient.post<Invoice>("/invoices", payload);
      markSaved();
      router.push(`/invoices/${saved.id}${then === "issue" ? "?action=issue" : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invoices.builder.saveFailed"));
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty) setLeaveTo(invoice ? `/invoices/${invoice.id}` : "/invoices");
    else router.back();
  }

  const picked = pickedDueDays(issueDate, dueDate);

  return (
    <div className="flex flex-col gap-4" {...interactionProps}>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FormField label={t("invoices.builder.contact")} required>
          {(field) => <ContactPicker id={field.id} aria-describedby={field["aria-describedby"]} aria-invalid={field["aria-invalid"]} aria-required={field["aria-required"]} value={contactId} onValueChange={touch(setContactId)} />}
        </FormField>
        <FormField label={t("invoices.builder.type")}>
          {() => (
            <Select value={type} onValueChange={(v) => touch(setType)(v as InvoiceType)}>
              <SelectTrigger aria-label={t("invoices.builder.type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">{t("invoices.builder.typeStandard")}</SelectItem>
                <SelectItem value="advance">{t("invoices.builder.typeAdvance")}</SelectItem>
                <SelectItem value="progress">{t("invoices.builder.typeProgress")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label={t("invoices.builder.currency")} required>
          {(field) => <Combobox id={field.id} options={currencyOptions} value={currency} onValueChange={touch(setCurrency)} aria-label={t("invoices.builder.currency")} />}
        </FormField>
        {pos.active ? (
          <PlaceOfSupplyField value={pos.placeOfSupply} onChange={touch(pos.setPlaceOfSupply)} source={pos.source} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} />
        ) : (
          <div className="hidden xl:block" />
        )}
        <FormField label={t("invoices.builder.issueDate")} helperText={t("invoices.builder.issueDateHelp")}>
          {() => <DatePicker value={issueDate} onChange={touch(setIssueDate)} aria-label={t("invoices.builder.issueDate")} />}
        </FormField>
        <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-3">
          <FormField label={t("invoices.builder.dueDate")} helperText={t("invoices.builder.dueTermsHelp", { terms: dueDays === 0 ? t("invoices.builder.termsOnReceipt") : t("invoices.builder.termsDaysAfterIssue", { n: dueDays }) })}>
            {() => (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-56">
                  <DatePicker value={dueDate} onChange={touch(setDueDate)} aria-label={t("invoices.builder.dueDate")} />
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("invoices.builder.dueIn")}>
                  {DUE_PICKS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={picked === days}
                      onClick={() => touch(setDueDate)(daysAfter(issueDate, days))}
                      className={cn(
                        "h-7 rounded-md border px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        picked === days ? "border-primary bg-info-bg text-primary" : "border-border bg-surface-sunken text-on-surface hover:border-border-strong",
                      )}
                    >
                      {days === 0 ? t("invoices.builder.onReceipt") : t("invoices.builder.plusDays", { n: days })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FormField>
        </div>
      </Card>

      <PlaceOfSupplyNotice notice={pos.notice} />

      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold text-on-surface">{t("invoices.builder.lines")}</h2>
          <a href="#invoice-notes" className="text-[12.5px] font-medium text-primary hover:underline">
            {t("invoices.builder.notesAndTermsLink")}
          </a>
        </div>
        <QuoteLineEditor lines={lines} onChange={touch(setLines)} currency={currency} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} flaggedKeys={pos.flagged} showHsn={pos.active} />
      </Card>

      <Card id="invoice-notes" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label={t("invoices.builder.notes")} helperText={t("invoices.builder.notesHelp")}>
            {(field) => <RichTextEditor {...field} value={notes} onValueChange={touch(setNotes)} placeholder={t("invoices.builder.notesPlaceholder")} />}
          </FormField>
          <FormField label={t("invoices.builder.terms")}>
            {(field) => <RichTextEditor {...field} value={terms} onValueChange={touch(setTerms)} placeholder={t("invoices.builder.termsPlaceholder")} />}
          </FormField>
        </div>
      </Card>

      {/* US-INV-34: totals and actions stay in view. */}
      <DocumentBuilderBar totals={totals} currency={currency} dirty={dirty} testIdPrefix="invoice">
        <Button type="button" variant="secondary" onClick={cancel} disabled={saving}>
          {t("invoices.builder.cancel")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void preview()} disabled={saving || previewing} aria-busy={previewing}>
          {previewing ? <Spinner size="sm" /> : <Eye size={14} aria-hidden />}
          {t("invoices.builder.previewPdf")}
        </Button>
        <Button type="button" variant={canIssue ? "secondary" : "primary"} onClick={() => void save("view")} disabled={saving}>
          {saving ? <Spinner size="sm" /> : invoice ? t("invoices.builder.saveDraft") : t("invoices.builder.saveAsDraft")}
        </Button>
        {canIssue && (
          <Button type="button" onClick={() => void save("issue")} disabled={saving}>
            <Send size={14} aria-hidden />
            {t("invoices.builder.saveAndIssue")}
          </Button>
        )}
      </DocumentBuilderBar>

      <LeaveWithoutSavingDialog open={leaveTo !== null} document="invoice" onLeave={leave} onStay={() => setLeaveTo(null)} />
    </div>
  );
}
