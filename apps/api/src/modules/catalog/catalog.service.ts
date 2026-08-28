import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createCatalogItemSchema, updateCatalogItemSchema } from "@spine/shared";
import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { catalogItems } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { requireOwnershipCapability } from "../../auth/capability.util";

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
          defaultTaxRatePercentage: resolvedTax?.blendedPercentage ?? input.defaultTaxRatePercentage ?? 0,
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
          ...(input.incomeAccountId !== undefined ? { incomeAccountId: input.incomeAccountId } : {}),
          ...(input.expenseAccountId !== undefined ? { expenseAccountId: input.expenseAccountId } : {}),
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
