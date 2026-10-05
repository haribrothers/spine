import { Injectable, OnModuleInit } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { DigestService } from "./digest.service";

export const DAILY_DIGEST_QUEUE = "daily-digest";
/** Every 15 minutes; each member's digest goes out on the first run at or after their "Send at" (US-NTF-13). */
const POLL_CRON = "*/15 * * * *";

@Injectable()
export class DailyDigestWorker implements OnModuleInit {
  constructor(
    private readonly queue: QueueService,
    private readonly digest: DigestService,
  ) {}

  async onModuleInit() {
    await this.queue.schedule(DAILY_DIGEST_QUEUE, POLL_CRON);
    await this.queue.work(DAILY_DIGEST_QUEUE, async () => {
      await this.digest.runDue(new Date());
    });
  }
}
