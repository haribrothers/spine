import { inflateSync } from "node:zlib";

function streamOf(body: string): string | null {
  const m = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
  if (!m) return null;
  try {
    return inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1");
  } catch {
    return m[1]!;
  }
}

const hexToString = (hex: string) => String.fromCodePoint(...(hex.replace(/\s+/g, "").match(/.{4}/g) ?? []).map((h) => parseInt(h, 16)));

/** A font's ToUnicode CMap: glyph id (4 hex digits) → text. */
function parseToUnicode(cmap: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1]!.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F\s]+)>/g)) map.set(m[1]!.toLowerCase().padStart(4, "0"), hexToString(m[2]!));
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1]!.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(\[[^\]]*\]|<[0-9a-fA-F\s]+>)/g)) {
      const start = parseInt(m[1]!, 16);
      const end = parseInt(m[2]!, 16);
      const targets = m[3]!.startsWith("[") ? [...m[3]!.matchAll(/<([0-9a-fA-F\s]+)>/g)].map((t) => t[1]!) : null;
      for (let gid = start; gid <= end; gid++) {
        const key = gid.toString(16).padStart(4, "0");
        if (targets) {
          if (targets[gid - start]) map.set(key, hexToString(targets[gid - start]!));
        } else {
          const base = parseInt(m[3]!.slice(1, -1), 16);
          map.set(key, String.fromCodePoint(base + gid - start));
        }
      }
    }
  }
  return map;
}

/**
 * Every text string drawn in a react-pdf PDF, in order, one content stream
 * per line. The PDFs embed subset TrueType fonts (D-151), so text is glyph
 * ids; each font's ToUnicode map turns them back into characters.
 */
export function pdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const objects = new Map<string, string>();
  for (const m of raw.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objects.set(m[1]!, m[2]!);

  // Font resource name (/F1) → glyph map.
  const fonts = new Map<string, Map<string, string>>();
  for (const body of objects.values()) {
    for (const dict of body.matchAll(/\/Font\s*<<([\s\S]*?)>>/g)) {
      for (const ref of dict[1]!.matchAll(/\/([\w.+-]+)\s+(\d+) 0 R/g)) {
        const font = objects.get(ref[2]!);
        const toUnicode = font?.match(/\/ToUnicode (\d+) 0 R/);
        const cmap = toUnicode ? streamOf(objects.get(toUnicode[1]!) ?? "") : null;
        if (cmap) fonts.set(ref[1]!, parseToUnicode(cmap));
      }
    }
  }

  let out = "";
  for (const body of objects.values()) {
    if (/\/ToUnicode|\/Length1|\/Subtype \/(Image|Type0|CIDFontType2)/.test(body)) continue;
    const content = streamOf(body);
    if (!content || !/Tf\b/.test(content)) continue;
    let font: Map<string, string> | undefined;
    for (const m of content.matchAll(/\/([\w.+-]+)\s+[\d.]+\s+Tf|<([0-9a-fA-F]+)>/g)) {
      if (m[1]) {
        font = fonts.get(m[1]);
        continue;
      }
      const hex = m[2]!.toLowerCase();
      if (font) out += (hex.match(/.{4}/g) ?? []).map((g) => font!.get(g) ?? "").join("");
      else out += Buffer.from(hex, "hex").toString("latin1");
    }
    out += "\n";
  }
  return out;
}
