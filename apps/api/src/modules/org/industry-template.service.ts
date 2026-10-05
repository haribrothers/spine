import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { CONSTRUCTION_ACCOUNTS, CONSTRUCTION_CATEGORIES, industryTemplateSchema, type TemplateSeedResult } from "@spine/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { accounts, expenseCategories, settings } from "../../db/schema";

/** Where the last Construction seed is kept, for the note on Expenses › Categories. */
export const TEMPLATE_SEED_KEY = "industry_template_seed";

/**
 * US-ONB-13 (D-129) — choosing Construction / Contracting sets up its cost
 * accounts (5300, 5400, 5500) and six expense categories, once. Existing
 * codes and names win and are reported as kept; running it again creates
 * nothing; switching template never deletes or remaps anything.
 */
@Injectable()
export class IndustryTemplateService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Saves the template and, for Construction, seeds in the same transaction. */
  async set(orgId: string, actorUserId: string, value: unknown): Promise<{ key: string; value: unknown; seeded?: TemplateSeedResult }> {
    const parsed = industryTemplateSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Pick one of the industry templates.");
    return this.db.transaction(async (tx) => {
      await tx
        .insert(settings)
        .values({ orgId, key: "industry_template", value: parsed.data })
        .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: parsed.data, updatedAt: new Date() } });
      if (parsed.data.template !== "construction") return { key: "industry_template", value: parsed.data };
      const seeded = await this.seedConstruction(tx, orgId, actorUserId);
      return { key: "industry_template", value: parsed.data, seeded };
    });
  }

  async seedConstruction(tx: Database | Transaction, orgId: string, actorUserId: string | null): Promise<TemplateSeedResult> {
    const [previous] = await tx.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, TEMPLATE_SEED_KEY)));
    const before = (previous?.value as TemplateSeedResult | undefined) ?? { accounts: [], categories: [], kept: [] };
    const result: TemplateSeedResult = { accounts: [], categories: [], kept: [] };

    const codes = [...new Set([...CONSTRUCTION_ACCOUNTS.map((a) => a.code), ...CONSTRUCTION_CATEGORIES.map((c) => c.accountCode)])];
    const existing = await tx.select().from(accounts).where(and(eq(accounts.orgId, orgId), inArray(accounts.code, codes)));
    const byCode = new Map(existing.map((a) => [a.code, a]));
    for (const seed of CONSTRUCTION_ACCOUNTS) {
      const found = byCode.get(seed.code);
      if (found) {
        if (found.name !== seed.name) result.kept.push(`Kept your existing account ${found.code} · ${found.name}`);
        continue;
      }
      const [row] = await tx.insert(accounts).values({ orgId, code: seed.code, name: seed.name, type: "expense", isSystem: false }).returning();
      byCode.set(seed.code, row!);
      result.accounts.push(`${seed.code} · ${seed.name}`);
    }

    const names = CONSTRUCTION_CATEGORIES.map((c) => c.name.toLowerCase());
    const existingCategories = await tx
      .select({ name: expenseCategories.name })
      .from(expenseCategories)
      .where(and(eq(expenseCategories.orgId, orgId), inArray(sql`lower(${expenseCategories.name})`, names)));
    const taken = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.name]));
    for (const seed of CONSTRUCTION_CATEGORIES) {
      const found = taken.get(seed.name.toLowerCase());
      if (found) {
        // A category this template made last time isn't "yours" — say nothing about it.
        if (!before.categories.some((n) => n.toLowerCase() === seed.name.toLowerCase())) result.kept.push(`Kept your existing category “${found}”`);
        continue;
      }
      await tx.insert(expenseCategories).values({ orgId, name: seed.name, accountId: byCode.get(seed.accountCode)?.id ?? null, createdByUserId: actorUserId });
      result.categories.push(seed.name);
    }

    // The first run's note stands until something new is set up.
    if (result.accounts.length || result.categories.length) {
      await tx
        .insert(settings)
        .values({ orgId, key: TEMPLATE_SEED_KEY, value: result })
        .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: result, updatedAt: new Date() } });
    }
    return result;
  }
}
