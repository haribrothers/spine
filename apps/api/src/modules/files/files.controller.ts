import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { FilesService } from "./files.service";

/** Matches CLAUDE.md's field-role-read-only precedent, same as Contacts. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — generous for a logo/avatar or a document attachment.

@Controller("files")
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Owner+staff+field can upload. Originally owner+staff only (matching
   * every other mutating Contacts endpoint); widened to include field once
   * this became the same endpoint a personal avatar upload
   * (Profile & Preferences, PRD S-10.17 — "every user regardless of role")
   * goes through, and site-photo capture (F11) already implies field needs
   * upload access generally, not just avatars.
   *
   * `FileInterceptor` (multer, from `@nestjs/platform-express` — already a
   * dependency, main.ts already uses this platform adapter) parses the
   * `multipart/form-data` body itself; it does not depend on Nest's global
   * body parser, which is disabled in main.ts only so Better Auth can read
   * the raw request stream for its own (non-multipart) routes.
   *
   * `IdempotencyInterceptor` runs after `FileInterceptor` in the decorator
   * list, so by the time it reads `request.headers`/`request.session` the
   * multipart body has already been consumed and `request.file` attached —
   * it never touches the raw body itself (only the JSON response it
   * stores), so it works unmodified here.
   */
  @Post()
  @OrgRoles(["owner", "staff", "field"])
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }), IdempotencyInterceptor)
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } })
  async upload(
    @Session() session: UserSession,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const orgId = requireOrgId(session);
    if (!file) {
      throw new BadRequestException("No file provided — send multipart/form-data with a 'file' field");
    }
    const row = await this.filesService.upload(orgId, {
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      uploadedByUserId: session.user?.id ?? null,
    });
    return row;
  }

  /**
   * Redirects to a short-lived signed URL rather than proxy-streaming the
   * bytes — see FilesService.getSignedUrl's comment for why. No role
   * restriction: any authenticated org member can view an attachment they
   * can already see metadata for (matching Contacts' GET routes carrying
   * no `@OrgRoles`, since field reads everything per §2.1).
   */
  @Get(":id")
  async get(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { url } = await this.filesService.getSignedUrl(orgId, id);
    res.redirect(302, url);
  }
}
