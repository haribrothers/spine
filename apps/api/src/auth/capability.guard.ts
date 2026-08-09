import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { and, eq, inArray } from "drizzle-orm";
import type { Capability } from "@spine/shared";
import { DATABASE } from "../db/db.module";
import type { Database } from "../db/client";
import { member, teamMemberships, teamPrivileges } from "../db/schema";
import { CAPABILITY_KEY } from "./require-capability.decorator";

/**
 * Registered as a global APP_GUARD in app.module.ts, declared AFTER
 * AuthModule.forRoot(...) is imported — @thallesp/nestjs-better-auth's
 * AuthModule.forRoot self-registers its own AuthGuard as a global APP_GUARD
 * internally (there is no separate OrgRolesGuard; @OrgRoles is handled
 * inside that same AuthGuard). Nest resolves multiple APP_GUARD providers
 * in registration order, so AuthGuard runs first and populates
 * request.session before this guard's canActivate reads it.
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
    // Same access pattern as IdempotencyInterceptor — guards run before the
    // @Session() param decorator resolves, so read the session Better
    // Auth's AuthGuard already attached to the raw request.
    const orgId: string | undefined = request.session?.session?.activeOrganizationId;
    const userId: string | undefined = request.session?.user?.id;
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
