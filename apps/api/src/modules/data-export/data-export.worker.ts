import { Injectable, OnModuleInit } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { DATA_EXPORT_QUEUE, DataExportService } from "./data-export.service";

export const DATA_EXPORT_CLEANUP_QUEUE = "data-export-cleanup";

/** US-SET-15/16 — builds requested exports, and every hour deletes those past their 7 days. */
@Injectable()
export class DataExportWorker implements OnModuleInit {
  constructor(
    private readonly queue: QueueService,
    private readonly exports: DataExportService,
  ) {}

  async onModuleInit() {
    await this.queue.work<{ exportId: string }>(DATA_EXPORT_QUEUE, async (job) => {
      await this.exports.process(job.data.exportId);
    });
    await this.queue.schedule(DATA_EXPORT_CLEANUP_QUEUE, "0 * * * *");
    await this.queue.work(DATA_EXPORT_CLEANUP_QUEUE, async () => {
      await this.exports.sweepExpired();
    });
  }
}
