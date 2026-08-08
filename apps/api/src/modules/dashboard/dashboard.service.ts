import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, ne } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { catalogItems, contacts, quotes, settings } from "../../db/schema";

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
}
