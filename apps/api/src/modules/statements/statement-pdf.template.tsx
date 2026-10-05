import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { Statement } from "@spine/shared";
import { formatMoneyForPdf } from "../../common/money-format";
import { DEFAULT_DOCUMENT_BRANDING, DocumentAccentBar, DocumentFooterLine, pagePaddingFor, type DocumentBranding } from "../pdf/document-branding";

export interface StatementPdfBusiness {
  name: string;
  address?: string;
  paymentInstructions?: string;
}

export interface StatementPdfData {
  statement: Statement;
  business: StatementPdfBusiness | null;
  logoDataUri?: string;
  locale?: string;
  branding?: DocumentBranding;
}

// Same fonts and colours as the invoice PDF (PDFs are always light).
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 14, borderBottomWidth: 2, marginBottom: 18 },
  businessBlock: { flexDirection: "row", alignItems: "center" },
  logo: { width: 32, height: 32, objectFit: "contain", marginRight: 8 },
  initials: { width: 32, height: 32, borderRadius: 6, backgroundColor: "#211F1A", color: "#FFFFFF", fontSize: 10, fontWeight: 700, textAlign: "center", paddingTop: 10, marginRight: 8 },
  businessName: { fontSize: 12, fontWeight: 700 },
  businessMeta: { fontSize: 9, color: "#555555", marginTop: 2 },
  titleBlock: { alignItems: "flex-end" },
  title: { fontSize: 18, fontWeight: 700 },
  period: { fontSize: 9, color: "#555555", marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  label: { fontSize: 9, color: "#555555", marginBottom: 2 },
  customer: { fontSize: 10, fontWeight: 700 },
  balanceLabel: { fontSize: 9, color: "#555555", textAlign: "right" },
  balance: { fontSize: 18, fontWeight: 700, textAlign: "right" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333333", paddingBottom: 4, paddingHorizontal: 4 },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0" },
  th: { fontSize: 8, fontWeight: 700 },
  colDate: { width: 60 },
  colRef: { width: 80 },
  colType: { flex: 1 },
  colMoney: { width: 80, textAlign: "right" },
});

function shortDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Jul 6 – Oct 4, 2026" */
export function statementPeriodLabel(from: string, to: string): string {
  const end = new Date(`${to}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const start = new Date(`${from}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
  return `${start} – ${end}`;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "S"
  );
}

/**
 * US-PAY-14/15 — the statement PDF (`StatementPdf`): the business,
 * "STATEMENT" and the period, "Statement for <customer>" with the balance
 * due, and every charge and payment with a running balance.
 */
export function StatementPdfDocument({ statement, business, logoDataUri, locale, branding }: StatementPdfData) {
  const brand = branding ?? DEFAULT_DOCUMENT_BRANDING;
  const fmt = (amount: string) => formatMoneyForPdf(BigInt(amount), statement.currency, locale);
  const money = (amount: string) => (amount === "0" ? "" : fmt(amount));
  const businessName = business?.name ?? "Your business";

  return (
    <Document title={`Statement — ${statement.contactName}`} author={businessName}>
      <Page size="A4" style={[styles.page, pagePaddingFor(brand)]}>
        <DocumentAccentBar color={brand.color} />
        <View style={[styles.header, { borderBottomColor: brand.color }]}>
          <View style={styles.businessBlock}>
            {logoDataUri ? <Image src={logoDataUri} style={styles.logo} /> : <Text style={styles.initials}>{initials(businessName)}</Text>}
            <View>
              <Text style={styles.businessName}>{businessName}</Text>
              {business?.address && <Text style={styles.businessMeta}>{business.address}</Text>}
            </View>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>STATEMENT</Text>
            <Text style={styles.period}>{statementPeriodLabel(statement.from, statement.to)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.label}>Statement for</Text>
            <Text style={styles.customer}>{statement.contactName}</Text>
            {statement.contactAddress && <Text>{statement.contactAddress}</Text>}
          </View>
          <View>
            <Text style={styles.balanceLabel}>Balance due</Text>
            <Text style={styles.balance}>{fmt(statement.balanceDue)}</Text>
          </View>
        </View>

        <View style={styles.tableHeader} fixed>
          <Text style={[styles.th, styles.colDate]}>Date</Text>
          <Text style={[styles.th, styles.colRef]}>Reference</Text>
          <Text style={[styles.th, styles.colType]}>Type</Text>
          <Text style={[styles.th, styles.colMoney]}>Charges</Text>
          <Text style={[styles.th, styles.colMoney]}>Payments</Text>
          <Text style={[styles.th, styles.colMoney]}>Balance</Text>
        </View>
        {statement.mode === "all" && (
          <View style={styles.row} wrap={false}>
            <Text style={[styles.colDate, { width: 140 }]}>Opening balance</Text>
            <Text style={styles.colType} />
            <Text style={styles.colMoney} />
            <Text style={styles.colMoney} />
            <Text style={styles.colMoney}>{fmt(statement.openingBalance)}</Text>
          </View>
        )}
        {statement.rows.map((row, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.colDate}>{shortDate(row.date)}</Text>
            <Text style={styles.colRef}>{row.reference ?? "—"}</Text>
            <Text style={styles.colType}>{row.type}</Text>
            <Text style={styles.colMoney}>{money(row.charges)}</Text>
            <Text style={styles.colMoney}>{money(row.payments)}</Text>
            <Text style={styles.colMoney}>{fmt(row.balance)}</Text>
          </View>
        ))}

        <DocumentFooterLine footer={brand.footer} />
      </Page>
    </Document>
  );
}
