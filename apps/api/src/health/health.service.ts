import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DATABASE } from "../db/db.module";
import type { Database } from "../db/client";
import { QueueService } from "../modules/queue/queue.service";

/** A check that hasn't answered in 3 s counts as down, so Docker's healthcheck never hangs. */
const CHECK_TIMEOUT_MS = 3000;

function withinTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("timed out")), CHECK_TIMEOUT_MS).unref();
    }),
  ]);
}

/** US-OPS-05 — what readiness depends on: the database and the job queue. */
@Injectable()
export class HealthService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
  ) {}

  async database(): Promise<boolean> {
    try {
      await withinTimeout(this.db.execute(sql`select 1`));
      return true;
    } catch {
      return false;
    }
  }

  async jobQueue(): Promise<boolean> {
    try {
      return await withinTimeout(this.queue.reachable());
    } catch {
      return false;
    }
  }
}
