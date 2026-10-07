import type { DocumentLayout, ResolvedDocumentLayout } from "@spine/shared";
import type { FilesService } from "../files/files.service";

/**
 * US-SET-19 — the signature as a data URI for a PDF, when the document
 * type shows it and one is uploaded. A missing or damaged file leaves the
 * signature off rather than failing the document.
 */
export async function loadSignatureDataUri(files: FilesService, orgId: string, saved: DocumentLayout | null, layout: ResolvedDocumentLayout): Promise<string | undefined> {
  if (!layout.signature || !saved?.signatureFileId) return undefined;
  try {
    const { bytes, mimeType } = await files.readBytes(orgId, saved.signatureFileId);
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  } catch {
    return undefined;
  }
}
