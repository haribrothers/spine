import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, lt } from "drizzle-orm";
import { MODULE_KEYS, MODULES, fieldUsersMessage, occurrenceOnOrAfter, scheduleFinished, type ModuleKey, type ModuleSettings, type ModulesResponse, type RecurringSchedule } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { member, recurringBills, recurringInvoices } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { MODULES_KEY, forgetModules, loadModules } from "../../common/modules";
import { AuditLogService } from "../audit/audit-log.service";
import { SettingsService } from "./settings.service";

export const MODULES_CHANGED_AT_KEY = "modules_changed_at";

const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * US-SET-23–US-SET-25 (D-154) — switching optional modules on and off.
 * Nothing is deleted: a switched-off module's records, Team grants and
 * settings stay, and come back when it's switched on. Recurring schedules
 * resume from their next future date; dates missed while off are skipped.
 */
@Injectable()
export class ModulesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly audit: AuditLogService,
  ) {}

  async get(orgId: string): Promise<ModulesResponse> {
    const modules = await loadModules(this.db, orgId);
    const changedAt = (await this.settings.get<Partial<Record<ModuleKey, string>>>(orgId, MODULES_CHANGED_AT_KEY)) ?? {};
    const offSince = Object.fromEntries(MODULE_KEYS.filter((k) => !modules[k] && changedAt[k]).map((k) => [k, changedAt[k]!]));
    return { ...modules, ...(Object.keys(offSince).length ? { offSince } : {}) };
  }

  /** Whether the organisation has ever saved its modules (US-ONB-14: the template sets them only before then). */
  async saved(orgId: string): Promise<boolean> {
    return (await this.settings.get(orgId, MODULES_KEY)) !== null;
  }

  async update(orgId: string, actorUserId: string, next: ModuleSettings, db: Database | Transaction = this.db): Promise<ModuleSettings & { notice?: string }> {
    forgetModules(orgId);
    const current = await loadModules(db, orgId);
    // D-154: the field app can't vanish from under people who use it.
    if (current.jobsField && !next.jobsField) {
      const field = await db.select({ id: member.id }).from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "field"), eq(member.isActive, true)));
      if (field.length > 0) throw new BadRequestException(fieldUsersMessage(field.length));
    }
    const changed = MODULE_KEYS.filter((k) => current[k] !== next[k]);
    const today = orgClock().date;
    const changedAt = ((await this.settings.get<Partial<Record<ModuleKey, string>>>(orgId, MODULES_CHANGED_AT_KEY)) ?? {}) as Partial<Record<ModuleKey, string>>;

    let notice: string | undefined;
    if (changed.includes("recurring") && next.recurring) {
      await this.resumeSchedules(db, orgId, today);
      notice = `Recurring documents were off from ${longDate(changedAt.recurring ?? today)} to ${longDate(today)}; missed dates were skipped.`;
    }

    await this.settings.set(orgId, MODULES_KEY, next);
    if (changed.length) {
      await this.settings.set(orgId, MODULES_CHANGED_AT_KEY, { ...changedAt, ...Object.fromEntries(changed.map((k) => [k, today])) });
      await this.audit.record(db, {
        orgId,
        actorUserId,
        action: "updated",
        entityType: "modules",
        entityId: orgId,
        contactId: null,
        changes: changed.map((k) => ({ field: MODULES[k].label, from: current[k] ? "On" : "Off", to: next[k] ? "On" : "Off" })),
      });
    }
    forgetModules(orgId);
    return { ...next, ...(notice ? { notice } : {}) };
  }

  /** US-SET-25 — active schedules move to their next run on or after today; anything missed is skipped, and one past its end finishes. */
  private async resumeSchedules(db: Database | Transaction, orgId: string, today: string) {
    for (const table of [recurringInvoices, recurringBills] as const) {
      const rows = await db.select().from(table).where(and(eq(table.orgId, orgId), eq(table.status, "active"), lt(table.nextRunOn, today)));
      for (const row of rows) {
        const nextRunOn = occurrenceOnOrAfter(row as unknown as RecurringSchedule, today);
        const finished = scheduleFinished(nextRunOn, { endsOn: row.endsOn, maxCount: row.maxCount }, row.createdCount);
        await db
          .update(table)
          .set(finished ? { status: "finished", nextRunOn: null } : { nextRunOn })
          .where(eq(table.id, row.id));
      }
    }
  }
}
