/**
 * US-MOB-17 (D-202) — the customer's signature as a PNG, made on the phone
 * without a native module: the strokes drawn on the pad are rasterised into
 * a black-on-white, 1-bit image and encoded here (stored deflate, so no
 * compressor is needed; a 1-bit image of a signature is a few tens of KB).
 * Like a document, it's dark on white in both themes.
 */

export interface Point {
  x: number;
  y: number;
}
export type Stroke = Point[];

export interface SignatureImage {
  width: number;
  height: number;
  /** One byte per pixel: 1 where the pen drew. */
  ink: Uint8Array;
}

/** Draws the strokes (in the pad's points) at `scale`, `penWidth` points wide, with round joins. */
export function rasterize(strokes: readonly Stroke[], size: { width: number; height: number }, options: { scale?: number; penWidth?: number } = {}): SignatureImage {
  const scale = options.scale ?? 2;
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  const radius = ((options.penWidth ?? 2.5) * scale) / 2;
  const ink = new Uint8Array(width * height);

  const segment = (a: Point, b: Point) => {
    const ax = a.x * scale;
    const ay = a.y * scale;
    const bx = b.x * scale;
    const by = b.y * scale;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - radius));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx) + radius));
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - radius));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by) + radius));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
        const cx = ax + t * dx - px;
        const cy = ay + t * dy - py;
        if (cx * cx + cy * cy <= radius * radius) ink[y * width + x] = 1;
      }
    }
  };

  for (const stroke of strokes) {
    if (stroke.length === 1) segment(stroke[0]!, stroke[0]!);
    for (let i = 1; i < stroke.length; i++) segment(stroke[i - 1]!, stroke[i]!);
  }
  return { width, height, ink };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function chunk(type: string, data: Uint8Array): number[] {
  const typed = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) typed[i] = type.charCodeAt(i);
  typed.set(data, 4);
  return [...u32(data.length), ...typed, ...u32(crc32(typed))];
}

/** zlib with stored (uncompressed) deflate blocks. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const MAX = 65535;
  const blocks = Math.max(1, Math.ceil(raw.length / MAX));
  const out = new Uint8Array(2 + blocks * 5 + raw.length + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let at = 2;
  for (let i = 0; i < blocks; i++) {
    const part = raw.subarray(i * MAX, Math.min(raw.length, (i + 1) * MAX));
    out[at++] = i === blocks - 1 ? 1 : 0;
    out[at++] = part.length & 0xff;
    out[at++] = (part.length >>> 8) & 0xff;
    out[at++] = ~part.length & 0xff;
    out[at++] = (~part.length >>> 8) & 0xff;
    out.set(part, at);
    at += part.length;
  }
  out.set(u32(adler32(raw)), at);
  return out;
}

/** A 1-bit greyscale PNG: white paper, black ink. */
export function encodePng(image: SignatureImage): Uint8Array {
  const rowBytes = Math.ceil(image.width / 8);
  const raw = new Uint8Array((rowBytes + 1) * image.height);
  for (let y = 0; y < image.height; y++) {
    const row = y * (rowBytes + 1);
    raw[row] = 0; // filter: none
    for (let byte = 0; byte < rowBytes; byte++) {
      let bits = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byte * 8 + bit;
        // 1 is white; ink (and the padding past the last pixel) stays as drawn.
        const white = x >= image.width || image.ink[y * image.width + x] === 0;
        if (white) bits |= 0x80 >> bit;
      }
      raw[row + 1 + byte] = bits;
    }
  }
  const header = new Uint8Array([...u32(image.width), ...u32(image.height), 1, 0, 0, 0, 0]);
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk("IHDR", header), ...chunk("IDAT", zlibStored(raw)), ...chunk("IEND", new Uint8Array())]);
}

/** Whether the customer has drawn something more than a dot. */
export function hasSignature(strokes: readonly Stroke[]): boolean {
  return strokes.some((stroke) => stroke.length > 1);
}
