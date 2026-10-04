"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, Card, Spinner } from "@spine/ui";
import { Camera } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCapability } from "../../../../lib/capabilities-context";
import { HistorySection } from "../../../../components/history-section";
import type { Job, JobPhoto, UploadedFile } from "../types";
import { PHOTO_ACCEPT } from "../../../../lib/upload-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
function fileUrl(fileId: string): string {
  return `${API_URL}/files/${fileId}`;
}

/**
 * S-04.10 (web upload) — a grid of every photo attached to the job,
 * general site photos and milestone-completion photos both (the same
 * `job_photos` table serves both — see jobs.ts's own doc comment on
 * `milestoneId`), plus an "Add photo" affordance for a general (not
 * milestone-tied) site/progress photo. Same two-step upload pattern as
 * CompleteMilestoneDialog: upload to `POST /files` on selection, then
 * `POST /jobs/:id/photos` with the resulting file id.
 */
export function PhotosSection({ job }: { job: Job }) {
  const canUpload = useCapability("job_photos.edit_own");
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<JobPhoto[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<JobPhoto[]>(`/jobs/${job.id}/photos`)
      .then(setPhotos)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load photos."));
  }, [job.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const uploaded = await apiClient.upload<UploadedFile>("/files", file);
        await apiClient.post(`/jobs/${job.id}/photos`, { fileId: uploaded.id });
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload one or more photos.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-on-surface">Photos</h3>
        {canUpload && (
          <>
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline disabled:opacity-50"
            >
              {uploading ? <Spinner size="sm" /> : <Camera size={14} />}
              Add photo
            </button>
            <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} multiple className="hidden" onChange={handleFilesSelected} />
          </>
        )}
      </div>

      {!photos ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : photos.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group flex flex-col gap-1 overflow-hidden rounded-md border border-border bg-surface">
              <a href={fileUrl(photo.fileId)} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden bg-surface-sunken">
                {/* Remote file served by our own API, not a Next-optimizable local asset. */}
                <img
                  src={fileUrl(photo.fileId)}
                  alt={photo.caption ?? "Job photo"}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </a>
              <div className="flex items-start justify-between gap-1 px-2 pb-2">
                <div className="min-w-0">
                  {photo.caption && <p className="truncate text-[12px] text-on-surface">{photo.caption}</p>}
                  <p className="text-[11px] text-on-surface-muted">
                    {photo.milestoneId ? "Milestone completion" : "Site photo"} · {new Date(photo.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <HistorySection endpoint={`/jobs/${job.id}/photos/${photo.id}/history`} subjectLabel="this photo" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
