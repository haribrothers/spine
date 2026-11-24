import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrgModule } from "../org/org.module";
import { ActivitiesController } from "./activities.controller";
import { ActivitiesService } from "./activities.service";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { LeadStagesController } from "./lead-stages.controller";
import { LeadStagesService } from "./lead-stages.service";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";
import { MeetingsController } from "./meetings.controller";
import { MeetingsService } from "./meetings.service";

/**
 * First real business/domain module in this codebase (everything before
 * was infrastructure). Covers all of PRD FEAT-01 Contacts & CRM's stories:
 * contacts (customer/vendor/both, persons, addresses), leads (pipeline with
 * per-organisation stages, US-CRM-19), activities (call/meeting/note/task + overdue follow-ups), and
 * meetings (S-01.9 — scheduled calendar events, optionally linked to a
 * contact; distinct from activities' own "meeting" type, see
 * meetings.ts's schema comment).
 */
@Module({
  imports: [AuditModule, OrgModule, NotificationsModule],
  controllers: [ContactsController, LeadsController, LeadStagesController, ActivitiesController, MeetingsController],
  providers: [ContactsService, LeadsService, LeadStagesService, ActivitiesService, MeetingsService],
  exports: [ContactsService, LeadsService, LeadStagesService, ActivitiesService, MeetingsService],
})
export class ContactsModule {}
