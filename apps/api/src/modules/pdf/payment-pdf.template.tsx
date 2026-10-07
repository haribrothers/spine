import { resolveDocumentLayout, type ResolvedDocumentLayout } from "@spine/shared";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { formatMoneyForPdf } from "../../common/money-format";
import { DEFAULT_DOCUMENT_BRANDING, DocumentAccentBar, DocumentFooterLine, pagePaddingFor, type DocumentBranding } from "./document-branding";
import type { payments, paymentAllocations } from "../../db/schema";
import { PDF_FONT_FAMILY } from "./pdf-fonts";
import { LayoutTextBlocks, SignatureBlock } from "./document-extras";

export interface PaymentPdfBusinessProfile {
  name: string;
  logoUrl?: string;
  address?: string;
  industry?: string;
}

export interface PaymentPdfAllocationRow {
  allocation: typeof paymentAllocations.$inferSelect;
  invoiceNumber: string | null;
}

export interface PaymentPdfData {
  /** US-SET-19 — the signature image, when this document type shows it. */
  signatureDataUri?: string;
  /** US-SET-17 (D-152) — Settings › Documents: paper size, title… */
  layout?: ResolvedDocumentLayout;
  /** US-SET-10 — document colour and footer from Settings › Branding. */
  branding?: DocumentBranding;
  /** US-OPS-24 — the organisation's locale for money (Settings › Currency & locale). */
  locale?: string;
  payment: typeof payments.$inferSelect;
  contactName: string | null;
  contactEmail: string | null;
  allocations: PaymentPdfAllocationRow[];
  business: PaymentPdfBusinessProfile | null;
  /** See quote-pdf.template.tsx's identical field for the full reasoning. */
  logoDataUri?: string;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  upi: "UPI",
  other: "Other",
};

// Styles are a near-exact copy of invoice-pdf.template.tsx's own StyleSheet
// — kept as a separate literal for the same reason that one gives for
// copying quote-pdf.template.tsx's: the two document types' visual layout
// can diverge independently later without a shared-styles change quietly
// touching every document type at once.
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
  table: { marginTop: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0" },
  colInvoice: { flex: 3 },
  colAmount: { flex: 1.4, textAlign: "right" },
  thText: { fontSize: 8, color: "#888888", textTransform: "uppercase", letterSpacing: 0.5 },
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
  creditRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6 },
  creditLabel: { fontSize: 10, fontWeight: 700, color: "#0f766e" },
  creditValue: { fontSize: 10, fontWeight: 700, color: "#0f766e" },
  footer: { marginTop: 28 },
  footerText: { fontSize: 9, color: "#333333", lineHeight: 1.4 },
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
 * Renders a payment receipt (S-06.6) purely from its own stored `payments`/
 * `payment_allocations` rows — same "read straight from the DB, one code
 * path for every caller" design as InvoicePdfDocument/QuotePdfDocument.
 * Unlike invoices/quotes, a payment has no line items of its own to
 * snapshot — the "table" here lists which invoices the payment was applied
 * to (if any), not catalogue lines, since that's the information a
 * recipient actually needs from a receipt.
 */
export function PaymentPdfDocument({ payment, contactName, contactEmail, allocations, business, logoDataUri, locale, branding, signatureDataUri, layout: givenLayout }: PaymentPdfData) {
  const layout = givenLayout ?? resolveDocumentLayout(null, "receipt");
  const brand = branding ?? DEFAULT_DOCUMENT_BRANDING;
  const currency = payment.currency;
  const fmt = (amount: bigint) => formatMoneyForPdf(amount, currency, locale);
  const unallocated = payment.amount - payment.allocatedAmount;

  return (
    <Document title={payment.number ?? "Receipt"} author={business?.name ?? "Spine"}>
      <Page size={layout.paperSize} style={[styles.page, pagePaddingFor(brand)]}>
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
            <Text style={styles.docNumber}>{payment.number ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Received from</Text>
            <Text style={styles.contactName}>{contactName ?? "—"}</Text>
            {contactEmail && <Text style={styles.businessMeta}>{contactEmail}</Text>}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Date received</Text>
            <Text style={styles.lineName}>{formatDate(payment.date)}</Text>
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Method</Text>
            <Text style={styles.lineName}>
              {METHOD_LABELS[payment.method] ?? payment.method}
              {payment.reference ? ` — ${payment.reference}` : ""}
            </Text>
          </View>
        </View>

        {allocations.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.colInvoice, styles.thText]}>Applied to</Text>
              <Text style={[styles.colAmount, styles.thText]}>Amount</Text>
            </View>
            {allocations.map(({ allocation, invoiceNumber }) => (
              <View key={allocation.id} style={styles.tableRow}>
                <Text style={styles.colInvoice}>{invoiceNumber ?? "—"}</Text>
                <Text style={styles.colAmount}>{fmt(allocation.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.totalsBlock}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Amount received</Text>
            <Text style={[styles.grandTotalValue, { color: brand.color }]}>{fmt(payment.amount)}</Text>
          </View>
          {unallocated > 0n && (
            <View style={styles.creditRow}>
              <Text style={styles.creditLabel}>Held as credit</Text>
              <Text style={styles.creditValue}>{fmt(unallocated)}</Text>
            </View>
          )}
        </View>

        {payment.notes && (
          <View style={styles.footer}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.footerText}>{payment.notes}</Text>
          </View>
        )}

        <LayoutTextBlocks notes={layout.notes} terms={layout.terms} />

        {signatureDataUri && <SignatureBlock src={signatureDataUri} businessName={business?.name ?? "Your business"} />}

        <DocumentFooterLine footer={brand.footer} />
        <Text
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }) => `${payment.number ?? "Receipt"} · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
