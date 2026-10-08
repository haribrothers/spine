import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import { ACCESS_REMOVED_ERROR, accessRemovedMessage } from "@spine/shared";
import { DATABASE } from "../db/db.module";
import type { Database } from "../db/client";
import { member, organization } from "../db/schema";
import { auth } from "./auth";

/**
 * US-TEAM-04 / US-MOB-02 — a deactivated member's sessions stop working for
 * that organisation. `member.isActive` is app-owned (Better Auth has no
 * per-membership disable), so nothing else rejects the session: every
 * signed-in request whose active organisation has this user deactivated is
 * answered 403 `ACCESS_REMOVED` with "Your access to <Business> was removed."
 * — the field app signs out on it and shows that message. Registered before
 * ModuleGuard and CapabilityGuard so it wins over their answers.
 */
@Injectable()
export class ActiveMemberGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    const request = context.switchToHttp().getRequest();
    const session = request.session ?? (await auth.api.getSession({ headers: request.headers ? fromNodeHeaders(request.headers) : new Headers() }));
    const orgId: string | undefined = session?.session?.activeOrganizationId;
    const userId: string | undefined = session?.user?.id;
    // Signed out or without an organisation: the other guards answer that.
    if (!orgId || !userId) return true;
    const [row] = await this.db
      .select({ isActive: member.isActive, businessName: organization.name })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
    if (!row || row.isActive) return true;
    throw new ForbiddenException({ statusCode: 403, error: ACCESS_REMOVED_ERROR, message: accessRemovedMessage(row.businessName) });
  }
}
