/**
 * What file pickers offer — the same types `POST /files` accepts (checked
 * there from the file's bytes, US-OPS-29). `.heic` is listed by extension
 * too because some browsers don't know HEIC's MIME type.
 */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,.heic";
export const PHOTO_OR_PDF_ACCEPT = `${PHOTO_ACCEPT},application/pdf`;
