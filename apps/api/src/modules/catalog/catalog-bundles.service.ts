import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { BUNDLE_ONE_CURRENCY, computeDocumentLine, type CatalogBundle, type CreateCatalogBundleInput, type UpdateCatalogBundleInput } from "@spine/shared";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { catalogBundleLines, catalogBundles, catalogItems, quoteLines, quotes } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { requireOwnershipCapability } from "../../auth/capability.util";

type BundleRow = typeof catalogBundles.$inferSelect;
type BundleLineRow = typeof catalogBundleLines.$inferSelect;

function toBundle(row: BundleRow, lines: BundleLineRow[]): CatalogBundle {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    currency: row.currency,
    totalAmount: row.totalAmount.toString(),
    createdByUserId: row.createdByUserId,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    lines: lines
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({
        id: l.id,
        sortOrder: l.sortOrder,
        type: l.type,
        catalogItemId: l.catalogItemId,
        name: l.name,
        description: l.description,
        quantity: l.quantity,
        unitPriceAmount: l.unitPriceAmount.toString(),
        discountPercentage: l.discountPercentage,
        taxRatePercentage: l.taxRatePercentage,
        taxRateId: l.taxRateId,
        taxGroupId: l.taxGroupId,
        isTaxInclusive: l.isTaxInclusive,
        supplyClass: l.supplyClass,
        hsnSac: l.hsnSac,
      })),
  };
}

/**
 * US-QUO-25 (D-096) — catalogue bundles: a quote's lines saved under a name
 * and added to quotes and invoices in one go (US-QUO-26). Lines are copied
 * from the quote when the bundle is saved, so later changes to the quote
 * never reach the bundle. Reads are open to every member; changes follow
 * the catalogue's own/others rules — `catalog.edit_*` to rename,
 * `catalog.delete_*` to archive, restore or delete (as catalogue items do).
 */
@Injectable()
export class CatalogBundlesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(orgId: string, options: { includeArchived?: boolean; currency?: string } = {}): Promise<CatalogBundle[]> {
    const conditions = [eq(catalogBundles.orgId, orgId)];
    if (!options.includeArchived) conditions.push(isNull(catalogBundles.archivedAt));
    if (options.currency) conditions.push(eq(catalogBundles.currency, options.currency));
    const rows = await this.db.select().from(catalogBundles).where(and(...conditions)).orderBy(asc(catalogBundles.name), desc(catalogBundles.createdAt));
    if (!rows.length) return [];
    const lines = await this.db.select().from(catalogBundleLines).where(inArray(catalogBundleLines.bundleId, rows.map((r) => r.id)));
    return rows.map((row) => toBundle(row, lines.filter((l) => l.bundleId === row.id)));
  }

  async getOne(orgId: string, id: string): Promise<CatalogBundle> {
    const row = await this.find(orgId, id);
    const lines = await this.db.select().from(catalogBundleLines).where(eq(catalogBundleLines.bundleId, id));
    return toBundle(row, lines);
  }

  private async find(orgId: string, id: string): Promise<BundleRow> {
    const [row] = await this.db.select().from(catalogBundles).where(and(eq(catalogBundles.orgId, orgId), eq(catalogBundles.id, id)));
    if (!row) throw new NotFoundException("Bundle not found");
    return row;
  }

  /** Copies the quote's lines (their snapshot prices and tax) into a new bundle, or (US-CAT-14) builds it from catalogue items. */
  async create(orgId: string, actorUserId: string, input: CreateCatalogBundleInput): Promise<CatalogBundle> {
    if (input.items) return this.createFromItems(orgId, actorUserId, input as CreateCatalogBundleInput & { items: NonNullable<CreateCatalogBundleInput["items"]> });
    const [quote] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, input.sourceQuoteId!)));
    if (!quote) throw new NotFoundException("Quote not found");
    const lines = await this.db.select().from(quoteLines).where(eq(quoteLines.quoteId, quote.id)).orderBy(quoteLines.sortOrder);
    if (!lines.some((l) => l.type === "item")) throw new BadRequestException("This quote has no item lines to save as a bundle.");

    const id = await this.db.transaction(async (tx) => {
      const [bundle] = await tx
        .insert(catalogBundles)
        .values({
          orgId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          currency: quote.currency,
          totalAmount: lines.reduce((sum, l) => sum + l.lineTotalAmount, 0n),
          createdByUserId: actorUserId,
        })
        .returning();
      await tx.insert(catalogBundleLines).values(
        lines.map((l, i) => ({
          bundleId: bundle!.id,
          sortOrder: i,
          type: l.type,
          catalogItemId: l.catalogItemId,
          name: l.name,
          description: l.description,
          quantity: l.quantity,
          unitPriceAmount: l.unitPriceAmount,
          discountPercentage: l.discountPercentage,
          taxRatePercentage: l.taxRatePercentage,
          taxRateId: l.taxRateId,
          taxGroupId: l.taxGroupId,
          isTaxInclusive: l.isTaxInclusive,
          supplyClass: l.supplyClass,
          hsnSac: l.hsnSac,
        })),
      );
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "catalog_bundle",
        entityId: bundle!.id,
        contactId: null,
        changes: [{ field: "name", from: null, to: bundle!.name }],
      });
      return bundle!.id;
    });
    return this.getOne(orgId, id);
  }

  /**
   * US-CAT-14 (D-213) — a bundle from catalogue items: each line copies the
   * item's default price, tax, HSN/SAC and supply type, with the quantity
   * given. The items must be this organisation's, active and in one currency.
   */
  private async createFromItems(orgId: string, actorUserId: string, input: CreateCatalogBundleInput & { items: NonNullable<CreateCatalogBundleInput["items"]> }): Promise<CatalogBundle> {
    const ids = [...new Set(input.items.map((i) => i.catalogItemId))];
    const rows = await this.db.select().from(catalogItems).where(and(eq(catalogItems.orgId, orgId), inArray(catalogItems.id, ids), isNull(catalogItems.archivedAt)));
    if (rows.length !== ids.length) throw new BadRequestException("Some of these items are archived or no longer exist. Refresh and try again.");
    const currencies = new Set(rows.map((r) => r.defaultPriceCurrency));
    if (currencies.size > 1) throw new BadRequestException(BUNDLE_ONE_CURRENCY);
    const currency = rows[0]!.defaultPriceCurrency;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const lines = input.items.map((entry, i) => {
      const item = byId.get(entry.catalogItemId)!;
      const computed = computeDocumentLine({
        quantity: entry.quantity,
        unitPriceAmount: item.defaultPriceAmount,
        currency,
        rates: item.defaultTaxRatePercentage > 0 ? [{ id: "default", name: "default", percent: item.defaultTaxRatePercentage, isCompound: false }] : [],
        inclusive: false,
      });
      return {
        sortOrder: i,
        type: "item" as const,
        catalogItemId: item.id,
        name: item.name,
        description: item.description,
        quantity: entry.quantity,
        unitPriceAmount: item.defaultPriceAmount,
        discountPercentage: 0,
        taxRatePercentage: item.defaultTaxRatePercentage,
        taxRateId: item.defaultTaxRateId,
        taxGroupId: item.defaultTaxGroupId,
        isTaxInclusive: false,
        supplyClass: item.supplyClass,
        hsnSac: item.hsnSac,
        total: computed.tax.total.amount,
      };
    });

    const id = await this.db.transaction(async (tx) => {
      const [bundle] = await tx
        .insert(catalogBundles)
        .values({
          orgId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          currency,
          totalAmount: lines.reduce((sum, l) => sum + l.total, 0n),
          createdByUserId: actorUserId,
        })
        .returning();
      await tx.insert(catalogBundleLines).values(lines.map(({ total: _total, ...line }) => ({ ...line, bundleId: bundle!.id })));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "catalog_bundle",
        entityId: bundle!.id,
        contactId: null,
        changes: [{ field: "name", from: null, to: bundle!.name }],
      });
      return bundle!.id;
    });
    return this.getOne(orgId, id);
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateCatalogBundleInput): Promise<CatalogBundle> {
    const existing = await this.find(orgId, id);
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, { own: "catalog.edit_own", others: "catalog.edit_others" });
    const next = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    };
    await this.db.transaction(async (tx) => {
      await tx.update(catalogBundles).set({ ...next, updatedAt: new Date() }).where(eq(catalogBundles.id, id));
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, next as Record<string, unknown>);
      if (changes.length) await this.auditLog.record(tx, { orgId, actorUserId, action: "updated", entityType: "catalog_bundle", entityId: id, contactId: null, changes });
    });
    return this.getOne(orgId, id);
  }

  async setArchived(orgId: string, id: string, actorUserId: string, archived: boolean): Promise<CatalogBundle> {
    const existing = await this.find(orgId, id);
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, { own: "catalog.delete_own", others: "catalog.delete_others" });
    await this.db.transaction(async (tx) => {
      await tx.update(catalogBundles).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() }).where(eq(catalogBundles.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: archived ? "archived" : "restored", entityType: "catalog_bundle", entityId: id, contactId: null });
    });
    return this.getOne(orgId, id);
  }

  /** Bundles are never referenced by documents (their lines are copied), so one can always be deleted. */
  async delete(orgId: string, id: string, actorUserId: string): Promise<{ id: string }> {
    const existing = await this.find(orgId, id);
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, { own: "catalog.delete_own", others: "catalog.delete_others" });
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, { orgId, actorUserId, action: "deleted", entityType: "catalog_bundle", entityId: id, contactId: null, changes: [{ field: "name", from: existing.name, to: null }] });
      await tx.delete(catalogBundles).where(eq(catalogBundles.id, id));
    });
    return { id };
  }
}
