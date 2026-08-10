import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createExpenseCategorySchema, updateExpenseCategorySchema } from "@spine/shared";
import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { expenseCategories, expenses } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

/** S-09.9 half — org-configurable expense categories. Flat CRUD, following CatalogService's own established conventions exactly (org-scoped, soft-delete via archivedAt, AuditLogService inside the same transaction). */
@Injectable()
export class ExpenseCategoriesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(orgId: string, options: { includeArchived?: boolean } = {}) {
    let rows = await this.db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.orgId, orgId))
      .orderBy(asc(expenseCategories.name));
    if (!options.includeArchived) {
      rows = rows.filter((row) => row.archivedAt === null);
    }
    return rows;
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(expenseCategories)
      .where(and(eq(expenseCategories.orgId, orgId), eq(expenseCategories.id, id)));
    if (!row) {
      throw new NotFoundException("Expense category not found");
    }
    return row;
  }

  async create(orgId: string, actorUserId: string, input: CreateExpenseCategoryInput) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(expenseCategories)
        .values({ orgId, name: input.name, accountId: input.accountId ?? null })
        .returning();
      if (!row) {
        throw new BadRequestException("Failed to create expense category");
      }
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "expense_category",
        entityId: row.id,
        contactId: null,
        changes: [{ field: "name", from: null, to: row.name }],
      });
      return row;
    });
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateExpenseCategoryInput) {
    const existing = await this.getOne(orgId, id);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(expenseCategories)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(expenseCategories.id, id))
        .returning();
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, input as Record<string, unknown>);
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "expense_category",
          entityId: id,
          contactId: null,
          changes,
        });
      }
      return row;
    });
  }

  async archive(orgId: string, id: string, actorUserId: string) {
    await this.getOne(orgId, id);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(expenseCategories)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(expenseCategories.id, id))
        .returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "archived",
        entityType: "expense_category",
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
        .update(expenseCategories)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(expenseCategories.id, id))
        .returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "restored",
        entityType: "expense_category",
        entityId: id,
        contactId: null,
      });
      return row;
    });
  }

  /** Hard delete, blocked once any expense references this category — same "referenced -> block delete" convention as ContactsService.delete's own ledger check. */
  async delete(orgId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(orgId, id);
    const [used] = await this.db.select().from(expenses).where(eq(expenses.categoryId, id));
    if (used) {
      throw new BadRequestException("Expense category is used by an expense and cannot be deleted — archive it instead");
    }
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "expense_category",
        entityId: id,
        contactId: null,
        changes: [{ field: "name", from: existing.name, to: null }],
      });
      await tx.delete(expenseCategories).where(eq(expenseCategories.id, id));
    });
    return { id };
  }
}
