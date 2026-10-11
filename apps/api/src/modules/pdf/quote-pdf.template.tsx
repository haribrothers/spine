import { resolveDocumentLayout, type ResolvedDocumentLayout, amountInWords } from "@spine/shared";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { quotes, quoteLines } from "../../db/schema";
import { formatMoneyForPdf } from "../../common/money-format";
import { renderRichTextForPdf } from "./rich-text-to-pdf";
import { DEFAULT_DOCUMENT_BRANDING, DocumentAccentBar, DocumentFooterLine, pagePaddingFor, type DocumentBranding } from "./document-branding";
import { PDF_FONT_FAMILY } from "./pdf-fonts";
import { DocumentLinesTable } from "./document-lines";
import { AmountInWordsLine, SignatureBlock } from "./document-extras";

export interface QuotePdfBusinessProfile {
  name: string;
  logoUrl?: string;
  address?: string;
  industry?: string;
}

export interface QuotePdfData {
  /** US-SET-19 — the signature image, when this document type shows it. */
  signatureDataUri?: string;
  /** US-SET-17 (D-152) — Settings › Documents: paper size, columns, title… */
  layout?: ResolvedDocumentLayout;
  /** US-SET-10 — document colour and footer from Settings › Branding. */
  branding?: DocumentBranding;
  /** US-OPS-24 — the organisation's locale for money (Settings › Currency & locale). */
  locale?: string;
  quote: typeof quotes.$inferSelect;
  lines: (typeof quoteLines.$inferSelect)[];
  contactName: string | null;
  contactEmail: string | null;
  business: QuotePdfBusinessProfile | null;
  /** US-QUO-35 — a quote that hasn't been sent prints "DRAFT" across every page, so a preview can't pass for the real thing. */
  watermark?: boolean;
  /** Base64 data URI for the org logo, resolved by QuotePdfService before render (React-PDF's <Image> needs a URL or a resolvable source, and CLAUDE.md's "byte-identical across environments" requirement rules out a live network fetch inside the renderer itself). Undefined when there is no logo or it could not be fetched — the header degrades to text-only. */
  logoDataUri?: string;
}

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
  docSubject: { fontSize: 10, color: "#1a1a1a", marginTop: 4, maxWidth: 220, textAlign: "right" },
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
  footer: { marginTop: 28 },
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
 * Renders a quote purely from its own stored snapshot (`quotes`/
 * `quote_lines` rows) — never re-reads `catalog_items`, per CLAUDE.md's
 * "documents snapshot their data" rule. Every money value is formatted via
 * `formatMoneyForPdf` (the shared `formatMoney`, made PDF-safe, D-123; the web
 * app uses the same formatter), never a hand-rolled division, so this template can never
 * silently misplace a decimal point.
 */
export function QuotePdfDocument({ quote, lines, contactName, contactEmail, business, logoDataUri, locale, branding, signatureDataUri, layout: givenLayout, watermark = false }: QuotePdfData) {
  const layout = givenLayout ?? resolveDocumentLayout(null, "quote");
  const brand = branding ?? DEFAULT_DOCUMENT_BRANDING;
  const currency = quote.currency;
  const fmt = (amount: bigint | string) => formatMoneyForPdf(amount, currency, locale);

  return (
    <Document title={quote.number ?? "Quote"} author={business?.name ?? "Spine"}>
      <Page size={layout.paperSize} style={[styles.page, pagePaddingFor(brand)]}>
        {watermark && <DraftWatermark />}
        <DocumentAccentBar color={brand.color} />
        <View style={styles.header}>
          <View style={styles.businessBlock}>
            {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
            <View>
              <Text style={styles.businessName}>{business?.name ?? "Your business"}</Text>
              {business?.address && <Text style={styles.businessMeta}>{business.address}</Text>}
            </View>
          </View>
          <View style={styles.docTitleBlock}>
            <Text style={[styles.docTitle, { color: brand.color }]}>{layout.title.toUpperCase()}</Text>
            <Text style={styles.docNumber}>{quote.number ?? "DRAFT"}</Text>
            {/* US-QUO-30: the quote's title under its number. */}
            {quote.title && <Text style={styles.docSubject}>{quote.title}</Text>}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Prepared for</Text>
            <Text style={styles.contactName}>{contactName ?? "—"}</Text>
            {contactEmail && <Text style={styles.businessMeta}>{contactEmail}</Text>}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Date issued</Text>
            <Text style={styles.lineName}>{formatDate(quote.sentAt ?? quote.createdAt)}</Text>
            {quote.validUntil && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Valid until</Text>
                <Text style={styles.lineName}>{formatDate(quote.validUntil)}</Text>
              </>
            )}
          </View>
        </View>

        <DocumentLinesTable lines={lines} columns={layout.columns} fmt={fmt} showHsn={quote.supplyType !== null} showDiscount={true} />

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{fmt(quote.subtotalAmount)}</Text>
          </View>
          {quote.discountAmount > 0n && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>{fmt(-BigInt(quote.discountAmount))}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax</Text>
            <Text style={styles.totalsValue}>{fmt(quote.taxAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: brand.color }]}>{fmt(quote.totalAmount)}</Text>
          </View>
        </View>

        {layout.amountInWords && <AmountInWordsLine words={amountInWords(quote.totalAmount, quote.currency)} />}

        {/* notes/termsAndConditions are HTML now (RichTextEditor) — React-PDF's
            <Text> only accepts plain strings/nested <Text>, so this walks the
            editor's own small tag set into Text/View/Link rather than
            printing raw markup. See rich-text-to-pdf.tsx for the full
            reasoning. */}
        {quote.notes && (
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>Notes</Text>
            {renderRichTextForPdf(quote.notes, { paragraph: styles.footerParagraph, text: styles.footerText })}
          </View>
        )}
        {quote.termsAndConditions && (
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>Terms &amp; conditions</Text>
            {renderRichTextForPdf(quote.termsAndConditions, { paragraph: styles.footerParagraph, text: styles.footerText })}
          </View>
        )}

        {signatureDataUri && <SignatureBlock src={signatureDataUri} businessName={business?.name ?? "Your business"} />}

        <DocumentFooterLine footer={brand.footer} />
        <Text
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }) => `${quote.number ?? "Draft quote"} · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

/**
 * US-QUO-35, US-INV-34 — "DRAFT" across the middle of every page of an unsent quote or a draft invoice,
 * faint and behind the content: drawn first, and `fixed` so it repeats on
 * each page.
 */
export function DraftWatermark({ document = "quote" }: { document?: "quote" | "invoice" }) {
  return (
    <View fixed style={watermarkStyles.layer}>
      <View style={watermarkStyles.rotated}>
        <Text style={watermarkStyles.big}>DRAFT</Text>
        <Text style={watermarkStyles.small}>Preview only — not a valid {document}</Text>
      </View>
    </View>
  );
}

const watermarkStyles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  rotated: { alignItems: "center", transform: "rotate(-35deg)" },
  big: { fontSize: 120, fontWeight: 700, color: "#000000", opacity: 0.06, letterSpacing: 12 },
  small: { fontSize: 18, fontWeight: 700, color: "#000000", opacity: 0.09, marginTop: 4, letterSpacing: 1 },
});
