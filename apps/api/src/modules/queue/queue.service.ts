import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PgBoss, type Job as PgBossJob } from "pg-boss";
import { sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";

/**
 * Thin wrapper around `pg-boss` (PRD stack table: "pg-boss (Postgres-backed
 * queue, avoids a Redis container)") — the first real job queue anywhere in
 * this codebase. pg-boss manages its own schema (a dedicated `pgboss`
 * Postgres schema, auto-created on `start()` against the same `DATABASE_URL`
 * this app already requires) — no separate migration or `.env` var needed
 * for it, and no new required env var: this module reuses `DATABASE_URL`.
 *
 * Started once at boot (`onModuleInit`) and stopped on shutdown
 * (`onModuleDestroy`), matching NestJS's own lifecycle hooks rather than a
 * bespoke bootstrap path — this runs in the same process as the HTTP API
 * (see `main.ts`), so `pnpm --filter @spine/api dev`/`start` starts the
 * worker automatically, with no separate command to document or forget to
 * run. A single-process design is appropriate here: this is a single-host,
 * self-hosted deployment (CLAUDE.md — "Docker Compose (single-host, not
 * Kubernetes)"), not a fleet that would need a dedicated worker
 * process/pod.
 *
 * If `DATABASE_URL` is unreachable at boot, `start()` throws — deliberately
 * NOT caught here. The whole app requires a working Postgres connection to
 * do anything (DbModule has no fallback either), so a broken DB is a real
 * boot failure, not something to degrade gracefully around. SMTP being
 * unset/down is the graceful-degradation case (handled entirely inside
 * `EmailService`/the job handler), not this.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private boss: PgBoss | null = null;

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async onModuleInit() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      // DbModule already throws on this at boot, so this branch is
      // unreachable in practice — guarded anyway so QueueService never
      // assumes DbModule's provider factory ran first.
      throw new Error("DATABASE_URL is required");
    }
    this.boss = new PgBoss({ connectionString: databaseUrl });
    this.boss.on("error", (err: Error) => this.logger.error("pg-boss error", err));
    await this.boss.start();
    this.logger.log("pg-boss started");
  }

  async onModuleDestroy() {
    await this.boss?.stop({ graceful: true, timeout: 5000 });
  }

  /** The started `PgBoss` instance — throws if called before `onModuleInit` has run (shouldn't happen; Nest awaits every module's `onModuleInit` before serving requests). */
  getBoss(): PgBoss {
    if (!this.boss) {
      throw new Error("QueueService used before pg-boss finished starting");
    }
    return this.boss;
  }

  /**
   * Enqueue a job. Retries with backoff by default (3 attempts, exponential
   * backoff starting at 5s) — this is the whole reason CLAUDE.md/`.env.
   * example` call for a real queue instead of a fire-and-forget attempt:
   * SMTP being down for a minute must not lose the email, it should retry
   * automatically without another user action.
   */
  async send(queueName: string, data: object, retry?: { retryLimit: number; retryDelay: number; retryDelayMax?: number }) {
    const boss = this.getBoss();
    await boss.createQueue(queueName).catch(() => {
      // createQueue is idempotent per pg-boss docs but throws if the queue
      // already exists in some versions/race conditions — swallow rather
      // than fail the enqueue over a harmless "already exists".
    });
    await boss.send(queueName, data, {
      retryLimit: retry?.retryLimit ?? 3,
      retryDelay: retry?.retryDelay ?? 5,
      ...(retry?.retryDelayMax !== undefined ? { retryDelayMax: retry.retryDelayMax } : {}),
      retryBackoff: true,
    });
  }

  /** Register a worker for `queueName`. Thin passthrough kept here so callers never import `pg-boss` types directly. */
  async work<T extends object>(queueName: string, handler: (job: PgBossJob<T>) => Promise<void>) {
    const boss = this.getBoss();
    await boss.createQueue(queueName).catch(() => {});
    await boss.work<T>(queueName, async (jobs: PgBossJob<T>[]) => {
      for (const job of jobs) {
        await handler(job);
      }
    });
  }

  /**
   * Arm a recurring job on a cron schedule — pg-boss's own scheduler
   * (`pgboss.schedule` table) fires `send()` internally on the given cron
   * expression, deduplicating so only one instance of the job is ever
   * queued per tick even with multiple app instances pointed at the same
   * database. First caller in this codebase: `MeetingReminderWorker`
   * (PRD S-10.21) — every prior queue use here was `send()`'s immediate,
   * one-shot enqueue triggered by a business action, never a clock.
   * Idempotent to call repeatedly (e.g. every boot) — pg-boss upserts the
   * schedule by `(name)`, so re-registering the same cron is a no-op.
   */
  async schedule(queueName: string, cron: string, data?: object) {
    const boss = this.getBoss();
    await boss.createQueue(queueName).catch(() => {});
    await boss.schedule(queueName, cron, data ?? null);
  }

  /**
   * Read-only listing of a queue's not-yet-completed jobs, for the "pending
   * emails" view (S-03.4 follow-up) — queries `pgboss.job` directly rather
   * than `PgBoss.fetch()`, since `fetch()` claims/dequeues jobs (moves them
   * to `active`), which would be a real side effect for what's meant to be
   * a passive status check. pg-boss has no public "peek without claiming"
   * API, so a direct read against its own schema (which it documents as
   * stable/inspectable — `pgboss.job` is not a private implementation
   * detail, other pg-boss tooling like its own dashboard reads it the same
   * way) is the correct approach here, not a hack around the library.
   * Filtered to `created`/`retry`/`active` — `completed`/`cancelled`/
   * `failed` are terminal and each already has its own durable signal
   * elsewhere (`quotes.emailStatus`), so this view is specifically "what's
   * still in flight," not a full job history.
   */
  async listPendingJobs(queueName: string, orgId: string): Promise<QueueJobSummary[]> {
    const result = await this.db.execute<{
      id: string;
      data: unknown;
      state: string;
      retry_count: number;
      retry_limit: number;
      created_on: Date;
      start_after: Date;
    }>(sql`
      SELECT id, data, state, retry_count, retry_limit, created_on, start_after
      FROM pgboss.job
      WHERE name = ${queueName}
        AND state IN ('created', 'retry', 'active')
        AND data->>'orgId' = ${orgId}
      ORDER BY created_on ASC
    `);
    return result.map((row) => ({
      id: row.id,
      data: row.data,
      state: row.state,
      retryCount: row.retry_count,
      retryLimit: row.retry_limit,
      createdOn: row.created_on,
      startAfter: row.start_after,
    }));
  }
}

export interface QueueJobSummary {
  id: string;
  data: unknown;
  state: string;
  retryCount: number;
  retryLimit: number;
  createdOn: Date;
  startAfter: Date;
}
