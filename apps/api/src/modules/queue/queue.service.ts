import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PgBoss, type Job as PgBossJob } from "pg-boss";

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
  async send(queueName: string, data: object) {
    const boss = this.getBoss();
    await boss.createQueue(queueName).catch(() => {
      // createQueue is idempotent per pg-boss docs but throws if the queue
      // already exists in some versions/race conditions — swallow rather
      // than fail the enqueue over a harmless "already exists".
    });
    await boss.send(queueName, data, {
      retryLimit: 3,
      retryDelay: 5,
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
}
