import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { and, eq, inArray } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import type { Capability } from "@spine/shared";
import { auth } from "./auth";
import { DATABASE } from "../db/db.module";
import type { Database } from "../db/client";
import { member, teamMemberships, teamPrivileges } from "../db/schema";
import { CAPABILITY_KEY } from "./require-capability.decorator";

/**
 * Registered as a global APP_GUARD in app.module.ts. @thallesp/nestjs-
 * better-auth's AuthModule.forRoot self-registers its own AuthGuard as a
 * global APP_GUARD too (there is no separate OrgRolesGuard; @OrgRoles is
 * handled inside that same AuthGuard) — this guard used to assume Nest
 * would run that AuthGuard first (since AuthModule.forRoot is imported
 * before this guard is declared in app.module.ts's providers array) and
 * read `request.session` off the raw request as a result. That assumption
 * was wrong: verified live against a real running server that
 * `request.session` is still `undefined` here even on routes where
 * @OrgRoles' own check already passed — Nest does not order cross-module
 * global APP_GUARDs by import position, only by each module's own
 * discovery order in the DI graph. So this guard resolves the session
 * itself via `auth.api.getSession` (the same primitive AuthGuard uses
 * internally), falling back to `request.session` first in case a future
 * Nest/AuthModule version does populate it before this guard runs — never
 * trusting guard ordering either way.
 *
 * No-ops for any route without @RequireCapability metadata, so it's safe to
 * register globally without affecting routes that don't use it.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Capability | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    // NOT guaranteed to be Better Auth's own AuthGuard's request.session yet
    // — despite this guard being declared after AuthModule.forRoot(...) in
    // app.module.ts, Nest does not order cross-module global APP_GUARDs by
    // import position; verified live that request.session is still
    // undefined here on a real HTTP request even though @OrgRoles' own
    // AuthGuard check on the very same route passes. So this guard resolves
    // the session itself, the same way AuthGuard does internally
    // (auth.api.getSession against the request's own headers) rather than
    // depending on guard execution order at all.
    const session = request.session ?? (await auth.api.getSession({ headers: request.headers ? fromNodeHeaders(request.headers) : new Headers() }));
    const orgId: string | undefined = session?.session?.activeOrganizationId;
    const userId: string | undefined = session?.user?.id;
    if (!orgId || !userId) {
      // Should be unreachable — @OrgRoles already requires an active org —
      // but fail closed rather than assume.
      throw new ForbiddenException("No active organisation on session");
    }

    const [membership] = await this.db
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
    if (!membership) {
      throw new ForbiddenException("Not a member of this organisation");
    }

    if (membership.role === "owner") return true;

    if (membership.role !== "staff") {
      // field, or any future fixed role — @RequireCapability is meaningless
      // for a fixed role; reaching here is a controller misconfiguration,
      // not something to silently allow.
      throw new ForbiddenException(`Role "${membership.role}" is not eligible for capability "${required}"`);
    }

    const teamIds = await this.db
      .select({ teamId: teamMemberships.teamId })
      .from(teamMemberships)
      .where(eq(teamMemberships.memberId, membership.id));
    if (teamIds.length === 0) {
      throw new ForbiddenException(`Missing capability: ${required}`);
    }

    const [grant] = await this.db
      .select({ granted: teamPrivileges.granted })
      .from(teamPrivileges)
      .where(
        and(
          inArray(
            teamPrivileges.teamId,
            teamIds.map((t) => t.teamId),
          ),
          eq(teamPrivileges.capability, required),
          eq(teamPrivileges.granted, true),
        ),
      )
      .limit(1);

    if (!grant) {
      throw new ForbiddenException(`Missing capability: ${required}`);
    }
    return true;
  }
}
