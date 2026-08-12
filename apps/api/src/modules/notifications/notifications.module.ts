import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { OrgModule } from "../org/org.module";
import { MeetingReminderWorker } from "./meeting-reminder.worker";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotifyEmailWorker } from "./notify-email.worker";
import { PushService } from "./push.service";

/**
 * PRD F3 Stage 3 (S-03.7) + S-10.11 (added 2026-08-08) — real
 * implementation, replacing the empty `@Module({})` stub. `NotificationsService`
 * is exported so other modules (QuotesModule now; Invoices/Payments later)
 * can inject it for their own "notify X about Y" needs. `NotifyEmailWorker`
 * is a provider only (not exported, not a controller) — it self-registers
 * with pg-boss via its own `onModuleInit`, mirroring `QuoteEmailWorker`'s
 * exact shape. `NotificationsController` (new, S-10.11) exposes the
 * read-side (list/unread-count/mark-read) the in-app bell + drawer read
 * from.
 */
@Module({
  imports: [EmailModule, OrgModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotifyEmailWorker, MeetingReminderWorker, PushService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
