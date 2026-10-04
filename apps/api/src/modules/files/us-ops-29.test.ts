import { describe, expect, it } from "vitest";
import { contentDisposition } from "./files.service";
import {
  MINIMAL_PDF,
  gpsLatitudeBytes,
  heicWithGps,
  jpegWithGps,
  orientationEntry,
  pngChunksValid,
  pngWithGps,
  webpWithGps,
} from "./test-photos";
import { sniffMimeType, stripGpsLocation } from "./upload-safety";

describe("US-OPS-29", () => {
  describe("type from the file's bytes", () => {
    it.each([
      ["JPEG", jpegWithGps(), "image/jpeg"],
      ["PNG", pngWithGps(), "image/png"],
      ["WebP", webpWithGps(), "image/webp"],
      ["HEIC", heicWithGps(), "image/heic"],
      ["PDF", MINIMAL_PDF, "application/pdf"],
    ])("recognises a %s", (_, bytes, expected) => {
      expect(sniffMimeType(bytes)).toBe(expected);
    });

    it.each([
      ["a text file", Buffer.from("root:x:0:0:root:/root:/bin/bash")],
      ["an HTML page", Buffer.from("<!doctype html><script>alert(1)</script>")],
      ["an SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
      ["a GIF", Buffer.from("GIF89a\x01\x00\x01\x00", "latin1")],
      ["a Windows program", Buffer.from("MZ\x90\x00", "latin1")],
      ["an AVIF", Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypavif\0\0\0\0mif1avif", "latin1")])],
      ["an empty file", Buffer.alloc(0)],
    ])("refuses %s", (_, bytes) => {
      expect(sniffMimeType(bytes)).toBeNull();
    });
  });

  describe("GPS location removed, orientation kept", () => {
    it.each([
      ["JPEG (little-endian EXIF)", jpegWithGps(true), "image/jpeg", true],
      ["JPEG (big-endian EXIF)", jpegWithGps(false), "image/jpeg", false],
      ["WebP", webpWithGps(), "image/webp", true],
      ["HEIC", heicWithGps(), "image/heic", false],
      ["PNG", pngWithGps(), "image/png", false],
    ] as const)("strips GPS from a %s", (_, photo, mime, little) => {
      expect(photo.includes(gpsLatitudeBytes(little))).toBe(true);
      expect(photo.includes(Buffer.from("N\0\0\0", "latin1"))).toBe(true);

      const stripped = stripGpsLocation(photo, mime);

      expect(stripped.includes(gpsLatitudeBytes(little))).toBe(false);
      expect(stripped.includes(Buffer.from("N\0\0\0", "latin1"))).toBe(false);
      expect(stripped.includes(orientationEntry(little))).toBe(true);
      expect(stripped.length).toBe(photo.length);
      expect(sniffMimeType(stripped)).toBe(mime);
    });

    it("keeps every PNG chunk's checksum valid after stripping", () => {
      expect(pngChunksValid(stripGpsLocation(pngWithGps(), "image/png"))).toBe(true);
    });

    it("leaves a PDF and a photo without location data unchanged", () => {
      expect(stripGpsLocation(MINIMAL_PDF, "application/pdf").equals(MINIMAL_PDF)).toBe(true);
      const plainJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);
      expect(stripGpsLocation(plainJpeg, "image/jpeg").equals(plainJpeg)).toBe(true);
    });

    it("doesn't modify the caller's buffer", () => {
      const photo = jpegWithGps();
      stripGpsLocation(photo, "image/jpeg");
      expect(photo.includes(gpsLatitudeBytes())).toBe(true);
    });
  });

  describe("Content-Disposition", () => {
    it("shows allowed photos and PDFs inline", () => {
      expect(contentDisposition({ mimeType: "image/jpeg", originalFilename: "site.jpg" })).toMatch(/^inline;/);
      expect(contentDisposition({ mimeType: "application/pdf", originalFilename: "quote.pdf" })).toMatch(/^inline;/);
    });

    it("downloads anything else, such as an SVG stored before type checks", () => {
      expect(contentDisposition({ mimeType: "image/svg+xml", originalFilename: "logo.svg" })).toMatch(/^attachment;/);
    });

    it("keeps an awkward file name a safe label", () => {
      const header = contentDisposition({ mimeType: "application/pdf", originalFilename: '../../etc/pass"wd\r\n.pdf' });
      expect(header).not.toMatch(/[\r\n]/);
      expect(header).toContain('filename="../../etc/pass_wd__.pdf"');
      expect(header).toContain("filename*=UTF-8''..%2F..%2Fetc%2Fpass_wd__.pdf");
    });
  });
});
