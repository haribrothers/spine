import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { minorUnitExponent } from "@spine/shared";
import type { ReportCell, ReportColumnKind, ReportDocument } from "./report-document";

/**
 * US-RPT-33 (D-144, D-100) — one PDF template for every report: logo,
 * business name, report name and range or date at the top; the table; and
 * a footer on every page with the basis, "Prepared <date>" and page
 * numbers. Always light. Landscape when a report has more than five
 * amount columns. Helvetica until Phase 9's fonts (D-151).
 */
const INK = "#1a1a1a";
const MUTED = "#555555";
const RULE = "#d4d4d4";

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 9, color: INK, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 12 },
  logo: { maxHeight: 40, maxWidth: 120, objectFit: "contain" },
  business: { fontSize: 10, color: MUTED },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 2 },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 2 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 4, marginBottom: 2 },
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: RULE },
  headingRow: { flexDirection: "row", paddingTop: 8, paddingBottom: 3 },
  grandRow: { flexDirection: "row", paddingVertical: 4, borderTopWidth: 1, borderTopColor: INK, marginTop: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
  cell: { paddingRight: 6 },
  note: { fontSize: 8, color: MUTED, marginTop: 10 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
});

const AMOUNT_KINDS: ReportColumnKind[] = ["money", "number", "percent"];

/** More than five amount columns → landscape (D-144). */
export function isLandscape(doc: ReportDocument): boolean {
  return doc.columns.filter((c) => AMOUNT_KINDS.includes(c.kind)).length > 5;
}

function formatCell(cell: ReportCell, kind: ReportColumnKind, currency: string, locale: string): string {
  if (cell === null || cell === "") return "";
  if (kind === "money") {
    const places = minorUnitExponent(currency);
    const value = Number(BigInt(cell)) / 10 ** places;
    // A true minus sign, as on screen (D-151).
    return new Intl.NumberFormat(locale, { minimumFractionDigits: places, maximumFractionDigits: places }).format(value).replace("-", "−");
  }
  if (kind === "percent") return `${String(cell).replace("-", "−")}%`;
  if (kind === "number") return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(cell));
  return String(cell);
}

export function ReportPdfDocument({ doc, business, logoDataUri, locale, prepared }: { doc: ReportDocument; business: string; logoDataUri?: string; locale: string; prepared: string }) {
  const flexOf = (kind: ReportColumnKind) => (kind === "text" ? 2.4 : 1);
  const align = (kind: ReportColumnKind) => (kind === "text" ? "left" : "right");
  return (
    <Document title={`${doc.title} — ${business}`} author={business} creator="Spine">
      <Page size="A4" orientation={isLandscape(doc) ? "landscape" : "portrait"} style={styles.page} wrap>
        <View style={styles.header}>
          {logoDataUri ? <Image src={logoDataUri} style={styles.logo} /> : null}
          <View>
            <Text style={styles.business}>{business}</Text>
            <Text style={styles.title}>{doc.title}</Text>
            <Text style={styles.subtitle}>
              {doc.subtitle} · Amounts in {doc.currency}
            </Text>
          </View>
        </View>

        <View style={styles.headRow}>
          {doc.columns.map((c, i) => (
            <Text key={i} style={[styles.cell, styles.bold, { flex: flexOf(c.kind), textAlign: align(c.kind) }]}>
              {c.header}
            </Text>
          ))}
        </View>
        {doc.rows.map((r, ri) => (
          <View key={ri} style={r.style === "heading" ? styles.headingRow : r.style === "grand" ? styles.grandRow : styles.row} wrap={false}>
            {doc.columns.map((c, i) => (
              <Text key={i} style={[styles.cell, r.style ? styles.bold : {}, { flex: flexOf(c.kind), textAlign: align(c.kind) }]}>
                {r.style === "heading" ? (i === 0 ? String(r.cells[0] ?? "") : "") : formatCell(r.cells[i] ?? null, c.kind, doc.currency, locale)}
              </Text>
            ))}
          </View>
        ))}
        {doc.notes?.map((n, i) => (
          <Text key={i} style={styles.note}>
            {n}
          </Text>
        ))}

        <View style={styles.footer} fixed>
          <Text>
            {business}
            {doc.basis ? ` · ${doc.basis}` : ""} · Prepared {prepared}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
