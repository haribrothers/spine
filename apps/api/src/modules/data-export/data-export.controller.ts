import { Body, Controller, Get, Param, Post, Res, UseInterceptors } from "@nestjs/common";
import { OptionalAuth, OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createDataExportSchema } from "@spine/shared";
import type { Response } from "express";
import type { z } from "zod";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { requireOrgId } from "../org/settings.controller";
import { DataExportService } from "./data-export.service";

/** US-SET-15/16 (D-094) — Data export. Owner-only, never Team-configurable. */
@Controller("org/exports")
export class DataExportController {
  constructor(private readonly exports: DataExportService) {}

  @Post()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body(new ZodValidationPipe(createDataExportSchema)) body: z.infer<typeof createDataExportSchema>) {
    return this.exports.request(requireOrgId(session), session.user.id, body);
  }

  @Get()
  @OrgRoles(["owner"])
  async latest(@Session() session: UserSession) {
    return { export: await this.exports.latest(requireOrgId(session)) };
  }

  /**
   * US-SET-16 — no role guard and optional sign-in on purpose: anyone who
   * isn't an Owner of the organisation (signed out included), or once the
   * link has expired, gets 404 — not 401 or 403 — so the link reveals nothing.
   */
  @Get(":id/download")
  @OptionalAuth()
  async download(@Session() session: UserSession | null | undefined, @Param("id") id: string, @Res() res: Response) {
    const orgId = (session?.session as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId ?? null;
    const file = await this.exports.download(orgId, session?.user.id ?? null, id);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    if (file.size) res.setHeader("Content-Length", String(file.size));
    file.stream.pipe(res);
  }
}
