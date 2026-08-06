import { Module } from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";

/**
 * First real writer to `audit_log` (previously `@Module({})`, table
 * existed in schema only — see CHANGELOG). Exported so ContactsModule can
 * inject `AuditLogService` into ContactsService/LeadsService/
 * ActivitiesService without those services owning their own audit-writing
 * logic.
 */
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
