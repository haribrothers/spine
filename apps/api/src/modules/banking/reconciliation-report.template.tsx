import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoneyForPdf } from "../../common/money-format";
import { PDF_FONT_FAMILY } from "../pdf/pdf-fonts";

export interface ReconciliationReportData {
  business: { name: string; address?: string; taxId?: string };
  account: { name: string; last4: string | null };
  endDate: string;
  currency: string;
  locale: string;
  statementClosing: bigint;
  depositsOutstanding: bigint;
  paymentsOutstanding: bigint;
  excluded: bigint;
  spineBalance: bigint;
  opening: bigint;
  matchedCount: number;
  excludedCount: number;
  finished: { by: string | null; at: string | null };
  outstanding: { date: string; what: string; contact: string | null; amount: bigint }[];
  matched: { date: string; line: string; matchedTo: string; amount: bigint }[];
  excludedLines: { date: string; line: string; note: string | null; amount: bigint }[];
  generatedOn: string;
}

// PDFs are always light (UI rules); same fonts and header as the remittance advice.
const styles = StyleSheet.create({
  page: { padding: 44, paddingBottom: 60, fontSize: 9.5, fontFamily: PDF_FONT_FAMILY, color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: "#1f3a8a", marginBottom: 18 },
  businessName: { fontSize: 13, fontWeight: 700 },
  meta: { fontSize: 9, color: "#555555", marginTop: 2 },
  title: { fontSize: 15, fontWeight: 700, color: "#1f3a8a", textAlign: "right" },
  titleMeta: { fontSize: 9, color: "#555555", marginTop: 3, textAlign: "right" },
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  label: { fontSize: 8, color: "#6b6b6b", marginBottom: 4, textTransform: "uppercase" },
  kv: { flexDirection: "row", marginBottom: 3 },
  kvKey: { width: 170, fontSize: 9, color: "#6b6b6b" },
  kvKeyNarrow: { width: 90, fontSize: 9, color: "#6b6b6b" },
  kvValue: { fontSize: 9, textAlign: "right", width: 90 },
  bold: { fontWeight: 700 },
  section: { fontSize: 8, fontWeight: 700, color: "#555555", textTransform: "uppercase", marginTop: 14, marginBottom: 4 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999999", paddingBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0" },
  th: { fontSize: 8, fontWeight: 700, color: "#555555" },
  colDate: { width: 70 },
  colMain: { flex: 1, paddingRight: 8 },
  colMoney: { width: 90, textAlign: "right" },
  empty: { fontSize: 9, color: "#6b6b6b", paddingVertical: 5 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 28, fontSize: 8, color: "#777777", borderTopWidth: 0.5, borderTopColor: "#e0e0e0", paddingTop: 8 },
});

/**
 * US-BANK-17 (D-231) — a finished reconciliation for the accountant: how
 * the statement and the books agree, what's outstanding, and every matched
 * and excluded line. Generated when asked for; never stored.
 */
export function ReconciliationReportDocument(data: ReconciliationReportData) {
  const money = (v: bigint) => formatMoneyForPdf(v, data.currency, data.locale);
  const signed = (v: bigint) => (v > 0n ? `+${money(v)}` : money(v));
  const date = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(data.locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");
  const kv = (k: string, v: string, bold = false) => (
    <View key={k} style={styles.kv}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvValue, bold ? styles.bold : {}]}>{v}</Text>
    </View>
  );
  const accountLine = [data.account.name, data.account.last4 ? `••${data.account.last4}` : null].filter(Boolean).join(" · ");
  return (
    <Document title={`Reconciliation report — ${data.account.name} to ${data.endDate}`} author={data.business.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={{ maxWidth: 280 }}>
            <Text style={styles.businessName}>{data.business.name}</Text>
            {data.business.address ? <Text style={styles.meta}>{data.business.address}</Text> : null}
            {data.business.taxId ? <Text style={styles.meta}>{data.business.taxId}</Text> : null}
          </View>
          <View>
            <Text style={styles.title}>RECONCILIATION REPORT</Text>
            <Text style={styles.titleMeta}>{accountLine}</Text>
            <Text style={styles.titleMeta}>Statement to {date(data.endDate)}</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View>
            <Text style={styles.label}>Summary</Text>
            {kv("Statement closing balance", money(data.statementClosing))}
            {kv("Deposits not yet on the statement", `+ ${money(data.depositsOutstanding)}`)}
            {kv("Payments not yet on the statement", `− ${money(data.paymentsOutstanding)}`)}
            {data.excluded !== 0n ? kv("Statement lines excluded from the books", `− ${money(data.excluded)}`) : null}
            {kv(`Balance in Spine on ${date(data.endDate)}`, money(data.spineBalance), true)}
          </View>
          <View>
            <Text style={styles.label}>Reconciled</Text>
            {[
              ["Opening balance", money(data.opening)],
              ["Lines matched", String(data.matchedCount)],
              ["Lines excluded", String(data.excludedCount)],
              ["Finished", [data.finished.at ? date(data.finished.at) : null, data.finished.by ? `by ${data.finished.by}` : null].filter(Boolean).join(" ") || "—"],
            ].map(([k, v]) => (
              <View key={k} style={styles.kv}>
                <Text style={styles.kvKeyNarrow}>{k}</Text>
                <Text style={{ fontSize: 9, maxWidth: 140 }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.section}>Not yet on the statement</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDate]}>Date</Text>
          <Text style={[styles.th, styles.colMain]}>Entry</Text>
          <Text style={[styles.th, styles.colMain]}>Contact</Text>
          <Text style={[styles.th, styles.colMoney]}>Amount</Text>
        </View>
        {data.outstanding.length === 0 ? <Text style={styles.empty}>Nothing — every entry up to the end date is on the statement.</Text> : null}
        {data.outstanding.map((o, i) => (
          <View key={`o${i}`} style={styles.row} wrap={false}>
            <Text style={styles.colDate}>{date(o.date)}</Text>
            <Text style={styles.colMain}>{o.what}</Text>
            <Text style={styles.colMain}>{o.contact ?? "—"}</Text>
            <Text style={styles.colMoney}>{signed(o.amount)}</Text>
          </View>
        ))}

        <Text style={styles.section}>Matched lines</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDate]}>Date</Text>
          <Text style={[styles.th, styles.colMain]}>Statement line</Text>
          <Text style={[styles.th, styles.colMain]}>Matched to</Text>
          <Text style={[styles.th, styles.colMoney]}>Amount</Text>
        </View>
        {data.matched.map((m, i) => (
          <View key={`m${i}`} style={styles.row} wrap={false}>
            <Text style={styles.colDate}>{date(m.date)}</Text>
            <Text style={styles.colMain}>{m.line}</Text>
            <Text style={styles.colMain}>{m.matchedTo}</Text>
            <Text style={styles.colMoney}>{signed(m.amount)}</Text>
          </View>
        ))}

        {data.excludedLines.length ? <Text style={styles.section}>Excluded</Text> : null}
        {data.excludedLines.map((x, i) => (
          <View key={`x${i}`} style={styles.row} wrap={false}>
            <Text style={styles.colDate}>{date(x.date)}</Text>
            <Text style={styles.colMain}>{x.line}</Text>
            <Text style={styles.colMain}>{x.note ?? "—"}</Text>
            <Text style={styles.colMoney}>{signed(x.amount)}</Text>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          {data.business.name} · Generated from Spine on {date(data.generatedOn)}.
        </Text>
      </Page>
    </Document>
  );
}
