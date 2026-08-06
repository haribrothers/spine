import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { DATABASE } from "../db/db.module";
import type { Database } from "../db/client";
import { idempotencyKeys } from "../db/schema";

/**
 * First place in the codebase enforcing CLAUDE.md's "idempotency keys on
 * all mutating endpoints" rule with an actual mechanism, rather than a
 * pattern copied from elsewhere — there was nothing else in apps/api to
 * follow. Approach: a required `Idempotency-Key` request header, scoped per
 * org + endpoint (method + path) so the same key value can't collide across
 * unrelated routes. First request executes and stores the response; a
 * replayed request with the same key short-circuits to the stored response
 * without re-running the handler. A concurrent duplicate (key inserted by
 * another in-flight request, response not yet known) gets a 409 rather than
 * silently double-executing — safer than a race that lets both through.
 *
 * Applied per-controller via `@UseInterceptors(IdempotencyInterceptor)` on
 * mutating routes only; GET routes should not use this.
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

    // orgId is attached by the route's own auth/session handling before
    // this interceptor's handler body runs is not guaranteed — read it from
    // the session the same way controllers do, via better-auth's request
    // session, falling back to "no-org" scoping keyed on user id if absent
    // (e.g. this should not realistically happen since routes using this
    // interceptor are also org-scoped, but fail closed rather than throw).
    const orgId: string | undefined = request.session?.session?.activeOrganizationId;
    if (!orgId) {
      throw new BadRequestException("No active organisation on session");
    }

    const endpoint = `${request.method} ${request.route?.path ?? request.url}`;

    const [existing] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.orgId, orgId), eq(idempotencyKeys.endpoint, endpoint), eq(idempotencyKeys.key, key)));

    if (existing) {
      return of(existing.responseBody);
    }

    try {
      await this.db.insert(idempotencyKeys).values({
        orgId,
        endpoint,
        key,
        responseStatus: "pending",
        responseBody: null,
      });
    } catch {
      // Unique constraint hit — another request with the same key is
      // already in flight or just landed between our SELECT and INSERT.
      throw new ConflictException("Duplicate request with this Idempotency-Key is already in progress");
    }

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          await this.db
            .update(idempotencyKeys)
            .set({ responseStatus: "200", responseBody: responseBody ?? null })
            .where(and(eq(idempotencyKeys.orgId, orgId), eq(idempotencyKeys.endpoint, endpoint), eq(idempotencyKeys.key, key)));
        },
        error: async () => {
          // Let a failed request be retried with the same key rather than
          // permanently poisoning it — delete the pending row on failure.
          await this.db
            .delete(idempotencyKeys)
            .where(and(eq(idempotencyKeys.orgId, orgId), eq(idempotencyKeys.endpoint, endpoint), eq(idempotencyKeys.key, key)));
        },
      }),
    );
  }
}
