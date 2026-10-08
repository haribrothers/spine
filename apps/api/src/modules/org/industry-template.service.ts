import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { INDUSTRY_TEMPLATES, industryTemplateSchema, templateModules, type IndustryTemplateValue, type TemplateSeedResult } from "@spine/shared";
import { MODULES_KEY, forgetModules } from "../../common/modules";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { accounts, expenseCategories, settings } from "../../db/schema";

/** Where the last template seed is kept, for the note on Expenses › Categories. */
export const TEMPLATE_SEED_KEY = "industry_template_seed";

/**
 * US-ONB-13 (D-129), US-ONB-20 (D-193) — choosing a template sets up its
 * cost accounts and expense categories, once. Existing codes and names win
 * and are reported as kept; running it again creates nothing; switching
 * template never deletes or remaps anything.
 */
@Injectable()
export class IndustryTemplateService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Saves the template and seeds its accounts and categories in the same transaction. */
  async set(orgId: string, actorUserId: string, value: unknown): Promise<{ key: string; value: unknown; seeded?: TemplateSeedResult }> {
    const parsed = industryTemplateSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Pick one of the industry templates.");
    return this.db.transaction(async (tx) => {
      await tx
        .insert(settings)
        .values({ orgId, key: "industry_template", value: parsed.data })
        .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: parsed.data, updatedAt: new Date() } });
      // US-ONB-14 (D-154): the template sets modules only for an organisation that has never saved them.
      const [modules] = await tx.select({ key: settings.key }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, MODULES_KEY)));
      if (!modules) {
        await tx.insert(settings).values({ orgId, key: MODULES_KEY, value: templateModules(parsed.data.template) });
        forgetModules(orgId);
      }
      const definition = INDUSTRY_TEMPLATES[parsed.data.template];
      if (!definition.accounts.length && !definition.categories.length) return { key: "industry_template", value: parsed.data };
      const seeded = await this.seedTemplate(tx, orgId, actorUserId, parsed.data.template);
      return { key: "industry_template", value: parsed.data, seeded };
    });
  }

  async seedTemplate(tx: Database | Transaction, orgId: string, actorUserId: string | null, template: IndustryTemplateValue): Promise<TemplateSeedResult> {
    const { accounts: templateAccounts, categories: templateCategories } = INDUSTRY_TEMPLATES[template];
    const [previous] = await tx.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, TEMPLATE_SEED_KEY)));
    const before = (previous?.value as TemplateSeedResult | undefined) ?? { accounts: [], categories: [], kept: [] };
    const result: TemplateSeedResult = { template, accounts: [], categories: [], kept: [] };

    const codes = [...new Set([...templateAccounts.map((a) => a.code), ...templateCategories.map((c) => c.accountCode)])];
    const existing = await tx.select().from(accounts).where(and(eq(accounts.orgId, orgId), inArray(accounts.code, codes)));
    const byCode = new Map(existing.map((a) => [a.code, a]));
    for (const seed of templateAccounts) {
      const found = byCode.get(seed.code);
      if (found) {
        if (found.name !== seed.name) result.kept.push(`Kept your existing account ${found.code} · ${found.name}`);
        continue;
      }
      const [row] = await tx.insert(accounts).values({ orgId, code: seed.code, name: seed.name, type: "expense", isSystem: false }).returning();
      byCode.set(seed.code, row!);
      result.accounts.push(`${seed.code} · ${seed.name}`);
    }

    const names = templateCategories.map((c) => c.name.toLowerCase());
    const existingCategories = await tx
      .select({ name: expenseCategories.name })
      .from(expenseCategories)
      .where(and(eq(expenseCategories.orgId, orgId), inArray(sql`lower(${expenseCategories.name})`, names)));
    const taken = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.name]));
    for (const seed of templateCategories) {
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
