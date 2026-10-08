import { Image, Text, View, StyleSheet } from "@react-pdf/renderer";

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
      {notes.trim() ? (
        <View style={styles.block} wrap={false}>
          <Text style={styles.label}>Notes</Text>
          <Text style={styles.text}>{notes.trim()}</Text>
        </View>
      ) : null}
      {terms.trim() ? (
        <View style={styles.block} wrap={false}>
          <Text style={styles.label}>Terms</Text>
          <Text style={styles.text}>{terms.trim()}</Text>
        </View>
      ) : null}
    </>
  );
}

const signatureStyles = StyleSheet.create({
  block: { marginTop: 24, alignSelf: "flex-end", width: 200, alignItems: "center" },
  image: { height: 44, maxWidth: 180, objectFit: "contain", marginBottom: 4 },
  rule: { borderTopWidth: 1, borderTopColor: "#1a1a1a", width: "100%", marginBottom: 4 },
  caption: { fontSize: 8, color: "#555555", textAlign: "center" },
  words: { marginTop: 12, fontSize: 9, color: "#333333" },
  wordsLabel: { fontWeight: 700, color: "#1a1a1a" },
});

/** US-SET-19 — the total in words, in the organisation's currency. */
export function AmountInWordsLine({ words }: { words: string }) {
  return (
    <Text style={signatureStyles.words}>
      <Text style={signatureStyles.wordsLabel}>Amount in words: </Text>
      {words}
    </Text>
  );
}

/** US-SET-19 — the uploaded signature above "Authorised signatory — <business name>". */
export function SignatureBlock({ src, businessName }: { src: string; businessName: string }) {
  return (
    <View style={signatureStyles.block} wrap={false}>
      <Image src={src} style={signatureStyles.image} />
      <View style={signatureStyles.rule} />
      <Text style={signatureStyles.caption}>Authorised signatory — {businessName}</Text>
    </View>
  );
}
