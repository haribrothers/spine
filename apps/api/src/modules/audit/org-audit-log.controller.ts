import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { requireOrgId } from "../org/settings.controller";
import { OrgAuditLogService, type AuditLogFilters } from "./org-audit-log.service";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function filtersFrom(q: Record<string, string | undefined>): AuditLogFilters {
  for (const key of ["from", "to"] as const) {
    if (q[key] && !DATE.test(q[key]!)) throw new BadRequestException(`"${key}" must be a date like 2026-10-05.`);
  }
  return { from: q.from || undefined, to: q.to || undefined, userId: q.userId || undefined, entityType: q.entityType || undefined, action: q.action || undefined };
}

/** US-SET-11/12 (D-064) — the organisation audit log. Owners only, never Team-configurable. */
@Controller("org")
@OrgRoles(["owner"])
export class OrgAuditLogController {
  constructor(private readonly auditLog: OrgAuditLogService) {}

  /** `cursor` is the position of the page's first entry (0, 50, 100…). */
  @Get("audit-log")
  async list(@Session() session: UserSession, @Query() query: Record<string, string | undefined>) {
    const offset = Math.max(0, Number(query.cursor) || 0);
    return this.auditLog.page(requireOrgId(session), filtersFrom(query), offset);
  }
}
