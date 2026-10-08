import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { occurrenceAfter, occurrenceOnOrAfter, scheduleFinished, START_IN_PAST, type CreateRecurringInvoiceInput, type RecurringInvoice } from "@spine/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { contacts, recurringInvoiceLines, recurringInvoices } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { AuditLogService } from "../audit/audit-log.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { computeInvoiceTotals } from "./invoices.service";

type ScheduleRow = typeof recurringInvoices.$inferSelect;
type LineRow = typeof recurringInvoiceLines.$inferSelect;

function toRecurringInvoice(row: ScheduleRow, contactName: string, lines: LineRow[]): RecurringInvoice {
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
        discountPercentage: l.discountPercentage,
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
 * US-INV-20–22 (D-092) — recurring invoices: a schedule plus template lines.
 * Every route needs `invoices.manage_recurring` (checked by the
 * controller). The run that creates the invoices is US-INV-21; saving a
 * schedule only works out its next run date. Editing changes future
 * invoices only — invoices already created are their own documents.
 */
@Injectable()
export class RecurringInvoicesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly taxResolver: TaxResolverService,
  ) {}

  async list(orgId: string): Promise<RecurringInvoice[]> {
    const rows = await this.db
      .select({ schedule: recurringInvoices, contactName: contacts.name })
      .from(recurringInvoices)
      .innerJoin(contacts, eq(recurringInvoices.contactId, contacts.id))
      .where(eq(recurringInvoices.orgId, orgId))
      .orderBy(asc(recurringInvoices.name));
    if (!rows.length) return [];
    const lines = await this.db.select().from(recurringInvoiceLines).where(inArray(recurringInvoiceLines.recurringInvoiceId, rows.map((r) => r.schedule.id)));
    return rows.map((r) => toRecurringInvoice(r.schedule, r.contactName, lines.filter((l) => l.recurringInvoiceId === r.schedule.id)));
  }

  async getOne(orgId: string, id: string): Promise<RecurringInvoice> {
    const [row] = await this.db
      .select({ schedule: recurringInvoices, contactName: contacts.name })
      .from(recurringInvoices)
      .innerJoin(contacts, eq(recurringInvoices.contactId, contacts.id))
      .where(and(eq(recurringInvoices.orgId, orgId), eq(recurringInvoices.id, id)));
    if (!row) throw new NotFoundException("Recurring invoice not found");
    const lines = await this.db.select().from(recurringInvoiceLines).where(eq(recurringInvoiceLines.recurringInvoiceId, id));
    return toRecurringInvoice(row.schedule, row.contactName, lines);
  }

  protected async find(orgId: string, id: string): Promise<ScheduleRow> {
    const [row] = await this.db.select().from(recurringInvoices).where(and(eq(recurringInvoices.orgId, orgId), eq(recurringInvoices.id, id)));
    if (!row) throw new NotFoundException("Recurring invoice not found");
    return row;
  }

  private async checkContact(orgId: string, contactId: string) {
    const [contact] = await this.db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
    if (!contact) throw new BadRequestException("Contact not found");
  }

  /** Prices and tax worked out the way an invoice would, for the list's amount. */
  private async computed(orgId: string, input: CreateRecurringInvoiceInput) {
    return computeInvoiceTotals(orgId, input.currency, input.lines, this.taxResolver);
  }

  private async writeLines(tx: Transaction, scheduleId: string, input: CreateRecurringInvoiceInput) {
    await tx.delete(recurringInvoiceLines).where(eq(recurringInvoiceLines.recurringInvoiceId, scheduleId));
    await tx.insert(recurringInvoiceLines).values(
      input.lines.map((l, i) => ({
        recurringInvoiceId: scheduleId,
        sortOrder: i,
        type: l.type,
        catalogItemId: l.catalogItemId ?? null,
        name: l.name,
        description: l.description ?? null,
        quantity: l.type === "item" ? l.quantity : 0,
        unitPriceAmount: l.type === "item" ? l.unitPriceAmount : 0n,
        discountPercentage: l.type === "item" ? l.discountPercentage : 0,
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
  private firstRun(input: CreateRecurringInvoiceInput, from: string, createdCount: number): string {
    const next = occurrenceOnOrAfter(input, from);
    if (scheduleFinished(next, input, createdCount)) throw new BadRequestException("This schedule ends before its next invoice. Pick a later end date.");
    return next;
  }

  async create(orgId: string, actorUserId: string, input: CreateRecurringInvoiceInput): Promise<RecurringInvoice> {
    const today = orgClock().date;
    if (input.startsOn < today) throw new BadRequestException(START_IN_PAST);
    await this.checkContact(orgId, input.contactId);
    const nextRunOn = this.firstRun(input, today, 0);
    const totals = await this.computed(orgId, input);

    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(recurringInvoices)
        .values({
          orgId,
          name: input.name.trim(),
          contactId: input.contactId,
          currency: input.currency,
          frequency: input.frequency,
          dayRule: input.dayRule,
          startsOn: input.startsOn,
          endsOn: input.endsOn ?? null,
          maxCount: input.maxCount ?? null,
          dueDays: input.dueDays,
          mode: input.mode,
          status: "active",
          nextRunOn,
          totalAmount: totals.totalAmount,
          createdByUserId: actorUserId,
        })
        .returning();
      await this.writeLines(tx, row!.id, input);
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "recurring_invoice",
        entityId: row!.id,
        contactId: input.contactId,
        changes: [{ field: "name", from: null, to: row!.name }],
      });
      return row!.id;
    });
    return this.getOne(orgId, id);
  }

  /**
   * Replaces the schedule and its lines. Invoices it already created are
   * untouched. An active schedule's next date is worked out again from
   * today (a start date already passed is kept as it was); a paused or
   * finished one stays as it is until resumed.
   */
  async update(orgId: string, id: string, actorUserId: string, input: CreateRecurringInvoiceInput): Promise<RecurringInvoice> {
    const existing = await this.find(orgId, id);
    const today = orgClock().date;
    if (input.startsOn !== existing.startsOn && input.startsOn < today) throw new BadRequestException(START_IN_PAST);
    await this.checkContact(orgId, input.contactId);
    const nextRunOn = existing.status === "active" ? this.firstRun(input, today, existing.createdCount) : existing.nextRunOn;
    const totals = await this.computed(orgId, input);
    const next = {
      name: input.name.trim(),
      contactId: input.contactId,
      currency: input.currency,
      frequency: input.frequency,
      dayRule: input.dayRule,
      startsOn: input.startsOn,
      endsOn: input.endsOn ?? null,
      maxCount: input.maxCount ?? null,
      dueDays: input.dueDays,
      mode: input.mode,
      nextRunOn,
      totalAmount: totals.totalAmount,
    };
    await this.db.transaction(async (tx) => {
      await tx.update(recurringInvoices).set({ ...next, updatedAt: new Date() }).where(eq(recurringInvoices.id, id));
      await this.writeLines(tx, id, input);
      const changes = AuditLogService.diffFields(
        { ...existing, totalAmount: existing.totalAmount.toString() } as Record<string, unknown>,
        { ...next, totalAmount: next.totalAmount.toString() } as Record<string, unknown>,
      );
      await this.auditLog.record(tx, { orgId, actorUserId, action: "updated", entityType: "recurring_invoice", entityId: id, contactId: input.contactId, changes });
    });
    return this.getOne(orgId, id);
  }

  /** US-INV-22 — a paused schedule creates nothing; its next date is empty until it's resumed. */
  async pause(orgId: string, id: string, actorUserId: string): Promise<RecurringInvoice> {
    const existing = await this.find(orgId, id);
    if (existing.status !== "active") throw new BadRequestException("Only an active schedule can be paused.");
    await this.db.transaction(async (tx) => {
      await tx.update(recurringInvoices).set({ status: "paused", nextRunOn: null, updatedAt: new Date() }).where(eq(recurringInvoices.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "paused", entityType: "recurring_invoice", entityId: id, contactId: existing.contactId });
    });
    return this.getOne(orgId, id);
  }

  /**
   * US-INV-22 — resumes from the next occurrence after today; dates missed
   * while paused aren't back-filled. A schedule whose end has passed in the
   * meantime is finished instead.
   */
  async resume(orgId: string, id: string, actorUserId: string): Promise<RecurringInvoice> {
    const existing = await this.find(orgId, id);
    if (existing.status !== "paused") throw new BadRequestException("Only a paused schedule can be resumed.");
    const next = occurrenceAfter(existing, orgClock().date);
    const finished = scheduleFinished(next, existing, existing.createdCount);
    await this.db.transaction(async (tx) => {
      await tx
        .update(recurringInvoices)
        .set({ status: finished ? "finished" : "active", nextRunOn: finished ? null : next, updatedAt: new Date() })
        .where(eq(recurringInvoices.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "resumed", entityType: "recurring_invoice", entityId: id, contactId: existing.contactId });
    });
    return this.getOne(orgId, id);
  }

  /** US-INV-22 — removes the schedule; invoices it already created are kept (their link to it is cleared). */
  async delete(orgId: string, id: string, actorUserId: string): Promise<{ id: string }> {
    const existing = await this.find(orgId, id);
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "recurring_invoice",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "name", from: existing.name, to: null }],
      });
      await tx.delete(recurringInvoices).where(eq(recurringInvoices.id, id));
    });
    return { id };
  }
}
