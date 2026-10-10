import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { bulkRefusedMessage, lineSupplyClass, supplyClassTaxError, type BulkCatalogItemsInput, type CatalogItemUsage, type SupplyClass, type createCatalogItemSchema, type updateCatalogItemSchema } from "@spine/shared";
import { and, asc, countDistinct, eq, inArray, max } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, catalogItems, invoiceLines, invoices, quoteLines, quotes } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { requireOwnershipCapability } from "../../auth/capability.util";

/** US-TAX-11 — an item with tax is taxable; an exempt or non-taxable item can't carry tax. */
function itemSupplyClass(taxPercent: number, requested: SupplyClass | undefined): SupplyClass {
  const error = supplyClassTaxError(requested, taxPercent);
  if (error) throw new BadRequestException(error);
  return lineSupplyClass(taxPercent, requested);
}

export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;

/**
 * Catalogue items CRUD (PRD F2). Deliberately a flat CRUD, unlike
 * ContactsService's nested persons/addresses handling — a catalog item has
 * no sub-entities, so every write is a single-table statement, still
 * wrapped in `db.transaction(...)` for create/update/archive/restore only
 * because AuditLogService.record() must join the same transaction as the
 * mutation it documents (see AuditLogService's own top comment) — not
 * because there's any multi-row write to keep atomic here.
 */
@Injectable()
export class CatalogService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly taxResolver: TaxResolverService,
  ) {}

  async list(orgId: string, options: { search?: string; category?: string; includeArchived?: boolean }) {
    const conditions = [eq(catalogItems.orgId, orgId)];
    let rows = await this.db
      .select()
      .from(catalogItems)
      .where(and(...conditions))
      .orderBy(asc(catalogItems.name));

    if (!options.includeArchived) {
      rows = rows.filter((row) => row.archivedAt === null);
    }
    if (options.category) {
      rows = rows.filter((row) => row.category === options.category);
    }
    if (options.search) {
      const needle = options.search.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(needle) ||
          (row.description?.toLowerCase().includes(needle) ?? false) ||
          (row.category?.toLowerCase().includes(needle) ?? false),
      );
    }
    return rows;
  }

  async getOne(orgId: string, id: string) {
    const [item] = await this.db
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.id, id)));
    if (!item) {
      throw new NotFoundException("Catalog item not found");
    }
    return item;
  }

  /** `GET /catalog-items/:id/history` — confirms the item exists (org-scoped) before delegating to AuditLogService, same pattern as InvoicesService.getHistory. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "catalog_item", id);
  }

  /**
   * Self-contained on purpose (S-02.4 — "add an item inline while building
   * a quote"): this endpoint takes nothing beyond `orgId` + the create
   * payload, no quote/document context, so a future Quotes line-item
   * builder can call `POST /catalog-items` directly from an inline
   * "+ New item" affordance without any special-casing here.
   */
  async create(orgId: string, actorUserId: string, input: CreateCatalogItemInput) {
    const resolvedTax = input.defaultTaxRateId || input.defaultTaxGroupId
      ? await this.taxResolver.resolve(orgId, { taxRateId: input.defaultTaxRateId, taxGroupId: input.defaultTaxGroupId })
      : null;
    const taxPercent = resolvedTax?.blendedPercentage ?? input.defaultTaxRatePercentage ?? 0;
    const supplyClass = itemSupplyClass(taxPercent, input.supplyClass);
    // US-TAX-13: the inter-state tax must be one of the org's rates or groups.
    if (input.interTaxRateId || input.interTaxGroupId) {
      await this.taxResolver.resolve(orgId, { taxRateId: input.interTaxRateId, taxGroupId: input.interTaxGroupId });
    }

    const created = await this.db.transaction(async (tx) => {
      const [item] = await tx
        .insert(catalogItems)
        .values({
          orgId,
          name: input.name,
          description: input.description ?? null,
          unit: input.unit,
          category: input.category ?? null,
          defaultPriceAmount: input.defaultPriceAmount,
          defaultPriceCurrency: input.defaultPriceCurrency,
          defaultTaxRatePercentage: taxPercent,
          interTaxRateId: input.interTaxRateId ?? null,
          interTaxGroupId: input.interTaxGroupId ?? null,
          hsnSac: input.hsnSac ?? null,
          supplyClass,
          defaultTaxRateId: input.defaultTaxRateId ?? null,
          defaultTaxGroupId: input.defaultTaxGroupId ?? null,
          incomeAccountId: input.incomeAccountId ?? null,
          expenseAccountId: input.expenseAccountId ?? null,
          createdByUserId: actorUserId,
        })
        .returning();
      if (!item) {
        throw new BadRequestException("Failed to create catalog item");
      }

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "catalog_item",
        entityId: item.id,
        contactId: null,
        changes: [{ field: "name", from: null, to: item.name }],
      });

      return item;
    });

    return created;
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateCatalogItemInput) {
    const [existing] = await this.db
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.id, id)));
    if (!existing) {
      throw new NotFoundException("Catalog item not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "catalog.edit_own",
      others: "catalog.edit_others",
    });

    const taxRefChanged = input.defaultTaxRateId !== undefined || input.defaultTaxGroupId !== undefined;
    const resolvedTax = taxRefChanged
      ? await this.taxResolver.resolve(orgId, {
          taxRateId: input.defaultTaxRateId !== undefined ? input.defaultTaxRateId : existing.defaultTaxRateId,
          taxGroupId: input.defaultTaxGroupId !== undefined ? input.defaultTaxGroupId : existing.defaultTaxGroupId,
        })
      : null;
    const taxPercent = resolvedTax?.blendedPercentage ?? input.defaultTaxRatePercentage ?? existing.defaultTaxRatePercentage;
    const supplyClass = itemSupplyClass(taxPercent, input.supplyClass ?? existing.supplyClass);
    if (input.interTaxRateId !== undefined || input.interTaxGroupId !== undefined) {
      const rateId = input.interTaxRateId !== undefined ? input.interTaxRateId : existing.interTaxRateId;
      const groupId = input.interTaxGroupId !== undefined ? input.interTaxGroupId : existing.interTaxGroupId;
      if (rateId || groupId) await this.taxResolver.resolve(orgId, { taxRateId: rateId, taxGroupId: groupId });
    }

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(catalogItems)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.defaultPriceAmount !== undefined ? { defaultPriceAmount: input.defaultPriceAmount } : {}),
          ...(input.defaultPriceCurrency !== undefined ? { defaultPriceCurrency: input.defaultPriceCurrency } : {}),
          ...(resolvedTax
            ? { defaultTaxRatePercentage: resolvedTax.blendedPercentage }
            : input.defaultTaxRatePercentage !== undefined
              ? { defaultTaxRatePercentage: input.defaultTaxRatePercentage }
              : {}),
          ...(input.defaultTaxRateId !== undefined ? { defaultTaxRateId: input.defaultTaxRateId } : {}),
          ...(input.defaultTaxGroupId !== undefined ? { defaultTaxGroupId: input.defaultTaxGroupId } : {}),
          ...(input.interTaxRateId !== undefined ? { interTaxRateId: input.interTaxRateId } : {}),
          ...(input.interTaxGroupId !== undefined ? { interTaxGroupId: input.interTaxGroupId } : {}),
          ...(input.hsnSac !== undefined ? { hsnSac: input.hsnSac } : {}),
          ...(input.incomeAccountId !== undefined ? { incomeAccountId: input.incomeAccountId } : {}),
          ...(input.expenseAccountId !== undefined ? { expenseAccountId: input.expenseAccountId } : {}),
          supplyClass,
          updatedAt: new Date(),
        })
        .where(eq(catalogItems.id, id))
        .returning();

      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, input as Record<string, unknown>);
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "catalog_item",
          entityId: id,
          contactId: null,
          changes,
        });
      }

      return row;
    });

    return updated;
  }

  /**
   * US-CAT-12 (D-213) — archive, restore or change several items at once,
   * all or nothing. Every item's own/others right is checked before
   * anything changes (edit rights to update, delete rights to archive or
   * restore, as the single-item routes); one transaction, one audit row each.
   */
  async bulk(orgId: string, actorUserId: string, input: BulkCatalogItemsInput): Promise<{ updated: number }> {
    const ids = [...new Set(input.ids)];
    const rows = await this.db.select().from(catalogItems).where(and(eq(catalogItems.orgId, orgId), inArray(catalogItems.id, ids)));
    if (rows.length !== ids.length) throw new NotFoundException("Some of these items no longer exist. Refresh and try again.");

    const rights = input.action === "update" ? { own: "catalog.edit_own", others: "catalog.edit_others" } as const : { own: "catalog.delete_own", others: "catalog.delete_others" } as const;
    let refused = 0;
    for (const row of rows) {
      try {
        await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, row.createdByUserId, rights);
      } catch (err) {
        if (err instanceof ForbiddenException) refused += 1;
        else throw err;
      }
    }
    if (refused > 0) throw new ForbiddenException(bulkRefusedMessage(refused));

    const changes = input.changes ?? {};
    const taxChanged = changes.defaultTaxRateId !== undefined || changes.defaultTaxGroupId !== undefined;
    const taxRateId = changes.defaultTaxRateId ?? null;
    const taxGroupId = changes.defaultTaxGroupId ?? null;
    if (taxRateId && taxGroupId) throw new BadRequestException("Choose a tax rate or a tax group, not both.");
    const resolvedTax = taxChanged && (taxRateId || taxGroupId) ? await this.taxResolver.resolve(orgId, { taxRateId, taxGroupId }) : null;
    const taxPercent = taxChanged ? (resolvedTax?.blendedPercentage ?? 0) : null;
    const interChanged = changes.interTaxRateId !== undefined || changes.interTaxGroupId !== undefined;
    const interRateId = changes.interTaxRateId ?? null;
    const interGroupId = changes.interTaxGroupId ?? null;
    if (interRateId && interGroupId) throw new BadRequestException("Choose a tax rate or a tax group, not both.");
    if (interRateId || interGroupId) await this.taxResolver.resolve(orgId, { taxRateId: interRateId, taxGroupId: interGroupId });
    if (changes.incomeAccountId) {
      const [account] = await this.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.id, changes.incomeAccountId), eq(accounts.type, "income")));
      if (!account) throw new BadRequestException("Choose one of your income accounts.");
    }

    await this.db.transaction(async (tx) => {
      const now = new Date();
      for (const row of rows) {
        if (input.action === "archive" || input.action === "restore") {
          const archivedAt = input.action === "archive" ? (row.archivedAt ?? now) : null;
          await tx.update(catalogItems).set({ archivedAt, updatedAt: now }).where(eq(catalogItems.id, row.id));
          await this.auditLog.record(tx, { orgId, actorUserId, action: input.action === "archive" ? "archived" : "restored", entityType: "catalog_item", entityId: row.id, contactId: null });
          continue;
        }
        const set: Partial<typeof catalogItems.$inferInsert> = {};
        if (changes.category !== undefined) set.category = changes.category || null;
        if (taxChanged) {
          set.defaultTaxRateId = taxRateId;
          set.defaultTaxGroupId = taxGroupId;
          set.defaultTaxRatePercentage = taxPercent ?? 0;
          // A tax makes an item taxable; "No tax" leaves its supply type as it was.
          set.supplyClass = taxPercent && taxPercent > 0 ? "taxable" : row.supplyClass;
        }
        if (interChanged) {
          set.interTaxRateId = interRateId;
          set.interTaxGroupId = interGroupId;
        }
        if (changes.incomeAccountId !== undefined) set.incomeAccountId = changes.incomeAccountId;
        await tx.update(catalogItems).set({ ...set, updatedAt: now }).where(eq(catalogItems.id, row.id));
        const diff = AuditLogService.diffFields(row as unknown as Record<string, unknown>, set as Record<string, unknown>);
        if (diff.length) {
          await this.auditLog.record(tx, { orgId, actorUserId, action: "updated", entityType: "catalog_item", entityId: row.id, contactId: null, changes: diff });
        }
      }
    });
    return { updated: rows.length };
  }

  /** US-CAT-15 — how many distinct quotes and invoices have a line from this item, and when it was last quoted. */
  async usage(orgId: string, id: string): Promise<CatalogItemUsage> {
    await this.getOne(orgId, id);
    const [quoted] = await this.db
      .select({ count: countDistinct(quotes.id), last: max(quotes.createdAt) })
      .from(quoteLines)
      .innerJoin(quotes, eq(quoteLines.quoteId, quotes.id))
      .where(and(eq(quotes.orgId, orgId), eq(quoteLines.catalogItemId, id)));
    const [invoiced] = await this.db
      .select({ count: countDistinct(invoices.id) })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
      .where(and(eq(invoices.orgId, orgId), eq(invoiceLines.catalogItemId, id)));
    const last = quoted?.last ? new Date(quoted.last) : null;
    return { quotes: Number(quoted?.count ?? 0), invoices: Number(invoiced?.count ?? 0), lastQuotedAt: last ? last.toISOString() : null };
  }

  /** Archive (soft-delete), never a hard DELETE by default — see catalog.ts's schema comment. */
  async archive(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.id, id)));
    if (!existing) {
      throw new NotFoundException("Catalog item not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "catalog.delete_own",
      others: "catalog.delete_others",
    });
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(catalogItems)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(catalogItems.id, id))
        .returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "archived",
        entityType: "catalog_item",
        entityId: id,
        contactId: null,
      });
      return row;
    });
    return updated;
  }

  async restore(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.id, id)));
    if (!existing) {
      throw new NotFoundException("Catalog item not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "catalog.delete_own",
      others: "catalog.delete_others",
    });
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(catalogItems)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(catalogItems.id, id))
        .returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "restored",
        entityType: "catalog_item",
        entityId: id,
        contactId: null,
      });
      return row;
    });
    return updated;
  }

  /**
   * True hard delete, retained for defensive cleanup only — the web UI only
   * ever offers archive (matching Contacts' own UI convention). Unlike
   * ContactsService.delete(), this is currently UNGUARDED: nothing FKs to
   * `catalog_items` yet, since Quotes/Invoices (which will hold line items
   * referencing a catalog item) don't exist. Once they do, either add a
   * similar "referenced -> block delete" check here (mirroring
   * ContactsService.delete()'s journal_lines check) or simply never expose
   * hard-delete from their UI, the same way Contacts' UI never calls this
   * beyond its own defensive test cleanup.
   */
  async delete(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.id, id)));
    if (!existing) {
      throw new NotFoundException("Catalog item not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "catalog.delete_own",
      others: "catalog.delete_others",
    });
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "catalog_item",
        entityId: id,
        contactId: null,
        changes: [{ field: "name", from: existing.name, to: null }],
      });
      await tx.delete(catalogItems).where(eq(catalogItems.id, id));
    });
    return { id };
  }
}
