import { Body, Controller, Post, Req, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { auth } from "../../auth/auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "./settings.controller";

/**
 * Team-invite step of the onboarding wizard. Deliberately thin — this
 * wraps Better Auth's own organization-plugin invitation endpoint
 * (`auth.api.createInvitation`, mounted natively at
 * POST /api/auth/organization/invite-member) rather than hand-rolling an
 * invite table, per the task brief. Kept as a small dedicated controller
 * (not just telling the wizard to call the Better Auth route directly) so
 * this endpoint can enforce the same @OrgRoles(["owner"]) + idempotency
 * pattern as the rest of the onboarding endpoints, and so the wizard's step
 * component only ever talks to `/api/org/*`.
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
}
