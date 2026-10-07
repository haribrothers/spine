import { parse, type HTMLElement, type Node } from "node-html-parser";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
const URL_IN_TEXT = /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

export interface EmailBodyStyles {
  paragraph: string;
  list: string;
  item: string;
  link: string;
}

const isElement = (node: Node): node is HTMLElement => node.nodeType === 1;
const textOf = (node: Node): string => (isElement(node) ? node.childNodes.map(textOf).join("") : node.text);

/**
 * D-189 — an email message from the rich text editor, made safe and styled
 * for email clients: only the editor's own tags (p, br, strong, em, lists,
 * links to http(s) or mailto) survive, each with inline styles; anything
 * else keeps just its text. Web addresses in plain text become links (D-153).
 * Returns the HTML and the plain-text paragraphs.
 */
export function renderEmailBody(html: string, styles: EmailBodyStyles): { html: string; textBlocks: string[] } {
  const root = parse(html, { blockTextElements: {} });

  const inline = (node: Node, inLink = false): string => {
    if (!isElement(node)) {
      const text = escape(node.text);
      return inLink ? text : text.replace(URL_IN_TEXT, (url) => `<a href="${url}" style="${styles.link}">${url}</a>`);
    }
    const children = () => node.childNodes.map((c) => inline(c, inLink || node.tagName === "A")).join("");
    switch (node.tagName) {
      case "BR":
        return "<br>";
      case "STRONG":
      case "B":
        return `<strong>${children()}</strong>`;
      case "EM":
      case "I":
        return `<em>${children()}</em>`;
      case "A": {
        const href = node.getAttribute("href")?.trim() ?? "";
        return SAFE_HREF.test(href) ? `<a href="${escape(href)}" style="${styles.link}">${children()}</a>` : children();
      }
      default:
        return children();
    }
  };

  const htmlBlocks: string[] = [];
  const textBlocks: string[] = [];
  const inlineText = (node: Node): string => {
    if (!isElement(node)) return node.text;
    if (node.tagName === "BR") return "\n";
    const inner = node.childNodes.map(inlineText).join("");
    if (node.tagName === "A") {
      const href = node.getAttribute("href") ?? "";
      return href && href !== inner && SAFE_HREF.test(href) ? `${inner} (${href})` : inner;
    }
    return inner;
  };
  let loose: Node[] = [];
  const flushLoose = () => {
    if (loose.length && loose.some((n) => textOf(n).trim())) {
      htmlBlocks.push(`<p style="${styles.paragraph}">${loose.map((n) => inline(n)).join("").trim()}</p>`);
      textBlocks.push(loose.map(inlineText).join("").trim());
    }
    loose = [];
  };
  for (const node of root.childNodes) {
    if (isElement(node) && (node.tagName === "P" || node.tagName === "DIV")) {
      flushLoose();
      if (!textOf(node).trim()) continue;
      htmlBlocks.push(`<p style="${styles.paragraph}">${node.childNodes.map((c) => inline(c)).join("")}</p>`);
      textBlocks.push(node.childNodes.map(inlineText).join("").trim());
    } else if (isElement(node) && (node.tagName === "UL" || node.tagName === "OL")) {
      flushLoose();
      const tag = node.tagName.toLowerCase();
      const items = node.childNodes.filter((c): c is HTMLElement => isElement(c) && c.tagName === "LI");
      htmlBlocks.push(`<${tag} style="${styles.list}">${items.map((li) => `<li style="${styles.item}">${li.childNodes.map((c) => inline(c)).join("")}</li>`).join("")}</${tag}>`);
      textBlocks.push(items.map((li, i) => `${tag === "ol" ? `${i + 1}.` : "•"} ${li.childNodes.map(inlineText).join("").trim()}`).join("\n"));
    } else {
      loose.push(node);
    }
  }
  flushLoose();
  return { html: htmlBlocks.join("\n"), textBlocks };
}

/**
 * The message's first paragraph when it's a greeting — one short line
 * ending in a comma ("Hi Alan,") — and the rest of the message without it.
 */
export function splitGreeting(html: string): { greeting: string | undefined; rest: string } {
  const root = parse(html, { blockTextElements: {} });
  const blocks = root.childNodes.filter((n) => !(n.nodeType === 3 && !n.text.trim()));
  const first = blocks[0];
  if (blocks.length < 2 || !first || !isElement(first) || first.tagName !== "P" || first.childNodes.some(isElement)) return { greeting: undefined, rest: html };
  const text = first.text.trim();
  if (!text || text.length > 80 || !text.endsWith(",")) return { greeting: undefined, rest: html };
  first.remove();
  return { greeting: text, rest: root.toString() };
}
