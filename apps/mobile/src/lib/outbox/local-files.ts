import { Directory, File, Paths } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { LocalPhoto } from "./types";

/**
 * Photos and receipts waiting in the outbox are copied into the app's own
 * documents folder, so the camera roll or a cleared cache can't take them
 * away before they're sent; they're deleted once sent or discarded.
 */
const LONG_EDGE = 2048;
const QUALITY = 0.7;

export interface LocalFiles {
  /** Compresses a photo (D-053: before queueing; long edge at most 2048 px) and keeps a copy for the outbox. */
  keepPhoto(uri: string, options?: { name?: string; width?: number; height?: number }): Promise<LocalPhoto>;
  discard(photo: Pick<LocalPhoto, "uri">): void;
  /** False when the phone no longer has the file (cleared storage). */
  exists(photo: Pick<LocalPhoto, "uri">): boolean;
  /**
   * The photo as a multipart `file` field for `POST /files`. Expo's fetch
   * takes a real Blob — expo-file-system's `File` is one — and refuses
   * React Native's `{ uri, name, type }` parts ("Unsupported FormDataPart
   * implementation").
   */
  formData(photo: LocalPhoto): FormData;
}

function outboxFolder(): Directory {
  const dir = new Directory(Paths.document, "outbox");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export const deviceFiles: LocalFiles = {
  async keepPhoto(uri, options = {}) {
    const { width = 0, height = 0 } = options;
    const resize = Math.max(width, height) > LONG_EDGE ? [{ resize: width >= height ? { width: LONG_EDGE } : { height: LONG_EDGE } }] : [];
    const compressed = await manipulateAsync(uri, resize, { compress: QUALITY, format: SaveFormat.JPEG });
    const base = (options.name ?? `photo-${Date.now()}`).replace(/\.[a-z0-9]+$/i, "");
    const target = new File(outboxFolder(), `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}.jpg`);
    await new File(compressed.uri).copy(target);
    return { uri: target.uri, name: `${base}.jpg`, mimeType: "image/jpeg", size: target.info().size ?? 0 };
  },
  formData(photo) {
    const form = new FormData();
    form.append("file", new File(photo.uri) as unknown as Blob, photo.name);
    return form;
  },
  exists(photo) {
    try {
      return new File(photo.uri).exists;
    } catch {
      return false;
    }
  },
  discard(photo) {
    try {
      const file = new File(photo.uri);
      if (file.exists) file.delete();
    } catch {
      // Already gone.
    }
  },
};

/** "14.2 MB", "820 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
