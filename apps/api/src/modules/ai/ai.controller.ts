import { BadRequestException, Body, Controller, Get, HttpCode, Post, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { aiProviderCheckSchema, aiSettingsUpdateSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { AiSettingsService } from "./ai-settings.service";

const firstIssue = (issues: { message: string }[], fallback: string) => issues[0]?.message ?? fallback;

/** US-AI-01, US-AI-02 (D-162–D-164) — Settings › AI assistant. Owner-only, always reachable: it's where AI is switched on. */
@Controller("org/ai")
export class AiSettingsController {
  constructor(private readonly ai: AiSettingsService) {}

  @Get()
  @OrgRoles(["owner"])
  async get(@Session() session: UserSession) {
    return this.ai.get(requireOrgId(session));
  }

  @Put()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async put(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = aiSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error.issues, "Check the AI settings and try again."));
    return this.ai.update(requireOrgId(session), session.user.id, parsed.data);
  }

  /** Read-only — it saves nothing but what the saved provider can do — so no Idempotency-Key (05-api). */
  @Post("test")
  @HttpCode(200)
  @OrgRoles(["owner"])
  async test(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = aiProviderCheckSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error.issues, "Choose a provider and fill in its details."));
    return this.ai.test(requireOrgId(session), parsed.data);
  }

  @Post("models")
  @HttpCode(200)
  @OrgRoles(["owner"])
  async models(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = aiProviderCheckSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error.issues, "Choose a provider and fill in its details."));
    return this.ai.models(requireOrgId(session), parsed.data);
  }
}

/**
 * The AI features' own routes live under `/ai/*`, which the module guard
 * refuses with 403 `MODULE_OFF` while AI is off (US-AI-01). `GET /ai/status`
 * tells a signed-in member's screens what the provider can do.
 */
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiSettingsService) {}

  @Get("status")
  async status(@Session() session: UserSession) {
    const s = await this.ai.get(requireOrgId(session));
    return { supportsImages: s.supportsImages };
  }
}
