import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";

/**
 * SMTP/Nodemailer wrapper — see email.service.ts. No controller: nothing
 * calls this directly over HTTP, only queue workers (e.g.
 * quotes/quote-email.worker.ts) inject it.
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
