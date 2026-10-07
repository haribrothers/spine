import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type { TaxComponent } from "@spine/shared";
import { gstColumns, taxableValue, type PdfLine } from "./document-lines";

const styles = StyleSheet.create({
  table: { marginTop: 14 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#1a1a1a", paddingBottom: 4, marginBottom: 2 },
  row: { flexDirection: "row", paddingVertical: 3 },
  th: { fontSize: 7.5, fontWeight: 700 },
  td: { fontSize: 8 },
  first: { flex: 1.5 },
  num: { flex: 1.3, textAlign: "right" },
});

/**
 * "Tax summary table" (D-152) — under GST, tax by HSN/SAC code with each
 * tax and the total (US-TAX-15); otherwise tax by rate. Follows the lines.
 */
export function TaxSummaryTable({ lines, fmt, gstTaxes }: { lines: readonly PdfLine[]; fmt: (amount: bigint) => string; gstTaxes?: Record<string, TaxComponent[]> }) {
  const items = lines.filter((l) => l.type === "item" && (l.lineTaxAmount ?? 0n) !== 0n);
  if (!items.length) return null;

  if (gstTaxes) {
    const columns = gstColumns(gstTaxes);
    const groups = new Map<string, { taxable: bigint; taxes: Map<string, bigint>; total: bigint }>();
    for (const line of items) {
      const key = line.hsnSac ?? "—";
      const group = groups.get(key) ?? { taxable: 0n, taxes: new Map(), total: 0n };
      group.taxable += taxableValue(line);
      for (const part of gstTaxes[line.id] ?? []) group.taxes.set(part.taxType, (group.taxes.get(part.taxType) ?? 0n) + part.amount);
      group.total += line.lineTaxAmount ?? 0n;
      groups.set(key, group);
    }
    return (
      <View style={styles.table} wrap={false}>
        <View style={styles.headerRow}>
          <Text style={[styles.first, styles.th]}>HSN/SAC</Text>
          <Text style={[styles.num, styles.th]}>Taxable value</Text>
          {columns.map((c) => (
            <Text key={c.type} style={[styles.num, styles.th]}>
              {c.label.split(" ")[0]}
            </Text>
          ))}
          <Text style={[styles.num, styles.th]}>Total tax</Text>
        </View>
        {[...groups.entries()].map(([code, g]) => (
          <View key={code} style={styles.row}>
            <Text style={[styles.first, styles.td]}>{code}</Text>
            <Text style={[styles.num, styles.td]}>{fmt(g.taxable)}</Text>
            {columns.map((c) => (
              <Text key={c.type} style={[styles.num, styles.td]}>
                {fmt(g.taxes.get(c.type) ?? 0n)}
              </Text>
            ))}
            <Text style={[styles.num, styles.td]}>{fmt(g.total)}</Text>
          </View>
        ))}
      </View>
    );
  }

  const byRate = new Map<number, { taxable: bigint; tax: bigint }>();
  for (const line of items) {
    const group = byRate.get(line.taxRatePercentage) ?? { taxable: 0n, tax: 0n };
    group.taxable += taxableValue(line);
    group.tax += line.lineTaxAmount ?? 0n;
    byRate.set(line.taxRatePercentage, group);
  }
  return (
    <View style={styles.table} wrap={false}>
      <View style={styles.headerRow}>
        <Text style={[styles.first, styles.th]}>Rate</Text>
        <Text style={[styles.num, styles.th]}>Taxable value</Text>
        <Text style={[styles.num, styles.th]}>Tax</Text>
      </View>
      {[...byRate.entries()].map(([rate, g]) => (
        <View key={rate} style={styles.row}>
          <Text style={[styles.first, styles.td]}>{rate}%</Text>
          <Text style={[styles.num, styles.td]}>{fmt(g.taxable)}</Text>
          <Text style={[styles.num, styles.td]}>{fmt(g.tax)}</Text>
        </View>
      ))}
    </View>
  );
}
