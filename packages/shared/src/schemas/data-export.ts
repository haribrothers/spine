import { z } from "zod";

/**
 * US-SET-15/16 (D-094) — "Data export": a ZIP of every table as CSV
 * (default) and/or JSON, optionally with the files, never secrets; Owner
 * only; the download link expires after 7 days.
 */

export const DATA_EXPORT_FORMATS = ["csv", "json"] as const;
export type DataExportFormat = (typeof DATA_EXPORT_FORMATS)[number];

/** `POST /org/exports`. */
export const createDataExportSchema = z.object({
  formats: z.array(z.enum(DATA_EXPORT_FORMATS)).min(1, { error: "Choose CSV, JSON or both." }),
  includeFiles: z.boolean(),
});
export type CreateDataExport = z.infer<typeof createDataExportSchema>;

/** How long a prepared export can be downloaded. */
export const DATA_EXPORT_TTL_DAYS = 7;

export type DataExportStatus = "preparing" | "ready" | "failed" | "expired";

/** `GET /org/exports` (the latest) and `POST /org/exports`. */
export interface DataExportSummary {
  id: string;
  status: DataExportStatus;
  formats: DataExportFormat[];
  includeFiles: boolean;
  requestedBy: string | null;
  createdAt: string;
  sizeBytes: number | null;
  expiresAt: string | null;
}

/** "48.2 MB", "820 KB", "512 bytes". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}
