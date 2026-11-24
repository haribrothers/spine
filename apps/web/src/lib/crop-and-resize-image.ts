import { t } from "./i18n";

/**
 * Canvas-based crop + downscale for avatar/logo uploads. No existing
 * precedent for canvas work anywhere in the repo (confirmed via
 * `grep -rn "canvas" apps/web/src apps/design-system/src` returning
 * nothing before writing this) — this establishes the pattern.
 *
 * Takes the pixel crop rectangle `react-easy-crop`'s `onCropComplete`
 * reports (in source-image pixel coordinates, already accounting for any
 * zoom/pan the user applied) and produces a compressed square output
 * File, capped at `maxDimension` on each side. Never upscales: if the
 * crop selection is already smaller than `maxDimension`, the output stays
 * at the crop's own resolution.
 */

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropAndResizeOptions {
  /** Maximum output width/height in px. Default 256. Never upscaled past this. */
  maxDimension?: number;
  /** canvas.toBlob() MIME type. Default "image/jpeg". */
  mimeType?: "image/jpeg" | "image/webp";
  /** canvas.toBlob() quality, 0–1. Default 0.85. */
  quality?: number;
  /** Filename for the resulting File. Default "logo.jpg". */
  fileName?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(t("common.logoCrop.loadFailed")));
    img.src = src;
  });
}

/**
 * Draws `crop` (native source-pixel coordinates) out of `source` onto an
 * offscreen canvas sized to fit within `maxDimension` × `maxDimension`
 * (downscale-only — the output canvas is never larger than the crop
 * itself), then encodes it as a compressed Blob/File.
 *
 * Single `drawImage` call does both the crop *and* the scale in one pass
 * (source rectangle = the crop region, destination rectangle = the final
 * output size) — no intermediate full-resolution canvas needed.
 */
export async function cropAndResizeImage(
  imageSrc: string,
  crop: PixelCrop,
  options: CropAndResizeOptions = {},
): Promise<File> {
  const { maxDimension = 256, mimeType = "image/jpeg", quality = 0.85, fileName = "logo.jpg" } = options;

  const image = await loadImage(imageSrc);

  const cropWidth = Math.max(1, Math.round(crop.width));
  const cropHeight = Math.max(1, Math.round(crop.height));

  // Downscale-only: the output never exceeds the crop's own resolution,
  // even if that resolution is below maxDimension.
  const scale = Math.min(1, maxDimension / cropWidth, maxDimension / cropHeight);
  const outputWidth = Math.max(1, Math.round(cropWidth * scale));
  const outputHeight = Math.max(1, Math.round(cropHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error(t("common.logoCrop.canvasFailed"));
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    Math.round(crop.x),
    Math.round(crop.y),
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
  if (!blob) {
    throw new Error(t("common.logoCrop.encodeFailed"));
  }

  return new File([blob], fileName, { type: mimeType });
}
