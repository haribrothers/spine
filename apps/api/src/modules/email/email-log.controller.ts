import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { EMAIL_KINDS, EMAIL_LOG_STATUSES, type EmailKind, type EmailLogStatus } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { EmailLogService } from "./email-log.service";

const list = <T extends string>(value: string | undefined, allowed: readonly T[]): T[] | undefined => {
  const items = (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is T => (allowed as readonly string[]).includes(s));
  return items.length ? items : undefined;
};
const day = (value: string | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

/**
 * US-SET-27–29 (D-220) — the email log. Owner-only, never Team-configurable:
 * it lists every customer and team email (07-security).
 */
@Controller("emails")
export class EmailLogController {
  constructor(private readonly emails: EmailLogService) {}

  @Get()
  @OrgRoles(["owner"])
  async list(@Session() session: UserSession, @Query("status") status?: string, @Query("kind") kind?: string, @Query("from") from?: string, @Query("to") to?: string, @Query("entityId") entityId?: string) {
    return this.emails.list(requireOrgId(session), {
      status: list<EmailLogStatus>(status, EMAIL_LOG_STATUSES),
      kind: list<EmailKind>(kind, EMAIL_KINDS),
      from: day(from),
      to: day(to),
      entityId: entityId && /^[0-9a-f-]{36}$/i.test(entityId) ? entityId : undefined,
    });
  }

  @Get("status")
  @OrgRoles(["owner"])
  async status(@Session() session: UserSession) {
    return this.emails.status(requireOrgId(session));
  }

  @Post(":id/retry")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async retry(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.emails.retry(requireOrgId(session), id, session.user.id);
  }

  @Post(":id/cancel")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async cancel(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.emails.cancel(requireOrgId(session), id, session.user.id);
  }
}
