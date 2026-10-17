import { UnprocessableEntityException } from "@nestjs/common";
import { AI_UNREADABLE_FILE_MESSAGE } from "@spine/shared";

/** What a document becomes before it's sent: its text, or images of it. */
export type DocumentInput = { kind: "text"; text: string } | { kind: "images"; images: { mimeType: string; base64: string }[] };

/** A PDF with less text than this is a scan: its pages are sent as images (D-170). */
const MIN_TEXT = 20;
/** Enough for a long bill; a model doesn't need the terms and conditions pages. */
const MAX_TEXT = 24_000;
const MAX_PAGES = 3;
/** The longest side of an image sent, in pixels — enough to read small print, small enough for every provider. */
const MAX_SIDE = 2000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const canvasImport = () => import("@napi-rs/canvas");

/**
 * US-AI-08 (D-170) — a PDF's text layer is extracted here with `unpdf` and
 * sent as text; a scanned PDF's first pages, and photos, are sent as
 * images (scaled down when they're large). The document itself is sent as
 * it is — it's what the person asked AI to read (D-165).
 */
export async function documentInput(bytes: Buffer, mimeType: string): Promise<DocumentInput> {
  if (mimeType === "application/pdf") return pdfInput(bytes);
  if (IMAGE_TYPES.has(mimeType)) return { kind: "images", images: [await fitImage(bytes, mimeType)] };
  throw new UnprocessableEntityException(AI_UNREADABLE_FILE_MESSAGE);
}

async function pdfInput(bytes: Buffer): Promise<DocumentInput> {
  const { extractText, getDocumentProxy, renderPageAsImage } = await import("unpdf");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    throw new UnprocessableEntityException("This PDF couldn't be opened. Check it isn't damaged or password-protected, or enter the bill by hand.");
  }
  const { text } = await extractText(pdf, { mergePages: true });
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.replace(/\s/g, "").length >= MIN_TEXT) return { kind: "text", text: clean.slice(0, MAX_TEXT) };
  const images: { mimeType: string; base64: string }[] = [];
  for (let page = 1; page <= Math.min(pdf.numPages, MAX_PAGES); page += 1) {
    const viewport = (await pdf.getPage(page)).getViewport({ scale: 1 });
    const scale = Math.min(2, MAX_SIDE / Math.max(viewport.width, viewport.height));
    const png = await renderPageAsImage(pdf, page, { canvasImport, scale });
    images.push({ mimeType: "image/png", base64: Buffer.from(png).toString("base64") });
  }
  return { kind: "images", images };
}

/** A photo as it is, or re-encoded as a JPEG no larger than MAX_SIDE when it's bigger. */
async function fitImage(bytes: Buffer, mimeType: string): Promise<{ mimeType: string; base64: string }> {
  const { createCanvas, loadImage } = await canvasImport();
  let image: Awaited<ReturnType<typeof loadImage>>;
  try {
    image = await loadImage(bytes);
  } catch {
    throw new UnprocessableEntityException(AI_UNREADABLE_FILE_MESSAGE);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  if (scale === 1 && bytes.length <= 3_500_000) return { mimeType, base64: bytes.toString("base64") };
  const canvas = createCanvas(Math.round(image.width * scale), Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return { mimeType: "image/jpeg", base64: (await canvas.encode("jpeg", 85)).toString("base64") };
}
