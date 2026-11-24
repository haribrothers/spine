import { Inject, Injectable } from "@nestjs/common";
import { fromDecimalString, UNKNOWN_ACCOUNT, UNKNOWN_TAX, type CatalogImportResult, type CatalogImportRow, type CatalogImportRowResult, BAD_HSN_SAC, isValidHsnSac } from "@spine/shared";
import { and, eq, isNull } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, catalogItems, settings, taxGroups, taxRates } from "../../db/schema";
import { CatalogService } from "./catalog.service";

const key = (s: string) => s.trim().toLowerCase();

/**
 * US-CAT-09 (D-161) — imports catalogue items, the same way contacts are
 * imported (US-CRM-14): each row is matched and then created through
 * `CatalogService.create`. Tax is matched by a tax rate's or group's name;
 * income and expense accounts by code or name (of the right type). A name
 * already in the catalogue — or earlier in the file — is a duplicate and
 * skipped. A dry run returns what would happen, for the preview.
 */
@Injectable()
export class CatalogImportService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly catalog: CatalogService,
  ) {}

  async import(orgId: string, actorUserId: string, rows: CatalogImportRow[], dryRun: boolean): Promise<CatalogImportResult> {
    const [currencySetting] = await this.db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
    const currency = (currencySetting?.value as { code?: string } | undefined)?.code ?? "USD";
    const [rates, groups, chart, existing] = await Promise.all([
      this.db.select({ id: taxRates.id, name: taxRates.name }).from(taxRates).where(and(eq(taxRates.orgId, orgId), isNull(taxRates.archivedAt))),
      this.db.select({ id: taxGroups.id, name: taxGroups.name }).from(taxGroups).where(and(eq(taxGroups.orgId, orgId), isNull(taxGroups.archivedAt))),
      this.db.select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type }).from(accounts).where(eq(accounts.orgId, orgId)),
      this.db.select({ name: catalogItems.name }).from(catalogItems).where(eq(catalogItems.orgId, orgId)),
    ]);
    const rateByName = new Map(rates.map((r) => [key(r.name), r.id]));
    const groupByName = new Map(groups.map((g) => [key(g.name), g.id]));
    const account = (value: string, type: "income" | "expense") => chart.find((a) => a.type === type && (a.code === value.trim() || key(a.name) === key(value)))?.id;
    const seen = new Set(existing.map((e) => key(e.name)));

    const results: CatalogImportRowResult[] = [];
    let imported = 0;
    for (const r of rows) {
      const name = r.name?.trim() ?? "";
      const fail = (reason: string) => results.push({ row: r.row, name, status: "failed", reason });
      if (!name) {
        fail("Name is missing");
        continue;
      }
      if (seen.has(key(name))) {
        results.push({ row: r.row, name, status: "duplicate", reason: "Already in the catalogue" });
        continue;
      }
      // "$12,500.00", "12500", "₹ 95" — currency symbols and thousands commas are dropped; anything else must be a number.
      const priceText = (r.price ?? "").replace(/[\s,]/g, "").replace(/^[^\p{L}\d.-]+|[^\p{L}\d.-]+$/gu, "");
      const price = priceText ? fromDecimalString(priceText, currency) : 0n;
      if (price === null || price < 0n) {
        fail(`Price ${r.price} isn't an amount`);
        continue;
      }
      let taxRateId: string | null = null;
      let taxGroupId: string | null = null;
      if (r.tax) {
        taxRateId = rateByName.get(key(r.tax)) ?? null;
        taxGroupId = taxRateId ? null : (groupByName.get(key(r.tax)) ?? null);
        if (!taxRateId && !taxGroupId) {
          fail(UNKNOWN_TAX(r.tax));
          continue;
        }
      }
      const incomeAccountId = r.incomeAccount ? account(r.incomeAccount, "income") : null;
      if (r.incomeAccount && !incomeAccountId) {
        fail(UNKNOWN_ACCOUNT(r.incomeAccount));
        continue;
      }
      const expenseAccountId = r.expenseAccount ? account(r.expenseAccount, "expense") : null;
      if (r.expenseAccount && !expenseAccountId) {
        fail(UNKNOWN_ACCOUNT(r.expenseAccount));
        continue;
      }

      // US-TAX-14: "9403", "9403 10 10" — spaces dropped; it must be 4, 6 or 8 digits.
      const hsnSac = (r.hsnSac ?? "").replace(/\s+/g, "");
      if (hsnSac && !isValidHsnSac(hsnSac)) {
        fail(BAD_HSN_SAC(r.hsnSac!));
        continue;
      }

      seen.add(key(name));
      if (!dryRun) {
        try {
          await this.catalog.create(orgId, actorUserId, {
            name,
            description: r.description || null,
            unit: r.unit || "each",
            category: r.category || null,
            defaultPriceAmount: price,
            defaultPriceCurrency: currency,
            defaultTaxRateId: taxRateId,
            defaultTaxGroupId: taxGroupId,
            incomeAccountId: incomeAccountId ?? null,
            expenseAccountId: expenseAccountId ?? null,
            hsnSac: hsnSac || null,
          });
          imported += 1;
        } catch (err) {
          fail(err instanceof Error ? err.message : "Couldn't create the item");
          continue;
        }
      }
      results.push({ row: r.row, name, status: "ok", reason: null });
    }
    return { dryRun, imported, rows: results };
  }
}
