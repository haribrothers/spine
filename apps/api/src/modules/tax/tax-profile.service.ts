import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { gstinError, isUnionTerritory, taxPreset, type PutTaxProfileInput, type TaxPreset, type TaxProfile, type TaxProfileUpdate } from "@spine/shared";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { settings, taxGroupRates, taxGroups, taxRates } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { SettingsService } from "../org/settings.service";

const PROFILE_KEY = "tax_profile";
const DOCUMENT_LAYOUT_KEY = "document_layout";

/**
 * US-TAX-09 (D-145) — the tax country and its preset. Choosing a country
 * adds the preset's rates and groups that aren't there yet; an existing
 * rate (same name and percentage) is reused, never edited or deleted, so
 * seeding twice adds nothing.
 */
@Injectable()
export class TaxProfileService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async get(orgId: string): Promise<TaxProfile> {
    return (await this.settings.get<TaxProfile>(orgId, PROFILE_KEY)) ?? {};
  }

  /**
   * Saves the fields given and keeps the rest. A country seeds its preset
   * (US-TAX-09); the GSTIN must belong to the state (US-TAX-12), and a
   * union-territory business gets its CGST + UTGST groups back.
   */
  async update(orgId: string, actorUserId: string, input: PutTaxProfileInput): Promise<TaxProfileUpdate> {
    return this.db.transaction(async (tx) => {
      // Two saves at once would both see the rates missing and add them twice.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`tax_profile:${orgId}`}))`);
      const preset = input.country ? taxPreset(input.country) : null;
      const added = preset ? await this.seed(tx, orgId, actorUserId, preset) : 0;
      const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
      const profile: TaxProfile = { ...(await this.read<TaxProfile>(tx, orgId, PROFILE_KEY)), ...given };
      if (profile.registrationNumber && profile.stateCode) {
        const message = gstinError(profile.registrationNumber, profile.stateCode);
        if (message) throw new BadRequestException(message);
      }
      await this.write(tx, orgId, PROFILE_KEY, profile);
      if (preset?.invoiceTitle) {
        const layout = (await this.read<Record<string, Record<string, unknown> | undefined>>(tx, orgId, DOCUMENT_LAYOUT_KEY)) ?? {};
        await this.write(tx, orgId, DOCUMENT_LAYOUT_KEY, { ...layout, invoice: { ...layout.invoice, title: preset.invoiceTitle } });
      }
      if (profile.country === "IN" && input.stateCode && isUnionTerritory(input.stateCode)) await this.restoreUnionTerritoryGroups(tx, orgId);
      return { profile, added };
    });
  }

  /**
   * US-TAX-12 — a union territory without a legislature charges CGST +
   * UTGST: restore each "GST n% (UT)" group (and its rates) whose
   * "GST n%" group is in use.
   */
  private async restoreUnionTerritoryGroups(tx: Transaction, orgId: string): Promise<void> {
    const groups = await tx.select().from(taxGroups).where(eq(taxGroups.orgId, orgId));
    const active = new Set(groups.filter((g) => g.archivedAt === null).map((g) => g.name));
    const restore = groups.filter((g) => g.archivedAt !== null && g.name.endsWith(" (UT)") && active.has(g.name.slice(0, -5)));
    if (!restore.length) return;
    const ids = restore.map((g) => g.id);
    await tx.update(taxGroups).set({ archivedAt: null, updatedAt: new Date() }).where(inArray(taxGroups.id, ids));
    const rateIds = (await tx.select({ id: taxGroupRates.taxRateId }).from(taxGroupRates).where(inArray(taxGroupRates.taxGroupId, ids))).map((r) => r.id);
    await tx
      .update(taxRates)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(taxRates.orgId, orgId), inArray(taxRates.id, rateIds), isNotNull(taxRates.archivedAt)));
  }

  /** Adds the preset's missing rates and groups; returns how many rates it added. */
  private async seed(tx: Transaction, orgId: string, actorUserId: string, preset: TaxPreset): Promise<number> {
    const existing = await tx.select().from(taxRates).where(eq(taxRates.orgId, orgId));
    const ids = new Map<string, string>();
    let added = 0;
    for (const rate of preset.rates) {
      const match = existing.find((r) => r.name.trim().toLowerCase() === rate.name.toLowerCase() && Number(r.rate) === rate.rate);
      if (match) {
        ids.set(rate.name, match.id);
        continue;
      }
      const [row] = await tx
        .insert(taxRates)
        .values({ orgId, name: rate.name, rate: rate.rate, taxType: rate.taxType, archivedAt: rate.archived ? new Date() : null })
        .returning();
      ids.set(rate.name, row!.id);
      added += 1;
      await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "tax_rate", entityId: row!.id, contactId: null, changes: [{ field: "name", from: null, to: row!.name }] });
    }

    const groupNames = new Set((await tx.select({ name: taxGroups.name }).from(taxGroups).where(eq(taxGroups.orgId, orgId))).map((g) => g.name.trim().toLowerCase()));
    for (const group of preset.groups) {
      if (groupNames.has(group.name.toLowerCase())) continue;
      const [row] = await tx
        .insert(taxGroups)
        .values({ orgId, name: group.name, scope: group.scope, archivedAt: group.archived ? new Date() : null })
        .returning();
      await tx.insert(taxGroupRates).values(group.rates.map((name) => ({ taxGroupId: row!.id, taxRateId: ids.get(name)! })));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "tax_group", entityId: row!.id, contactId: null, changes: [{ field: "name", from: null, to: row!.name }] });
    }
    return added;
  }

  private async read<T>(tx: Transaction, orgId: string, key: string): Promise<T | null> {
    const [row] = await tx.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, key)));
    return (row?.value as T | undefined) ?? null;
  }

  private async write(tx: Transaction, orgId: string, key: string, value: unknown): Promise<void> {
    await tx
      .insert(settings)
      .values({ orgId, key, value: value as object })
      .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: value as object, updatedAt: new Date() } });
  }
}
