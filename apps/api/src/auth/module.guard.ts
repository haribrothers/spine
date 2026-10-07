import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import { MODULE_OFF_ERROR, moduleForRoute, moduleOffMessage } from "@spine/shared";
import { DATABASE } from "../db/db.module";
import type { Database } from "../db/client";
import { loadModules } from "../common/modules";
import { auth } from "./auth";

/**
 * US-SET-24 (D-154) — every route a switched-off module owns answers 403
 * `{ error: "MODULE_OFF" }`, from the web and the mobile app alike, before
 * capability checks (registered ahead of `CapabilityGuard`). Routes are
 * matched against the same map the web uses (`packages/shared/src/modules.ts`).
 * A module being off never widens access.
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    const request = context.switchToHttp().getRequest();
    const key = moduleForRoute(String(request.path ?? request.url ?? ""));
    if (!key) return true;
    const session = request.session ?? (await auth.api.getSession({ headers: request.headers ? fromNodeHeaders(request.headers) : new Headers() }));
    const orgId: string | undefined = session?.session?.activeOrganizationId;
    // Signed out or without an organisation: the other guards answer that.
    if (!orgId) return true;
    if ((await loadModules(this.db, orgId))[key]) return true;
    throw new ForbiddenException({ statusCode: 403, error: MODULE_OFF_ERROR, message: moduleOffMessage(key) });
  }
}
