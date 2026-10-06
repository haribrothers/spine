import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Put, UseInterceptors } from "@nestjs/common";
import { brandingSchema, businessProfileSchema, invoiceRemindersSchema, taxProfileSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { SettingsService } from "./settings.service";
import { IndustryTemplateService } from "./industry-template.service";

/**
 * Org-scoped settings read/write, backing every onboarding-wizard step that
 * doesn't have its own dedicated table (business profile, industry
 * template, currency/locale, financial year start, default tax rate,
 * onboarding/checklist state — see SettingsService's key documentation).
 * Also the endpoint Settings (later, out of scope here) will reuse to edit
 * the same values post-onboarding.
 */
@Controller("org/settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly industryTemplate: IndustryTemplateService,
  ) {}

  @Get()
  async getAll(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.settingsService.getAll(orgId);
  }

  @Get(":key")
  async getOne(@Session() session: UserSession, @Param("key") key: string) {
    const orgId = requireOrgId(session);
    const value = await this.settingsService.get(orgId, key);
    return { key, value };
  }

  /**
   * Only the owner may change org-wide config — staff/field never reach
   * this per CLAUDE.md's server-side-authorization rule. `@OrgRoles` reads
   * the org member role off the session's active org, never a client claim.
   */
  @Put(":key")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async setOne(@Session() session: UserSession, @Param("key") key: string, @Body("value") value: unknown) {
    const orgId = requireOrgId(session);
    // US-ONB-13: Construction sets up its cost accounts and categories in the same transaction.
    if (key === "industry_template") return this.industryTemplate.set(orgId, session.user.id, value);
    if (key === "business_profile") {
      // US-INV-16: the same rules the Settings form shows.
      const parsed = businessProfileSchema.safeParse(value);
      if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the business profile and try again.");
    }
    if (key === "invoice_reminders") {
      // US-INV-18: the schedule the reminder job follows.
      const parsed = invoiceRemindersSchema.safeParse(value);
      if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the reminder settings and try again.");
    }
    if (key === "tax_profile") {
      // US-DASH-25: the return period the dashboard's tax card follows.
      const parsed = taxProfileSchema.safeParse(value);
      if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the tax settings and try again.");
    }
    if (key === "branding") {
      // US-SET-09: only the listed theme presets.
      const parsed = brandingSchema.safeParse(value);
      if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the branding settings and try again.");
    }
    await this.settingsService.set(orgId, key, value);
    return { key, value };
  }
}

export function requireOrgId(session: UserSession): string {
  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    throw new ForbiddenException("No active organisation on session");
  }
  return orgId;
}
