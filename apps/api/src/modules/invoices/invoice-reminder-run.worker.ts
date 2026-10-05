import { Injectable, OnModuleInit } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { InvoiceRemindersService } from "./invoice-reminders.service";

export const INVOICE_REMINDER_RUN_QUEUE = "invoice-reminder-run";
/** Every 15 minutes, so a run starts within 15 minutes of "Send at" and again after a restart. */
const POLL_CRON = "*/15 * * * *";

/** US-INV-19 — fires the daily reminder run (InvoiceRemindersService.runDue decides whether today is due). */
@Injectable()
export class InvoiceReminderRunWorker implements OnModuleInit {
  constructor(
    private readonly queue: QueueService,
    private readonly reminders: InvoiceRemindersService,
  ) {}

  async onModuleInit() {
    await this.queue.schedule(INVOICE_REMINDER_RUN_QUEUE, POLL_CRON);
    await this.queue.work(INVOICE_REMINDER_RUN_QUEUE, async () => {
      await this.reminders.runDue(new Date());
    });
  }
}
