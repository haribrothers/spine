import { crc32 } from "node:zlib";

/**
 * Hand-built photos carrying a real EXIF block, for the upload-safety
 * tests. Each has an Orientation tag (6, "rotate 90°") and a GPS directory
 * whose latitude is the distinctive `GPS_LATITUDE_BYTES`, so a test can
 * prove the location is gone by searching for those exact bytes. They're
 * not decodable images — only the bytes Spine inspects are real.
 */
export const GPS_LATITUDE = [
  [37, 1],
  [48, 1],
  [5309, 100],
] as const;

function writer(little: boolean) {
  return {
    u16: (n: number) => {
      const b = Buffer.alloc(2);
      if (little) b.writeUInt16LE(n);
      else b.writeUInt16BE(n);
      return b;
    },
    u32: (n: number) => {
      const b = Buffer.alloc(4);
      if (little) b.writeUInt32LE(n);
      else b.writeUInt32BE(n);
      return b;
    },
  };
}

export function gpsLatitudeBytes(little = true): Buffer {
  const { u32 } = writer(little);
  return Buffer.concat(GPS_LATITUDE.flatMap(([num, den]) => [u32(num), u32(den)]));
}

/** A TIFF block: IFD0 { Orientation = 6, GPS pointer } and GPS { LatitudeRef "N", Latitude }. */
export function exifTiff(little = true): Buffer {
  const { u16, u32 } = writer(little);
  const ifd0Offset = 8;
  const gpsOffset = ifd0Offset + 2 + 2 * 12 + 4; // 38
  const latitudeOffset = gpsOffset + 2 + 2 * 12 + 4; // 68
  return Buffer.concat([
    Buffer.from(little ? "II" : "MM", "latin1"),
    u16(42),
    u32(ifd0Offset),
    // IFD0
    u16(2),
    u16(0x0112), u16(3), u32(1), u16(6), u16(0), // Orientation = 6
    u16(0x8825), u16(4), u32(1), u32(gpsOffset), // GPS IFD pointer
    u32(0),
    // GPS IFD
    u16(2),
    u16(0x0001), u16(2), u32(2), Buffer.from("N\0\0\0", "latin1"), // GPSLatitudeRef "N"
    u16(0x0002), u16(5), u32(3), u32(latitudeOffset), // GPSLatitude (3 rationals)
    u32(0),
    gpsLatitudeBytes(little),
  ]);
}

/** IFD0's Orientation entry as it appears in `exifTiff` — must survive stripping. */
export function orientationEntry(little = true): Buffer {
  const { u16, u32 } = writer(little);
  return Buffer.concat([u16(0x0112), u16(3), u32(1), u16(6), u16(0)]);
}

export function jpegWithGps(little = true): Buffer {
  const app1 = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), exifTiff(little)]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(app1.length + 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), length, app1, Buffer.from([0xff, 0xd9])]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function pngWithGps(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("eXIf", exifTiff(false)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Every PNG chunk's CRC matches its contents. */
export function pngChunksValid(png: Buffer): boolean {
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const expected = png.readUInt32BE(offset + 8 + length);
    if (crc32(png.subarray(offset + 4, offset + 8 + length)) !== expected) return false;
    offset += 12 + length;
  }
  return true;
}

export function webpWithGps(): Buffer {
  const tiff = exifTiff(true);
  const chunk = (type: string, data: Buffer) => {
    const size = Buffer.alloc(4);
    size.writeUInt32LE(data.length);
    return Buffer.concat([Buffer.from(type, "latin1"), size, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const body = Buffer.concat([Buffer.from("WEBP", "latin1"), chunk("VP8X", Buffer.from([0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0])), chunk("EXIF", tiff)]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length);
  return Buffer.concat([Buffer.from("RIFF", "latin1"), size, body]);
}

/** An iPhone-style HEIC: `ftyp heic` then an Exif item (4-byte offset, `Exif\0\0`, TIFF). */
export function heicWithGps(): Buffer {
  const ftyp = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic\0\0\0\0mif1heic", "latin1")]);
  const item = Buffer.concat([Buffer.from([0, 0, 0, 6]), Buffer.from("Exif\0\0", "latin1"), exifTiff(false)]);
  const mdatHeader = Buffer.alloc(8);
  mdatHeader.writeUInt32BE(item.length + 8);
  mdatHeader.write("mdat", 4, "latin1");
  return Buffer.concat([ftyp, mdatHeader, item]);
}

export const MINIMAL_PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n", "latin1");
