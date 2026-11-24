"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Spinner, cn } from "@spine/ui";
import { ImagePlus, MoreHorizontal, TriangleAlert, Upload, X } from "lucide-react";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import { apiClient } from "../../../../lib/api-client";
import { useT } from "../../../../lib/i18n";
import { useCapability } from "../../../../lib/capabilities-context";
import { orgLocaleTag } from "../../../../lib/money";
import { PHOTO_ACCEPT } from "../../../../lib/upload-types";
import { groupPhotos } from "../job-page-state";
import type { Job, JobPhoto, Milestone, UploadedFile } from "../types";
import { PhotoViewer, photoUrl } from "./photo-viewer";
import { usePhotoDelete } from "./delete-photo-dialog";

interface Upload {
  key: string;
  name: string;
  error: string | null;
}

/**
 * US-JOB-36 (D-215) — the job's photos, grouped under "Site photos" and
 * each milestone they were added with. "Add photos" (or a drop on the
 * card) takes several files at once: each uploads on its own tile, one
 * that fails says why, and the rest carry on. A photo opens full size in
 * PhotoViewer. Uploads go to `POST /files`, then `POST /jobs/:id/photos`.
 * US-JOB-39: each photo's menu (Open, Download, Delete photo) and the
 * viewer offer Delete to whoever may delete it (usePhotoDelete).
 */
export function PhotosSection({ job, milestones, onChanged }: { job: Job; milestones: Milestone[]; onChanged?: () => void }) {
  const t = useT();
  const canUpload = useCapability("job_photos.edit_own");
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<JobPhoto[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ group: string; index: number } | null>(null);
  const now = useMemo(() => new Date(), []);

  const load = useCallback(() => {
    apiClient
      .get<JobPhoto[]>(`/jobs/${job.id}/photos`)
      .then(setPhotos)
      .catch((err) => setError(err instanceof Error ? err.message : t("jobs.photosSection.loadFailed")));
  }, [job.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupPhotos(photos ?? [], milestones, now, orgLocaleTag()), [photos, milestones, now]);
  const openGroup = open ? groups.find((g) => g.key === open.group) : undefined;

  // After a delete the viewer shows the next photo in the group, or closes if it was the last.
  const remover = usePhotoDelete(
    job.id,
    (photoId) => {
      setPhotos((current) => current?.filter((p) => p.id !== photoId) ?? current);
      setOpen((o) => {
        if (!o || !openGroup) return o;
        const left = openGroup.photos.filter((p) => p.id !== photoId).length;
        return left === 0 ? null : { ...o, index: Math.min(o.index, left - 1) };
      });
      onChanged?.();
    },
    (message) => {
      setError(message);
      load();
    },
  );
  const anyLocked = (photos ?? []).some((p) => p.lockedBy === "milestone_invoiced");

  async function uploadAll(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.heic$/i.test(f.name));
    if (!images.length) {
      setError(t("jobs.photosSection.chooseImages"));
      return;
    }
    setError(null);
    const batch = images.map((file) => ({ file, key: `${Date.now()}-${Math.random()}` }));
    setUploads((current) => [...current, ...batch.map((b) => ({ key: b.key, name: b.file.name, error: null }))]);
    await Promise.all(
      batch.map(async ({ file, key }) => {
        try {
          const uploaded = await apiClient.upload<UploadedFile>("/files", file);
          await apiClient.post(`/jobs/${job.id}/photos`, { fileId: uploaded.id });
          setUploads((current) => current.filter((u) => u.key !== key));
        } catch (err) {
          const why = err instanceof Error ? err.message : t("jobs.photosSection.uploadFailed");
          setUploads((current) => current.map((u) => (u.key === key ? { ...u, error: why } : u)));
        }
      }),
    );
    load();
    onChanged?.();
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) void uploadAll(files);
  }

  const dropProps = canUpload
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          void uploadAll(Array.from(e.dataTransfer.files));
        },
      }
    : {};

  const uploadTiles = uploads.map((u) => (
    <div
      key={u.key}
      className={cn("flex aspect-4/3 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-3 text-center text-[12px]", u.error ? "border-overdue bg-overdue-bg text-overdue" : "border-border bg-surface-sunken text-on-surface-muted")}
      data-testid="photo-upload"
    >
      {u.error ? <TriangleAlert size={18} aria-hidden /> : <Upload size={18} aria-hidden />}
      <span className="max-w-full truncate font-medium">{u.name}</span>
      {u.error ? (
        <>
          <span>{u.error}</span>
          <button type="button" className="inline-flex items-center gap-1 font-medium underline" onClick={() => setUploads((c) => c.filter((x) => x.key !== u.key))}>
            <X size={12} aria-hidden />
            {t("jobs.photosSection.dismiss")}
          </button>
        </>
      ) : (
        <>
          <span className="sr-only">{t("jobs.photosSection.uploading")}</span>
          <span className="h-1 w-3/4 overflow-hidden rounded-full bg-border" aria-hidden>
            <span className="block h-full w-1/2 rounded-full bg-primary motion-safe:animate-pulse" />
          </span>
        </>
      )}
    </div>
  ));

  return (
    <Card className={cn("flex flex-col gap-4 transition-colors", dragging && "border-primary bg-info-bg/40")} {...dropProps} data-testid="job-photos">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-on-surface">{t("jobs.photosSection.title")}</h3>
          {canUpload && <p className="text-[12.5px] text-on-surface-muted">{t("jobs.photosSection.hint")}</p>}
        </div>
        {canUpload && (
          <>
            <Button onClick={() => inputRef.current?.click()}>
              <ImagePlus size={15} aria-hidden />
              {t("jobs.photosSection.addPhotos")}
            </Button>
            <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} multiple className="hidden" onChange={onFiles} data-testid="photo-input" />
          </>
        )}
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!photos ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : groups.length === 0 && uploads.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">{t("jobs.photosSection.empty")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {uploads.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{uploadTiles}</div>}
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label} className="flex flex-col gap-2.5" data-testid="photo-group">
              <h4 className="text-[13px] font-semibold text-on-surface">
                {group.label}
                <span className="font-normal text-on-surface-muted">
                  {group.note ? ` · ${group.note}` : ""} · {group.photos.length}
                </span>
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.photos.map((photo, index) => {
                  const name = photo.caption ?? t("jobs.photosSection.photo");
                  return (
                    <div key={photo.id} className="group relative" data-testid="photo-tile">
                      <button
                        type="button"
                        onClick={() => setOpen({ group: group.key, index })}
                        className="relative block aspect-4/3 w-full overflow-hidden rounded-md border border-border bg-surface-sunken text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={t("jobs.photosSection.openAria", { name })}
                      >
                        {/* A file served by our own API, not a Next-optimizable asset. */}
                        <img src={photoUrl(photo.fileId)} alt="" className="h-full w-full object-cover transition-transform motion-safe:group-hover:scale-105" />
                        {photo.caption && (
                          <span className="absolute inset-x-0 bottom-0 truncate bg-inverse-surface/70 px-2 py-1 text-[11.5px] font-medium text-inverse-on-surface">{photo.caption}</span>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={t("jobs.photosSection.actionsAria", { name })}
                            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-on-surface opacity-100 shadow-sm transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            data-testid="photo-menu"
                          >
                            <MoreHorizontal size={16} aria-hidden />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setOpen({ group: group.key, index })}>
                            <MENU_ICONS.view aria-hidden />
                            {t("jobs.photosSection.open")}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={photoUrl(photo.fileId, true)}>
                              <MENU_ICONS.download aria-hidden />
                              {t("jobs.photosSection.download")}
                            </a>
                          </DropdownMenuItem>
                          {remover.canDelete(photo) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem destructive onSelect={() => remover.request(photo)}>
                                <MENU_ICONS.delete aria-hidden />
                                {t("jobs.photosSection.delete")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {anyLocked && <p className="text-[12.5px] text-on-surface-muted">{t("jobs.photosSection.lockedNote")}</p>}
        </div>
      )}

      {remover.dialog}
      <PhotoViewer
        photos={openGroup?.photos ?? []}
        index={open && openGroup ? open.index : null}
        groupLabel={openGroup?.label ?? ""}
        onIndexChange={(index) => setOpen((o) => (o ? { ...o, index } : o))}
        onClose={() => setOpen(null)}
        canDelete={remover.canDelete}
        onDelete={remover.request}
      />
    </Card>
  );
}
