"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Slider,
  Spinner,
} from "@spine/ui";
import { cropAndResizeImage } from "./crop-and-resize-image";
import { useT } from "./i18n";

/**
 * A focused, one-off crop step between "user picked a file" and "upload
 * fires" — used by `ContactLogo` and the onboarding/Settings business logo
 * upload. Locked to a 1:1 aspect ratio — logos/avatars only ever render
 * square/circular, so there's no aspect-ratio choice to expose. Lives in
 * `apps/web/src/lib/` (moved out of `apps/web/src/app/contacts/`, its
 * original single consumer) since it's a generic Dialog + crop-widget
 * composition with no Contacts-specific logic.
 */
export function LogoCropDialog({
  open,
  imageSrc,
  cropShape = "round",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** Object URL for the freshly-picked file. */
  imageSrc: string | null;
  /** "round" for circular avatars (contacts), "rect" for square logos. Default "round". */
  cropShape?: "round" | "rect";
  onCancel: () => void;
  /** Receives the cropped + resized File, ready to upload. */
  onConfirm: (file: File) => Promise<void> | void;
}) {
  const t = useT();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  function resetAndCancel() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
    onCancel();
  }

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    setError(null);
    try {
      const file = await cropAndResizeImage(imageSrc, croppedAreaPixels);
      await onConfirm(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.logoCrop.cropFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && resetAndCancel()}>
      <DialogContent size="md" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("common.logoCrop.title")}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {imageSrc && (
            <div className="relative h-64 w-full overflow-hidden rounded-md bg-surface-sunken">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape={cropShape}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-[12px] text-on-surface-muted">{t("common.logoCrop.zoom")}</span>
            <Slider
              value={[zoom]}
              onValueChange={([value]) => setZoom(value ?? 1)}
              min={1}
              max={3}
              step={0.01}
              aria-label={t("common.logoCrop.zoom")}
              className="flex-1"
            />
          </div>

          {error && <p className="mt-2 text-[12px] text-overdue">{error}</p>}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={resetAndCancel} disabled={saving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !croppedAreaPixels}>
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {t("common.logoCrop.saving")}
              </>
            ) : (
              t("common.logoCrop.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
