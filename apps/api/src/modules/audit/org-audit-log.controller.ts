import { BadRequestException, Controller, Get, Query, Res } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { auditEntityLabel } from "@spine/shared";
import type { Response } from "express";
import { toCsv } from "../../common/csv";
import { requireOrgId } from "../org/settings.controller";
import { OrgAuditLogService, type AuditLogFilters } from "./org-audit-log.service";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function filtersFrom(q: Record<string, string | undefined>): AuditLogFilters {
  for (const key of ["from", "to"] as const) {
    if (q[key] && !DATE.test(q[key]!)) throw new BadRequestException(`"${key}" must be a date like 2026-10-05.`);
  }
  return { from: q.from || undefined, to: q.to || undefined, userId: q.userId || undefined, entityType: q.entityType || undefined, entityId: q.entityId || undefined, action: q.action || undefined };
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

  /** US-SET-12 — the filtered entries as CSV, streamed in batches so a large log never times out. */
  @Get("audit-log.csv")
  async csv(@Session() session: UserSession, @Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const filters = filtersFrom(query);
    const orgId = requireOrgId(session);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.write(toCsv(["timestamp", "actor_name", "actor_email", "action", "record_type", "record_id", "record", "changes"], []));
    for await (const batch of this.auditLog.stream(orgId, filters)) {
      const rows = batch.map((e) => [e.createdAt, e.actor?.name ?? "", e.actor?.email ?? "", e.action, auditEntityLabel(e.entityType), e.entityId, e.recordLabel ?? "", e.changes == null ? "" : JSON.stringify(e.changes)]);
      res.write(`\r\n${toCsv([], rows).replace(/^\r\n/, "")}`);
    }
    res.end();
  }
}
