import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { resolveDocumentBranding } from "@spine/shared";

/**
 * US-SET-10 — what every customer document prints from Settings › Branding:
 * a bar, the document title and the total in the document colour, and the
 * footer line on every page. PDFs stay light whatever the viewer's theme.
 * Issued documents keep the PDF stored when they were issued (US-INV-17),
 * so a later branding change never alters them.
 */
export interface DocumentBranding {
  /** `#RRGGBB`, readable on white (US-SET-10). */
  color: string;
  footer?: string;
}

/** The branding to print when a caller didn't load any (Spine Blue, no footer). */
export const DEFAULT_DOCUMENT_BRANDING: DocumentBranding = resolveDocumentBranding(undefined);

const styles = StyleSheet.create({
  bar: { position: "absolute", top: 0, left: 0, right: 0, height: 6 },
  footer: { position: "absolute", bottom: 38, left: 40, right: 40, fontSize: 8, color: "#555555", textAlign: "center", lineHeight: 1.4 },
});

/** The coloured bar across the top of every page. */
export function DocumentAccentBar({ color }: { color: string }) {
  return <View style={[styles.bar, { backgroundColor: color }]} fixed />;
}

/** The business's footer line, on every page above the page number. */
export function DocumentFooterLine({ footer }: { footer?: string }) {
  return footer ? (
    <Text style={styles.footer} fixed>
      {footer}
    </Text>
  ) : null;
}

/** Extra bottom padding so content never runs under a footer line. */
export function pagePaddingFor(branding: DocumentBranding) {
  return branding.footer ? { paddingBottom: 76 } : {};
}
