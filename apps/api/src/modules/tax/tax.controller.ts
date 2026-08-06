import { Body, Controller, Get, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { SettingsService } from "../org/settings.service";

const DEFAULT_TAX_RATE_KEY = "default_tax_rate";

export interface DefaultTaxRate {
  name: string;
  /** Decimal percentage, e.g. 7.5 for 7.5%. Stored as a number, not minor units — this is a rate, not money. */
  percentage: number;
}

/**
 * A single default named tax rate, per the wizard-shell scope. Full
 * multi-rate tax-group CRUD (inclusive/exclusive pricing, per-item tax
 * mapping) is FEAT-08, a later phase — explicitly not built here. Backed
 * by the generic `settings` table (key `default_tax_rate`), same as every
 * other wizard-shell step without a dedicated table.
 */
@Controller("org/tax")
export class TaxController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("default-rate")
  async getDefaultRate(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    const value = await this.settingsService.get<DefaultTaxRate>(orgId, DEFAULT_TAX_RATE_KEY);
    return value ?? { name: "Tax", percentage: 0 };
  }

  @Put("default-rate")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async setDefaultRate(@Session() session: UserSession, @Body() body: DefaultTaxRate) {
    const orgId = requireOrgId(session);
    await this.settingsService.set(orgId, DEFAULT_TAX_RATE_KEY, body);
    return body;
  }
}
