import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoneyForPdf } from "../../common/money-format";
import { PDF_FONT_FAMILY } from "../pdf/pdf-fonts";

export interface RemittancePdfData {
  business: { name: string; address?: string; email?: string; taxId?: string };
  vendor: { name: string; taxId?: string | null; email?: string | null };
  payment: { number: string; date: string; method: string; reference: string | null; account: string | null; amount: bigint; currency: string };
  bills: { number: string; date: string | null; total: bigint; paid: bigint; stillOwed: bigint }[];
  locale: string;
}

// PDFs are always light (UI rules); same fonts as the other documents.
const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 10, fontFamily: PDF_FONT_FAMILY, color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: "#1f3a8a", marginBottom: 20 },
  businessName: { fontSize: 13, fontWeight: 700 },
  meta: { fontSize: 9, color: "#555555", marginTop: 2 },
  title: { fontSize: 16, fontWeight: 700, color: "#1f3a8a", textAlign: "right" },
  titleMeta: { fontSize: 9, color: "#555555", marginTop: 4, textAlign: "right" },
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  label: { fontSize: 8, color: "#6b6b6b", marginBottom: 3, textTransform: "uppercase" },
  vendor: { fontSize: 11, fontWeight: 700 },
  kv: { flexDirection: "row", marginBottom: 2 },
  kvKey: { width: 84, fontSize: 9, color: "#6b6b6b" },
  kvValue: { fontSize: 9 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999999", paddingBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0" },
  th: { fontSize: 8, fontWeight: 700, color: "#555555" },
  colRef: { flex: 1 },
  colDate: { width: 80 },
  colMoney: { width: 84, textAlign: "right" },
  total: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: "#1a1a1a", paddingTop: 6, marginTop: 2 },
  totalText: { fontSize: 11, fontWeight: 700 },
  note: { marginTop: 22, fontSize: 9, color: "#444444" },
  footer: { position: "absolute", left: 44, right: 44, bottom: 30, fontSize: 8, color: "#777777", borderTopWidth: 0.5, borderTopColor: "#e0e0e0", paddingTop: 8 },
});

/**
 * US-PUR-54 (D-229) — a remittance advice: what one vendor payment paid,
 * bill by bill, so the vendor can match it. Generated when asked for;
 * never stored or numbered.
 */
export function RemittancePdfDocument(data: RemittancePdfData) {
  const money = (v: bigint) => formatMoneyForPdf(v, data.payment.currency, data.locale);
  const date = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(data.locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");
  const { business, vendor, payment } = data;
  return (
    <Document title={`Remittance advice ${payment.number}`} author={business.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={{ maxWidth: 300 }}>
            <Text style={styles.businessName}>{business.name}</Text>
            {business.address ? <Text style={styles.meta}>{business.address}</Text> : null}
            {business.taxId || business.email ? <Text style={styles.meta}>{[business.taxId, business.email].filter(Boolean).join(" · ")}</Text> : null}
          </View>
          <View>
            <Text style={styles.title}>REMITTANCE ADVICE</Text>
            <Text style={styles.titleMeta}>
              {payment.number} · {date(payment.date)}
            </Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={{ maxWidth: 240 }}>
            <Text style={styles.label}>Paid to</Text>
            <Text style={styles.vendor}>{vendor.name}</Text>
            {vendor.taxId ? <Text style={styles.meta}>{vendor.taxId}</Text> : null}
            {vendor.email ? <Text style={styles.meta}>{vendor.email}</Text> : null}
          </View>
          <View>
            {[
              ["Payment date", date(payment.date)],
              ["Method", payment.method],
              ["Reference", payment.reference ?? "—"],
              ...(payment.account ? [["From", payment.account]] : []),
              ["Amount", money(payment.amount)],
            ].map(([k, v]) => (
              <View key={k} style={styles.kv}>
                <Text style={styles.kvKey}>{k}</Text>
                <Text style={styles.kvValue}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colRef]}>Your invoice</Text>
          <Text style={[styles.th, styles.colDate]}>Invoice date</Text>
          <Text style={[styles.th, styles.colMoney]}>Invoice total</Text>
          <Text style={[styles.th, styles.colMoney]}>Paid now</Text>
          <Text style={[styles.th, styles.colMoney]}>Still owed</Text>
        </View>
        {data.bills.map((b) => (
          <View key={b.number} style={styles.row} wrap={false}>
            <Text style={styles.colRef}>{b.number}</Text>
            <Text style={styles.colDate}>{date(b.date)}</Text>
            <Text style={styles.colMoney}>{money(b.total)}</Text>
            <Text style={styles.colMoney}>{money(b.paid)}</Text>
            <Text style={styles.colMoney}>{money(b.stillOwed)}</Text>
          </View>
        ))}
        <View style={styles.total}>
          <Text style={[styles.totalText, { flex: 1 }]}>Total paid</Text>
          <Text style={[styles.totalText, styles.colMoney]}>{money(payment.amount)}</Text>
          <Text style={styles.colMoney}> </Text>
        </View>

        <Text style={styles.note}>
          Questions about this payment? {business.email ? `Write to ${business.email} and quote ${payment.number}.` : `Quote ${payment.number}.`}
        </Text>
        <Text style={styles.footer} fixed>
          {business.name} · This advice lists what we paid on {date(payment.date)}; it is not a tax invoice.
        </Text>
      </Page>
    </Document>
  );
}
