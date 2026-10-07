import { Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  block: { marginTop: 14 },
  label: { fontSize: 8, color: "#888888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  text: { fontSize: 9, color: "#333333", lineHeight: 1.4 },
});

/**
 * US-SET-18 — Settings › Documents' notes and terms, printed as they are on
 * documents without notes of their own (credit notes, receipts, statements).
 */
export function LayoutTextBlocks({ notes, terms }: { notes: string; terms: string }) {
  return (
    <>
      {notes.trim() && (
        <View style={styles.block} wrap={false}>
          <Text style={styles.label}>Notes</Text>
          <Text style={styles.text}>{notes.trim()}</Text>
        </View>
      )}
      {terms.trim() && (
        <View style={styles.block} wrap={false}>
          <Text style={styles.label}>Terms</Text>
          <Text style={styles.text}>{terms.trim()}</Text>
        </View>
      )}
    </>
  );
}
