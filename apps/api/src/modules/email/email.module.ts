import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmailLogController } from "./email-log.controller";
import { EmailLogService } from "./email-log.service";
import { EmailService } from "./email.service";

/**
 * SMTP/Nodemailer wrapper — see email.service.ts — and the email log
 * (US-SET-27–29, D-220): queue workers (e.g. quotes/quote-email.worker.ts)
 * queue through `EmailLogService.enqueue` and wrap each try in `attempt`;
 * `/emails` lists, retries and cancels for Owners.
 */
@Module({
  imports: [AuditModule],
  controllers: [EmailLogController],
  providers: [EmailService, EmailLogService],
  exports: [EmailService, EmailLogService],
})
export class EmailModule {}
