import { inflateSync } from "node:zlib";

interface PdfObject {
  dict: string;
  /** The inflated stream, when the object has one. */
  stream: string | null;
}

/** Every object, reading each stream by its declared /Length (stream bytes can contain "endobj"). */
function readObjects(raw: string): Map<string, PdfObject> {
  const objects = new Map<string, PdfObject>();
  const header = /(\d+) 0 obj/g;
  let m: RegExpExecArray | null;
  while ((m = header.exec(raw))) {
    const start = m.index + m[0].length;
    const streamAt = raw.indexOf("stream", start);
    const endAt = raw.indexOf("endobj", start);
    if (streamAt !== -1 && streamAt < endAt) {
      const dict = raw.slice(start, streamAt);
      const length = Number(dict.match(/\/Length (\d+)/)?.[1] ?? NaN);
      const dataStart = streamAt + 6 + (raw[streamAt + 6] === "\r" ? 2 : 1);
      const data = Number.isFinite(length) ? raw.slice(dataStart, dataStart + length) : raw.slice(dataStart, raw.indexOf("endstream", dataStart));
      let stream: string;
      try {
        stream = /FlateDecode/.test(dict) ? inflateSync(Buffer.from(data, "latin1")).toString("latin1") : data;
      } catch {
        stream = data;
      }
      objects.set(m[1]!, { dict, stream });
      header.lastIndex = dataStart + data.length;
    } else {
      objects.set(m[1]!, { dict: raw.slice(start, endAt === -1 ? undefined : endAt), stream: null });
    }
  }
  return objects;
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
/** Every inflated stream in a PDF (page contents, fonts' maps…), for tests that look at drawing operators. */
export function pdfStreams(buf: Buffer): string[] {
  return [...readObjects(buf.toString("latin1")).values()].flatMap((o) => (o.stream === null ? [] : [o.stream]));
}

export function pdfText(buf: Buffer): string {
  const objects = readObjects(buf.toString("latin1"));

  // Font resource name (/F1) → glyph map.
  const fonts = new Map<string, Map<string, string>>();
  for (const object of objects.values()) {
    for (const dict of object.dict.matchAll(/\/Font\s*<<([\s\S]*?)>>/g)) {
      for (const ref of dict[1]!.matchAll(/\/([\w.+-]+)\s+(\d+) 0 R/g)) {
        const toUnicode = objects.get(ref[2]!)?.dict.match(/\/ToUnicode (\d+) 0 R/);
        const cmap = toUnicode ? objects.get(toUnicode[1]!)?.stream : null;
        if (cmap) fonts.set(ref[1]!, parseToUnicode(cmap));
      }
    }
  }

  let out = "";
  for (const object of objects.values()) {
    const content = object.stream;
    if (!content || /\/Subtype \/Image|\/Length1/.test(object.dict) || !/Tf\b/.test(content)) continue;
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
