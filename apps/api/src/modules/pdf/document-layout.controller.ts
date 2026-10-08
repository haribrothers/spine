import { BadRequestException, Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { DOCUMENT_TYPES, documentLayoutSchema, type DocumentType } from "@spine/shared";
import { requireOrgId } from "../org/settings.controller";
import { DocumentPreviewService } from "./document-preview.service";

/**
 * US-SET-17 — `GET /org/settings/document_layout/preview?type=&layout=`: a
 * sample PDF of one document type with the options being edited (the
 * `layout` query is the unsaved `document_layout` as base64url JSON).
 * Owner-only, like the setting itself; it reads and stores nothing else.
 */
@Controller("org/settings/document_layout")
export class DocumentLayoutController {
  constructor(private readonly preview: DocumentPreviewService) {}

  @Get("preview")
  @OrgRoles(["owner"])
  async getPreview(@Session() session: UserSession, @Query("type") type: string, @Query("layout") encoded: string | undefined, @Res() res: Response) {
    if (!(DOCUMENT_TYPES as readonly string[]).includes(type)) throw new BadRequestException("Choose a document type to preview.");
    let raw: unknown = {};
    if (encoded) {
      try {
        raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      } catch {
        throw new BadRequestException("Couldn't read the layout to preview.");
      }
    }
    const parsed = documentLayoutSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the layout options and try again.");
    const buffer = await this.preview.render(requireOrgId(session), type as DocumentType, parsed.data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${type}-preview.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  }
}
