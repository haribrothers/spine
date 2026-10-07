import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { placeOfSupplyLabel } from "@spine/shared";
import { gstColumns, taxableValue, type PdfLine } from "./document-lines";
import type { GstPdfContext } from "./gst-document";

const styles = StyleSheet.create({
  label: { fontSize: 8, color: "#888888", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  value: { fontSize: 10, fontWeight: 700 },
  meta: { fontSize: 9, color: "#555555", marginTop: 2 },
  exportNote: { marginBottom: 12, padding: 6, borderWidth: 1, borderColor: "#dddddd", fontSize: 9 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  rowLabel: { color: "#555555" },
  rowValue: { textAlign: "right" },
});

const SUPPLY_TEXT = { intra: "Intra-state supply", inter: "Inter-state supply", export: "Export" } as const;

/** US-TAX-15 — "Place of supply: <state> (<code>)" and the supply type. */
export function PlaceOfSupplyBlock({ gst }: { gst: GstPdfContext }) {
  return (
    <View>
      <Text style={styles.label}>Place of supply</Text>
      <Text style={styles.value}>{gst.placeOfSupply ? placeOfSupplyLabel(gst.placeOfSupply) : "—"}</Text>
      <Text style={styles.meta}>{SUPPLY_TEXT[gst.supplyType]}</Text>
    </View>
  );
}

/** US-TAX-15 — an export says so; under LUT it carries no IGST (D-181). */
export function ExportNote({ gst }: { gst: GstPdfContext }) {
  if (gst.supplyType !== "export") return null;
  return <Text style={styles.exportNote}>{gst.exportUnderLut ? "Supply meant for export under LUT without payment of IGST" : "Supply meant for export with payment of IGST"}</Text>;
}

/** The customer's address and GSTIN (when registered), under their name. */
export function GstCustomerLines({ gst }: { gst: GstPdfContext }) {
  return (
    <>
      {gst.customer.address ? <Text style={styles.meta}>{gst.customer.address}</Text> : null}
      {gst.customer.gstin ? <Text style={styles.meta}>GSTIN {gst.customer.gstin}</Text> : null}
    </>
  );
}

/** US-TAX-15 — the totals' taxable value and each tax, instead of subtotal, discount and tax. */
export function GstTotalsRows({ lines, gst, fmt }: { lines: readonly PdfLine[]; gst: GstPdfContext; fmt: (amount: bigint) => string }) {
  const taxable = lines.filter((l) => l.type === "item").reduce((sum, l) => sum + taxableValue(l), 0n);
  const parts = Object.values(gst.lineTaxes).flat();
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Taxable value</Text>
        <Text style={styles.rowValue}>{fmt(taxable)}</Text>
      </View>
      {gstColumns(gst.lineTaxes).map((c) => (
        <View key={c.type} style={styles.row}>
          <Text style={styles.rowLabel}>{c.label}</Text>
          <Text style={styles.rowValue}>{fmt(parts.filter((p) => p.taxType === c.type).reduce((sum, p) => sum + p.amount, 0n))}</Text>
        </View>
      ))}
    </>
  );
}
