import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { OptionalAuth, OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { filesDamagedMessage } from "./file-integrity.worker";
import { verifyFileLink } from "./file-link";
import { FilesService, contentDisposition } from "./files.service";
import type { ByteRange } from "./storage/storage-driver";

/** Matches CLAUDE.md's field-role-read-only precedent, same as Contacts. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — generous for a logo/avatar or a document attachment.

/**
 * Parses a single `bytes=start-end` range. `null` means "send the whole
 * file"; `"unsatisfiable"` becomes a 416. Multi-range requests get the
 * whole file, which RFC 9110 allows.
 */
export function parseRange(header: string | undefined, size: number): ByteRange | null | "unsatisfiable" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startText, endText] = match;
  if (startText === "" && endText === "") return null;
  if (size === 0) return "unsatisfiable";
  let start: number;
  let end: number;
  if (startText === "") {
    // Suffix range: the last N bytes.
    const length = Number(endText);
    if (length === 0) return "unsatisfiable";
    start = Math.max(size - length, 0);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

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
   * US-OPS-28 — files whose last integrity check failed, for the Owners'
   * dashboard warning. Declared before `:id` so "integrity" isn't read as
   * a file id.
   */
  @Get("integrity")
  @OrgRoles(["owner"])
  async integrity(@Session() session: UserSession) {
    const summary = await this.filesService.integritySummary(requireOrgId(session));
    return { ...summary, message: summary.problemCount ? filesDamagedMessage(summary.problemCount) : null };
  }

  /**
   * US-OPS-27 — with the `local` driver the API streams the file with its
   * type, size, `ETag` and range support; with `s3` it redirects to a
   * presigned URL valid for 5 minutes. Either way the file must belong to
   * the caller's org. A request with no session is allowed only with a
   * valid signed link (`?exp=&sig=`, HMAC with `AUTH_SECRET`, ≤ 5 minutes).
   *
   * No role restriction: any org member can view an attachment they can
   * already see metadata for (matching Contacts' GET routes carrying no
   * `@OrgRoles`, since field reads everything per §2.1).
   */
  @Get(":id")
  @OptionalAuth()
  async get(
    @Session() session: UserSession | null | undefined,
    @Param("id") id: string,
    @Query("exp") exp: string | undefined,
    @Query("sig") sig: string | undefined,
    @Headers("range") rangeHeader: string | undefined,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    let file;
    if (session?.user) {
      const orgId = requireOrgId(session);
      file = await this.filesService.getMetadata(orgId, id);
      await this.filesService.assertReadableBy(orgId, session.user.id, file);
    } else if (sig !== undefined || exp !== undefined) {
      if (!verifyFileLink(id, exp, sig, process.env.AUTH_SECRET ?? "")) {
        throw new ForbiddenException("This file link has expired. Open the file from Spine again.");
      }
      file = await this.filesService.getMetadataForSignedLink(id);
    } else {
      throw new UnauthorizedException();
    }

    // US-OPS-29: browsers must never guess a different type from the bytes.
    res.setHeader("X-Content-Type-Options", "nosniff");
    const etag = `"${file.id}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");
    if (ifNoneMatch?.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag)) {
      res.status(304).end();
      return;
    }

    const size = Number(file.sizeBytes);
    const range = parseRange(rangeHeader, size);
    if (range === "unsatisfiable") {
      res.status(416).setHeader("Content-Range", `bytes */${size}`).end();
      return;
    }

    const download = await this.filesService.download(file, range ?? undefined);
    if (download.kind === "redirect") {
      res.redirect(302, download.url);
      return;
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", contentDisposition(file));
    res.setHeader("Accept-Ranges", "bytes");
    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
      res.setHeader("Content-Length", String(range.end - range.start + 1));
    } else {
      res.status(200);
      res.setHeader("Content-Length", String(size));
    }
    download.stream.on("error", (err) => res.destroy(err));
    download.stream.pipe(res);
  }
}
