"use client";

import { useEffect, useRef, useState } from "react";
import { DOCUMENT_TYPE_LABELS, amountInWords, resolveDocumentBranding, type DocumentType, type PaperSize } from "@spine/shared";
import { cn } from "@spine/ui";
import { formatMoney } from "../../../lib/money";
import { useSettingsValue } from "../use-settings-value";
import { useT } from "../../../lib/i18n";

/** The page's shape (A4 is 1 : 1.414, Letter 1 : 1.294), drawn 460 px wide so the sample stays readable when scaled to the column. */
const PAGE: Record<PaperSize, { width: number; height: number }> = { A4: { width: 460, height: 650 }, LETTER: { width: 460, height: 595 } };

/** Sample lines (minor units), the same on every preview: a heading and two items, one discounted. */
const LINES = [
  { heading: "Kitchen" },
  { name: "Modular kitchen", description: "Carcass, shutters and fittings", hsnSac: "9403", quantity: 1, unit: "set", rate: 180000n, discount: 0, tax: 18 },
  { name: "Installation", description: "Levelling and handover", hsnSac: "995472", quantity: 2, unit: "day", rate: 12500n, discount: 10, tax: 18 },
] as const;
const lineAmount = (l: { quantity: number; rate: bigint; discount: number }) => (BigInt(l.quantity) * l.rate * BigInt(100 - l.discount)) / 100n;
const ITEMS = LINES.filter((l): l is Extract<(typeof LINES)[number], { name: string }> => "name" in l);
const SUBTOTAL = ITEMS.reduce((sum, l) => sum + lineAmount(l), 0n);
const TAX = ITEMS.reduce((sum, l) => sum + (lineAmount(l) * BigInt(l.tax)) / 100n, 0n);
const TOTAL = SUBTOTAL + TAX;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const NUMBERS: Record<DocumentType, string> = { quote: "QUO-0042", invoice: "INV-0118", credit_note: "CRN-0009", receipt: "RCT-0087", statement: "" };

/** Sample data, not copy: the customer and dates the preview shows. */
const SAMPLE = { customer: "Harbourview Apartments", issued: "13 Oct", period: "1 Sep – 30 Sep", due: "12 Nov", opened: "1 Sep", invoiced: "4 Sep", paid: "21 Sep" };

export interface DocumentSampleOptions {
  type: DocumentType;
  title: string;
  paperSize: PaperSize;
  columns: { quantity: boolean; discount: boolean; hsnSac: boolean; lineTax: boolean };
  taxSummary: boolean;
  amountInWords: boolean;
  signature: boolean;
  /** The uploaded signature; the sample shows it above "Authorised signatory", as the PDF does. */
  signatureFileId?: string | null;
  terms: string;
  notes: string;
  /** India's GST shows HSN/SAC and splits tax into CGST and SGST. */
  gst: boolean;
}

/**
 * US-SET-17 to US-SET-19 (D-237) — Settings › Documents' preview: a sample
 * of the document drawn in HTML from the options on screen — the business's
 * name or logo, its document colour and footer (Branding), the title, the
 * columns, tax summary, amount in words, signature, terms and notes — on a
 * page of the chosen paper size, scaled to fit. It changes as the options
 * do, with nothing to load. Light in both themes, like the PDF.
 */
export function DocumentSample(props: DocumentSampleOptions) {
  const t = useT();
  const profile = useSettingsValue<{ name?: string; logoUrl?: string; address?: string }>("business_profile", {});
  const brandingSetting = useSettingsValue<unknown>("branding", {});
  const currencySetting = useSettingsValue<{ code?: string }>("currency", { code: "USD" });
  const branding = resolveDocumentBranding(brandingSetting.value);
  const currency = currencySetting.value.code ?? "USD";
  const page = PAGE[props.paperSize] ?? PAGE.A4;

  // Drawn at the page's own size, then scaled to the column.
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => entry && setScale(entry.contentRect.width / page.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [page.width]);

  const money = (amount: bigint) => formatMoney(amount, currency);
  const business = profile.value.name?.trim() || t("settings.documentSample.yourBusiness");
  const lineDocument = props.type === "quote" || props.type === "invoice" || props.type === "credit_note";
  const discount = props.columns.discount && props.type !== "credit_note";
  const hsn = props.gst && props.columns.hsnSac;

  return (
    <figure className="flex flex-col gap-2" aria-label={t("settings.documentSample.previewLabel", { type: DOCUMENT_TYPE_LABELS[props.type] })} data-testid="document-sample">
      <div ref={box} className="w-full overflow-hidden rounded-md border border-border shadow-sm" style={{ height: page.height * scale }}>
        <div
          data-surface="document"
          className="origin-top-left bg-surface text-on-surface"
          style={{ width: page.width, height: page.height, transform: `scale(${scale})` }}
          role="img"
          aria-label={t("settings.documentSample.sampleLabel", { type: DOCUMENT_TYPE_LABELS[props.type].toLowerCase() })}
        >
          <div className="h-1.5" style={{ backgroundColor: branding.color }} />
          <div className="flex h-[calc(100%-6px)] flex-col gap-4 px-8 pb-6 pt-6 text-[10.5px] leading-snug">
            {/* Header: the business, and the document's title and number. */}
            <div className="flex items-start justify-between gap-6">
              <div className="flex min-w-0 flex-col gap-1">
                {profile.value.logoUrl ? <img src={profile.value.logoUrl} alt="" className="mb-1 h-9 max-w-36 object-contain object-left" /> : null}
                <span className="text-[16px] font-bold">{business}</span>
                {profile.value.address ? <span className="whitespace-pre-line text-on-surface-muted">{profile.value.address}</span> : <Bars widths={["w-40", "w-28"]} />}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span className="text-[17px] font-bold uppercase tracking-wide" style={{ color: branding.color }} data-testid="document-sample-title">
                  {props.type === "statement" ? props.title || t("settings.documentSample.statement") : props.title}
                </span>
                {NUMBERS[props.type] && <span className="font-semibold">{NUMBERS[props.type]}</span>}
                <span className="text-on-surface-muted">{props.type === "statement" ? SAMPLE.period : SAMPLE.issued}</span>
              </div>
            </div>

            <div className="flex justify-between gap-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-[8.5px] font-semibold uppercase tracking-wide text-on-surface-muted">{props.type === "receipt" ? t("settings.documentSample.receivedFrom") : t("settings.documentSample.billTo")}</span>
                <span className="font-semibold">{SAMPLE.customer}</span>
                <Bars widths={["w-32", "w-24"]} />
              </div>
              {props.type === "invoice" && (
                <div className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-[8.5px] font-semibold uppercase tracking-wide text-on-surface-muted">{t("settings.documentSample.due")}</span>
                  <span className="font-semibold">{SAMPLE.due}</span>
                </div>
              )}
            </div>

            {lineDocument && (
              <table className="w-full border-collapse" data-testid="document-sample-lines">
                <thead>
                  <tr className="border-b border-on-surface text-left text-[9px] font-semibold uppercase tracking-wide">
                    <th className="py-1.5 pr-2">{t("settings.documentSample.columns.item")}</th>
                    {hsn && <th className="py-1.5 pr-2">{t("settings.documentSample.columns.hsnSac")}</th>}
                    {props.columns.quantity && <th className="py-1.5 pr-2 text-right">{t("settings.documentSample.columns.qty")}</th>}
                    <th className="py-1.5 pr-2 text-right">{t("settings.documentSample.columns.rate")}</th>
                    {discount && <th className="py-1.5 pr-2 text-right">{t("settings.documentSample.columns.discount")}</th>}
                    {props.columns.lineTax && <th className="py-1.5 pr-2 text-right">{t("settings.documentSample.columns.tax")}</th>}
                    <th className="py-1.5 text-right">{t("settings.documentSample.columns.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {LINES.map((l, i) =>
                    "heading" in l ? (
                      <tr key={i}>
                        <td colSpan={7} className="pb-0.5 pt-2 font-bold">
                          {l.heading}
                        </td>
                      </tr>
                    ) : (
                      <tr key={i} className="border-b border-border align-top">
                        <td className="py-1.5 pr-2">
                          <span className="font-semibold">{l.name}</span>
                          <span className="block text-on-surface-muted">{l.description}</span>
                        </td>
                        {hsn && <td className="py-1.5 pr-2">{l.hsnSac}</td>}
                        {props.columns.quantity && (
                          <td className="py-1.5 pr-2 text-right">
                            {l.quantity} {l.unit}
                          </td>
                        )}
                        <td className="py-1.5 pr-2 text-right">{money(l.rate)}</td>
                        {discount && <td className="py-1.5 pr-2 text-right">{l.discount ? `${l.discount}%` : "—"}</td>}
                        {props.columns.lineTax && <td className="py-1.5 pr-2 text-right">{l.tax}%</td>}
                        <td className="py-1.5 text-right">{money(lineAmount(l))}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}

            {lineDocument && (
              <div className="flex justify-between gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {props.taxSummary && (
                    <table className="w-full max-w-60 border-collapse text-[8.5px]" data-testid="document-sample-tax-summary">
                      <thead>
                        <tr className="border-b border-border text-left text-on-surface-muted">
                          <th className="py-1 pr-2 font-semibold">{t("settings.documentSample.columns.tax")}</th>
                          <th className="py-1 pr-2 text-right font-semibold">{t("settings.documentSample.columns.taxable")}</th>
                          <th className="py-1 text-right font-semibold">{t("settings.documentSample.columns.amount")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(props.gst ? [t("settings.documentSample.cgst", { rate: 9 }), t("settings.documentSample.sgst", { rate: 9 })] : [t("settings.documentSample.taxAt", { rate: 18 })]).map((label) => (
                          <tr key={label} className="border-b border-border">
                            <td className="py-1 pr-2">{label}</td>
                            <td className="py-1 pr-2 text-right">{money(SUBTOTAL)}</td>
                            <td className="py-1 text-right">{money(props.gst ? TAX / 2n : TAX)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {props.amountInWords && <p className="italic text-on-surface-muted" data-testid="document-sample-words">{amountInWords(TOTAL, currency)}</p>}
                </div>
                <dl className="grid w-48 shrink-0 grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                  <dt className="text-on-surface-muted">{t("settings.documentSample.subtotal")}</dt>
                  <dd className="text-right">{money(SUBTOTAL)}</dd>
                  {props.gst ? (
                    <>
                      <dt className="text-on-surface-muted">{t("settings.documentSample.cgst", { rate: 9 })}</dt>
                      <dd className="text-right">{money(TAX / 2n)}</dd>
                      <dt className="text-on-surface-muted">{t("settings.documentSample.sgst", { rate: 9 })}</dt>
                      <dd className="text-right">{money(TAX / 2n)}</dd>
                    </>
                  ) : (
                    <>
                      <dt className="text-on-surface-muted">{t("settings.documentSample.columns.tax")}</dt>
                      <dd className="text-right">{money(TAX)}</dd>
                    </>
                  )}
                  <dt className="border-t border-on-surface pt-1 text-[11px] font-bold">{props.type === "credit_note" ? t("settings.documentSample.credit") : t("settings.documentSample.total")}</dt>
                  <dd className="border-t border-on-surface pt-1 text-right text-[11px] font-bold" style={{ color: branding.color }}>
                    {money(TOTAL)}
                  </dd>
                </dl>
              </div>
            )}

            {props.type === "receipt" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between border-b border-on-surface pb-2">
                  <span className="text-[11px] font-semibold">{t("settings.documentSample.paymentReceived")}</span>
                  <span className="text-[14px] font-bold" style={{ color: branding.color }}>
                    {money(TOTAL)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t("settings.documentSample.paidAgainst", { number: NUMBERS.invoice })}</span>
                  <span>{money(TOTAL)}</span>
                </div>
                {props.amountInWords && <p className="italic text-on-surface-muted">{amountInWords(TOTAL, currency)}</p>}
              </div>
            )}

            {props.type === "statement" && (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-on-surface text-left text-[9px] font-semibold uppercase tracking-wide">
                    <th className="py-1.5 pr-2">{t("settings.documentSample.columns.date")}</th>
                    <th className="py-1.5 pr-2">{t("settings.documentSample.columns.details")}</th>
                    <th className="py-1.5 pr-2 text-right">{t("settings.documentSample.columns.amount")}</th>
                    <th className="py-1.5 text-right">{t("settings.documentSample.columns.balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [SAMPLE.opened, t("settings.documentSample.openingBalance"), "", 0n],
                    [SAMPLE.invoiced, t("settings.documentSample.statementInvoice", { number: NUMBERS.invoice }), money(TOTAL), TOTAL],
                    [SAMPLE.paid, t("settings.documentSample.statementPayment", { number: NUMBERS.receipt }), `−${money(TOTAL / 2n)}`, TOTAL - TOTAL / 2n],
                  ].map(([date, details, amount, balance]) => (
                    <tr key={String(details)} className="border-b border-border">
                      <td className="py-1.5 pr-2">{String(date)}</td>
                      <td className="py-1.5 pr-2">{String(details)}</td>
                      <td className="py-1.5 pr-2 text-right">{String(amount)}</td>
                      <td className="py-1.5 text-right">{money(balance as bigint)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-auto flex items-end justify-between gap-6">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {props.terms.trim() && <SampleText label={t("settings.documentSample.terms")} text={props.terms} />}
                {props.notes.trim() && <SampleText label={t("settings.documentSample.notes")} text={props.notes} />}
              </div>
              {props.signature && props.signatureFileId && (
                <div className="flex w-36 shrink-0 flex-col items-center gap-1" data-testid="document-sample-signature">
                  <img src={`${API_URL}/files/${props.signatureFileId}`} alt={t("settings.documentSample.signatureAlt")} className="h-10 w-full border-b border-on-surface object-contain object-bottom pb-0.5" />
                  <span className="text-on-surface-muted">{t("settings.documentSample.signatory")}</span>
                </div>
              )}
            </div>
            {branding.footer && <p className="border-t border-border pt-2 text-center text-[8px] text-on-surface-muted">{branding.footer}</p>}
          </div>
        </div>
      </div>
      <figcaption className="text-[12px] text-on-surface-muted">{t("settings.documentSample.caption")}</figcaption>
    </figure>
  );
}

function SampleText({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8.5px] font-semibold uppercase tracking-wide text-on-surface-muted">{label}</span>
      <p className="line-clamp-3 whitespace-pre-line">{text.trim()}</p>
    </div>
  );
}

/** Placeholder lines for details the sample doesn't spell out. */
function Bars({ widths }: { widths: string[] }) {
  return (
    <span className="flex flex-col gap-1 pt-0.5">
      {widths.map((w, i) => (
        <span key={i} className={cn("h-1.5 rounded-full bg-border", w)} />
      ))}
    </span>
  );
}
