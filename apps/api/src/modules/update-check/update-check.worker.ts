import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { UpdateCheckService, updateCheckEnabled } from "./update-check.service";

export const UPDATE_CHECK_QUEUE = "update-check";
/** Once a day, at a quiet hour. */
const DAILY_CRON = "17 4 * * *";

/**
 * US-OPS-06 — the daily update check, plus one at start-up when the last
 * result is missing or a day old, so a new install's Owners hear about an
 * update without waiting for the night. With `UPDATE_CHECK=off` nothing is
 * scheduled, so no request is ever made.
 */
@Injectable()
export class UpdateCheckWorker implements OnModuleInit {
  private readonly logger = new Logger("Update check");

  constructor(
    private readonly queue: QueueService,
    private readonly updateCheck: UpdateCheckService,
  ) {}

  async onModuleInit() {
    if (!updateCheckEnabled()) return;
    await this.queue.schedule(UPDATE_CHECK_QUEUE, DAILY_CRON);
    await this.queue.work(UPDATE_CHECK_QUEUE, async () => {
      await this.updateCheck.check();
    });
    // Never stops the API from starting: the daily run catches up instead.
    try {
      if (await this.updateCheck.isStale()) await this.queue.send(UPDATE_CHECK_QUEUE, { reason: "start-up" });
    } catch (err) {
      this.logger.warn(`Could not queue the start-up update check: ${(err as Error).message}`);
    }
  }
}
