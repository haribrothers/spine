import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { auth } from "../../auth/auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "./settings.controller";

/**
 * Team-invite step of the onboarding wizard, plus the Users page's pending
 * invites list. Deliberately thin — this wraps Better Auth's own
 * organization-plugin invitation endpoints (createInvitation,
 * listInvitations, cancelInvitation, mounted natively at
 * POST/GET /api/auth/organization/*) rather than hand-rolling an invite
 * table, per the task brief. Kept as a small dedicated controller so these
 * endpoints can enforce the same @OrgRoles(["owner"]) + idempotency
 * pattern as the rest of the onboarding endpoints, and so the web app only
 * ever talks to `/api/org/*`.
 */
@Controller("org/invitations")
export class InvitationsController {
  @Post()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async invite(
    @Session() session: UserSession,
    @Req() request: Request,
    @Body() body: { email: string; role: "owner" | "staff" | "field" },
  ) {
    const orgId = requireOrgId(session);
    const invitation = await auth.api.createInvitation({
      body: {
        email: body.email,
        role: body.role,
        organizationId: orgId,
      },
      headers: fromNodeHeaders(request.headers),
    });
    return invitation;
  }

  /**
   * Feedback item: "I want to list all users including the user who has
   * been sent an invite" — Better Auth's listInvitations returns every
   * status (pending/accepted/cancelled/rejected); this endpoint filters to
   * pending only, since accepted invites are already covered by
   * GET /org/members and the rest aren't actionable.
   */
  @Get()
  async list(@Session() session: UserSession, @Req() request: Request) {
    const orgId = requireOrgId(session);
    const invitations = await auth.api.listInvitations({
      query: { organizationId: orgId },
      headers: fromNodeHeaders(request.headers),
    });
    return invitations.filter((invitation) => invitation.status === "pending");
  }

  @Delete(":id")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async cancel(@Session() session: UserSession, @Req() request: Request, @Param("id") id: string) {
    requireOrgId(session);
    await auth.api.cancelInvitation({
      body: { invitationId: id },
      headers: fromNodeHeaders(request.headers),
    });
    return { cancelled: true };
  }

  /**
   * Better Auth's own createInvitation has a built-in `resend` flag for an
   * existing pending invite (same email/org): it refreshes the expiry and
   * re-runs sendInvitationEmail, keeping the same invitation id rather than
   * creating a new row — no manual cancel-then-recreate needed.
   */
  @Post(":id/resend")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async resend(@Session() session: UserSession, @Req() request: Request, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    const headers = fromNodeHeaders(request.headers);
    const existing = await auth.api.listInvitations({ query: { organizationId: orgId }, headers });
    const invitation = existing.find((row) => row.id === id);
    if (!invitation) {
      throw new BadRequestException("Invitation not found");
    }
    return auth.api.createInvitation({
      body: { email: invitation.email, role: invitation.role, organizationId: orgId, resend: true },
      headers,
    });
  }
}
