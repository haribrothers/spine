import { useEffect, useState } from "react";
import { Directory, File, Paths } from "expo-file-system";
import { CLIENT_VERSION_HEADER } from "@spine/shared/mobile";
import { APP_VERSION } from "../app-version";
import { useSignedInSession } from "../session/session-provider";

/** Downloads in flight, so a photo shown twice (the job and its photos) is fetched once. */
const downloading = new Map<string, Promise<string | null>>();

function cachedFile(fileId: string): File {
  const dir = new Directory(Paths.cache, "files");
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, fileId);
}

/**
 * A stored file (a job photo) as a local image URI: `GET /files/:id` with
 * the bearer token, so the server checks the owning record (US-OPS-20)
 * like any request, saved once in the app's cache folder. React Native's
 * Android image loader drops the `Authorization` header (every photo was a
 * 401 on Android, US-MOB-20), so the phone downloads the file itself; a
 * photo seen once also shows offline. Null until it's there (or if it
 * can't be fetched) — the tile shows its placeholder. An empty id (a
 * photo still on the phone) is skipped.
 */
export function useFileUri(fileId: string): string | null {
  const { apiBase, token } = useSignedInSession();
  const [uri, setUri] = useState<string | null>(() => {
    if (!fileId) return null;
    try {
      const file = cachedFile(fileId);
      return file.exists ? file.uri : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!fileId || uri) return;
    let live = true;
    let pending = downloading.get(fileId);
    if (!pending) {
      pending = File.downloadFileAsync(`${apiBase}/files/${fileId}`, cachedFile(fileId), {
        headers: { Authorization: `Bearer ${token}`, [CLIENT_VERSION_HEADER]: APP_VERSION },
      })
        .then((file) => file.uri)
        .catch(() => null)
        .finally(() => downloading.delete(fileId));
      downloading.set(fileId, pending);
    }
    void pending.then((next) => {
      if (live && next) setUri(next);
    });
    return () => {
      live = false;
    };
  }, [apiBase, token, fileId, uri]);

  return uri;
}
