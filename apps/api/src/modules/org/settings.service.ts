import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { settings } from "../../db/schema";

/**
 * Thin key/value read-through over the generic org-scoped `settings` table
 * (apps/api/src/db/schema/org.ts) — there is no dedicated businessProfile
 * or taxRates table by design (see the onboarding task brief). Keys used by
 * the onboarding wizard, documented here as the single source of truth for
 * their shape since nothing else defines a schema for them:
 *
 * - `business_profile`   → { name: string; logoUrl?: string; address?: string; industry?: string }
 * - `industry_template`  → { template: "construction" | "general_services" | "generic" }
 * - `currency`           → { code: string; locale: string }
 * - `financial_year_start` → { month: number (1-12); day: number (1-31) }
 * - `default_tax_rate`   → { name: string; percentage: number } (percentage as a decimal string, e.g. "7.5")
 * - `onboarding_status`  → { completedSteps: string[]; skipped: boolean; completedAt?: string }
 * - `dashboard_checklist_dismissed` → { dismissed: boolean }
 */
@Injectable()
export class SettingsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async get<T = unknown>(orgId: string, key: string): Promise<T | null> {
    const [row] = await this.db
      .select()
      .from(settings)
      .where(and(eq(settings.orgId, orgId), eq(settings.key, key)));
    return (row?.value as T) ?? null;
  }

  async getMany(orgId: string, keys: string[]): Promise<Record<string, unknown>> {
    const rows = await this.db.select().from(settings).where(eq(settings.orgId, orgId));
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      if (keys.length === 0 || keys.includes(row.key)) {
        result[row.key] = row.value;
      }
    }
    return result;
  }

  async getAll(orgId: string): Promise<Record<string, unknown>> {
    return this.getMany(orgId, []);
  }

  /** Upsert on (orgId, key) — matches the table's unique constraint. */
  async set(orgId: string, key: string, value: unknown): Promise<void> {
    await this.db
      .insert(settings)
      .values({ orgId, key, value: value as object })
      .onConflictDoUpdate({
        target: [settings.orgId, settings.key],
        set: { value: value as object, updatedAt: new Date() },
      });
  }
}
