"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Slider,
  Spinner,
} from "@spine/ui";
import { cropAndResizeImage } from "./crop-and-resize-image";

/**
 * A focused, one-off crop step between "user picked a file" and "upload
 * fires" for `ContactLogo`. Locked to a 1:1 aspect ratio — logos/avatars
 * only ever render square/circular, so there's no aspect-ratio choice to
 * expose. Scoped to `apps/web/src/app/contacts/` rather than `@spine/ui`:
 * this is one small app-level composition of an existing Dialog primitive
 * plus a single third-party crop widget, not a generic reusable pattern
 * yet — the same call this session's prior entries made for the four
 * "Add X" dialogs (Dialog composition stays app-level unless/until a
 * second real consumer shows up).
 */
export function LogoCropDialog({
  open,
  imageSrc,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** Object URL for the freshly-picked file. */
  imageSrc: string | null;
  onCancel: () => void;
  /** Receives the cropped + resized File, ready to upload. */
  onConfirm: (file: File) => Promise<void> | void;
}) {
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
      setError(err instanceof Error ? err.message : "Could not crop image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && resetAndCancel()}>
      <DialogContent size="md" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Crop logo</DialogTitle>
        </DialogHeader>

        {imageSrc && (
          <div className="relative h-64 w-full overflow-hidden rounded-md bg-surface-sunken">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <span className="text-[12px] text-on-surface-muted">Zoom</span>
          <Slider
            value={[zoom]}
            onValueChange={([value]) => setZoom(value ?? 1)}
            min={1}
            max={3}
            step={0.01}
            className="flex-1"
          />
        </div>

        {error && <p className="mt-2 text-[12px] text-overdue">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={resetAndCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !croppedAreaPixels}>
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
