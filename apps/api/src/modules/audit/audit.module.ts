import { Module } from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";
import { OrgAuditLogController } from "./org-audit-log.controller";
import { OrgAuditLogService } from "./org-audit-log.service";

/**
 * First real writer to `audit_log` (previously `@Module({})`, table
 * existed in schema only — see CHANGELOG). Exported so ContactsModule can
 * inject `AuditLogService` into ContactsService/LeadsService/
 * ActivitiesService without those services owning their own audit-writing
 * logic.
 */
@Module({
  // US-SET-11/12: the organisation-wide log, Owner-only.
  controllers: [OrgAuditLogController],
  providers: [AuditLogService, OrgAuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
