import { Injectable, OnModuleInit } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { RecurringInvoiceRunService } from "./recurring-invoice-run.service";

export const RECURRING_INVOICE_RUN_QUEUE = "recurring-invoice-run";
/** Every 15 minutes, so the 6:00 AM run starts on time and a restarted server catches up straight away. */
const POLL_CRON = "*/15 * * * *";

/** US-INV-21 — fires the recurring invoice run (RecurringInvoiceRunService.runDue decides what's due). */
@Injectable()
export class RecurringInvoiceRunWorker implements OnModuleInit {
  constructor(
    private readonly queue: QueueService,
    private readonly run: RecurringInvoiceRunService,
  ) {}

  async onModuleInit() {
    await this.queue.schedule(RECURRING_INVOICE_RUN_QUEUE, POLL_CRON);
    await this.queue.work(RECURRING_INVOICE_RUN_QUEUE, async () => {
      await this.run.runDue(new Date());
    });
  }
}
