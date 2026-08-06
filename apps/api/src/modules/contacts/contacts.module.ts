import { Module } from "@nestjs/common";
import { ActivitiesController } from "./activities.controller";
import { ActivitiesService } from "./activities.service";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";

/**
 * First real business/domain module in this codebase (everything before
 * was infrastructure). Covers PRD F1 Contacts & CRM's MUST-level stories
 * (S-01.1, S-01.2, S-01.4, S-01.6, S-01.7) per this task's scope — contacts
 * (customer/vendor/both, persons, addresses), leads (fixed-stage pipeline),
 * and activities (call/meeting/note/task + overdue follow-ups). Deferred:
 * S-01.3 unified timeline (nothing to show yet — quotes/invoices/payments
 * don't exist), S-01.5 pipeline board UI (data model is here, board is
 * not), S-01.8 CSV import.
 */
@Module({
  controllers: [ContactsController, LeadsController, ActivitiesController],
  providers: [ContactsService, LeadsService, ActivitiesService],
  exports: [ContactsService, LeadsService, ActivitiesService],
})
export class ContactsModule {}
