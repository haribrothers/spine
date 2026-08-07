import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { NotificationsService } from "./notifications.service";
import { NotifyEmailWorker } from "./notify-email.worker";

/**
 * PRD F3 Stage 3 (S-03.7) — real implementation, replacing the empty
 * `@Module({})` stub. `NotificationsService` is exported so other modules
 * (QuotesModule now; Invoices/Payments later) can inject it for their own
 * "email the owner about X" needs. `NotifyEmailWorker` is a provider only
 * (not exported, not a controller) — it self-registers with pg-boss via its
 * own `onModuleInit`, mirroring `QuoteEmailWorker`'s exact shape.
 */
@Module({
  imports: [EmailModule],
  providers: [NotificationsService, NotifyEmailWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}
