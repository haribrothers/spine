import { RequireCapability } from "../../auth/require-capability.decorator";
import { Body, Controller, Get, Put, Query, Res, UseInterceptors } from "@nestjs/common";
import type { Response } from "express";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { sendCsv, toCsv } from "../../common/csv";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { SettingsService } from "../org/settings.service";
import { ReportExportService } from "../reports/export/report-export.service";
import { taxSummaryDocument } from "../reports/export/report-documents";
import { ReportsService } from "../reports/reports.service";

const DEFAULT_TAX_RATE_KEY = "default_tax_rate";
const PRICES_INCLUDE_TAX_KEY = "prices_include_tax";

export interface DefaultTaxRate {
  name: string;
  /** Decimal percentage, e.g. 7.5 for 7.5%. Stored as a number, not minor units — this is a rate, not money. */
  percentage: number;
}

export interface PricesIncludeTaxSetting {
  /** S-08.2 — whether the org's catalogue/quote/invoice prices are entered tax-inclusive or tax-exclusive by default. A line can still override via its own `isTaxInclusive` snapshot. */
  inclusive: boolean;
}

const DEFAULT_PRICES_INCLUDE_TAX: PricesIncludeTaxSetting = { inclusive: false };

/**
 * `default-rate` is a legacy single named rate, kept only for the
 * onboarding wizard's tax step (which asks for one rate as a quick-start
 * default, not full FEAT-08 CRUD) — real multi-rate/tax-group management is
 * `TaxRatesController`/`TaxGroupsController` (tax-rates.controller.ts,
 * tax-groups.controller.ts), both backed by real tables now that FEAT-08 is
 * built. Both endpoints stay backed by the generic `settings` table, same
 * convention as every other wizard-shell step without a dedicated table.
 */
@Controller("org/tax")
export class TaxController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly reportsService: ReportsService,
    private readonly exporter: ReportExportService,
  ) {}

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

  @Get("prices-include-tax")
  async getPricesIncludeTax(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    const value = await this.settingsService.get<PricesIncludeTaxSetting>(orgId, PRICES_INCLUDE_TAX_KEY);
    return value ?? DEFAULT_PRICES_INCLUDE_TAX;
  }

  @Put("prices-include-tax")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async setPricesIncludeTax(@Session() session: UserSession, @Body() body: PricesIncludeTaxSetting) {
    const orgId = requireOrgId(session);
    await this.settingsService.set(orgId, PRICES_INCLUDE_TAX_KEY, body);
    return body;
  }

  /** S-08.4 — Owner, or `reports.view_financial_statements` (US-RPT-36): reading the summary isn't managing tax, which stays Owner-only. */
  @Get("summary")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_financial_statements")
  async taxSummary(@Session() session: UserSession, @Query("from") from: string, @Query("to") to: string, @Query("format") format?: string) {
    const orgId = requireOrgId(session);
    // US-RPT-32 — `?format=csv|xlsx` downloads it as on screen.
    const asFile = ReportExportService.parseFormat(format);
    const report = await this.reportsService.taxSummary(orgId, from, to);
    return asFile ? this.exporter.file(orgId, asFile, taxSummaryDocument(report)) : report;
  }

  /** US-RPT-14 — the tax summary as CSV, for the return. Same gate as the summary. */
  @Get("summary/export.csv")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_financial_statements")
  async exportTaxSummary(@Session() session: UserSession, @Query("from") from: string, @Query("to") to: string, @Res() res: Response) {
    const report = await this.reportsService.taxSummary(requireOrgId(session), from, to);
    const rows: (string | number)[][] = [
      ...report.collectedByRate.map((r) => [r.name, r.taxableAmount, r.amount]),
      ...(report.adjustments ? [["Adjustments from credit notes and voided invoices", report.adjustments.taxableAmount, report.adjustments.amount]] : []),
      ["Total collected", report.totalTaxable, report.taxCollected],
      ["Tax paid", "", report.taxPaid],
      ["Net payable", "", report.netTaxPayable],
    ];
    sendCsv(res, `tax-summary-${from}-to-${to}.csv`, toCsv(["Collected by rate", "Taxable amount", "Tax"], rows));
  }
}
