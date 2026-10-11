import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { occurrenceAfter, occurrenceOnOrAfter, scheduleFinished, START_IN_PAST, type CreateRecurringBillInput, type RecurringBill } from "@spine/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { contacts, moneyAccounts, recurringBillLines, recurringBills } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { AuditLogService } from "../audit/audit-log.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { computeBillTotals } from "./vendor-bills.service";

type ScheduleRow = typeof recurringBills.$inferSelect;
type LineRow = typeof recurringBillLines.$inferSelect;

function toRecurringBill(row: ScheduleRow, contactName: string, lines: LineRow[]): RecurringBill {
  return {
    id: row.id,
    name: row.name,
    contactId: row.contactId,
    contactName,
    currency: row.currency,
    frequency: row.frequency,
    dayRule: row.dayRule,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    maxCount: row.maxCount,
    createdCount: row.createdCount,
    dueDays: row.dueDays,
    moneyAccountId: row.moneyAccountId,
    mode: row.mode,
    status: row.status,
    nextRunOn: row.nextRunOn,
    totalAmount: row.totalAmount.toString(),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    lines: lines
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({
        id: l.id,
        sortOrder: l.sortOrder,
        type: l.type,
        catalogItemId: l.catalogItemId,
        name: l.name,
        description: l.description,
        quantity: l.quantity,
        unitPriceAmount: l.unitPriceAmount.toString(),
        accountId: l.accountId,
        taxRatePercentage: l.taxRatePercentage,
        taxRateId: l.taxRateId,
        taxGroupId: l.taxGroupId,
        isTaxInclusive: l.isTaxInclusive,
        supplyClass: l.supplyClass,
        hsnSac: l.hsnSac,
      })),
  };
}

/**
 * US-PUR-29–31 (D-159) — recurring bills: a schedule plus template lines,
 * the bill-side twin of `RecurringInvoicesService`. Every route needs
 * `vendor_bills.manage_recurring` (checked by the controller). Saving only
 * works out the next run date; the run (US-PUR-30) makes the bills.
 * Editing changes future bills only.
 */
@Injectable()
export class RecurringBillsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly taxResolver: TaxResolverService,
  ) {}

  async list(orgId: string): Promise<RecurringBill[]> {
    const rows = await this.db
      .select({ schedule: recurringBills, contactName: contacts.name })
      .from(recurringBills)
      .innerJoin(contacts, eq(recurringBills.contactId, contacts.id))
      .where(eq(recurringBills.orgId, orgId))
      .orderBy(asc(recurringBills.name));
    if (!rows.length) return [];
    const lines = await this.db.select().from(recurringBillLines).where(inArray(recurringBillLines.recurringBillId, rows.map((r) => r.schedule.id)));
    return rows.map((r) => toRecurringBill(r.schedule, r.contactName, lines.filter((l) => l.recurringBillId === r.schedule.id)));
  }

  async getOne(orgId: string, id: string): Promise<RecurringBill> {
    const [row] = await this.db
      .select({ schedule: recurringBills, contactName: contacts.name })
      .from(recurringBills)
      .innerJoin(contacts, eq(recurringBills.contactId, contacts.id))
      .where(and(eq(recurringBills.orgId, orgId), eq(recurringBills.id, id)));
    if (!row) throw new NotFoundException("Recurring bill not found");
    const lines = await this.db.select().from(recurringBillLines).where(eq(recurringBillLines.recurringBillId, id));
    return toRecurringBill(row.schedule, row.contactName, lines);
  }

  protected async find(orgId: string, id: string): Promise<ScheduleRow> {
    const [row] = await this.db.select().from(recurringBills).where(and(eq(recurringBills.orgId, orgId), eq(recurringBills.id, id)));
    if (!row) throw new NotFoundException("Recurring bill not found");
    return row;
  }

  private async checkReferences(orgId: string, input: CreateRecurringBillInput) {
    const [contact] = await this.db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) throw new BadRequestException("Vendor not found");
    if (input.moneyAccountId) {
      const [account] = await this.db.select({ id: moneyAccounts.id }).from(moneyAccounts).where(and(eq(moneyAccounts.orgId, orgId), eq(moneyAccounts.id, input.moneyAccountId)));
      if (!account) throw new BadRequestException("Choose one of your money accounts.");
    }
  }

  private async writeLines(tx: Transaction, scheduleId: string, input: CreateRecurringBillInput) {
    await tx.delete(recurringBillLines).where(eq(recurringBillLines.recurringBillId, scheduleId));
    await tx.insert(recurringBillLines).values(
      input.lines.map((l, i) => ({
        recurringBillId: scheduleId,
        sortOrder: i,
        type: l.type,
        catalogItemId: l.catalogItemId ?? null,
        name: l.name,
        description: l.description ?? null,
        quantity: l.type === "item" ? l.quantity : 0,
        unitPriceAmount: l.type === "item" ? l.unitPriceAmount : 0n,
        accountId: l.type === "item" ? (l.accountId ?? null) : null,
        taxRatePercentage: l.type === "item" ? l.taxRatePercentage : 0,
        taxRateId: l.type === "item" ? (l.taxRateId ?? null) : null,
        taxGroupId: l.type === "item" ? (l.taxGroupId ?? null) : null,
        isTaxInclusive: l.type === "item" ? l.isTaxInclusive : false,
        supplyClass: l.type === "item" ? (l.supplyClass ?? null) : null,
        hsnSac: l.type === "item" ? (l.hsnSac ?? null) : null,
      })),
    );
  }

  /** The first run date, or a 400 when the schedule ends before it. */
  private firstRun(input: CreateRecurringBillInput, from: string, createdCount: number): string {
    const next = occurrenceOnOrAfter(input, from);
    if (scheduleFinished(next, input, createdCount)) throw new BadRequestException("This schedule ends before its next bill. Pick a later end date.");
    return next;
  }

  private fields(input: CreateRecurringBillInput) {
    return {
      name: input.name.trim(),
      contactId: input.contactId,
      currency: input.currency,
      frequency: input.frequency,
      dayRule: input.dayRule,
      startsOn: input.startsOn,
      endsOn: input.endsOn ?? null,
      maxCount: input.maxCount ?? null,
      dueDays: input.dueDays,
      moneyAccountId: input.moneyAccountId ?? null,
      mode: input.mode,
    };
  }

  /** `isDemo` (US-ONB-30): the demo's schedule; one a person sets up for a demo vendor stays theirs (D-191). */
  async create(orgId: string, actorUserId: string, input: CreateRecurringBillInput, isDemo = false): Promise<RecurringBill> {
    const today = orgClock().date;
    if (input.startsOn < today) throw new BadRequestException(START_IN_PAST);
    await this.checkReferences(orgId, input);
    const nextRunOn = this.firstRun(input, today, 0);
    const totals = await computeBillTotals(orgId, input.currency, input.lines, this.taxResolver);
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(recurringBills)
        .values({ orgId, ...this.fields(input), status: "active", nextRunOn, totalAmount: totals.totalAmount, createdByUserId: actorUserId, isDemo })
        .returning();
      await this.writeLines(tx, row!.id, input);
      await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "recurring_bill", entityId: row!.id, contactId: input.contactId, changes: [{ field: "name", from: null, to: row!.name }] });
      return row!.id;
    });
    return this.getOne(orgId, id);
  }

  /**
   * US-PUR-31 — replaces the schedule and its lines; bills it already
   * created are untouched. An active schedule's next date is worked out
   * again from today; a paused or finished one stays until resumed.
   */
  async update(orgId: string, id: string, actorUserId: string, input: CreateRecurringBillInput): Promise<RecurringBill> {
    const existing = await this.find(orgId, id);
    const today = orgClock().date;
    if (input.startsOn !== existing.startsOn && input.startsOn < today) throw new BadRequestException(START_IN_PAST);
    await this.checkReferences(orgId, input);
    const nextRunOn = existing.status === "active" ? this.firstRun(input, today, existing.createdCount) : existing.nextRunOn;
    const totals = await computeBillTotals(orgId, input.currency, input.lines, this.taxResolver);
    const next = { ...this.fields(input), nextRunOn, totalAmount: totals.totalAmount };
    await this.db.transaction(async (tx) => {
      await tx.update(recurringBills).set({ ...next, updatedAt: new Date() }).where(eq(recurringBills.id, id));
      await this.writeLines(tx, id, input);
      const changes = AuditLogService.diffFields(
        { ...existing, totalAmount: existing.totalAmount.toString() } as Record<string, unknown>,
        { ...next, totalAmount: next.totalAmount.toString() } as Record<string, unknown>,
      );
      await this.auditLog.record(tx, { orgId, actorUserId, action: "updated", entityType: "recurring_bill", entityId: id, contactId: input.contactId, changes });
    });
    return this.getOne(orgId, id);
  }

  /** US-PUR-31 — removes the schedule; bills it already created are kept (their link to it is cleared). */
  async delete(orgId: string, id: string, actorUserId: string): Promise<{ id: string }> {
    const existing = await this.find(orgId, id);
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, { orgId, actorUserId, action: "deleted", entityType: "recurring_bill", entityId: id, contactId: existing.contactId, changes: [{ field: "name", from: existing.name, to: null }] });
      await tx.delete(recurringBills).where(eq(recurringBills.id, id));
    });
    return { id };
  }

  /** US-PUR-31 — a paused schedule creates nothing; its next date is empty until it's resumed. */
  async pause(orgId: string, id: string, actorUserId: string): Promise<RecurringBill> {
    const existing = await this.find(orgId, id);
    if (existing.status !== "active") throw new BadRequestException("Only an active schedule can be paused.");
    await this.db.transaction(async (tx) => {
      await tx.update(recurringBills).set({ status: "paused", nextRunOn: null, updatedAt: new Date() }).where(eq(recurringBills.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "paused", entityType: "recurring_bill", entityId: id, contactId: existing.contactId });
    });
    return this.getOne(orgId, id);
  }

  /**
   * US-PUR-31 — resumes from the next future occurrence; dates passed while
   * paused aren't created. A schedule whose end has passed meanwhile is
   * finished instead.
   */
  async resume(orgId: string, id: string, actorUserId: string): Promise<RecurringBill> {
    const existing = await this.find(orgId, id);
    if (existing.status !== "paused") throw new BadRequestException("Only a paused schedule can be resumed.");
    const next = occurrenceAfter(existing, orgClock().date);
    const finished = scheduleFinished(next, existing, existing.createdCount);
    await this.db.transaction(async (tx) => {
      await tx.update(recurringBills).set({ status: finished ? "finished" : "active", nextRunOn: finished ? null : next, updatedAt: new Date() }).where(eq(recurringBills.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "resumed", entityType: "recurring_bill", entityId: id, contactId: existing.contactId });
    });
    return this.getOne(orgId, id);
  }
}
