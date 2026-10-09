import { useEffect, useRef } from "react";
import type { LocalPhoto } from "../outbox/types";

/**
 * Photos the camera hands back to the screen that opened it (a milestone's
 * completion, a receipt): the caller picks a request id, opens
 * `/camera?request=<id>`, and gets the photos when the camera closes.
 */
const listeners = new Map<string, (photos: LocalPhoto[]) => void>();

export const cameraHandoff = {
  deliver(request: string, photos: LocalPhoto[]) {
    listeners.get(request)?.(photos);
  },
};

/** Calls `onPhotos` with what the camera returns for `request`. */
export function useCameraResult(request: string, onPhotos: (photos: LocalPhoto[]) => void) {
  const callback = useRef(onPhotos);
  callback.current = onPhotos;
  useEffect(() => {
    listeners.set(request, (photos) => callback.current(photos));
    return () => {
      listeners.delete(request);
    };
  }, [request]);
}
