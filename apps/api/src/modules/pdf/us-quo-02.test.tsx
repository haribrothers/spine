import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { DocumentLinesTable, type PdfLine } from "./document-lines";

/** Every element in a React tree, depth first. */
function elements(node: ReactNode): ReactElement<{ style?: unknown; children?: ReactNode }>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<{ style?: unknown; children?: ReactNode }>;
  return [el, ...elements(el.props.children)];
}

function styleOf(tree: ReactNode, text: string): Record<string, unknown> {
  const el = elements(tree).find((e) => e.props.children === text);
  if (!el) throw new Error(`No text "${text}"`);
  const style = el.props.style;
  return Object.assign({}, ...(Array.isArray(style) ? style : [style]));
}

const line = (over: Partial<PdfLine>): PdfLine => ({ id: over.name ?? "l", type: "item", name: "x", description: null, quantity: 1, unitPriceAmount: 0n, taxRatePercentage: 0, lineTotalAmount: 0n, ...over });

describe("US-QUO-02 · section headings and text lines on the PDF", () => {
  it("prints a heading bold and larger, and a text line as plain, lighter text", () => {
    const tree = DocumentLinesTable({
      lines: [line({ type: "heading", name: "Strip-out and preparation" }), line({ type: "text", name: "Work starts within 10 days of acceptance." }), line({ name: "Tiling" })],
      columns: { quantity: true, discount: true, hsnSac: true, lineTax: true },
      fmt: (n) => String(n),
    });
    const heading = styleOf(tree, "Strip-out and preparation");
    const text = styleOf(tree, "Work starts within 10 days of acceptance.");
    expect(heading).toMatchObject({ fontSize: 11, fontWeight: 700 });
    expect(text.fontWeight).toBe(400);
    expect(Number(text.fontSize)).toBeLessThan(Number(heading.fontSize));
    expect(text.color).not.toBe(heading.color);
  });
});
