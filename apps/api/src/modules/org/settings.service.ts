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
 * - `quote_conversion_guard` → { mode: "off" | "warn" | "block" } — governs
 *   what happens when a user converts the SAME accepted quote into a job or
 *   invoice more than once (nothing else in the schema prevents this — see
 *   JobsService.createFromQuote/InvoicesService.convertFromQuote's own doc
 *   comments). "off": always allow silently (pre-existing behaviour).
 *   "warn" (default): the convert action still succeeds, but the caller
 *   must pass `confirm: true` once an existing conversion is found —
 *   without it, the request is rejected with a 409 so the web UI can show
 *   a real confirmation dialog first. "block": rejected outright, no way
 *   to override from the UI (an owner would need to lower this setting
 *   first). Checked identically by both JobsService and InvoicesService,
 *   via QuoteConversionGuardService (see that class's own doc comment).
 * - `dashboard_meetings_scope` → { scope: "own" | "org" } — S-10.19,
 *   governs the dashboard's "upcoming meetings" widget for Owner/Staff.
 *   "own" (default if unset): only meetings the viewer organizes. "org":
 *   every meeting in the org. Owner-editable from Settings. Field ALWAYS
 *   sees own-meetings-only regardless of this setting — enforced
 *   server-side in the dashboard meetings route itself (checked before
 *   honoring "org"), not a client-side toggle, so this is not a
 *   Field-widening lever.
 * - `meeting_reminder_lead_minutes` → { minutes: number } — S-10.22, the
 *   org-wide default for how many minutes before a meeting starts the
 *   S-10.21 "starting soon" reminder fires. Owner-editable from Settings.
 *   Any user can override it for themselves via `user.
 *   meetingReminderLeadMinutes` (nullable — null means "use this org
 *   default"); if this key itself is unset, `MeetingReminderWorker` falls
 *   back to a hardcoded default. See that worker's own comment for the
 *   full three-tier resolution order (user override → org default →
 *   hardcoded fallback).
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
