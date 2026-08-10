"use client";

import { useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Spinner,
  Textarea,
} from "@spine/ui";
import { Camera, X } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import type { Job, Milestone, UploadedFile } from "../types";

/**
 * S-04.4 — "mark a milestone as complete with photos, so office staff can
 * raise the invoice." Field-reachable (gated on `jobs.update_milestones`
 * by the caller, not here — see MilestonesSection's own `canUpdateStatus`
 * prop), so this dialog is deliberately simple: pick photos, add an
 * optional note, submit. Photos use the same two-step upload pattern as
 * every other file attachment in this codebase (`business-logo-upload.tsx`)
 * — each picked file is uploaded to `POST /files` immediately on selection
 * (not deferred to submit time), and only the resulting file ids are sent
 * to `completeMilestoneSchema`'s `photoFileIds`.
 */
export function CompleteMilestoneDialog({
  job,
  milestone,
  onOpenChange,
  onCompleted,
}: {
  job: Job;
  milestone: Milestone | null;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ id: string; previewUrl: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = milestone !== null;

  function reset() {
    setNotes("");
    setPhotos([]);
    setError(null);
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const uploaded = await apiClient.upload<UploadedFile>("/files", file);
        setPhotos((current) => [...current, { id: uploaded.id, previewUrl: URL.createObjectURL(file) }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload one or more photos.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(id: string) {
    setPhotos((current) => current.filter((p) => p.id !== id));
  }

  async function handleSubmit() {
    if (!milestone) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/jobs/${job.id}/milestones/${milestone.id}/complete`, {
        completionNotes: notes.trim() || null,
        photoFileIds: photos.map((p) => p.id),
      });
      reset();
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark this milestone complete.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark "{milestone?.name}" complete</DialogTitle>
          <DialogDescription>Add completion photos and notes so office staff can raise the invoice.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField label="Completion notes" helperText="Optional — site conditions, what was done, anything worth recording.">
            {(field) => <Textarea {...field} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />}
          </FormField>

          <FormField label="Photos" helperText="Optional — attach progress or completion photos.">
            {() => (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="group relative h-16 w-16 overflow-hidden rounded-md border border-border">
                      {/* Object URL preview of a locally picked file, not an app asset — <Image> doesn't apply here. */}
                      <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => removePhoto(p.id)}
                        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                    className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-strong text-on-surface-muted transition-colors hover:bg-surface-sunken"
                  >
                    {uploading ? <Spinner size="sm" /> : <Camera size={18} />}
                    <span className="text-[10px]">Add</span>
                  </button>
                </div>
                <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
              </div>
            )}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || uploading}>
            {saving ? <Spinner size="sm" /> : "Mark complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
