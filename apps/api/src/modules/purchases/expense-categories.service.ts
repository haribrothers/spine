import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ExpenseCategoryUsage, createExpenseCategorySchema, updateExpenseCategorySchema } from "@spine/shared";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { expenseCategories, expenses, accounts, settings, taxRates } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { requireOwnershipCapability } from "../../auth/capability.util";

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
    // US-PUR-23: with the posting account's code and name, so the labour form can preselect the 5200 category.
    let rows = (
      await this.db
        .select({ category: expenseCategories, accountCode: accounts.code, accountName: accounts.name, defaultTaxRateName: taxRates.name })
        .from(expenseCategories)
        .leftJoin(accounts, eq(expenseCategories.accountId, accounts.id))
        // US-PUR-46: the default tax rate's name, for the table and the form's hint.
        .leftJoin(taxRates, eq(expenseCategories.defaultTaxRateId, taxRates.id))
        .where(eq(expenseCategories.orgId, orgId))
        .orderBy(asc(expenseCategories.name))
    ).map((r) => ({ ...r.category, accountCode: r.accountCode, accountName: r.accountName, defaultTaxRateName: r.defaultTaxRateName }));
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

  /** `GET /expense-categories/:id/history` — confirms the category exists (org-scoped) before delegating to AuditLogService, same pattern as InvoicesService.getHistory. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "expense_category", id);
  }

  /**
   * US-PUR-46 (D-228) — how many expenses use each category, and what was
   * approved in it this month (by approval date, UTC month, in the
   * business's currency — the expenses list card's rule). Owners and Staff
   * only (the controller); Field never sees other people's money.
   */
  async usage(orgId: string): Promise<ExpenseCategoryUsage[]> {
    const [currencyRow] = await this.db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
    const currency = (currencyRow?.value as { code?: string } | undefined)?.code ?? "USD";
    const rows = await this.db
      .select({
        categoryId: expenses.categoryId,
        expenseCount: sql<number>`count(*)::int`,
        approvedThisMonth: sql<string>`coalesce(sum(${expenses.amount}) filter (where ${expenses.status} = 'approved' and ${expenses.currency} = ${currency} and to_char(${expenses.approvedAt} at time zone 'UTC', 'YYYY-MM') = to_char(now() at time zone 'UTC', 'YYYY-MM')), 0)::text`,
      })
      .from(expenses)
      .where(eq(expenses.orgId, orgId))
      .groupBy(expenses.categoryId);
    return rows.map((r) => ({ categoryId: r.categoryId, expenseCount: Number(r.expenseCount), approvedThisMonth: r.approvedThisMonth }));
  }

  /** US-PUR-47 — a name another category has, ignoring case and surrounding spaces (archived included), is a 409 naming it. */
  private async assertNameFree(orgId: string, name: string, exceptId?: string) {
    const [clash] = await this.db
      .select({ id: expenseCategories.id, name: expenseCategories.name, archivedAt: expenseCategories.archivedAt })
      .from(expenseCategories)
      .where(and(eq(expenseCategories.orgId, orgId), sql`lower(btrim(${expenseCategories.name})) = lower(btrim(${name}))`, exceptId ? ne(expenseCategories.id, exceptId) : undefined));
    if (clash) {
      throw new ConflictException({
        error: "EXPENSE_CATEGORY_NAME_TAKEN",
        message: `${clash.name} is already a category.`,
        existingId: clash.id,
        archived: clash.archivedAt !== null,
      });
    }
  }

  /** US-PUR-48 — a default tax rate must be one of the business's active rates. */
  private async assertActiveRate(orgId: string, taxRateId: string | null | undefined) {
    if (!taxRateId) return;
    const [rate] = await this.db.select({ id: taxRates.id }).from(taxRates).where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, taxRateId), isNull(taxRates.archivedAt)));
    if (!rate) throw new BadRequestException("Choose an active tax rate.");
  }

  async create(orgId: string, actorUserId: string, input: CreateExpenseCategoryInput) {
    await this.assertNameFree(orgId, input.name);
    await this.assertActiveRate(orgId, input.defaultTaxRateId);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(expenseCategories)
        .values({ orgId, name: input.name, description: input.description || null, accountId: input.accountId ?? null, defaultTaxRateId: input.defaultTaxRateId ?? null, createdByUserId: actorUserId })
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
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "expense_categories.edit_own",
      others: "expense_categories.edit_others",
    });
    if (input.name !== undefined) await this.assertNameFree(orgId, input.name, id);
    // A rate saved before it was archived can stay; a newly chosen one must be active.
    if (input.defaultTaxRateId !== existing.defaultTaxRateId) await this.assertActiveRate(orgId, input.defaultTaxRateId);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(expenseCategories)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
          ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
          ...(input.defaultTaxRateId !== undefined ? { defaultTaxRateId: input.defaultTaxRateId } : {}),
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
    const existing = await this.getOne(orgId, id);
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "expense_categories.delete_own",
      others: "expense_categories.delete_others",
    });
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
    const existing = await this.getOne(orgId, id);
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "expense_categories.delete_own",
      others: "expense_categories.delete_others",
    });
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
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "expense_categories.delete_own",
      others: "expense_categories.delete_others",
    });
    const [used] = await this.db.select().from(expenses).where(eq(expenses.categoryId, id));
    if (used) {
      throw new BadRequestException(`${existing.name} is used by an expense, so it can't be deleted — archive it instead.`);
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
