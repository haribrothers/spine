import { Inject, Injectable } from "@nestjs/common";
import { AUDIT_PAGE_SIZE, type AuditLogEntry, type AuditLogPage } from "@spine/shared";
import { and, count, desc, eq, gte, inArray, lt, or, type SQL } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import {
  activities,
  addresses,
  auditLog,
  catalogBundles,
  catalogItems,
  contactPersons,
  contacts,
  creditNotes,
  expenseCategories,
  expenses,
  invoices,
  jobNotes,
  jobPhotos,
  jobs,
  leadStages,
  leads,
  meetings,
  milestones,
  payments,
  quotes,
  recurringInvoices,
  recurringBills,
  taxGroups,
  taxRates,
  teams,
  user,
  vendorBills,
  vendorPayments,
} from "../../db/schema";

export interface AuditLogFilters {
  /** `YYYY-MM-DD`, organisation time, inclusive. */
  from?: string;
  to?: string;
  userId?: string;
  entityType?: string;
  /** US-TEAM-29 — one record's entries. */
  entityId?: string;
  action?: string;
}

interface RawRow {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
}

type Resolved = Map<string, { label: string | null; link: string | null }>;
type Resolver = (db: Database, orgId: string, ids: string[]) => Promise<Resolved>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Local midnight of a `YYYY-MM-DD` date (the process runs in organisation time, `TZ`). */
function localMidnight(date: string, plusDays = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d! + plusDays);
}

function byId<T extends { id: string }>(rows: T[], label: (r: T) => string | null, link: (r: T) => string | null): Resolved {
  return new Map(rows.map((r) => [r.id, { label: label(r), link: link(r) }]));
}

/**
 * How each record type is named and where it opens. Records with no page
 * of their own open their parent (a milestone its job, a credit note its
 * invoice) or their list.
 */
const RESOLVERS: Record<string, Resolver> = {
  contact: async (db, orgId, ids) =>
    byId(await db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(and(eq(contacts.orgId, orgId), inArray(contacts.id, ids))), (r) => r.name, (r) => `/contacts/${r.id}`),
  contact_person: async (db, orgId, ids) =>
    byId(await db.select({ id: contactPersons.id, name: contactPersons.name, contactId: contactPersons.contactId }).from(contactPersons).where(inArray(contactPersons.id, ids)), (r) => r.name, (r) => `/contacts/${r.contactId}`),
  address: async (db, orgId, ids) =>
    byId(await db.select({ id: addresses.id, line1: addresses.line1, contactId: addresses.contactId }).from(addresses).where(inArray(addresses.id, ids)), (r) => r.line1, (r) => `/contacts/${r.contactId}`),
  lead: async (db, orgId, ids) =>
    byId(
      await db.select({ id: leads.id, title: leads.title, contact: contacts.name }).from(leads).leftJoin(contacts, eq(leads.contactId, contacts.id)).where(and(eq(leads.orgId, orgId), inArray(leads.id, ids))),
      (r) => r.title || r.contact,
      () => "/leads",
    ),
  lead_stage: async (db, orgId, ids) =>
    byId(await db.select({ id: leadStages.id, name: leadStages.name }).from(leadStages).where(and(eq(leadStages.orgId, orgId), inArray(leadStages.id, ids))), (r) => r.name, () => "/leads"),
  activity: async (db, orgId, ids) =>
    byId(
      await db.select({ id: activities.id, notes: activities.notes, type: activities.type, contactId: activities.contactId }).from(activities).where(and(eq(activities.orgId, orgId), inArray(activities.id, ids))),
      (r) => r.notes?.trim() || r.type,
      (r) => (r.contactId ? `/contacts/${r.contactId}` : "/leads"),
    ),
  meeting: async (db, orgId, ids) =>
    byId(await db.select({ id: meetings.id, title: meetings.title }).from(meetings).where(and(eq(meetings.orgId, orgId), inArray(meetings.id, ids))), (r) => r.title, (r) => `/meetings?id=${r.id}`),
  catalog_item: async (db, orgId, ids) =>
    byId(await db.select({ id: catalogItems.id, name: catalogItems.name }).from(catalogItems).where(and(eq(catalogItems.orgId, orgId), inArray(catalogItems.id, ids))), (r) => r.name, () => "/catalog"),
  catalog_bundle: async (db, orgId, ids) =>
    byId(await db.select({ id: catalogBundles.id, name: catalogBundles.name }).from(catalogBundles).where(and(eq(catalogBundles.orgId, orgId), inArray(catalogBundles.id, ids))), (r) => r.name, () => "/catalog"),
  quote: async (db, orgId, ids) =>
    byId(await db.select({ id: quotes.id, number: quotes.number }).from(quotes).where(and(eq(quotes.orgId, orgId), inArray(quotes.id, ids))), (r) => r.number ?? "Draft quote", (r) => `/quotes/${r.id}`),
  invoice: async (db, orgId, ids) =>
    byId(await db.select({ id: invoices.id, number: invoices.number }).from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.id, ids))), (r) => r.number ?? "Draft invoice", (r) => `/invoices/${r.id}`),
  credit_note: async (db, orgId, ids) =>
    byId(
      await db.select({ id: creditNotes.id, number: creditNotes.number, invoiceId: creditNotes.invoiceId }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), inArray(creditNotes.id, ids))),
      (r) => r.number ?? "Draft credit note",
      (r) => (r.invoiceId ? `/invoices/${r.invoiceId}` : "/credit-notes"),
    ),
  payment: async (db, orgId, ids) =>
    byId(await db.select({ id: payments.id, number: payments.number }).from(payments).where(and(eq(payments.orgId, orgId), inArray(payments.id, ids))), (r) => r.number, (r) => `/payments?id=${r.id}`),
  job: async (db, orgId, ids) =>
    byId(await db.select({ id: jobs.id, name: jobs.name }).from(jobs).where(and(eq(jobs.orgId, orgId), inArray(jobs.id, ids))), (r) => r.name, (r) => `/jobs/${r.id}`),
  milestone: async (db, orgId, ids) =>
    byId(await db.select({ id: milestones.id, name: milestones.name, jobId: milestones.jobId }).from(milestones).where(and(eq(milestones.orgId, orgId), inArray(milestones.id, ids))), (r) => r.name, (r) => `/jobs/${r.jobId}`),
  job_note: async (db, orgId, ids) =>
    byId(await db.select({ id: jobNotes.id, jobId: jobNotes.jobId, job: jobs.name }).from(jobNotes).innerJoin(jobs, eq(jobNotes.jobId, jobs.id)).where(inArray(jobNotes.id, ids)), (r) => r.job, (r) => `/jobs/${r.jobId}`),
  job_photo: async (db, orgId, ids) =>
    byId(await db.select({ id: jobPhotos.id, jobId: jobPhotos.jobId, job: jobs.name }).from(jobPhotos).innerJoin(jobs, eq(jobPhotos.jobId, jobs.id)).where(inArray(jobPhotos.id, ids)), (r) => r.job, (r) => `/jobs/${r.jobId}`),
  tax_rate: async (db, orgId, ids) =>
    byId(await db.select({ id: taxRates.id, name: taxRates.name }).from(taxRates).where(and(eq(taxRates.orgId, orgId), inArray(taxRates.id, ids))), (r) => r.name, () => null),
  tax_group: async (db, orgId, ids) =>
    byId(await db.select({ id: taxGroups.id, name: taxGroups.name }).from(taxGroups).where(and(eq(taxGroups.orgId, orgId), inArray(taxGroups.id, ids))), (r) => r.name, () => null),
  vendor_bill: async (db, orgId, ids) =>
    byId(await db.select({ id: vendorBills.id, number: vendorBills.billNumber }).from(vendorBills).where(and(eq(vendorBills.orgId, orgId), inArray(vendorBills.id, ids))), (r) => r.number, (r) => `/vendor-bills/${r.id}`),
  expense_category: async (db, orgId, ids) =>
    byId(await db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).where(and(eq(expenseCategories.orgId, orgId), inArray(expenseCategories.id, ids))), (r) => r.name, () => "/expenses/categories"),
  expense: async (db, orgId, ids) =>
    byId(await db.select({ id: expenses.id, number: expenses.number }).from(expenses).where(and(eq(expenses.orgId, orgId), inArray(expenses.id, ids))), (r) => r.number, (r) => `/expenses?id=${r.id}`),
  vendor_payment: async (db, orgId, ids) =>
    byId(await db.select({ id: vendorPayments.id, number: vendorPayments.number }).from(vendorPayments).where(and(eq(vendorPayments.orgId, orgId), inArray(vendorPayments.id, ids))), (r) => r.number, () => "/vendor-payments"),
  recurring_invoice: async (db, orgId, ids) =>
    byId(await db.select({ id: recurringInvoices.id, name: recurringInvoices.name }).from(recurringInvoices).where(and(eq(recurringInvoices.orgId, orgId), inArray(recurringInvoices.id, ids))), (r) => r.name, () => "/invoices/recurring"),
  recurring_bill: async (db, orgId, ids) =>
    byId(await db.select({ id: recurringBills.id, name: recurringBills.name }).from(recurringBills).where(and(eq(recurringBills.orgId, orgId), inArray(recurringBills.id, ids))), (r) => r.name, () => "/vendor-bills/recurring"),
  team: async (db, orgId, ids) =>
    byId(await db.select({ id: teams.id, name: teams.name }).from(teams).where(and(eq(teams.orgId, orgId), inArray(teams.id, ids.filter((id) => UUID.test(id))))), (r) => r.name, (r) => `/team/teams/${r.id}`),
  user: async (db, orgId, ids) => byId(await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids)), (r) => r.name, () => "/team/users"),
  data_export: async () => new Map(),
};

/**
 * US-SET-11/12 (D-064) — the organisation-wide audit log, Owner-only:
 * filter by date, person, record type and action, 50 a page, newest first,
 * and stream the filtered rows as CSV.
 */
@Injectable()
export class OrgAuditLogService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private where(orgId: string, f: AuditLogFilters): SQL {
    return and(
      eq(auditLog.orgId, orgId),
      f.from ? gte(auditLog.createdAt, localMidnight(f.from)) : undefined,
      f.to ? lt(auditLog.createdAt, localMidnight(f.to, 1)) : undefined,
      f.userId ? eq(auditLog.actorUserId, f.userId) : undefined,
      f.entityType ? eq(auditLog.entityType, f.entityType) : undefined,
      f.entityId ? eq(auditLog.entityId, f.entityId) : undefined,
      f.action ? eq(auditLog.action, f.action) : undefined,
    )!;
  }

  private select() {
    return this.db
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        changes: auditLog.changes,
        actorUserId: auditLog.actorUserId,
        actorName: user.name,
        actorEmail: user.email,
      })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.actorUserId, user.id));
  }

  async page(orgId: string, filters: AuditLogFilters, offset: number): Promise<AuditLogPage> {
    const where = this.where(orgId, filters);
    const [rows, [{ total } = { total: 0 }], facets] = await Promise.all([
      this.select().where(where).orderBy(desc(auditLog.createdAt), desc(auditLog.id)).limit(AUDIT_PAGE_SIZE).offset(offset),
      this.db.select({ total: count() }).from(auditLog).where(where),
      this.facets(orgId),
    ]);
    return { entries: await this.withRecords(orgId, rows), total, offset, limit: AUDIT_PAGE_SIZE, facets };
  }

  /** Every filtered entry, oldest batch last, in keyset batches so a large log streams without holding it all. */
  async *stream(orgId: string, filters: AuditLogFilters, batchSize = 1000): AsyncGenerator<AuditLogEntry[]> {
    const where = this.where(orgId, filters);
    let after: { createdAt: Date; id: string } | null = null;
    for (;;) {
      const keyset: SQL | undefined = after
        ? or(lt(auditLog.createdAt, after.createdAt), and(eq(auditLog.createdAt, after.createdAt), lt(auditLog.id, after.id)))
        : undefined;
      const rows: RawRow[] = await this.select().where(and(where, keyset)).orderBy(desc(auditLog.createdAt), desc(auditLog.id)).limit(batchSize);
      if (rows.length === 0) return;
      yield await this.withRecords(orgId, rows);
      const last: RawRow = rows[rows.length - 1]!;
      after = { createdAt: last.createdAt, id: last.id };
      if (rows.length < batchSize) return;
    }
  }

  private async facets(orgId: string): Promise<AuditLogPage["facets"]> {
    const [people, types, actions] = await Promise.all([
      this.db
        .selectDistinct({ userId: user.id, name: user.name })
        .from(auditLog)
        .innerJoin(user, eq(auditLog.actorUserId, user.id))
        .where(eq(auditLog.orgId, orgId))
        .orderBy(user.name),
      this.db.selectDistinct({ v: auditLog.entityType }).from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(auditLog.entityType),
      this.db.selectDistinct({ v: auditLog.action }).from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(auditLog.action),
    ]);
    return { people, entityTypes: types.map((t) => t.v), actions: actions.map((a) => a.v) };
  }

  private async withRecords(orgId: string, rows: RawRow[]): Promise<AuditLogEntry[]> {
    const idsByType = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!idsByType.has(r.entityType)) idsByType.set(r.entityType, new Set());
      idsByType.get(r.entityType)!.add(r.entityId);
    }
    const resolved = new Map<string, Resolved>();
    await Promise.all(
      [...idsByType].map(async ([type, ids]) => {
        const resolver = RESOLVERS[type];
        if (!resolver) return;
        const valid = [...ids].filter((id) => type === "user" || UUID.test(id));
        if (valid.length) resolved.set(type, await resolver(this.db, orgId, valid));
      }),
    );
    return rows.map((r) => {
      const record = resolved.get(r.entityType)?.get(r.entityId);
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        actor: r.actorUserId && r.actorName ? { userId: r.actorUserId, name: r.actorName, email: r.actorEmail ?? "" } : null,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        recordLabel: record?.label ?? null,
        link: record?.link ?? null,
        changes: r.changes,
      };
    });
  }
}

