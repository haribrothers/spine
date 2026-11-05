"use client";

import { useEffect } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@spine/ui";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { orgLocaleTag } from "../../../../lib/money";
import { useT } from "../../../../lib/i18n";
import type { JobPhoto } from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** The photo through the files API, which checks the job it belongs to (CLAUDE.md: never serve a file without its record). */
export function photoUrl(fileId: string, download = false): string {
  return `${API_URL}/files/${fileId}${download ? "?download=1" : ""}`;
}

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/**
 * US-JOB-36 (D-215) — a photo full size, with its caption, who added it and
 * when; Previous and Next (also ← and →) move within its group, Download
 * saves the original and Close (also Esc) goes back to the grid.
 */
export function PhotoViewer({
  photos,
  index,
  groupLabel,
  onIndexChange,
  onClose,
}: {
  /** The group the open photo is in. */
  photos: JobPhoto[];
  index: number | null;
  groupLabel: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const open = index !== null && photos[index] !== undefined;
  const photo = open ? photos[index] : null;
  const count = photos.length;

  useEffect(() => {
    if (!open || index === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && index! > 0) onIndexChange(index! - 1);
      if (e.key === "ArrowRight" && index! < count - 1) onIndexChange(index! + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, count, onIndexChange]);

  const navClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-inverse-on-surface/10 text-inverse-on-surface transition-colors hover:bg-inverse-on-surface/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-on-surface disabled:opacity-30";
  const barButton =
    "inline-flex h-9 items-center gap-1.5 rounded-md border border-inverse-on-surface/25 px-3 text-[13px] font-medium text-inverse-on-surface transition-colors hover:bg-inverse-on-surface/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-on-surface";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        data-testid="photo-viewer"
        className="left-0 top-0 h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-inverse-surface shadow-none [&>button:last-child]:hidden"
      >
        {photo && index !== null && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <DialogTitle className="text-[13px] font-medium text-inverse-on-surface">
                {t("jobs.photoViewer.position", { group: groupLabel, index: index + 1, total: count })}
              </DialogTitle>
              <span className="flex-1" />
              <a href={photoUrl(photo.fileId, true)} className={barButton}>
                <Download size={15} aria-hidden />
                {t("jobs.photoViewer.download")}
              </a>
              <DialogClose className={barButton}>
                <X size={15} aria-hidden />
                {t("jobs.photoViewer.close")}
              </DialogClose>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-2 sm:gap-6 sm:px-6">
              <button type="button" className={navClass} aria-label={t("jobs.photoViewer.previous")} disabled={index === 0} onClick={() => onIndexChange(index - 1)}>
                <ChevronLeft size={20} aria-hidden />
              </button>
              {/* A file served by our own API, not a Next-optimizable asset. */}
              <img src={photoUrl(photo.fileId)} alt={photo.caption ?? t("jobs.photoViewer.alt")} className="max-h-full min-w-0 max-w-full rounded-md object-contain" />
              <button type="button" className={navClass} aria-label={t("jobs.photoViewer.next")} disabled={index === count - 1} onClick={() => onIndexChange(index + 1)}>
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
            <DialogDescription asChild>
              <div className="px-4 pb-5 pt-3 text-center text-[13px] text-inverse-on-surface-muted sm:px-6">
                {photo.caption && <p className="mb-1 text-[14px] font-semibold text-inverse-on-surface">{photo.caption}</p>}
                <p>
                  {t("jobs.photoViewer.added")} {photo.uploadedByName ? t("jobs.photoViewer.by", { name: photo.uploadedByName }) : ""}
                  {groupLabel !== t("jobs.photos.sitePhotos") ? t("jobs.photoViewer.with", { group: groupLabel }) : ""}· {when(photo.createdAt)}
                  <span className="hidden sm:inline">{t("jobs.photoViewer.moveHint")}</span>
                </p>
              </div>
            </DialogDescription>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
