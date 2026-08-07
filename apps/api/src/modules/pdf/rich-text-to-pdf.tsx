import { Text, View, Link, StyleSheet } from "@react-pdf/renderer";
import { parse, type HTMLElement, type Node } from "node-html-parser";
import type { ReactElement } from "react";

// `Style` itself lives in `@react-pdf/types` (a transitive dependency of
// `@react-pdf/renderer`, not exported by its own public API) — rather than
// add it as a direct dependency just for this one type, derive the same
// shape from `StyleSheet.create`'s own inferred return type, which
// `quote-pdf.template.tsx`'s `styles` object (the only real caller) is
// itself built from.
type PdfStyle = ReturnType<typeof StyleSheet.create>[string];

interface RichTextPdfStyles {
  paragraph: PdfStyle;
  text: PdfStyle;
}

/**
 * Converts the constrained HTML `RichTextEditor`/`RichTextContent` produce
 * (see packages/ui/src/components/rich-text-editor.tsx's own allowlist:
 * p/strong/em/ul/ol/li/a/br, nothing else) into React-PDF primitives
 * (Text/View/Link) — React-PDF's `<Text>` only accepts plain strings or
 * nested `<Text>`, never raw HTML, so a quote's notes/terms can't be
 * dropped into the PDF as-is once they became rich text; this replaces the
 * prior plain-string rendering.
 *
 * Deliberately a small hand-written walker, not a general HTML-to-PDF
 * library — the input is never arbitrary HTML (see this file's own
 * `parse()` call, which only ever receives a `quotes.notes`/
 * `termsAndConditions` value), so only the editor's own small tag set
 * needs handling; anything else (a future manual API write bypassing the
 * editor, or a legacy plain-text value from before this feature existed)
 * degrades to its own text content rather than throwing, per the
 * `default:`/text-node fallback below.
 */
export function renderRichTextForPdf(html: string, styles: RichTextPdfStyles): ReactElement {
  const root = parse(html);
  return <View>{root.childNodes.map((node, index) => renderNode(node, styles, index))}</View>;
}

function renderNode(node: Node, styles: RichTextPdfStyles, key: number): ReactElement | null {
  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase();

  switch (tag) {
    case "p":
      return (
        <Text key={key} style={styles.paragraph}>
          {el.childNodes.map((child, i) => renderInline(child, i))}
        </Text>
      );
    case "ul":
    case "ol":
      return (
        <View key={key} style={styles.paragraph}>
          {el.childNodes
            .filter((child) => (child as HTMLElement).tagName?.toLowerCase() === "li")
            .map((li, i) => (
              <Text key={i} style={styles.text}>
                {tag === "ol" ? `${i + 1}. ` : "•  "}
                {(li as HTMLElement).childNodes.map((child, j) => renderInline(child, j))}
              </Text>
            ))}
        </View>
      );
    case undefined:
      // A bare text node at the top level (legacy plain-text value written
      // before this field became rich text, or HTML that failed to parse
      // into any element) — render it directly rather than dropping it.
      return node.rawText.trim() ? (
        <Text key={key} style={styles.paragraph}>
          {node.rawText}
        </Text>
      ) : null;
    default:
      // Any other/unexpected tag — render its text content only, never its
      // markup, so an unrecognized element degrades gracefully instead of
      // silently vanishing or leaking raw tags into the PDF.
      return el.textContent?.trim() ? (
        <Text key={key} style={styles.paragraph}>
          {el.textContent}
        </Text>
      ) : null;
  }
}

function renderInline(node: Node, key: number): ReactElement | string {
  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase();

  switch (tag) {
    case "strong":
      return (
        <Text key={key} style={{ fontWeight: 700 }}>
          {el.textContent}
        </Text>
      );
    case "em":
      return (
        <Text key={key} style={{ fontStyle: "italic" }}>
          {el.textContent}
        </Text>
      );
    case "a": {
      const href = el.getAttribute("href");
      return href ? (
        <Link key={key} src={href} style={{ color: "#1a56db", textDecoration: "underline" }}>
          {el.textContent}
        </Link>
      ) : (
        <Text key={key}>{el.textContent}</Text>
      );
    }
    case "br":
      return "\n";
    case undefined:
      return node.rawText;
    default:
      return el.textContent ?? "";
  }
}
