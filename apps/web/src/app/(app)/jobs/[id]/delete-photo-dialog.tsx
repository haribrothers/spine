"use client";

import { useCallback, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  FormField,
  Textarea,
} from "@spine/ui";
import { Lock } from "lucide-react";
import type { JobPhotoLockReason } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { useT } from "../../../../lib/i18n";
import { useToast } from "../../../../components/toast-host";
import type { JobPhoto } from "../types";

/**
 * US-JOB-39 (D-277) — the dialog that asks before a photo is deleted. The
 * API's photo list says who may delete each one (`canDelete`: the person
 * who added an open photo, or anyone with `job_photos.edit_others`; a
 * locked one, Owners only) and checks it again on delete. A locked photo
 * (job Completed or Cancelled, milestone invoiced) needs a reason the
 * job's activity keeps.
 *
 *   const remover = usePhotoDelete(jobId, (id) => …);
 *   remover.canDelete(photo) && <button onClick={() => remover.request(photo)}>…
 *   {remover.dialog}
 */
export function usePhotoDelete(jobId: string, onDeleted: (photoId: string) => void, onFailed?: (message: string) => void) {
  const t = useT();
  const showToast = useToast();
  const [photo, setPhoto] = useState<JobPhoto | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const canDelete = useCallback((p: JobPhoto) => p.canDelete === true, []);

  const request = useCallback((p: JobPhoto) => {
    setReason("");
    setPhoto(p);
  }, []);

  const locked: JobPhotoLockReason | null = photo?.locked ? (photo.lockedBy ?? "job_completed") : null;
  const lockedTitle: Record<JobPhotoLockReason, string> = {
    job_completed: t("jobs.photoDelete.lockedTitle_job_completed"),
    job_cancelled: t("jobs.photoDelete.lockedTitle_job_cancelled"),
    milestone_invoiced: t("jobs.photoDelete.lockedTitle_milestone_invoiced"),
  };
  const lockedLine: Record<JobPhotoLockReason, string> = {
    job_completed: t("jobs.photoDelete.lockedLine_job_completed"),
    job_cancelled: t("jobs.photoDelete.lockedLine_job_cancelled"),
    milestone_invoiced: t("jobs.photoDelete.lockedLine_milestone_invoiced"),
  };

  async function confirm() {
    if (!photo) return;
    setBusy(true);
    try {
      await apiClient.delete(`/jobs/${jobId}/photos/${photo.id}`, locked ? { reason: reason.trim() } : {});
      showToast(t("jobs.photoDelete.deleted"));
      onDeleted(photo.id);
    } catch (err) {
      onFailed?.(err instanceof Error ? err.message : t("jobs.photoDelete.failed"));
    } finally {
      setBusy(false);
      setPhoto(null);
    }
  }

  const dialog = (
    <AlertDialog open={photo !== null} onOpenChange={(open) => !open && !busy && setPhoto(null)}>
      <AlertDialogContent data-testid="photo-delete-dialog">
        <AlertDialogHeader>
          {locked && (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-on-surface-muted">
              <Lock size={13} aria-hidden />
              {lockedLine[locked]}
            </p>
          )}
          <AlertDialogTitle>{locked ? lockedTitle[locked] : t("jobs.photoDelete.title")}</AlertDialogTitle>
          <AlertDialogDescription>{locked ? t("jobs.photoDelete.lockedBody") : t("jobs.photoDelete.body")}</AlertDialogDescription>
        </AlertDialogHeader>
        {locked && (
          <FormField label={t("jobs.photoDelete.reason")} required>
            {(field) => <Textarea {...field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} autoFocus />}
          </FormField>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("jobs.photoDelete.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            disabled={busy || (locked !== null && !reason.trim())}
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {t("jobs.photoDelete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { canDelete, request, dialog };
}
