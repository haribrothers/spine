import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { TAX_TYPE_LABELS, type DocumentColumns, type TaxComponent, type TaxType } from "@spine/shared";

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
  lineTaxAmount?: bigint;
  hsnSac?: string | null;
}

const GST_ORDER: TaxType[] = ["cgst", "sgst", "utgst", "igst", "cess"];

/** The tax types a GST document's lines carry, in print order, with the rate when every line has the same one. */
export function gstColumns(lineTaxes: Record<string, TaxComponent[]>): { type: TaxType; label: string; uniform: boolean }[] {
  const all = Object.values(lineTaxes).flat();
  return GST_ORDER.filter((t) => all.some((c) => c.taxType === t)).map((type) => {
    const rates = new Set(all.filter((c) => c.taxType === type).map((c) => c.rate));
    const uniform = rates.size === 1;
    return { type, uniform, label: uniform ? `${TAX_TYPE_LABELS[type]} ${[...rates][0]}%` : TAX_TYPE_LABELS[type] };
  });
}

/** A line's taxable value: what it's worth before tax. */
export const taxableValue = (line: Pick<PdfLine, "lineTotalAmount" | "lineTaxAmount">) => line.lineTotalAmount - (line.lineTaxAmount ?? 0n);

const styles = StyleSheet.create({
  table: { marginBottom: 16 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dddddd", paddingBottom: 6, marginBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  headingRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  th: { fontSize: 8, color: "#888888", textTransform: "uppercase", letterSpacing: 0.5 },
  name: { flex: 4 },
  hsn: { flex: 1.2, paddingLeft: 4 },
  qty: { flex: 0.8, textAlign: "right", paddingLeft: 4 },
  price: { flex: 1.4, textAlign: "right", paddingLeft: 4 },
  discount: { flex: 0.9, textAlign: "right", paddingLeft: 4 },
  tax: { flex: 0.9, textAlign: "right", paddingLeft: 4 },
  total: { flex: 1.4, textAlign: "right", paddingLeft: 4 },
  taxable: { flex: 1.5, textAlign: "right", paddingLeft: 4 },
  gstTax: { flex: 1.3, textAlign: "right", paddingLeft: 4 },
  // A GST table has more number columns: a narrower description and smaller figures.
  gstName: { flex: 2.4 },
  gstQty: { flex: 0.5 },
  gstRow: { fontSize: 8.5 },
  gstRate: { fontSize: 7, color: "#888888", textAlign: "right" },
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
  gstTaxes,
}: {
  lines: readonly PdfLine[];
  columns: DocumentColumns;
  fmt: (amount: bigint) => string;
  /** GST is on: HSN/SAC may show. */
  showHsn?: boolean;
  /** False for documents without discounts (credit notes). */
  showDiscount?: boolean;
  /** US-TAX-15 — a GST document: a taxable value and each tax (CGST, SGST or IGST, cess) per line. */
  gstTaxes?: Record<string, TaxComponent[]>;
}) {
  const gst = gstTaxes ? gstColumns(gstTaxes) : null;
  const hsn = showHsn && columns.hsnSac;
  const discount = showDiscount && columns.discount;
  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        <Text style={[styles.name, gst ? styles.gstName : {}, styles.th]}>Description</Text>
        {hsn && <Text style={[styles.hsn, styles.th]}>HSN/SAC</Text>}
        {columns.quantity && <Text style={[styles.qty, gst ? styles.gstQty : {}, styles.th]}>Qty</Text>}
        {columns.quantity && <Text style={[styles.price, styles.th]}>Unit price</Text>}
        {discount && <Text style={[styles.discount, styles.th]}>Disc.</Text>}
        {gst && <Text style={[styles.taxable, styles.th]}>Taxable value</Text>}
        {gst && columns.lineTax && gst.map((c) => <Text key={c.type} style={[styles.gstTax, styles.th]}>{c.label}</Text>)}
        {!gst && columns.lineTax && <Text style={[styles.tax, styles.th]}>Tax</Text>}
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
          <View key={line.id} style={[styles.row, gst ? styles.gstRow : {}]} wrap={false}>
            <View style={[styles.name, gst ? styles.gstName : {}]}>
              <Text style={styles.lineName}>{line.name}</Text>
              {line.description && <Text style={styles.lineDescription}>{line.description}</Text>}
            </View>
            {hsn && <Text style={styles.hsn}>{line.hsnSac ?? "—"}</Text>}
            {columns.quantity && <Text style={[styles.qty, gst ? styles.gstQty : {}]}>{line.quantity}</Text>}
            {columns.quantity && <Text style={styles.price}>{fmt(price)}</Text>}
            {discount && <Text style={styles.discount}>{pct > 0 ? `${pct}%` : "—"}</Text>}
            {gst && <Text style={styles.taxable}>{fmt(taxableValue(line))}</Text>}
            {gst &&
              columns.lineTax &&
              gst.map((c) => {
                const part = gstTaxes![line.id]?.find((t) => t.taxType === c.type);
                return (
                  <View key={c.type} style={styles.gstTax}>
                    <Text>{part ? fmt(part.amount) : "—"}</Text>
                    {part && !c.uniform && <Text style={styles.gstRate}>{part.rate}%</Text>}
                  </View>
                );
              })}
            {!gst && columns.lineTax && <Text style={styles.tax}>{line.taxRatePercentage > 0 ? `${line.taxRatePercentage}%` : "—"}</Text>}
            <Text style={styles.total}>{fmt(line.lineTotalAmount)}</Text>
          </View>
        );
      })}
    </View>
  );
}
