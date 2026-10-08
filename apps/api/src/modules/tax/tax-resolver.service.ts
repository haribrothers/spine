import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import type { SupplyClass, TaxRate as ComputeTaxRate } from "@spine/shared";
import { and, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { taxRates, taxGroupRates } from "../../db/schema";

export interface ResolvedLineTax {
  /** Ready to pass straight into `computeLineTax`. */
  rates: ComputeTaxRate[];
  /** Blended, snapshot-friendly percentage — sum of non-compound rates, for display/PDF/legacy `taxRatePercentage` columns. */
  blendedPercentage: number;
  /** D-182 — the supply class a 0% rate (or a group of 0% rates sharing one) gives a line that doesn't name its own. */
  supplyClass?: SupplyClass | null;
}

/**
 * Resolves a quote/invoice/catalog line's `taxRateId` XOR `taxGroupId` into
 * the shape `packages/shared`'s `computeLineTax` expects. Centralized here
 * so QuotesService/InvoicesService/CatalogService don't each reimplement
 * "at most one of rate/group, both org-scoped, group expands to its member
 * rates" — this is the single place that logic lives.
 */
@Injectable()
export class TaxResolverService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async resolve(
    orgId: string,
    input: { taxRateId?: string | null; taxGroupId?: string | null },
    tx: Transaction | Database = this.db,
  ): Promise<ResolvedLineTax> {
    if (input.taxRateId && input.taxGroupId) {
      throw new BadRequestException("A line can reference a tax rate or a tax group, not both");
    }

    if (input.taxRateId) {
      const [rate] = await tx.select().from(taxRates).where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, input.taxRateId)));
      if (!rate) {
        throw new BadRequestException("Tax rate not found");
      }
      return {
        rates: [{ id: rate.id, name: rate.name, percent: rate.rate, isCompound: rate.isCompound }],
        blendedPercentage: rate.rate,
        supplyClass: rate.rate === 0 ? rate.supplyClass : null,
      };
    }

    if (input.taxGroupId) {
      const links = await tx.select().from(taxGroupRates).where(eq(taxGroupRates.taxGroupId, input.taxGroupId));
      const ids = links.map((l) => l.taxRateId);
      if (ids.length === 0) {
        throw new BadRequestException("Tax group not found or has no rates");
      }
      const rows = await tx.select().from(taxRates).where(and(eq(taxRates.orgId, orgId), inArray(taxRates.id, ids)));
      if (rows.length !== ids.length) {
        throw new BadRequestException("Tax group not found");
      }
      // Stored at 4 decimal places, like every rate (US-TAX-07).
      const blendedPercentage = Number(rows.reduce((sum, r) => sum + r.rate, 0).toFixed(4));
      return {
        rates: rows.map((r) => ({ id: r.id, name: r.name, percent: r.rate, isCompound: r.isCompound })),
        blendedPercentage,
        supplyClass: blendedPercentage === 0 && new Set(rows.map((r) => r.supplyClass)).size === 1 ? rows[0]!.supplyClass : null,
      };
    }

    return { rates: [], blendedPercentage: 0 };
  }
}
