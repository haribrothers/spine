import { CLIENT_VERSION_HEADER } from "@spine/shared/mobile";
import type { ImageURISource } from "react-native";
import { APP_VERSION } from "../app-version";
import { useSignedInSession } from "../session/session-provider";

/**
 * A stored file as an image source: `GET /files/:id` with the bearer token,
 * so the server checks the owning record (US-OPS-20) like any request.
 */
export function useFileSource(): (fileId: string) => ImageURISource {
  const { apiBase, token } = useSignedInSession();
  return (fileId) => ({ uri: `${apiBase}/files/${fileId}`, headers: { Authorization: `Bearer ${token}`, [CLIENT_VERSION_HEADER]: APP_VERSION } });
}
