import { BadRequestException, Controller, Get, Inject, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "@thallesp/nestjs-better-auth";
import { and, eq, gt } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invitation as invitationTable, organization as organizationTable } from "../../db/schema";

/**
 * The unauthenticated counterpart to InvitationsController, same reasoning
 * as PublicQuotesController: Better Auth's own getInvitation endpoint
 * (called by AcceptInviteView once a session exists) REQUIRES an
 * authenticated session matching the invitation's email — it won't reveal
 * anything pre-auth. But the web signup form needs to pre-fill/lock the
 * invited email BEFORE that session exists (accept-invite's "Create
 * account" link), so this exposes just enough — email, org name, role —
 * to render that, gated only by knowing the invitation id from the emailed
 * link itself, same trust model as a public quote-acceptance link (§10.3).
 * Deliberately a separate controller under /public/invitations, never
 * mixed into the authenticated /org/invitations routes, and throttled
 * since it's reachable by anyone with no login/org membership.
 */
@Controller("public/invitations")
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class PublicInvitationsController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get(":id")
  async getPreview(@Param("id") id: string) {
    const [row] = await this.db
      .select({
        email: invitationTable.email,
        role: invitationTable.role,
        organizationName: organizationTable.name,
      })
      .from(invitationTable)
      .innerJoin(organizationTable, eq(organizationTable.id, invitationTable.organizationId))
      .where(and(eq(invitationTable.id, id), eq(invitationTable.status, "pending"), gt(invitationTable.expiresAt, new Date())));

    if (!row) {
      throw new BadRequestException("This invitation could not be found or has expired.");
    }
    return row;
  }
}
