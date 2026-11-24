/** US-OPS-31 — Owners are warned once the files volume is more than this full. */
export const STORAGE_WARNING_PERCENT = 85;

/** What `GET /health/ready` reports about file storage. `usedPercent` is null for the `s3` driver. */
export interface StorageStatus {
  driver: "local" | "s3";
  usedPercent: number | null;
}

/** The Owners' banner text, or null when there's room (or the driver can't tell). */
export function storageWarningMessage(usedPercent: number | null): string | null {
  if (usedPercent === null || usedPercent <= STORAGE_WARNING_PERCENT) return null;
  return `Storage is ${Math.round(usedPercent)}% full. Free up space or add disk before uploads stop working.`;
}

/** US-OPS-31 — the upload error when the files volume is full. */
export const STORAGE_FULL_MESSAGE = "There's no space left to store this file. Ask an owner to free up space.";
