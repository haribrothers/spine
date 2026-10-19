import { itemTaxFor, type AiQuoteLine, type CatalogBundle, type SupplyType } from "@spine/shared";
import { bundleLines } from "../../../lib/bundles";
import { blankLine, type EditableQuoteLine } from "./quote-line-editor";
import type { CatalogItemOption } from "./types";

export const NOT_IN_CATALOGUE_PRICE = "Add a price — not in your catalogue.";
/** Names the currency only — no amount to format. */
export const otherCurrencyPrice = (code: string) => `Add a price — the catalogue price is in ${code}.`;

export interface AiRowContext {
  catalogItems: CatalogItemOption[];
  bundles: CatalogBundle[];
  currency: string;
  supplyType: SupplyType | null;
  exportUnderLut: boolean;
  /** The editor's own supply-type rule (US-TAX-11), so an AI line gets the same as one picked by hand. */
  withSupply: (line: EditableQuoteLine, item?: CatalogItemOption) => EditableQuoteLine;
}

/** What one proposed line shows in the panel: where it comes from and its price, or none (D-172). */
export function proposedLineView(line: AiQuoteLine, ctx: Pick<AiRowContext, "catalogItems" | "bundles" | "currency">): { source: string; priceAmount: bigint | null } {
  const item = line.catalogItemId ? ctx.catalogItems.find((i) => i.id === line.catalogItemId && !i.archivedAt) : undefined;
  if (item) {
    const code = item.defaultPriceCurrency;
    const same = code === ctx.currency;
    return { source: same ? `Catalogue item · per ${item.unit}` : `Catalogue item · price in ${code}`, priceAmount: same ? BigInt(item.defaultPriceAmount) : null };
  }
  const bundle = line.bundleId ? ctx.bundles.find((b) => b.id === line.bundleId) : undefined;
  if (bundle) {
    const items = bundle.lines.filter((l) => l.type === "item");
    const names = items.slice(0, 3).map((l) => l.name).join(", ");
    return { source: `Bundle · ${names ? `${names} · ` : ""}${items.length} line${items.length === 1 ? "" : "s"}`, priceAmount: BigInt(bundle.totalAmount) * BigInt(Math.max(1, Math.round(line.quantity))) };
  }
  return { source: "Not in your catalogue", priceAmount: null };
}

/**
 * US-AI-13 (D-172) — the ticked lines as the builder's own rows, made the
 * way picking them by hand makes them: a catalogue item takes its name,
 * price, tax for the place of supply and HSN/SAC; a bundle becomes its
 * lines (each item line times the quantity); anything else is a line with
 * no price. AI never sets a price — a line without one, or whose
 * catalogue price is in another currency, says "Add a price".
 */
export function rowsFromAiLines(lines: AiQuoteLine[], ctx: AiRowContext): EditableQuoteLine[] {
  const activeIds = new Set(ctx.catalogItems.filter((i) => !i.archivedAt).map((i) => i.id));
  return lines.flatMap((ai): EditableQuoteLine[] => {
    const item = ai.catalogItemId ? ctx.catalogItems.find((i) => i.id === ai.catalogItemId && !i.archivedAt) : undefined;
    if (item) {
      const same = item.defaultPriceCurrency === ctx.currency;
      const row: EditableQuoteLine = {
        ...blankLine("item"),
        catalogItemId: item.id,
        name: item.name,
        description: ai.description ?? item.description ?? "",
        quantity: ai.quantity,
        unitPriceAmount: same ? BigInt(item.defaultPriceAmount) : 0n,
        taxRatePercentage: item.defaultTaxRateId || item.defaultTaxGroupId ? 0 : item.defaultTaxRatePercentage,
        ...itemTaxFor(item, ctx.supplyType, { exportUnderLut: ctx.exportUnderLut }),
        hsnSac: item.hsnSac ?? "",
        ...(same ? {} : { aiPriceNote: otherCurrencyPrice(item.defaultPriceCurrency) }),
      };
      return [ctx.withSupply(row, item)];
    }
    const bundle = ai.bundleId ? ctx.bundles.find((b) => b.id === ai.bundleId) : undefined;
    if (bundle) {
      return bundleLines(bundle, activeIds).map((fields) => ({ ...blankLine(fields.type), ...fields, quantity: fields.type === "item" ? fields.quantity * ai.quantity : fields.quantity }));
    }
    return [ctx.withSupply({ ...blankLine("item"), name: ai.name, description: ai.description ?? "", quantity: ai.quantity, aiPriceNote: NOT_IN_CATALOGUE_PRICE })];
  });
}

/** A new quote's first row, still untouched — replaced rather than left empty above the added lines. */
export function isUntouchedBlank(line: EditableQuoteLine): boolean {
  return line.type === "item" && !line.catalogItemId && !line.name.trim() && !line.description.trim() && line.unitPriceAmount === 0n && line.quantity === 1;
}
