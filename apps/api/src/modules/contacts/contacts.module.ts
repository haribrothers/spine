import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { OrgModule } from "../org/org.module";
import { ActivitiesController } from "./activities.controller";
import { ActivitiesService } from "./activities.service";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";
import { MeetingsController } from "./meetings.controller";
import { MeetingsService } from "./meetings.service";

/**
 * First real business/domain module in this codebase (everything before
 * was infrastructure). Covers all of PRD FEAT-01 Contacts & CRM's stories:
 * contacts (customer/vendor/both, persons, addresses), leads (fixed-stage
 * pipeline), activities (call/meeting/note/task + overdue follow-ups), and
 * meetings (S-01.9 — scheduled calendar events, optionally linked to a
 * contact; distinct from activities' own "meeting" type, see
 * meetings.ts's schema comment).
 */
@Module({
  imports: [AuditModule, OrgModule],
  controllers: [ContactsController, LeadsController, ActivitiesController, MeetingsController],
  providers: [ContactsService, LeadsService, ActivitiesService, MeetingsService],
  exports: [ContactsService, LeadsService, ActivitiesService, MeetingsService],
})
export class ContactsModule {}
