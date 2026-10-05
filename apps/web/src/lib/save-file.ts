/** Saves downloaded bytes as a file in the browser. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** The file name from a `Content-Disposition` header, or `fallback`. */
export function filenameFrom(headers: Headers, fallback: string): string {
  return /filename="([^"]+)"/.exec(headers.get("Content-Disposition") ?? "")?.[1] ?? fallback;
}
