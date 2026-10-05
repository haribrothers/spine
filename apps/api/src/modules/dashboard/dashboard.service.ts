import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { RetentionHeld } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, catalogItems, contacts, journalEntries, journalLines, jobs, quotes, settings } from "../../db/schema";

const CHECKLIST_DISMISSED_KEY = "dashboard_checklist_dismissed";

export interface SetupChecklistStatus {
  hasCustomer: boolean;
  hasItem: boolean;
  hasSentQuote: boolean;
  dismissed: boolean;
}

/**
 * PRD S-12.9 — real completion checks for the dashboard's setup checklist,
 * replacing its previous always-`false` placeholder (added back when
 * Contacts/Catalogue/Quotes didn't exist yet — see setup-checklist.tsx's
 * prior comment). Demo-seeded rows (`isDemo: true`) intentionally don't
 * satisfy any of these — the checklist is asking "have you done this for
 * real," and loading the demo dataset shouldn't silently tick these off.
 * A single existence check per item (`limit(1)`), not a count — nothing
 * here needs the total, only whether at least one real row exists.
 */
@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getSetupChecklist(orgId: string): Promise<SetupChecklistStatus> {
    const [customer, item, sentQuote, dismissedSetting] = await Promise.all([
      this.db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.isDemo, false), isNull(contacts.archivedAt)))
        .limit(1),
      this.db
        .select({ id: catalogItems.id })
        .from(catalogItems)
        .where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.isDemo, false), isNull(catalogItems.archivedAt)))
        .limit(1),
      this.db
        .select({ id: quotes.id })
        .from(quotes)
        .where(and(eq(quotes.orgId, orgId), eq(quotes.isDemo, false), ne(quotes.status, "draft")))
        .limit(1),
      this.db
        .select({ value: settings.value })
        .from(settings)
        .where(and(eq(settings.orgId, orgId), eq(settings.key, CHECKLIST_DISMISSED_KEY))),
    ]);

    return {
      hasCustomer: customer.length > 0,
      hasItem: item.length > 0,
      hasSentQuote: sentQuote.length > 0,
      dismissed: Boolean((dismissedSetting[0]?.value as { dismissed?: boolean } | undefined)?.dismissed),
    };
  }

  /**
   * `dashboard_checklist_dismissed` is stored in the same generic
   * `settings` table `SettingsService` owns, but reached through this
   * dedicated method/endpoint rather than `PUT /org/settings/:key` — that
   * route is deliberately `@OrgRoles(["owner"])`-only (real org
   * configuration shouldn't be staff-writable), while this checklist is
   * shown to and dismissible by every org member (`DashboardController`
   * has no `@OrgRoles` restriction on the read side either). Writing
   * straight to the same table/key keeps `GET /org/settings` (the
   * onboarding/Settings UI's own read of every key) seeing the same value,
   * without loosening the owner-only write gate for every other setting.
   */
  async dismissChecklist(orgId: string): Promise<void> {
    await this.db
      .insert(settings)
      .values({ orgId, key: CHECKLIST_DISMISSED_KEY, value: { dismissed: true } })
      .onConflictDoUpdate({
        target: [settings.orgId, settings.key],
        set: { value: { dismissed: true }, updatedAt: new Date() },
      });
  }

  /**
   * US-DASH-20 — retention held: the balance of 1150 Retention Receivable,
   * from journal lines grouped by job (never a parallel calculation), with
   * the three jobs holding the most.
   */
  async retentionHeld(orgId: string): Promise<RetentionHeld> {
    const held = sql<string>`sum(${journalLines.debit} - ${journalLines.credit})`;
    const rows = await this.db
      .select({ jobId: journalLines.jobId, held })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(journalEntries.orgId, orgId), eq(accounts.code, "1150"), isNotNull(journalLines.jobId)))
      .groupBy(journalLines.jobId);
    const holding = rows.map((r) => ({ jobId: r.jobId!, held: BigInt(r.held) })).filter((r) => r.held > 0n);
    holding.sort((a, b) => (b.held > a.held ? 1 : b.held < a.held ? -1 : 0));
    const top = holding.slice(0, 3);
    const names = top.length
      ? await this.db.select({ id: jobs.id, number: jobs.number, name: jobs.name }).from(jobs).where(and(eq(jobs.orgId, orgId), inArray(jobs.id, top.map((t) => t.jobId))))
      : [];
    const byId = new Map(names.map((j) => [j.id, j]));
    return {
      total: holding.reduce((sum, r) => sum + r.held, 0n).toString(),
      jobCount: holding.length,
      jobs: top.map((t) => ({ id: t.jobId, number: byId.get(t.jobId)?.number ?? null, name: byId.get(t.jobId)?.name ?? "", held: t.held.toString() })),
    };
  }
}
