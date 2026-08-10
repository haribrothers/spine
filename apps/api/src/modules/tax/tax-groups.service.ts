import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createTaxGroupSchema, updateTaxGroupSchema } from "@spine/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { taxGroups, taxGroupRates, taxRates } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

export type CreateTaxGroupInput = z.infer<typeof createTaxGroupSchema>;
export type UpdateTaxGroupInput = z.infer<typeof updateTaxGroupSchema>;

/**
 * PRD FEAT-08 (S-08.3) — a named bundle of tax rates applied together on
 * one line (e.g. "CGST + SGST"). `taxRateIds` is always replaced in full on
 * write, never diffed — the same "delete-all-then-reinsert" convention
 * quote_lines/invoice_lines already use for their own line arrays, since a
 * group's membership list is small and has no per-row identity worth
 * preserving across an edit.
 */
@Injectable()
export class TaxGroupsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(orgId: string, options: { includeArchived?: boolean } = {}) {
    let groups = await this.db
      .select()
      .from(taxGroups)
      .where(eq(taxGroups.orgId, orgId))
      .orderBy(asc(taxGroups.name));
    if (!options.includeArchived) {
      groups = groups.filter((row) => row.archivedAt === null);
    }
    return Promise.all(groups.map((group) => this.withRates(group)));
  }

  async getOne(orgId: string, id: string) {
    const [group] = await this.db
      .select()
      .from(taxGroups)
      .where(and(eq(taxGroups.orgId, orgId), eq(taxGroups.id, id)));
    if (!group) {
      throw new NotFoundException("Tax group not found");
    }
    return this.withRates(group);
  }

  private async withRates(group: typeof taxGroups.$inferSelect) {
    const links = await this.db.select().from(taxGroupRates).where(eq(taxGroupRates.taxGroupId, group.id));
    const ids = links.map((l) => l.taxRateId);
    const rates = ids.length ? await this.db.select().from(taxRates).where(inArray(taxRates.id, ids)) : [];
    return { ...group, taxRates: rates };
  }

  private async validateRateIds(orgId: string, taxRateIds: string[], tx: Transaction | Database = this.db) {
    if (taxRateIds.length === 0) {
      throw new BadRequestException("A tax group must include at least one tax rate");
    }
    const rows = await tx.select().from(taxRates).where(and(eq(taxRates.orgId, orgId), inArray(taxRates.id, taxRateIds)));
    if (rows.length !== new Set(taxRateIds).size) {
      throw new BadRequestException("One or more tax rates are invalid for this org");
    }
  }

  async create(orgId: string, actorUserId: string, input: CreateTaxGroupInput) {
    await this.validateRateIds(orgId, input.taxRateIds);
    const created = await this.db.transaction(async (tx) => {
      const [group] = await tx.insert(taxGroups).values({ orgId, name: input.name }).returning();
      if (!group) {
        throw new BadRequestException("Failed to create tax group");
      }
      await tx.insert(taxGroupRates).values(input.taxRateIds.map((taxRateId) => ({ taxGroupId: group.id, taxRateId })));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "tax_group",
        entityId: group.id,
        contactId: null,
        changes: [{ field: "name", from: null, to: group.name }],
      });
      return group;
    });
    return this.withRates(created);
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateTaxGroupInput) {
    const existing = await this.getOne(orgId, id);
    if (input.taxRateIds !== undefined) {
      await this.validateRateIds(orgId, input.taxRateIds);
    }

    const updated = await this.db.transaction(async (tx) => {
      const [group] = await tx
        .update(taxGroups)
        .set({ ...(input.name !== undefined ? { name: input.name } : {}), updatedAt: new Date() })
        .where(eq(taxGroups.id, id))
        .returning();

      if (input.taxRateIds !== undefined) {
        await tx.delete(taxGroupRates).where(eq(taxGroupRates.taxGroupId, id));
        await tx.insert(taxGroupRates).values(input.taxRateIds.map((taxRateId) => ({ taxGroupId: id, taxRateId })));
      }

      const changes = AuditLogService.diffFields(
        { name: existing.name } as Record<string, unknown>,
        { name: input.name } as Record<string, unknown>,
      );
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "tax_group",
          entityId: id,
          contactId: null,
          changes,
        });
      }
      return group!;
    });
    return this.withRates(updated);
  }

  async archive(orgId: string, id: string, actorUserId: string) {
    await this.getOne(orgId, id);
    await this.db.transaction(async (tx) => {
      await tx.update(taxGroups).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(taxGroups.id, id));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "archived",
        entityType: "tax_group",
        entityId: id,
        contactId: null,
      });
    });
    return this.getOne(orgId, id);
  }

  async restore(orgId: string, id: string, actorUserId: string) {
    await this.getOne(orgId, id);
    await this.db.transaction(async (tx) => {
      await tx.update(taxGroups).set({ archivedAt: null, updatedAt: new Date() }).where(eq(taxGroups.id, id));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "restored",
        entityType: "tax_group",
        entityId: id,
        contactId: null,
      });
    });
    return this.getOne(orgId, id);
  }

  async delete(orgId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(orgId, id);
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "tax_group",
        entityId: id,
        contactId: null,
        changes: [{ field: "name", from: existing.name, to: null }],
      });
      await tx.delete(taxGroupRates).where(eq(taxGroupRates.taxGroupId, id));
      await tx.delete(taxGroups).where(eq(taxGroups.id, id));
    });
    return { id };
  }
}
