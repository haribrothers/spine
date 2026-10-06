import { BadRequestException, Body, Controller, Get, Post, Query, UseInterceptors } from "@nestjs/common";
import { attachmentQuerySchema, createAttachmentSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { AttachmentsService } from "./attachments.service";

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the request and try again.");
  return parsed.data;
}

/**
 * US-OPS-33 (D-156) — attachments on records. Every role reaches these
 * routes; the service applies the record's own read and edit rules.
 */
@Controller("attachments")
@OrgRoles(["owner", "staff", "field"])
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query() query: unknown) {
    const { entityType, entityId } = parse(attachmentQuerySchema, query);
    return this.attachments.list(requireOrgId(session), session.user.id, entityType, entityId);
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async add(@Session() session: UserSession, @Body() body: unknown) {
    return this.attachments.add(requireOrgId(session), session.user.id, parse(createAttachmentSchema, body));
  }
}
