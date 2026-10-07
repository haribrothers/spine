import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { creditNotes, creditNoteLines } from "../../db/schema";
import { formatMoneyForPdf } from "../../common/money-format";
import { DEFAULT_DOCUMENT_BRANDING, DocumentAccentBar, DocumentFooterLine, pagePaddingFor, type DocumentBranding } from "./document-branding";
import type { InvoicePdfBusinessProfile } from "./invoice-pdf.template";
import { PDF_FONT_FAMILY } from "./pdf-fonts";

export interface CreditNotePdfData {
  /** US-SET-10 — document colour and footer from Settings › Branding. */
  branding?: DocumentBranding;
  /** US-OPS-24 — the organisation's locale for money (Settings › Currency & locale). */
  locale?: string;
  creditNote: typeof creditNotes.$inferSelect;
  lines: (typeof creditNoteLines.$inferSelect)[];
  invoiceNumber: string | null;
  contactName: string | null;
  contactEmail: string | null;
  business: InvoicePdfBusinessProfile | null;
  logoDataUri?: string;
}

// A copy of invoice-pdf.template.tsx's StyleSheet, kept separate for the
// same reason that file gives: each document's layout can change on its own.
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
  table: { marginTop: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0" },
  headingRow: { paddingTop: 10, paddingBottom: 2 },
  colName: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.4, textAlign: "right" },
  colTax: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1.4, textAlign: "right" },
  thText: { fontSize: 8, color: "#888888", textTransform: "uppercase", letterSpacing: 0.5 },
  lineName: { fontSize: 10 },
  lineNameHeading: { fontSize: 10, fontWeight: 700 },
  lineDescription: { fontSize: 8.5, color: "#666666", marginTop: 1 },
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
 * US-INV-17 (D-116) — a credit note as a PDF, laid out like the invoice it
 * credits: "CREDIT NOTE" with its number, who it's credited to, the invoice
 * it's against, the reason, the lines and the total credited. Rendered
 * from the credit note's own snapshot only.
 */
export function CreditNotePdfDocument({ creditNote, lines, invoiceNumber, contactName, contactEmail, business, logoDataUri, locale, branding }: CreditNotePdfData) {
  const brand = branding ?? DEFAULT_DOCUMENT_BRANDING;
  const currency = creditNote.currency;
  const fmt = (amount: bigint | string) => formatMoneyForPdf(amount, currency, locale);

  return (
    <Document title={creditNote.number ?? "Credit note"} author={business?.name ?? "Spine"}>
      <Page size="A4" style={[styles.page, pagePaddingFor(brand)]}>
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
            <Text style={[styles.docTitle, { color: brand.color }]}>CREDIT NOTE</Text>
            <Text style={styles.docNumber}>{creditNote.number ?? "DRAFT"}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Credited to</Text>
            <Text style={styles.contactName}>{contactName ?? "—"}</Text>
            {contactEmail && <Text style={styles.businessMeta}>{contactEmail}</Text>}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Date</Text>
            <Text style={styles.lineName}>{formatDate(creditNote.issuedAt ?? creditNote.date ?? creditNote.createdAt)}</Text>
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Against invoice</Text>
            <Text style={styles.lineName}>{invoiceNumber ?? "—"}</Text>
          </View>
        </View>

        {creditNote.reason && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Reason</Text>
            <Text style={styles.lineName}>{creditNote.reason}</Text>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colName, styles.thText]}>Description</Text>
            <Text style={[styles.colQty, styles.thText]}>Qty</Text>
            <Text style={[styles.colPrice, styles.thText]}>Unit price</Text>
            <Text style={[styles.colTax, styles.thText]}>Tax</Text>
            <Text style={[styles.colTotal, styles.thText]}>Total</Text>
          </View>
          {lines.map((line) => (
            <View key={line.id} style={styles.tableRow}>
              <View style={styles.colName}>
                <Text style={styles.lineName}>{line.name}</Text>
                {line.description && <Text style={styles.lineDescription}>{line.description}</Text>}
              </View>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colPrice}>{fmt(line.unitPriceAmount)}</Text>
              <Text style={styles.colTax}>{line.taxRatePercentage > 0 ? `${line.taxRatePercentage}%` : "—"}</Text>
              <Text style={styles.colTotal}>{fmt(line.lineTotalAmount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{fmt(creditNote.subtotalAmount)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax</Text>
            <Text style={styles.totalsValue}>{fmt(creditNote.taxAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total credited</Text>
            <Text style={[styles.grandTotalValue, { color: brand.color }]}>{fmt(creditNote.totalAmount)}</Text>
          </View>
        </View>

        <DocumentFooterLine footer={brand.footer} />
        <Text
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }) => `${creditNote.number ?? "Draft credit note"} · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
