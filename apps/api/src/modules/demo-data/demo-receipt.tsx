import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatMoney } from "@spine/shared";
import { PDF_FONT_FAMILY, registerPdfFonts } from "../pdf/pdf-fonts";

/** What a demo receipt prints — the expense it belongs to, as the shop would have printed it. */
export interface DemoReceipt {
  merchant: string;
  place: string;
  date: Date;
  description: string;
  amount: bigint;
  tax: bigint;
  currency: string;
  locale: string;
  paidWith: string;
}

const styles = StyleSheet.create({
  page: { paddingVertical: 18, paddingHorizontal: 16, fontFamily: PDF_FONT_FAMILY, fontSize: 8.5, color: "#2b2b2b", backgroundColor: "#fbfaf6" },
  merchant: { fontSize: 11, fontWeight: 700, textAlign: "center", letterSpacing: 0.6 },
  centre: { textAlign: "center", color: "#6b6b6b", marginTop: 2 },
  rule: { borderBottomWidth: 0.75, borderBottomColor: "#b8b8b8", borderStyle: "dashed", marginVertical: 7 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  total: { flexDirection: "row", justifyContent: "space-between", marginTop: 2, fontWeight: 700, fontSize: 10 },
});

/**
 * US-ONB-31 — a receipt for a demo expense, so its page has something to
 * preview: the merchant, the day, what was bought, the tax inside the
 * amount and the total, in the demo's currency. A narrow till-roll page
 * (80 mm); PDFs and receipts stay light (UI rules).
 */
export async function renderDemoReceipt(receipt: DemoReceipt): Promise<Buffer> {
  registerPdfFonts();
  const money = (v: bigint) => formatMoney(v, receipt.currency, receipt.locale);
  const day = receipt.date.toLocaleDateString(receipt.locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  return renderToBuffer(
    <Document title={`Receipt — ${receipt.merchant}`} author={receipt.merchant}>
      <Page size={[226, 340]} style={styles.page}>
        <Text style={styles.merchant}>{receipt.merchant.toUpperCase()}</Text>
        <Text style={styles.centre}>{receipt.place}</Text>
        <View style={styles.rule} />
        <View style={styles.row}>
          <Text>{day}</Text>
          <Text>Receipt</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ maxWidth: 140 }}>{receipt.description}</Text>
          <Text>{money(receipt.amount - receipt.tax)}</Text>
        </View>
        {receipt.tax > 0n && (
          <View style={styles.row}>
            <Text>Tax included</Text>
            <Text>{money(receipt.tax)}</Text>
          </View>
        )}
        <View style={styles.rule} />
        <View style={styles.total}>
          <Text>TOTAL</Text>
          <Text>{money(receipt.amount)}</Text>
        </View>
        <View style={styles.row}>
          <Text>{receipt.paidWith}</Text>
          <Text>{money(receipt.amount)}</Text>
        </View>
        <View style={styles.rule} />
        <Text style={styles.centre}>Thank you — keep this receipt</Text>
      </Page>
    </Document>,
  );
}
