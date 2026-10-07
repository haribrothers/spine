import { Injectable, OnModuleInit } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { RecurringBillRunService } from "./recurring-bill-run.service";

export const RECURRING_BILL_RUN_QUEUE = "recurring-bill-run";
/** Every 15 minutes, so the 6:00 AM run starts on time and a restarted server catches up straight away. */
const POLL_CRON = "*/15 * * * *";

/** US-PUR-30 — fires the recurring bill run (RecurringBillRunService.runDue decides what's due). */
@Injectable()
export class RecurringBillRunWorker implements OnModuleInit {
  constructor(
    private readonly queue: QueueService,
    private readonly run: RecurringBillRunService,
  ) {}

  async onModuleInit() {
    await this.queue.schedule(RECURRING_BILL_RUN_QUEUE, POLL_CRON);
    await this.queue.work(RECURRING_BILL_RUN_QUEUE, async () => {
      await this.run.runDue(new Date());
    });
  }
}
