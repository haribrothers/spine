import { BadRequestException, Body, Controller, Get, HttpCode, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { aiProviderCheckSchema, aiSettingsUpdateSchema, readDocumentSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { AiSettingsService } from "./ai-settings.service";
import { AiRequestService } from "./ai-request.service";
import { ReadDocumentService } from "./read-document/read-document.service";
import { ReadReceiptService } from "./read-document/read-receipt.service";

const firstIssue = (issues: { message: string }[], fallback: string) => issues[0]?.message ?? fallback;

/** US-AI-01–US-AI-04 (D-162–D-168) — Settings › AI assistant. Owner-only, always reachable: it's where AI is switched on. */
@Controller("org/ai")
export class AiSettingsController {
  constructor(
    private readonly ai: AiSettingsService,
    private readonly requests: AiRequestService,
  ) {}

  /** US-AI-04 — this month's usage (or `?month=YYYY-MM`). */
  @Get("usage")
  @OrgRoles(["owner"])
  async usage(@Session() session: UserSession, @Query("month") month?: string) {
    if (month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException("Give the month as YYYY-MM.");
    return this.requests.usage(requireOrgId(session), month);
  }

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
 * tells a signed-in member's screens which features are on, what the
 * provider can do and whether AI is paused for the month (US-AI-03, US-AI-04).
 */
@Controller("ai")
export class AiController {
  constructor(
    private readonly requests: AiRequestService,
    private readonly readDocument: ReadDocumentService,
    private readonly readReceipt: ReadReceiptService,
  ) {}

  @Get("status")
  async status(@Session() session: UserSession) {
    return this.requests.status(requireOrgId(session), session.user.id);
  }

  /** US-AI-08, US-AI-09 — reads a vendor's bill for the bill page, or a receipt for the expense form. Saves nothing, so no Idempotency-Key (05-api). */
  @Post("read-document")
  @HttpCode(200)
  async read(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = readDocumentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error.issues, "Choose a file to read."));
    const orgId = requireOrgId(session);
    return parsed.data.target === "expense" ? this.readReceipt.read(orgId, session.user.id, parsed.data.fileId) : this.readDocument.readVendorBill(orgId, session.user.id, parsed.data.fileId);
  }
}
