"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage, Spinner } from "@spine/ui";
import { Camera } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { LogoCropDialog } from "../../../lib/logo-crop-dialog";
import { PHOTO_ACCEPT } from "../../../lib/upload-types";
import { useT } from "../../../lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface UploadedFile {
  id: string;
}

/**
 * Business logo upload for the onboarding wizard's business-profile step
 * and its Settings equivalent (both mount `BusinessProfileStep`) — the
 * S-12.2 follow-up replacing the interim "paste a logo URL" text field.
 * Reuses the same pick → crop (`LogoCropDialog`) → `POST /files` upload
 * flow `ContactLogo` already established; `onUploaded` reports the file's
 * resolved `GET /files/:id` URL, which the caller stores as `logoUrl` in
 * the `business_profile` settings blob — no schema change needed, since
 * that field was always just "a URL string", previously typed in by hand.
 */
export function BusinessLogoUpload({
  logoUrl,
  onChange,
}: {
  logoUrl?: string;
  onChange: (logoUrl: string | undefined) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedImageSrc, setPickedImageSrc] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pickedImageSrc) URL.revokeObjectURL(pickedImageSrc);
    };
  }, [pickedImageSrc]);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setPickedImageSrc(URL.createObjectURL(file));
  }

  function closeCropDialog() {
    if (pickedImageSrc) URL.revokeObjectURL(pickedImageSrc);
    setPickedImageSrc(null);
  }

  async function handleCropConfirm(croppedFile: File) {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await apiClient.upload<UploadedFile>("/files", croppedFile);
      onChange(`${API_URL}/files/${uploaded.id}`);
      closeCropDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.logoUpload.failed"));
      throw err; // keep the dialog open so the user can retry Save
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={t("onboarding.logoUpload.upload")}
        className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-md cursor-pointer"
      >
        <Avatar size="lg" className="h-14 w-14 rounded-md">
          {logoUrl && <AvatarImage src={logoUrl} alt={t("onboarding.logoUpload.alt")} className="rounded-md" />}
          <AvatarFallback className="rounded-md text-[15px]">
            <Camera size={18} />
          </AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? <Spinner size="sm" /> : <Camera size={16} className="text-white" />}
        </span>
      </button>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-on-surface">{logoUrl ? t("onboarding.logoUpload.uploaded") : t("onboarding.logoUpload.none")}</span>
        <span className="text-[12px] text-on-surface-muted">{t("onboarding.logoUpload.hint")}</span>
        {error && <span className="text-[12px] text-overdue">{error}</span>}
      </div>
      <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} className="hidden" onChange={handleFileSelected} />
      <LogoCropDialog
        open={pickedImageSrc !== null}
        imageSrc={pickedImageSrc}
        cropShape="rect"
        onCancel={closeCropDialog}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
