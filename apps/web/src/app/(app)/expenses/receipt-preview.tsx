"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@spine/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** The address a stored file is served from, through its owning record's checks (`GET /files/:id`). */
export const fileUrl = (fileId: string) => `${API_URL}/files/${fileId}`;

/**
 * US-PUR-43/44 (D-227) — a receipt shown where it's checked: the photo, or
 * the first page of a PDF, with a button that opens it full size in a new
 * tab. `mimeType` when known (just uploaded); otherwise it tries the image
 * and falls back to the PDF view.
 */
export function ReceiptPreview({ fileId, mimeType, label = "Receipt", className }: { fileId: string; mimeType?: string | null; label?: string; className?: string }) {
  const [asPdf, setAsPdf] = useState(mimeType === "application/pdf");
  const src = fileUrl(fileId);
  return (
    <div className={cn("relative overflow-hidden rounded-md border border-border bg-surface-sunken", className)} data-testid="receipt-preview">
      {asPdf ? (
        <iframe title={label} src={`${src}#toolbar=0&navpanes=0&view=FitH`} className="pointer-events-none h-full w-full" />
      ) : (
        <img src={src} alt={label} className="h-full w-full object-contain" onError={() => setAsPdf(true)} />
      )}
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open the ${label.toLowerCase()} full size`}
        className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-on-surface-muted hover:text-on-surface"
      >
        <Maximize2 size={14} aria-hidden />
      </a>
    </div>
  );
}
