import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Put, UseInterceptors } from "@nestjs/common";
import { brandingSchema, businessProfileSchema, documentLayoutSchema, emailTemplatesSchema, invoiceRemindersSchema, taxProfileSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { SettingsService } from "./settings.service";
import { IndustryTemplateService } from "./industry-template.service";
import { SECRET_SETTING } from "../data-export/data-export.tables";

/**
 * Keys these generic routes never read or write: secrets (D-094), and the AI
 * assistant's settings, which only an Owner reaches, through `/org/ai`
 * (US-AI-01, US-AI-02), Connected agents' through `/org/agents` (US-MCP-02),
 * and the update check's result, which only an Owner reads, through
 * `/org/update-status` (US-OPS-06).
 */
const isPrivateSetting = (key: string) => SECRET_SETTING.test(key) || key === "ai" || key === "agents" || key === "update_check";

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
    const all = await this.settingsService.getAll(orgId);
    return Object.fromEntries(Object.entries(all).filter(([key]) => !isPrivateSetting(key)));
  }

  @Get(":key")
  async getOne(@Session() session: UserSession, @Param("key") key: string) {
    const orgId = requireOrgId(session);
    if (isPrivateSetting(key)) throw new ForbiddenException("This setting can't be read here.");
    const value = await this.settingsService.get(orgId, key);
    return { key, value };
  }

  /**
   * Only the owner may change org-wide config — staff/field never reach
   * this per Spine's server-side-authorization rule. `@OrgRoles` reads
   * the org member role off the session's active org, never a client claim.
   */
  @Put(":key")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async setOne(@Session() session: UserSession, @Param("key") key: string, @Body("value") value: unknown) {
    const orgId = requireOrgId(session);
    if (isPrivateSetting(key)) throw new ForbiddenException("This setting can't be changed here.");
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
    if (key === "document_layout") {
      // US-SET-17–US-SET-19 (D-152): only the known options, terms and notes under 2,000 characters.
      const parsed = documentLayoutSchema.safeParse(value);
      if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the document options and try again.");
    }
    if (key === "email_templates") {
      // US-SET-21 (D-153): a subject and message per email, with only the placeholders it can fill.
      const parsed = emailTemplatesSchema.safeParse(value);
      if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the email text and try again.");
      await this.settingsService.set(orgId, key, parsed.data);
      return { key, value: parsed.data };
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
