import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createTaxRateSchema, updateTaxRateSchema } from "@spine/shared";
import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { taxRates, taxGroupRates } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>;
export type UpdateTaxRateInput = z.infer<typeof updateTaxRateSchema>;

/**
 * PRD FEAT-08 (S-08.1) — named tax rates, flat CRUD following
 * CatalogService's own established conventions exactly (org-scoped,
 * soft-delete via archivedAt, AuditLogService inside the same transaction).
 *
 * Rates are never hard-deleted once any quote/invoice/catalog item line has
 * snapshotted them — see `archive()`'s own comment.
 */
@Injectable()
export class TaxRatesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(orgId: string, options: { includeArchived?: boolean } = {}) {
    let rows = await this.db
      .select()
      .from(taxRates)
      .where(eq(taxRates.orgId, orgId))
      .orderBy(asc(taxRates.name));
    if (!options.includeArchived) {
      rows = rows.filter((row) => row.archivedAt === null);
    }
    return rows;
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(taxRates)
      .where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, id)));
    if (!row) {
      throw new NotFoundException("Tax rate not found");
    }
    return row;
  }

  async create(orgId: string, actorUserId: string, input: CreateTaxRateInput) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(taxRates)
        .values({ orgId, name: input.name, rate: input.rate, isCompound: input.isCompound ?? false })
        .returning();
      if (!row) {
        throw new BadRequestException("Failed to create tax rate");
      }
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "tax_rate",
        entityId: row.id,
        contactId: null,
        changes: [{ field: "name", from: null, to: row.name }],
      });
      return row;
    });
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateTaxRateInput) {
    const existing = await this.getOne(orgId, id);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(taxRates)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.rate !== undefined ? { rate: input.rate } : {}),
          ...(input.isCompound !== undefined ? { isCompound: input.isCompound } : {}),
          updatedAt: new Date(),
        })
        .where(eq(taxRates.id, id))
        .returning();
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, input as Record<string, unknown>);
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "tax_rate",
          entityId: id,
          contactId: null,
          changes,
        });
      }
      return row;
    });
  }

  /**
   * Soft-delete only — a tax rate referenced by any quote/invoice line's
   * `taxRateId` (provenance FK, `onDelete: "set null"`) or any
   * `tax_group_rates` row (`onDelete: "restrict"`) must remain readable so
   * historical documents and existing groups keep resolving it. Archived
   * rates simply stop appearing as pickable options for new lines.
   */
  async archive(orgId: string, id: string, actorUserId: string) {
    await this.getOne(orgId, id);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(taxRates)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(taxRates.id, id))
        .returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "archived",
        entityType: "tax_rate",
        entityId: id,
        contactId: null,
      });
      return row;
    });
  }

  async restore(orgId: string, id: string, actorUserId: string) {
    await this.getOne(orgId, id);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(taxRates)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(taxRates.id, id))
        .returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "restored",
        entityType: "tax_rate",
        entityId: id,
        contactId: null,
      });
      return row;
    });
  }

  /** Hard delete, only reachable when nothing references this rate yet — mirrors CatalogService.delete()'s defensive-cleanup framing. */
  async delete(orgId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(orgId, id);
    const [usedInGroup] = await this.db.select().from(taxGroupRates).where(eq(taxGroupRates.taxRateId, id));
    if (usedInGroup) {
      throw new BadRequestException("Tax rate is used in a tax group and cannot be deleted — archive it instead");
    }
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "tax_rate",
        entityId: id,
        contactId: null,
        changes: [{ field: "name", from: existing.name, to: null }],
      });
      await tx.delete(taxRates).where(eq(taxRates.id, id));
    });
    return { id };
  }
}
