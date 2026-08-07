import { Global, Module } from "@nestjs/common";
import { QueueService } from "./queue.service";

/**
 * Wraps `pg-boss` (see queue.service.ts for the full rationale). `@Global()`
 * so any feature module can inject `QueueService` without re-importing this
 * module everywhere, matching `DbModule`'s own precedent — a job queue is
 * as foundational as the DB connection itself once any module needs it.
 */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
