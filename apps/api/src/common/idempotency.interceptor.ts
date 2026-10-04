import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { DATABASE } from "../db/db.module";
import type { Database } from "../db/client";
import { idempotencyKeys } from "../db/schema";

const PENDING = "pending";

/**
 * Every mutating route takes an `Idempotency-Key` (D-009, US-OPS-08), so a
 * retry or a double-click never repeats an action. A key is scoped to the
 * organisation, the user and the actual request path (method plus path, not
 * the route pattern), so two people, two devices or two records can never
 * share one.
 *
 * - First request with a key: runs, and its response is stored.
 * - Same key again after it finished: the stored response is returned and
 *   nothing runs again.
 * - Same key while the first is still running: 409.
 * - A request that fails frees its key, so it can be retried.
 * - No key: 400.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers["idempotency-key"];

    if (!key || typeof key !== "string") {
      throw new BadRequestException("Idempotency-Key header is required for this endpoint");
    }

    const orgId: string | undefined = request.session?.session?.activeOrganizationId;
    const userId: string | undefined = request.session?.user?.id;
    if (!orgId || !userId) {
      throw new BadRequestException("No active organisation on session");
    }

    const path = `${request.baseUrl ?? ""}${request.path ?? request.url}`;
    const endpoint = `${request.method} ${path}`;
    const scope = and(
      eq(idempotencyKeys.orgId, orgId),
      eq(idempotencyKeys.userId, userId),
      eq(idempotencyKeys.endpoint, endpoint),
      eq(idempotencyKeys.key, key),
    );

    const [existing] = await this.db.select().from(idempotencyKeys).where(scope);
    if (existing) {
      if (existing.responseStatus === PENDING) {
        throw new ConflictException("This request is already being processed. Wait a moment, then refresh.");
      }
      return of(existing.responseBody);
    }

    try {
      await this.db.insert(idempotencyKeys).values({ orgId, userId, endpoint, key, responseStatus: PENDING, responseBody: null });
    } catch {
      // Another request with the same key landed between the SELECT and INSERT.
      throw new ConflictException("This request is already being processed. Wait a moment, then refresh.");
    }

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          await this.db.update(idempotencyKeys).set({ responseStatus: "200", responseBody: responseBody ?? null }).where(scope);
        },
        error: async () => {
          await this.db.delete(idempotencyKeys).where(scope);
        },
      }),
    );
  }
}
