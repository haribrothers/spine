import { and, eq, inArray } from "drizzle-orm";
import { legacyGstRates, splitLineTax, type SupplyType, type TaxComponent, type TaxType } from "@spine/shared";
import type { Database, Transaction } from "../../db/client";
import { taxGroupRates, taxGroups, taxRates } from "../../db/schema";

/** A taxed line, from any document: a named rate, a group, or (older lines, credit notes) just a percentage. */
export interface TaxedLine {
  taxRateId?: string | null;
  taxGroupId?: string | null;
  taxRatePercentage: number;
  lineTaxAmount: bigint;
}

const GENERIC: readonly TaxType[] = ["other", "vat", "gst", "sales_tax"];

/**
 * The rates and groups a set of lines use, loaded once, so each line's tax
 * can be split by tax type (US-TAX-15, US-RPT-37, US-TAX-16).
 */
export class RateBook {
  private constructor(
    private readonly rates: Map<string, { name: string; taxType: TaxType; rate: number }>,
    private readonly groups: Map<string, { name: string; rateIds: string[] }>,
  ) {}

  static async load(db: Database | Transaction, orgId: string, lines: readonly Pick<TaxedLine, "taxRateId" | "taxGroupId">[]): Promise<RateBook> {
    const groupIds = [...new Set(lines.map((l) => l.taxGroupId).filter((id): id is string => Boolean(id)))];
    const groupRows = groupIds.length ? await db.select({ id: taxGroups.id, name: taxGroups.name }).from(taxGroups).where(and(eq(taxGroups.orgId, orgId), inArray(taxGroups.id, groupIds))) : [];
    const links = groupIds.length ? await db.select().from(taxGroupRates).where(inArray(taxGroupRates.taxGroupId, groupIds)) : [];
    const rateIds = [...new Set([...lines.map((l) => l.taxRateId).filter((id): id is string => Boolean(id)), ...links.map((l) => l.taxRateId)])];
    const rateRows = rateIds.length ? await db.select().from(taxRates).where(and(eq(taxRates.orgId, orgId), inArray(taxRates.id, rateIds))) : [];
    return new RateBook(
      new Map(rateRows.map((r) => [r.id, { name: r.name, taxType: r.taxType as TaxType, rate: Number(r.rate) }])),
      new Map(groupRows.map((g) => [g.id, { name: g.name, rateIds: links.filter((l) => l.taxGroupId === g.id).map((l) => l.taxRateId) }])),
    );
  }

  /** "GST 18%", "IGST 18%" — or "18% tax" for a line with only a percentage. Deleted rates and groups say so. */
  label(line: TaxedLine): { key: string; name: string } {
    if (line.taxRateId) return { key: `rate:${line.taxRateId}`, name: this.rates.get(line.taxRateId)?.name ?? "Deleted rate" };
    if (line.taxGroupId) return { key: `group:${line.taxGroupId}`, name: this.groups.get(line.taxGroupId)?.name ?? "Deleted group" };
    return { key: `flat:${line.taxRatePercentage}`, name: `${line.taxRatePercentage}% tax` };
  }

  /**
   * The rates a line was charged at, by tax type. On a GST document
   * (`supplyType` set) a rate from before tax types (or a general one) is
   * CGST + SGST within the state, else IGST; elsewhere it keeps its type.
   */
  ratesFor(line: TaxedLine, supplyType: SupplyType | null): { taxType: TaxType; rate: number }[] {
    const asType = (type: TaxType): TaxType => (supplyType && GENERIC.includes(type) ? (supplyType === "intra" ? "cgst" : "igst") : type);
    const rate = line.taxRateId ? this.rates.get(line.taxRateId) : undefined;
    if (rate) return supplyType && rate.taxType === "other" ? legacyGstRates(rate.rate, supplyType) : [{ taxType: asType(rate.taxType), rate: rate.rate }];
    const group = line.taxGroupId ? this.groups.get(line.taxGroupId) : undefined;
    if (group) return group.rateIds.flatMap((id) => (this.rates.get(id) ? [{ taxType: asType(this.rates.get(id)!.taxType), rate: this.rates.get(id)!.rate }] : []));
    if (supplyType) return legacyGstRates(line.taxRatePercentage, supplyType);
    return line.taxRatePercentage > 0 ? [{ taxType: "other", rate: line.taxRatePercentage }] : [];
  }

  /** The line's tax split by type; the parts always add up to the line's tax. */
  components(line: TaxedLine, supplyType: SupplyType | null): TaxComponent[] {
    const parts = splitLineTax(line.lineTaxAmount, this.ratesFor(line, supplyType));
    if (parts.length === 0 && line.lineTaxAmount !== 0n) return [{ taxType: "other", rate: line.taxRatePercentage, amount: line.lineTaxAmount }];
    return parts;
  }
}
