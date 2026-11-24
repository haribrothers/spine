import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "@thallesp/nestjs-better-auth";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invitation as invitationTable, organization as organizationTable } from "../../db/schema";

export const INVITATION_UNUSABLE_MESSAGE = "This invitation can't be used. Ask whoever invited you to send a new one.";

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

  /**
   * US-AUTH-11 — 404 for an id that doesn't exist; otherwise its status.
   * The email, role and business name come back only while the invitation
   * can still be used, so an old link reveals nothing about the business.
   */
  @Get(":id")
  async getPreview(@Param("id") id: string) {
    const [row] = await this.db
      .select({
        status: invitationTable.status,
        expiresAt: invitationTable.expiresAt,
        email: invitationTable.email,
        role: invitationTable.role,
        organizationName: organizationTable.name,
        isDemo: invitationTable.isDemo,
      })
      .from(invitationTable)
      .innerJoin(organizationTable, eq(organizationTable.id, invitationTable.organizationId))
      .where(eq(invitationTable.id, id));

    if (!row) throw new NotFoundException(INVITATION_UNUSABLE_MESSAGE);
    if (row.status !== "pending") return { status: row.status };
    // US-ONB-35: a demo invite reveals nothing and can't be used.
    if (row.isDemo) return { status: "expired" };
    if (row.expiresAt <= new Date()) return { status: "expired" };
    return { status: "pending", email: row.email, role: row.role, organizationName: row.organizationName };
  }
}
