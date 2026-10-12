import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { and, eq } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import type { Capability } from "@spine/shared";
import { auth } from "./auth";
import { DATABASE } from "../db/db.module";
import type { Database } from "../db/client";
import { member } from "../db/schema";
import { hasCapability } from "./capability.util";
import { CAPABILITY_KEY, PICKER_KEY, SECTION_KEY } from "./require-capability.decorator";

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
    const capability = this.reflector.getAllAndOverride<Capability | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const section = this.reflector.getAllAndOverride<Capability | undefined>(SECTION_KEY, [context.getHandler(), context.getClass()]);
    if (!capability && !section) return true;
    const required = (capability ?? section) as Capability;

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
    // No session at all is 401, as AuthGuard would answer: this guard can
    // run first, and the web app tells "signed out" (US-AUTH-12) apart from
    // "not allowed" (US-OPS-12) by the status.
    if (!userId) throw new UnauthorizedException();
    if (!orgId) {
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

    if (membership.role === "field") {
      // Field is fixed/non-configurable (never Team-gated, per §2.1) — if
      // execution reaches this guard at all, Better Auth's own AuthGuard
      // has already evaluated this route's @OrgRoles and allowed "field"
      // through, since @OrgRoles runs first and 403s an ineligible role
      // before this guard's canActivate is ever called. A route pairing
      // @OrgRoles([..., "field"]) with @RequireCapability therefore means
      // "field is allowed here unconditionally, no Team grant needed" —
      // e.g. jobs.controller.ts's addPhoto/addNote routes (S-04.10/S-04.4,
      // job_photos.edit_own/job_notes.edit_own). This guard previously threw for any
      // non-staff role including field, which meant a field user could
      // never actually pass a route explicitly built to allow them —
      // fixed live while adding the same field+capability shape for
      // S-07.2 (expenses.edit_own), which surfaced the same bug.
      return true;
    }

    if (membership.role !== "staff") {
      // Any future fixed role beyond owner/staff/field — same reasoning
      // as field would apply once such a role exists, but nothing defines
      // one yet, so fail closed rather than assume.
      throw new ForbiddenException(`Role "${membership.role}" is not eligible for capability "${required}"`);
    }

    // US-TEAM-30: a closed section refuses all its routes; a picker route
    // still answers `?picker=1`, with only what forms need (US-TEAM-31).
    if (section && !(await hasCapability(this.db, { orgId, userId }, section))) {
      const picker = this.reflector.get<boolean | undefined>(PICKER_KEY, context.getHandler()) && request.query?.picker === "1";
      if (!picker) throw new ForbiddenException(`Missing capability: ${section}`);
      request.sectionClosed = true;
    }
    // Same rule as everywhere else (hasCapability): only this organisation's Teams count.
    if (capability && !(await hasCapability(this.db, { orgId, userId }, capability))) {
      throw new ForbiddenException(`Missing capability: ${capability}`);
    }
    return true;
  }
}
