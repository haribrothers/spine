import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type { DocumentColumns } from "@spine/shared";

/** A quote, invoice or credit-note line as the PDF prints it. */
export interface PdfLine {
  id: string;
  type: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: bigint;
  /** Credit notes have none. */
  discountPercentage?: number;
  taxRatePercentage: number;
  lineTotalAmount: bigint;
  hsnSac?: string | null;
}

const styles = StyleSheet.create({
  table: { marginBottom: 16 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dddddd", paddingBottom: 6, marginBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  headingRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  th: { fontSize: 8, color: "#888888", textTransform: "uppercase", letterSpacing: 0.5 },
  name: { flex: 4 },
  hsn: { flex: 1.2 },
  qty: { flex: 0.8, textAlign: "right" },
  price: { flex: 1.4, textAlign: "right" },
  discount: { flex: 0.9, textAlign: "right" },
  tax: { flex: 0.9, textAlign: "right" },
  total: { flex: 1.4, textAlign: "right" },
  lineName: { fontSize: 10 },
  lineHeading: { fontSize: 11, fontWeight: 700 },
  lineDescription: { fontSize: 8.5, color: "#666666", marginTop: 2 },
});

/**
 * The unit price after the line's discount, rounded half-up once — what a
 * line prints when the Discount column is hidden (US-SET-17: "Hidden
 * columns don't change any amounts").
 */
export function discountedUnitPrice(unitPrice: bigint, discountPercentage: number): bigint {
  if (!discountPercentage) return unitPrice;
  const keep = 10000n - BigInt(Math.round(discountPercentage * 100));
  const scaled = unitPrice * keep;
  const half = scaled >= 0n ? 5000n : -5000n;
  return (scaled + half) / 10000n;
}

/**
 * US-SET-17 (D-152) — the lines table, with the columns Settings ›
 * Documents shows. Hidden columns only change what prints, never an amount.
 */
export function DocumentLinesTable({
  lines,
  columns,
  fmt,
  showHsn = false,
  showDiscount = true,
}: {
  lines: readonly PdfLine[];
  columns: DocumentColumns;
  fmt: (amount: bigint) => string;
  /** GST is on: HSN/SAC may show. */
  showHsn?: boolean;
  /** False for documents without discounts (credit notes). */
  showDiscount?: boolean;
}) {
  const hsn = showHsn && columns.hsnSac;
  const discount = showDiscount && columns.discount;
  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        <Text style={[styles.name, styles.th]}>Description</Text>
        {hsn && <Text style={[styles.hsn, styles.th]}>HSN/SAC</Text>}
        {columns.quantity && <Text style={[styles.qty, styles.th]}>Qty</Text>}
        {columns.quantity && <Text style={[styles.price, styles.th]}>Unit price</Text>}
        {discount && <Text style={[styles.discount, styles.th]}>Disc.</Text>}
        {columns.lineTax && <Text style={[styles.tax, styles.th]}>Tax</Text>}
        <Text style={[styles.total, styles.th]}>Amount</Text>
      </View>
      {lines.map((line) => {
        if (line.type !== "item") {
          return (
            <View key={line.id} style={styles.headingRow} wrap={false}>
              <Text style={styles.lineHeading}>{line.name}</Text>
              {line.description && <Text style={styles.lineDescription}>{line.description}</Text>}
            </View>
          );
        }
        const pct = line.discountPercentage ?? 0;
        const price = discount ? line.unitPriceAmount : discountedUnitPrice(line.unitPriceAmount, pct);
        return (
          <View key={line.id} style={styles.row} wrap={false}>
            <View style={styles.name}>
              <Text style={styles.lineName}>{line.name}</Text>
              {line.description && <Text style={styles.lineDescription}>{line.description}</Text>}
            </View>
            {hsn && <Text style={styles.hsn}>{line.hsnSac ?? "—"}</Text>}
            {columns.quantity && <Text style={styles.qty}>{line.quantity}</Text>}
            {columns.quantity && <Text style={styles.price}>{fmt(price)}</Text>}
            {discount && <Text style={styles.discount}>{pct > 0 ? `${pct}%` : "—"}</Text>}
            {columns.lineTax && <Text style={styles.tax}>{line.taxRatePercentage > 0 ? `${line.taxRatePercentage}%` : "—"}</Text>}
            <Text style={styles.total}>{fmt(line.lineTotalAmount)}</Text>
          </View>
        );
      })}
    </View>
  );
}
