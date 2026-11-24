import { crc32 } from "node:zlib";

/** The only types Spine stores (D-104): photos and PDFs. */
export type AllowedMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf";

export const UNSUPPORTED_TYPE_MESSAGE = "This file type isn't supported. Upload a photo or a PDF.";

/** HEIF brands used by iPhone and Android HEIC photos (AVIF's `avif`/`avis` are not accepted). */
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

/**
 * US-OPS-29 — the file's real type, read from its first bytes rather than
 * its name or the browser's claim. `null` for anything that isn't one of
 * the five allowed types.
 */
export function sniffMimeType(bytes: Buffer): AllowedMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png";
  if (bytes.length >= 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 5 && bytes.toString("latin1", 0, 5) === "%PDF-") return "application/pdf";
  if (bytes.length >= 12 && bytes.toString("latin1", 4, 8) === "ftyp") {
    const boxSize = Math.min(bytes.readUInt32BE(0), bytes.length);
    // Major brand at 8, then compatible brands from 16 to the end of the ftyp box.
    const brands = [bytes.toString("latin1", 8, 12)];
    for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(bytes.toString("latin1", i, i + 4));
    if (brands.some((brand) => HEIC_BRANDS.has(brand)) && !brands.includes("avif")) return "image/heic";
  }
  return null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXIF_HEADER = Buffer.from("Exif\0\0", "latin1");
const GPS_IFD_TAG = 0x8825;
const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

/**
 * US-OPS-29 — removes GPS location from a photo's EXIF and changes nothing
 * else: the GPS directory is emptied in place, so the image isn't
 * re-encoded (no quality loss) and the Orientation tag is kept. Works the
 * same for JPEG, PNG, WebP and HEIC (D-115). Returns a new buffer; PDFs and
 * photos without location data come back unchanged.
 */
export function stripGpsLocation(bytes: Buffer, mimeType: AllowedMimeType): Buffer {
  if (mimeType === "application/pdf") return bytes;
  const out = Buffer.from(bytes);
  if (mimeType === "image/png") {
    stripPngExif(out);
    return out;
  }
  for (const tiffStart of findTiffBlocks(out, mimeType)) wipeGpsDirectory(out, tiffStart);
  return out;
}

/** Start offsets of EXIF TIFF blocks: after an `Exif\0\0` marker (JPEG, HEIC, WebP) or a bare WebP `EXIF` chunk. */
function findTiffBlocks(bytes: Buffer, mimeType: AllowedMimeType): number[] {
  const starts: number[] = [];
  let at = bytes.indexOf(EXIF_HEADER);
  while (at !== -1) {
    if (isTiffHeader(bytes, at + EXIF_HEADER.length)) starts.push(at + EXIF_HEADER.length);
    at = bytes.indexOf(EXIF_HEADER, at + 1);
  }
  if (mimeType === "image/webp") {
    for (let offset = 12; offset + 8 <= bytes.length; ) {
      const size = bytes.readUInt32LE(offset + 4);
      if (bytes.toString("latin1", offset, offset + 4) === "EXIF" && isTiffHeader(bytes, offset + 8)) starts.push(offset + 8);
      offset += 8 + size + (size % 2);
    }
  }
  return [...new Set(starts)];
}

/** PNG keeps EXIF in an `eXIf` chunk whose CRC must be recomputed after the edit. */
function stripPngExif(bytes: Buffer): void {
  for (let offset = 8; offset + 12 <= bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (type === "eXIf" && dataStart + length + 4 <= bytes.length && isTiffHeader(bytes, dataStart)) {
      wipeGpsDirectory(bytes, dataStart);
      bytes.writeUInt32BE(crc32(bytes.subarray(offset + 4, dataStart + length)), dataStart + length);
    }
    offset = dataStart + length + 4;
  }
}

function isTiffHeader(bytes: Buffer, at: number): boolean {
  if (at + 8 > bytes.length) return false;
  const order = bytes.toString("latin1", at, at + 2);
  if (order === "II") return bytes.readUInt16LE(at + 2) === 42;
  if (order === "MM") return bytes.readUInt16BE(at + 2) === 42;
  return false;
}

/** Zeroes every GPS entry and its data, then marks the GPS directory as empty. */
function wipeGpsDirectory(bytes: Buffer, tiffStart: number): void {
  const little = bytes.toString("latin1", tiffStart, tiffStart + 2) === "II";
  const u16 = (at: number) => (little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at));
  const u32 = (at: number) => (little ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at));
  const inRange = (at: number, length: number) => at >= tiffStart && at + length <= bytes.length;

  const ifd0 = tiffStart + u32(tiffStart + 4);
  if (!inRange(ifd0, 2)) return;
  const entries = u16(ifd0);
  for (let i = 0; i < entries; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (!inRange(entry, 12) || u16(entry) !== GPS_IFD_TAG) continue;
    const gps = tiffStart + u32(entry + 8);
    if (!inRange(gps, 2)) return;
    const gpsEntries = u16(gps);
    for (let j = 0; j < gpsEntries; j++) {
      const gpsEntry = gps + 2 + j * 12;
      if (!inRange(gpsEntry, 12)) break;
      const size = (TYPE_SIZES[u16(gpsEntry + 2)] ?? 1) * u32(gpsEntry + 4);
      if (size > 4) {
        const data = tiffStart + u32(gpsEntry + 8);
        if (inRange(data, size)) bytes.fill(0, data, data + size);
      }
      bytes.fill(0, gpsEntry, gpsEntry + 12);
    }
    // An empty directory: zero entries, and the zeroed bytes after it read as "no next directory".
    bytes.fill(0, gps, gps + 2);
    return;
  }
}
