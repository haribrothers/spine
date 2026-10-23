import { BadRequestException, Controller, Get, Inject, NotFoundException, Req } from "@nestjs/common";
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Request as ExpressRequest } from "express";
import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { and, eq } from "drizzle-orm";
import { AGENT_SCOPES, type AgentConsentInfo, type AgentIdentity } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member } from "../../db/schema";
import { auth } from "../../auth/auth";
import { moduleOn } from "../../common/modules";
import { loadEmailBrand } from "../email/email-brand";
import { requireOrgId } from "../org/settings.controller";
import { agentIdentity, loadAgentClient } from "./agent-connections";
import { AgentsSettingsService } from "./agents-settings.service";

const EXPIRED = "This request has expired. Go back to your agent and connect again.";

/** The signed authorization query Better Auth put on the page's URL, checked against its secret. */
async function signedQuery(req: ExpressRequest): Promise<URLSearchParams> {
  const query = req.originalUrl.split("?")[1] ?? "";
  if (!query || !(await verifyOAuthQueryParams(query, (await auth.$context).secret))) throw new BadRequestException(EXPIRED);
  return new URLSearchParams(query);
}

/**
 * US-MCP-03 (D-258) — what Spine's consent and sign-in pages show about the
 * agent asking to connect. Both read the signed query Better Auth gave the
 * page, so neither trusts anything the browser made up. Not owned by the
 * agents module: the consent page explains that agents are off itself.
 */
@Controller("agent-consent")
export class AgentConsentController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: AgentsSettingsService,
  ) {}

  @Get()
  async info(@Session() session: UserSession, @Req() req: ExpressRequest): Promise<AgentConsentInfo> {
    const params = await signedQuery(req);
    const client = await loadAgentClient(this.db, params.get("client_id") ?? "");
    if (!client) throw new NotFoundException(EXPIRED);
    const orgId = requireOrgId(session);
    const [membership] = await this.db.select({ role: member.role }).from(member).where(and(eq(member.userId, session.user.id), eq(member.organizationId, orgId)));
    const drafts = (await this.settings.stored(orgId)).drafts;
    return {
      off: !(await moduleOn(this.db, orgId, "agents")),
      business: (await loadEmailBrand(this.db, orgId)).name,
      agent: agentIdentity(client),
      person: { name: session.user.name, role: (membership?.role ?? "staff") as AgentConsentInfo["person"]["role"], image: session.user.image ?? null },
      draftsOffered: drafts && (params.get("scope") ?? "").split(" ").includes(AGENT_SCOPES.draft),
    };
  }

  /** For the sign-in page's "<Agent> is asking to connect" line, before anyone has signed in. */
  @Get("agent")
  @AllowAnonymous()
  async agent(@Req() req: ExpressRequest): Promise<AgentIdentity> {
    const params = await signedQuery(req);
    const client = await loadAgentClient(this.db, params.get("client_id") ?? "");
    if (!client) throw new NotFoundException(EXPIRED);
    return agentIdentity(client);
  }
}
