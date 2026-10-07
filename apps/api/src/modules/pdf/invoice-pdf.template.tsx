import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { percentageOf, resolveDocumentLayout, type ResolvedDocumentLayout, amountInWords } from "@spine/shared";
import type { invoices, invoiceLines } from "../../db/schema";
import { formatMoneyForPdf } from "../../common/money-format";
import { renderRichTextForPdf } from "./rich-text-to-pdf";
import { DEFAULT_DOCUMENT_BRANDING, DocumentAccentBar, DocumentFooterLine, pagePaddingFor, type DocumentBranding } from "./document-branding";
import { PDF_FONT_FAMILY } from "./pdf-fonts";
import { DocumentLinesTable } from "./document-lines";
import { AmountInWordsLine, SignatureBlock } from "./document-extras";
import { ExportNote, GstCustomerLines, GstTotalsRows, PlaceOfSupplyBlock } from "./gst-blocks";
import type { GstPdfContext } from "./gst-document";
import { TaxSummaryTable } from "./tax-summary";

export interface InvoicePdfBusinessProfile {
  name: string;
  logoUrl?: string;
  address?: string;
  industry?: string;
  paymentInstructions?: string;
}

/**
 * US-INV-15 — what the "How to pay" block prints: the copy kept on an
 * issued invoice, or the current setting for a draft preview.
 */
export function invoicePaymentInstructions(invoice: { status: string; paymentInstructions: string | null }, business: InvoicePdfBusinessProfile | null): string | null {
  const text = invoice.status === "draft" ? business?.paymentInstructions : invoice.paymentInstructions;
  return text?.trim() || null;
}

/**
 * The invoice's printed title: Settings › Documents' title, unless GST
 * applies — then GST's own wins (US-SET-18, US-TAX-15): "Tax Invoice", or
 * "Bill of Supply" when every line is exempt or non-taxable.
 */
export function invoiceTitle(invoice: { supplyType: string | null }, title: string, billOfSupply = false): string {
  if (!invoice.supplyType) return title.toUpperCase();
  return billOfSupply ? "BILL OF SUPPLY" : "TAX INVOICE";
}

export interface InvoicePdfData {
  /** US-SET-19 — the signature image, when this document type shows it. */
  signatureDataUri?: string;
  /** US-TAX-15 — GSTINs, place of supply and the tax split, for a GST invoice; absent otherwise. */
  gst?: GstPdfContext | null;
  /** US-SET-17 (D-152) — Settings › Documents: paper size, columns, title… */
  layout?: ResolvedDocumentLayout;
  /** US-SET-10 — document colour and footer from Settings › Branding. */
  branding?: DocumentBranding;
  /** US-OPS-24 — the organisation's locale for money (Settings › Currency & locale). */
  locale?: string;
  /** US-JOB-29 — "Progress claim 3 · JOB-002", under the invoice number. */
  claimLabel?: string;
  invoice: typeof invoices.$inferSelect;
  lines: (typeof invoiceLines.$inferSelect)[];
  contactName: string | null;
  contactEmail: string | null;
  business: InvoicePdfBusinessProfile | null;
  /** See quote-pdf.template.tsx's identical field for the full reasoning. */
  logoDataUri?: string;
}

// Styles are a near-exact copy of quote-pdf.template.tsx's own StyleSheet —
// kept as a separate literal (not imported/shared) so the two document
// types' visual layout can diverge independently later without one
// template's styling change silently affecting the other, matching how
// invoices.ts's schema itself is a deliberate duplicate of quotes.ts rather
// than a shared base.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: PDF_FONT_FAMILY, color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  businessBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 48, height: 48, objectFit: "contain", marginRight: 10 },
  businessName: { fontSize: 14, fontWeight: 700 },
  businessMeta: { fontSize: 9, color: "#555555", marginTop: 2 },
  docTitleBlock: { alignItems: "flex-end" },
  docTitle: { fontSize: 18, fontWeight: 700 },
  docNumber: { fontSize: 10, color: "#555555", marginTop: 2 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 8, color: "#888888", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  contactName: { fontSize: 11, fontWeight: 700 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  metaCol: {},
  lineName: { fontSize: 10 },
  totalsBlock: { marginTop: 16, alignSelf: "flex-end", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: "#555555" },
  totalsValue: { textAlign: "right" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#333333",
    marginTop: 4,
    paddingTop: 4,
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 700 },
  grandTotalValue: { fontSize: 11, fontWeight: 700 },
  balanceDueRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6 },
  balanceDueLabel: { fontSize: 10, fontWeight: 700, color: "#b91c1c" },
  balanceDueValue: { fontSize: 10, fontWeight: 700, color: "#b91c1c" },
  footer: { marginTop: 28 },
  howToPay: { marginTop: 20, padding: 10, borderWidth: 1, borderColor: "#E7E5E0", borderRadius: 4, backgroundColor: "#FAFAF9" },
  howToPayTitle: { fontSize: 9, fontWeight: 700, marginBottom: 4, color: "#211F1A" },
  footerLabel: { fontSize: 8, color: "#888888", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  footerText: { fontSize: 9, color: "#333333", lineHeight: 1.4 },
  footerParagraph: { fontSize: 9, color: "#333333", lineHeight: 1.4, marginBottom: 4 },
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
  },
});

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Renders an invoice purely from its own stored snapshot (`invoices`/
 * `invoice_lines` rows) — never re-reads `catalog_items`, per CLAUDE.md's
 * "documents snapshot their data" rule. Structurally the same layout as
 * QuotePdfDocument (S-05.7's "email the invoice as a PDF with payment
 * instructions" — Stage 1 covers the PDF rendering itself; a dedicated
 * "payment instructions" block is a documented follow-up alongside
 * email-sending, once Payments exists to describe how to pay) with two
 * invoice-specific additions: due date instead of "valid until", and a
 * highlighted balance-due row when the invoice isn't fully paid.
 */
export function InvoicePdfDocument({ invoice, lines, contactName, contactEmail, business, logoDataUri, locale, branding, claimLabel, signatureDataUri, gst, layout: givenLayout }: InvoicePdfData) {
  const layout = givenLayout ?? resolveDocumentLayout(null, "invoice");
  const brand = branding ?? DEFAULT_DOCUMENT_BRANDING;
  const currency = invoice.currency;
  const fmt = (amount: bigint | string) => formatMoneyForPdf(amount, currency, locale);
  // US-JOB-21: retention held back is not part of what's due now.
  const balanceDue = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
  const amountDue = invoice.totalAmount - invoice.retentionAmount;
  const paymentInstructions = invoicePaymentInstructions(invoice, business);

  return (
    <Document title={invoice.number ?? "Invoice"} author={business?.name ?? "Spine"}>
      <Page size={layout.paperSize} style={[styles.page, pagePaddingFor(brand)]}>
        <DocumentAccentBar color={brand.color} />
        <View style={styles.header}>
          <View style={styles.businessBlock}>
            {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
            <View>
              <Text style={styles.businessName}>{business?.name ?? "Your business"}</Text>
              {(business?.address || gst?.business.gstin) && (
                <Text style={styles.businessMeta}>{[business?.address, gst?.business.gstin ? `GSTIN ${gst.business.gstin}` : null].filter(Boolean).join(" · ")}</Text>
              )}
            </View>
          </View>
          <View style={styles.docTitleBlock}>
            <Text style={[styles.docTitle, { color: brand.color }]}>{invoice.type === "advance" ? "DEPOSIT INVOICE" : invoiceTitle(invoice, layout.title, gst?.billOfSupply)}</Text>
            <Text style={styles.docNumber}>{invoice.number ?? "DRAFT"}</Text>
            {claimLabel && <Text style={styles.docNumber}>{claimLabel}</Text>}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Billed to</Text>
            <Text style={styles.contactName}>{contactName ?? "—"}</Text>
            {contactEmail && <Text style={styles.businessMeta}>{contactEmail}</Text>}
            {gst && <GstCustomerLines gst={gst} />}
          </View>
          {gst && (
            <View style={styles.metaCol}>
              <PlaceOfSupplyBlock gst={gst} />
            </View>
          )}
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Date issued</Text>
            <Text style={styles.lineName}>{formatDate(invoice.issuedAt ?? invoice.issueDate ?? invoice.createdAt)}</Text>
            {invoice.dueDate && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Due date</Text>
                <Text style={styles.lineName}>{formatDate(invoice.dueDate)}</Text>
              </>
            )}
          </View>
        </View>

        {gst && <ExportNote gst={gst} />}

        <DocumentLinesTable lines={lines} columns={layout.columns} fmt={fmt} showHsn={invoice.supplyType !== null} showDiscount={!gst} gstTaxes={gst?.lineTaxes} />

        <View style={styles.totalsBlock}>
          {gst ? (
            <GstTotalsRows lines={lines} gst={gst} fmt={fmt} />
          ) : (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>{fmt(invoice.subtotalAmount)}</Text>
              </View>
              {invoice.discountAmount > 0n && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Discount</Text>
                  <Text style={styles.totalsValue}>{fmt(-BigInt(invoice.discountAmount))}</Text>
                </View>
              )}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax</Text>
                <Text style={styles.totalsValue}>{fmt(invoice.taxAmount)}</Text>
              </View>
            </>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: brand.color }]}>{fmt(invoice.totalAmount)}</Text>
          </View>
          {invoice.retentionAmount > 0n && (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Retention held ({percentageOf(invoice.retentionAmount, invoice.subtotalAmount - invoice.discountAmount)}%)
                </Text>
                <Text style={styles.totalsValue}>{fmt(-BigInt(invoice.retentionAmount))}</Text>
              </View>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Amount due</Text>
                <Text style={[styles.grandTotalValue, { color: brand.color }]}>{fmt(amountDue)}</Text>
              </View>
            </>
          )}
          {invoice.amountPaid > 0n && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Paid</Text>
              <Text style={styles.totalsValue}>{fmt(-BigInt(invoice.amountPaid))}</Text>
            </View>
          )}
          {invoice.creditedAmount > 0n && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Credited</Text>
              <Text style={styles.totalsValue}>{fmt(-BigInt(invoice.creditedAmount))}</Text>
            </View>
          )}
          {balanceDue > 0n && invoice.status !== "draft" && (
            <View style={styles.balanceDueRow}>
              <Text style={styles.balanceDueLabel}>Balance due</Text>
              <Text style={styles.balanceDueValue}>{fmt(balanceDue)}</Text>
            </View>
          )}
        </View>

        {layout.amountInWords && <AmountInWordsLine words={amountInWords(invoice.totalAmount - invoice.retentionAmount, invoice.currency)} />}
        {layout.taxSummary && <TaxSummaryTable lines={lines} fmt={fmt} gstTaxes={gst?.lineTaxes} />}

        {paymentInstructions && (
          <View style={styles.howToPay} wrap={false}>
            <Text style={styles.howToPayTitle}>How to pay</Text>
            <Text style={styles.footerText}>{paymentInstructions}</Text>
          </View>
        )}

        {invoice.notes && (
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>Notes</Text>
            {renderRichTextForPdf(invoice.notes, { paragraph: styles.footerParagraph, text: styles.footerText })}
          </View>
        )}
        {invoice.termsAndConditions && (
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>Terms &amp; conditions</Text>
            {renderRichTextForPdf(invoice.termsAndConditions, { paragraph: styles.footerParagraph, text: styles.footerText })}
          </View>
        )}

        {signatureDataUri && <SignatureBlock src={signatureDataUri} businessName={business?.name ?? "Your business"} />}

        <DocumentFooterLine footer={brand.footer} />
        <Text
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }) => `${invoice.number ?? "Draft invoice"} · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
