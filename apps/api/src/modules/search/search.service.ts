import { moduleOn } from "../../common/modules";
import { Inject, Injectable } from "@nestjs/common";
import {
  RECENT_ITEMS_KEPT,
  RECENT_ITEMS_SHOWN,
  RECENT_SEARCHES_KEPT,
  RECENT_SEARCHES_SHOWN,
  SEARCH_GROUPS,
  SEARCH_GROUP_LABELS,
  SEARCH_LIMIT,
  SEARCH_MIN_LENGTH,
  SEARCH_SCOPED_LIMIT,
  formatMoney,
  isNumberMatch,
  parseDocumentNumber,
  parseSearchAmount,
  type RecordRecentInput,
  type SearchGroup,
  type SearchGroupType,
  type SearchRecentResponse,
  type SearchResponse,
  type SearchResult,
} from "@spine/shared";
import { and, desc, eq, exists, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getEffectiveCapabilities, getMemberRole } from "../../auth/capability.util";
import { orgClock, orgTimeZone } from "../../common/org-clock";
import { orgMoneySettings } from "../../common/money-format";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import {
  catalogItems,
  contactPersons,
  contacts,
  creditNotes,
  expenseCategories,
  expenses,
  invoices,
  jobAssignments,
  jobs,
  leadStages,
  leads,
  meetingAttendees,
  meetings,
  payments,
  quotes,
  user,
  vendorBills,
  vendorCredits,
  vendorPayments,
} from "../../db/schema";

const QUOTE_STATUS: Record<string, string> = { draft: "Draft", sent: "Sent", accepted: "Accepted", rejected: "Declined" };
const JOB_STATUS: Record<string, string> = { active: "Active", on_hold: "On hold", completed: "Completed", cancelled: "Cancelled" };
const EXPENSE_STATUS: Record<string, string> = { submitted: "Submitted", approved: "Approved", rejected: "Rejected" };
const VENDOR_CREDIT_STATUS: Record<string, string> = { draft: "Draft", open: "Open", used: "Used", void: "Void" };

type Row = Omit<SearchResult, "type"> & { exact: boolean };
type Recurrence = { frequency: "daily" | "weekly" | "monthly"; interval?: number; end: { type: "date"; date: string } | { type: "count"; count: number } };

function isoDate(value: Date | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

/** "10 Oct" from a date column. */
function shortDay(value: Date | string): string {
  return new Date(`${isoDate(value)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** `%q%` with LIKE's own wildcards taken literally. */
function contains(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Digits only, for matching phone numbers however they're written. */
function digitsOf(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * US-OPS-43 — a meeting's next start on or after `now`, or its last once
 * the series is over (`past`). Mirrors the reminder worker's walk.
 */
function meetingWhen(startAt: Date, recurrence: Recurrence | null, now: Date): { at: Date; past: boolean } {
  if (!recurrence) return { at: startAt, past: startAt < now };
  const step = recurrence.interval && recurrence.interval > 0 ? recurrence.interval : 1;
  const endDate = recurrence.end.type === "date" ? new Date(`${recurrence.end.date}T23:59:59Z`) : null;
  const count = recurrence.end.type === "count" ? recurrence.end.count : Infinity;
  let at = startAt;
  let last = startAt;
  for (let n = 0; n < count && n < 2000; n++) {
    if (endDate && at > endDate) break;
    if (at >= now) return { at, past: false };
    last = at;
    const next = new Date(at);
    if (recurrence.frequency === "daily") next.setUTCDate(next.getUTCDate() + step);
    else if (recurrence.frequency === "weekly") next.setUTCDate(next.getUTCDate() + step * 7);
    else next.setUTCMonth(next.getUTCMonth() + step);
    at = next;
  }
  return { at: last, past: true };
}

/** "Tue 20 Oct, 9:00 AM" in the organisation's time zone. */
function meetingTime(at: Date, allDay: boolean, timeZone: string): string {
  const day = at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
  if (allDay) return day;
  return `${day}, ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}`;
}

interface Ctx {
  orgId: string;
  userId: string;
  q: string;
  n: number;
  money: (amount: bigint, currency: string) => string;
  today: string;
  timeZone: string;
  /** US-OPS-45 — the query as an amount in minor units (never for Field). */
  amount: bigint | null;
  /** US-OPS-46 — archived contacts and catalogue items too. */
  archived: boolean;
  /** US-OPS-39 — read these records (recent items) instead of matching the query. */
  ids?: string[];
}

interface Access {
  field: boolean;
  /** Each group the caller may search, by its module's read rules. */
  allowed: Record<SearchGroupType, boolean>;
  /** Field, and Staff without "See everyone's expenses", find only their own. */
  ownExpensesOnly: boolean;
}

/**
 * US-OPS-22 (D-095), US-OPS-39 to US-OPS-49 (D-238) — one search across
 * every section, using trigram indexes. Each group applies its module's own
 * read rules: Owners and Staff read the sections their Teams open (D-235);
 * Field read only jobs they're assigned to, the meetings the calendar shows
 * them and their own expenses. A document number puts that document first;
 * an amount puts the documents for it first in their groups.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private async access(orgId: string, userId: string): Promise<Access | null> {
    const role = await getMemberRole(this.db, orgId, userId);
    if (!role) return null;
    const field = role === "field";
    // US-TEAM-31 (D-235): a section closed for every one of a Staff member's Teams isn't searched.
    const can = await getEffectiveCapabilities(this.db, { orgId, userId });
    const open = (capability: keyof typeof can) => !field && can[capability];
    // US-SET-24: nothing from a switched-off module.
    const leadsOn = await moduleOn(this.db, orgId, "leadsMeetings");
    const jobsOn = await moduleOn(this.db, orgId, "jobsField");
    return {
      field,
      ownExpensesOnly: field || !can["expenses.view_others"],
      allowed: {
        contacts: open("contacts.open"),
        leads: leadsOn && open("leads.open"),
        // Field's Meetings is fixed open (FIELD_ALWAYS_CAPABILITIES); the calendar's visibility applies below.
        meetings: leadsOn && can["meetings.open"],
        catalog_items: open("catalog.open"),
        quotes: open("quotes.open"),
        jobs: jobsOn && (field || can["jobs.open"]),
        invoices: open("invoices.open"),
        // US-INV-38, US-PAY-25, US-PUR-55: Owner and Staff only.
        credit_notes: open("credit_notes.open"),
        payments: open("payments.open"),
        vendor_bills: open("vendor_bills.open"),
        vendor_credits: open("vendor_credits.open"),
        vendor_payments: open("vendor_payments.open"),
        expenses: true,
      },
    };
  }

  private async context(orgId: string, userId: string, access: Access, q: string, n: number, archived: boolean): Promise<Ctx> {
    const { currency, locale } = await orgMoneySettings(this.db, orgId);
    return {
      orgId,
      userId,
      q,
      n,
      money: (amount, cur) => formatMoney(amount, cur, locale),
      today: orgClock().date,
      timeZone: orgTimeZone(),
      amount: access.field ? null : parseSearchAmount(q, locale, currency),
      archived,
    };
  }

  private run(type: SearchGroupType, c: Ctx, a: Access): Promise<Row[]> {
    switch (type) {
      case "contacts":
        return this.contacts(c);
      case "leads":
        return this.leads(c);
      case "meetings":
        return this.meetings(c, a.field);
      case "catalog_items":
        return this.catalogItems(c);
      case "quotes":
        return this.quotes(c);
      case "jobs":
        return this.jobs(c, a.field);
      case "invoices":
        return this.invoices(c);
      case "credit_notes":
        return this.creditNotes(c);
      case "payments":
        return this.payments(c);
      case "vendor_bills":
        return this.vendorBills(c);
      case "vendor_credits":
        return this.vendorCredits(c);
      case "vendor_payments":
        return this.vendorPayments(c);
      case "expenses":
        return this.expenses(c, a.ownExpensesOnly);
    }
  }

  async search(
    orgId: string,
    userId: string,
    rawQuery: string,
    options: { limit?: number; types?: SearchGroupType[]; includeArchived?: boolean } = {},
  ): Promise<SearchResponse> {
    const q = rawQuery.trim().slice(0, 100);
    if (q.length < SEARCH_MIN_LENGTH) return { query: q, groups: [] };
    const access = await this.access(orgId, userId);
    if (!access) return { query: q, groups: [] };
    const types = options.types?.length ? options.types : null;
    // US-OPS-49: up to 20 a group when narrowed to an area, 5 otherwise.
    const n = Math.min(Math.max(options.limit ?? SEARCH_LIMIT, 1), types ? SEARCH_SCOPED_LIMIT : SEARCH_LIMIT);
    const c = await this.context(orgId, userId, access, q, n, Boolean(options.includeArchived));

    const groups: (SearchGroup & { exact: boolean })[] = [];
    for (const type of SEARCH_GROUPS) {
      if (!access.allowed[type] || (types && !types.includes(type))) continue;
      const rows = await this.run(type, c, access);
      if (!rows.length) continue;
      groups.push({ type, label: SEARCH_GROUP_LABELS[type], exact: rows.some((r) => r.exact), items: rows.map(({ exact: _exact, ...item }) => ({ ...item, type })) });
    }
    // The group holding the document the number names comes first (stable for the rest).
    groups.sort((a, b) => Number(b.exact) - Number(a.exact));
    return { query: q, groups: groups.map(({ exact: _exact, ...g }) => g) };
  }

  // ---------- US-OPS-39: recent records and searches ----------

  async recent(orgId: string, userId: string): Promise<SearchRecentResponse> {
    const [row] = await this.db.select({ items: user.recentItems, searches: user.recentSearches }).from(user).where(eq(user.id, userId));
    const stored = (row?.items ?? []).filter((i) => (SEARCH_GROUPS as readonly string[]).includes(i.type)) as { type: SearchGroupType; id: string }[];
    const searches = (row?.searches ?? []).slice(0, RECENT_SEARCHES_SHOWN);
    const access = await this.access(orgId, userId);
    if (!access || !stored.length) return { items: [], searches: access ? searches : [] };

    const c = await this.context(orgId, userId, access, "", RECENT_ITEMS_KEPT, true);
    const found = new Map<string, SearchResult>();
    for (const type of SEARCH_GROUPS) {
      const ids = stored.filter((i) => i.type === type).map((i) => i.id);
      // A record in a section the caller can no longer open drops out.
      if (!ids.length || !access.allowed[type]) continue;
      for (const { exact: _exact, ...item } of await this.run(type, { ...c, ids, n: ids.length }, access)) found.set(`${type}:${item.id}`, { ...item, type });
    }
    const items = stored.map((i) => found.get(`${i.type}:${i.id}`)).filter((i): i is SearchResult => Boolean(i));
    return { items: items.slice(0, RECENT_ITEMS_SHOWN), searches };
  }

  async recordRecent(userId: string, input: RecordRecentInput): Promise<void> {
    const [row] = await this.db.select({ items: user.recentItems, searches: user.recentSearches }).from(user).where(eq(user.id, userId));
    if ("query" in input) {
      const query = input.query.trim();
      if (query.length < SEARCH_MIN_LENGTH) return;
      const searches = [query, ...(row?.searches ?? []).filter((s) => s.toLowerCase() !== query.toLowerCase())].slice(0, RECENT_SEARCHES_KEPT);
      await this.db.update(user).set({ recentSearches: searches }).where(eq(user.id, userId));
      return;
    }
    const items = [{ type: input.type, id: input.id, openedAt: new Date().toISOString() }, ...(row?.items ?? []).filter((i) => !(i.type === input.type && i.id === input.id))].slice(0, RECENT_ITEMS_KEPT);
    await this.db.update(user).set({ recentItems: items }).where(eq(user.id, userId));
  }

  async clearRecent(userId: string): Promise<void> {
    await this.db.update(user).set({ recentItems: null, recentSearches: null }).where(eq(user.id, userId));
  }

  // ---------- matching ----------

  /** The records named by id (recent items), or the text match plus — for an amount — the amount columns. */
  private match(c: Ctx, idCol: PgColumn, text: SQL | undefined, amountCols: (PgColumn | SQL)[] = []): SQL | undefined {
    if (c.ids) return inArray(idCol, c.ids);
    return or(text, this.amountMatch(c, amountCols));
  }

  private amountMatch(c: Ctx, amountCols: (PgColumn | SQL)[]): SQL | undefined {
    if (c.amount === null || !amountCols.length) return undefined;
    return or(...amountCols.map((col) => sql`${col} = ${c.amount!.toString()}::bigint`));
  }

  /** US-OPS-45 — documents for the amount come first in their group. */
  private amountFirst(c: Ctx, amountCols: (PgColumn | SQL)[]): SQL[] {
    const m = c.ids ? undefined : this.amountMatch(c, amountCols);
    return m ? [desc(sql`coalesce((${m}), false)`)] : [];
  }

  /** Matches on the text, plus a typed number like "QUO-4" against "QUO-0004". */
  private numberOrText(numberCol: PgColumn, q: string, ...textCols: (PgColumn | SQL)[]): SQL {
    const parsed = parseDocumentNumber(q);
    return or(
      ilike(numberCol, contains(q)),
      ...textCols.map((col) => sql`${col} ilike ${contains(q)}`),
      parsed ? sql`${numberCol} ~* ${`^${parsed.prefix}[^0-9]*0*${parsed.value}$`}` : undefined,
    )!;
  }

  private rank(numberCol: PgColumn | null, nameCol: PgColumn, q: string): SQL[] {
    const parsed = parseDocumentNumber(q);
    const similarity = desc(sql`greatest(similarity(coalesce(${nameCol}, ''), ${q}), ${numberCol ? sql`similarity(coalesce(${numberCol}, ''), ${q})` : sql`0`})`);
    if (!numberCol) return [similarity];
    const exact = parsed
      ? sql`(coalesce(${numberCol} ~* ${`^${parsed.prefix}[^0-9]*0*${parsed.value}$`}, false) or lower(coalesce(${numberCol}, '')) = lower(${q}))`
      : sql`lower(coalesce(${numberCol}, '')) = lower(${q})`;
    return [desc(exact), similarity];
  }

  /** "$2,389.50" when the amount is what matched, so the client bolds it. */
  private amountHit(c: Ctx, currency: string, ...values: bigint[]): string | null {
    return c.amount !== null && !c.ids && values.includes(c.amount) ? c.money(c.amount, currency) : null;
  }

  // ---------- groups ----------

  /** US-OPS-44 — by name or email, phone digits (theirs or a person's), tax ID without spaces, or one of their people. */
  private async contacts(c: Ctx): Promise<Row[]> {
    const digits = digitsOf(c.q);
    const byPhone = digits.length >= 4;
    const taxQ = c.q.replace(/\s/g, "");
    const phoneDigits = (col: PgColumn) => sql`regexp_replace(coalesce(${col}, ''), '\\D', '', 'g') like ${`%${digits}%`}`;
    const person = exists(
      this.db
        .select({ one: sql`1` })
        .from(contactPersons)
        .where(
          and(
            eq(contactPersons.contactId, contacts.id),
            or(ilike(contactPersons.name, contains(c.q)), ilike(contactPersons.email, contains(c.q)), byPhone ? phoneDigits(contactPersons.phone) : undefined),
          ),
        ),
    );
    const text = or(
      ilike(contacts.name, contains(c.q)),
      ilike(contacts.email, contains(c.q)),
      byPhone ? phoneDigits(contacts.phone) : undefined,
      taxQ.length >= SEARCH_MIN_LENGTH ? sql`replace(coalesce(${contacts.taxId}, ''), ' ', '') ilike ${contains(taxQ)}` : undefined,
      person,
    );
    const rows = await this.db
      .select({ id: contacts.id, name: contacts.name, type: contacts.type, email: contacts.email, phone: contacts.phone, taxId: contacts.taxId, gst: contacts.gstTreatment, archivedAt: contacts.archivedAt })
      .from(contacts)
      .where(and(eq(contacts.orgId, c.orgId), c.archived || c.ids ? undefined : isNull(contacts.archivedAt), this.match(c, contacts.id, text)))
      .orderBy(...this.rank(null, contacts.name, c.q), contacts.name)
      .limit(c.n);

    // What matched, when it isn't the name or email: the phone, the tax ID or one of their people.
    const q = c.q.toLowerCase();
    const plain = (r: (typeof rows)[number]) => c.ids || r.name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q);
    const others = rows.filter((r) => !plain(r)).map((r) => r.id);
    const people = others.length
      ? await this.db.select({ contactId: contactPersons.contactId, name: contactPersons.name, email: contactPersons.email, phone: contactPersons.phone }).from(contactPersons).where(inArray(contactPersons.contactId, others))
      : [];
    return rows.map((r) => {
      const kind = r.type === "vendor" ? "Vendor" : r.type === "both" ? "Customer and vendor" : "Customer";
      let detail: string | null = r.email ?? r.phone;
      let highlight: string | null = null;
      if (!plain(r)) {
        if (byPhone && r.phone && digitsOf(r.phone).includes(digits)) {
          detail = `Phone ${r.phone}`;
          highlight = r.phone;
        } else if (r.taxId && r.taxId.replace(/\s/g, "").toLowerCase().includes(taxQ.toLowerCase())) {
          detail = `${r.gst ? "GSTIN" : "Tax ID"} ${r.taxId}`;
          highlight = r.taxId;
        } else {
          const p = people.find(
            (x) => x.contactId === r.id && (x.name.toLowerCase().includes(q) || (x.email ?? "").toLowerCase().includes(q) || (byPhone && digitsOf(x.phone).includes(digits))),
          );
          if (p) {
            const byItsPhone = byPhone && digitsOf(p.phone).includes(digits) && !p.name.toLowerCase().includes(q);
            detail = byItsPhone ? `Contact: ${p.name} · ${p.phone}` : `Contact: ${p.name}`;
            highlight = byItsPhone ? p.phone : null;
          }
        }
      }
      return {
        id: r.id,
        title: r.name,
        subtitle: [kind, detail].filter(Boolean).join(" · "),
        status: r.archivedAt ? "Archived" : "Contact",
        href: `/contacts/${r.id}`,
        highlight,
        exact: false,
      };
    });
  }

  /** US-OPS-43 — by title or contact; "Harborview · $48,500.00", with the stage. */
  private async leads(c: Ctx): Promise<Row[]> {
    const rows = await this.db
      .select({ id: leads.id, title: leads.title, value: leads.valueAmount, currency: leads.valueCurrency, stage: leadStages.name, contact: contacts.name })
      .from(leads)
      .innerJoin(leadStages, eq(leads.stageId, leadStages.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.orgId, c.orgId), this.match(c, leads.id, or(ilike(leads.title, contains(c.q)), ilike(contacts.name, contains(c.q))))))
      .orderBy(...this.rank(null, leads.title, c.q), desc(leads.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: r.title || r.contact || "Lead",
      subtitle: [r.title ? r.contact : null, r.value > 0n ? c.money(r.value, r.currency) : null].filter(Boolean).join(" · ") || null,
      status: r.stage,
      href: `/leads?lead=${r.id}`,
      exact: false,
    }));
  }

  /** US-OPS-43 — by title, location or contact, as the calendar shows them; the next date, or the last once it's over. */
  private async meetings(c: Ctx, field: boolean): Promise<Row[]> {
    const role = field ? "field" : await getMemberRole(this.db, c.orgId, c.userId);
    // The calendar's own rule (MeetingsService): Owners see every meeting; others see org-wide ones and those they organise or are invited to.
    const visible =
      role === "owner"
        ? undefined
        : or(
            eq(meetings.visibility, "org"),
            eq(meetings.organizerUserId, c.userId),
            exists(this.db.select({ one: sql`1` }).from(meetingAttendees).where(and(eq(meetingAttendees.meetingId, meetings.id), eq(meetingAttendees.userId, c.userId)))),
          );
    const rows = await this.db
      .select({ id: meetings.id, title: meetings.title, startAt: meetings.startAt, allDay: meetings.allDay, recurrence: meetings.recurrence, contact: contacts.name })
      .from(meetings)
      .leftJoin(contacts, eq(meetings.contactId, contacts.id))
      .where(and(eq(meetings.orgId, c.orgId), visible, this.match(c, meetings.id, or(ilike(meetings.title, contains(c.q)), ilike(meetings.location, contains(c.q)), ilike(contacts.name, contains(c.q))))))
      .orderBy(...this.rank(null, meetings.title, c.q), desc(meetings.startAt))
      .limit(c.n);
    const now = new Date();
    return rows.map((r) => {
      const when = meetingWhen(r.startAt, r.recurrence as Recurrence | null, now);
      return {
        id: r.id,
        title: r.title,
        subtitle: [meetingTime(when.at, r.allDay, c.timeZone), r.contact].filter(Boolean).join(" · "),
        status: when.past ? "Past" : "Upcoming",
        href: `/meetings?id=${r.id}`,
        exact: false,
      };
    });
  }

  /** US-OPS-43 — by name, description or HSN/SAC; "Interior · $3.50". */
  private async catalogItems(c: Ctx): Promise<Row[]> {
    const rows = await this.db
      .select({ id: catalogItems.id, name: catalogItems.name, category: catalogItems.category, price: catalogItems.defaultPriceAmount, currency: catalogItems.defaultPriceCurrency, archivedAt: catalogItems.archivedAt })
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.orgId, c.orgId),
          c.archived || c.ids ? undefined : isNull(catalogItems.archivedAt),
          this.match(c, catalogItems.id, or(ilike(catalogItems.name, contains(c.q)), ilike(catalogItems.description, contains(c.q)), ilike(catalogItems.hsnSac, contains(c.q)))),
        ),
      )
      .orderBy(...this.rank(null, catalogItems.name, c.q), catalogItems.name)
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: r.name,
      subtitle: [r.category, c.money(r.price, r.currency)].filter(Boolean).join(" · "),
      status: r.archivedAt ? "Archived" : "Active",
      href: `/catalog?item=${r.id}`,
      exact: false,
    }));
  }

  private async quotes(c: Ctx): Promise<Row[]> {
    const amounts = [quotes.totalAmount];
    const rows = await this.db
      .select({ id: quotes.id, number: quotes.number, status: quotes.status, total: quotes.totalAmount, currency: quotes.currency, contact: contacts.name })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(and(eq(quotes.orgId, c.orgId), this.match(c, quotes.id, this.numberOrText(quotes.number, c.q, contacts.name), amounts)))
      .orderBy(...this.amountFirst(c, amounts), ...this.rank(quotes.number, contacts.name, c.q), desc(quotes.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: r.number ?? "Draft quote",
      subtitle: [r.contact, c.money(r.total, r.currency)].filter(Boolean).join(" · "),
      status: QUOTE_STATUS[r.status] ?? r.status,
      href: `/quotes/${r.id}`,
      highlight: this.amountHit(c, r.currency, r.total),
      exact: isNumberMatch(r.number, c.q),
    }));
  }

  private async jobs(c: Ctx, field: boolean): Promise<Row[]> {
    const rows = await this.db
      .select({ id: jobs.id, number: jobs.number, name: jobs.name, status: jobs.status, site: jobs.siteAddress, contact: contacts.name })
      .from(jobs)
      .leftJoin(contacts, eq(jobs.contactId, contacts.id))
      .where(
        and(
          eq(jobs.orgId, c.orgId),
          this.match(c, jobs.id, this.numberOrText(jobs.number, c.q, jobs.name, contacts.name)),
          // Field: only jobs they're on (US-JOB-19).
          field ? inArray(jobs.id, this.db.select({ id: jobAssignments.jobId }).from(jobAssignments).where(eq(jobAssignments.userId, c.userId))) : undefined,
        ),
      )
      .orderBy(...this.rank(jobs.number, jobs.name, c.q), desc(jobs.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: [r.number, r.name].filter(Boolean).join(" · "),
      subtitle: r.site ?? r.contact,
      status: JOB_STATUS[r.status] ?? r.status,
      href: `/jobs/${r.id}`,
      exact: isNumberMatch(r.number, c.q),
    }));
  }

  private async invoices(c: Ctx): Promise<Row[]> {
    const balanceSql = sql`(${invoices.totalAmount} - ${invoices.retentionAmount} - ${invoices.amountPaid} - ${invoices.creditedAmount})`;
    const amounts = [invoices.totalAmount, balanceSql];
    const rows = await this.db
      .select({ id: invoices.id, number: invoices.number, status: invoices.status, currency: invoices.currency, total: invoices.totalAmount, balance: sql<string>`${balanceSql}::text`, dueDate: invoices.dueDate, contact: contacts.name })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, c.orgId), this.match(c, invoices.id, this.numberOrText(invoices.number, c.q, contacts.name), amounts)))
      .orderBy(...this.amountFirst(c, amounts), ...this.rank(invoices.number, contacts.name, c.q), desc(invoices.createdAt))
      .limit(c.n);
    return rows.map((r) => {
      const due = BigInt(r.balance);
      const dueDate = isoDate(r.dueDate);
      const status =
        r.status === "void" ? "Void" : r.status === "draft" ? "Draft" : due <= 0n ? "Paid" : dueDate && dueDate < c.today ? "Overdue" : "Issued";
      const owing = r.status === "issued" && due > 0n;
      // US-OPS-45: matched on its total while something else is still due — show both.
      const amount = owing
        ? c.amount === r.total && due !== r.total && !c.ids
          ? `${c.money(r.total, r.currency)} · ${c.money(due, r.currency)} due`
          : `${c.money(due, r.currency)} due`
        : c.money(r.total, r.currency);
      return {
        id: r.id,
        title: r.number ?? "Draft invoice",
        subtitle: [r.contact, amount].filter(Boolean).join(" · "),
        status,
        href: `/invoices/${r.id}`,
        highlight: this.amountHit(c, r.currency, r.total, due),
        exact: isNumberMatch(r.number, c.q),
      };
    });
  }

  /** US-INV-38 — by number, customer, the invoice's number or the reason; "₹7,856.00 credit left" while credit is left. */
  private async creditNotes(c: Ctx): Promise<Row[]> {
    const amounts = [creditNotes.totalAmount];
    const rows = await this.db
      .select({ id: creditNotes.id, number: creditNotes.number, status: creditNotes.status, currency: creditNotes.currency, total: creditNotes.totalAmount, left: creditNotes.creditRemainingAmount, contact: contacts.name, invoice: invoices.number })
      .from(creditNotes)
      .leftJoin(contacts, eq(creditNotes.contactId, contacts.id))
      .leftJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
      .where(and(eq(creditNotes.orgId, c.orgId), this.match(c, creditNotes.id, this.numberOrText(creditNotes.number, c.q, contacts.name, invoices.number, creditNotes.reason), amounts)))
      .orderBy(...this.amountFirst(c, amounts), ...this.rank(creditNotes.number, contacts.name, c.q), desc(creditNotes.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: r.number ?? "Draft credit note",
      subtitle: [r.contact, r.invoice ? `against ${r.invoice}` : null, c.money(r.total, r.currency)].filter(Boolean).join(" · "),
      status: r.status === "draft" ? "Draft" : r.left > 0n ? `${c.money(r.left, r.currency)} credit left` : "Credited",
      href: `/credit-notes/${r.id}`,
      highlight: this.amountHit(c, r.currency, r.total),
      exact: isNumberMatch(r.number, c.q),
    }));
  }

  /** US-PAY-25 — by receipt number, reference or customer: "Halcyon Tech Parks · ₹45,000.00 · 10 Oct", with the credit left. */
  private async payments(c: Ctx): Promise<Row[]> {
    const amounts = [payments.amount];
    const rows = await this.db
      .select({ id: payments.id, number: payments.number, date: payments.date, currency: payments.currency, amount: payments.amount, allocated: payments.allocatedAmount, refunded: payments.refundedAmount, contact: contacts.name })
      .from(payments)
      .leftJoin(contacts, eq(payments.contactId, contacts.id))
      .where(and(eq(payments.orgId, c.orgId), this.match(c, payments.id, this.numberOrText(payments.number, c.q, contacts.name, payments.reference), amounts)))
      .orderBy(...this.amountFirst(c, amounts), ...this.rank(payments.number, contacts.name, c.q), desc(payments.date), desc(payments.createdAt))
      .limit(c.n);
    return rows.map((r) => {
      const left = r.amount - r.allocated - r.refunded;
      return {
        id: r.id,
        title: r.number ?? "Payment",
        subtitle: [r.contact, c.money(r.amount, r.currency), shortDay(r.date)].filter(Boolean).join(" · "),
        status: left > 0n ? `${c.money(left, r.currency)} credit left` : null,
        href: `/payments/${r.id}`,
        highlight: this.amountHit(c, r.currency, r.amount),
        exact: isNumberMatch(r.number, c.q),
      };
    });
  }

  /** US-PUR-55 — by number, reference or vendor: "VPY-0014 · Ridgeline · ₹48,000.00 · 11 Oct". */
  private async vendorPayments(c: Ctx): Promise<Row[]> {
    const amounts = [vendorPayments.amount];
    const rows = await this.db
      .select({ id: vendorPayments.id, number: vendorPayments.number, date: vendorPayments.date, currency: vendorPayments.currency, amount: vendorPayments.amount, vendor: contacts.name })
      .from(vendorPayments)
      .leftJoin(contacts, eq(vendorPayments.contactId, contacts.id))
      .where(and(eq(vendorPayments.orgId, c.orgId), this.match(c, vendorPayments.id, this.numberOrText(vendorPayments.number, c.q, contacts.name, vendorPayments.reference), amounts)))
      .orderBy(...this.amountFirst(c, amounts), ...this.rank(vendorPayments.number, contacts.name, c.q), desc(vendorPayments.date), desc(vendorPayments.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: r.number ?? "Vendor payment",
      subtitle: [r.vendor, c.money(r.amount, r.currency), shortDay(r.date)].filter(Boolean).join(" · "),
      status: null,
      href: `/vendor-payments/${r.id}`,
      highlight: this.amountHit(c, r.currency, r.amount),
      exact: isNumberMatch(r.number, c.q),
    }));
  }

  private async vendorBills(c: Ctx): Promise<Row[]> {
    const openSql = sql`(${vendorBills.totalAmount} - ${vendorBills.amountPaid} - ${vendorBills.creditedAmount})`;
    const amounts = [vendorBills.totalAmount, openSql];
    const rows = await this.db
      .select({ id: vendorBills.id, number: vendorBills.billNumber, status: vendorBills.status, currency: vendorBills.currency, total: vendorBills.totalAmount, paid: vendorBills.amountPaid, credited: vendorBills.creditedAmount, dueDate: vendorBills.dueDate, vendor: contacts.name })
      .from(vendorBills)
      .leftJoin(contacts, eq(vendorBills.contactId, contacts.id))
      .where(and(eq(vendorBills.orgId, c.orgId), this.match(c, vendorBills.id, this.numberOrText(vendorBills.billNumber, c.q, contacts.name), amounts)))
      .orderBy(...this.amountFirst(c, amounts), ...this.rank(vendorBills.billNumber, contacts.name, c.q), desc(vendorBills.createdAt))
      .limit(c.n);
    return rows.map((r) => {
      const open = r.total - r.paid - r.credited;
      const dueDate = isoDate(r.dueDate);
      const status = r.status === "void" ? "Void" : r.status === "draft" ? "Draft" : open <= 0n ? "Paid" : dueDate && dueDate < c.today ? "Overdue" : "Unpaid";
      const amount = c.amount === open && open !== r.total && !c.ids ? `${c.money(r.total, r.currency)} · ${c.money(open, r.currency)} due` : c.money(r.total, r.currency);
      return {
        id: r.id,
        title: [r.number, r.vendor].filter(Boolean).join(" · "),
        subtitle: amount,
        status,
        href: `/vendor-bills/${r.id}`,
        highlight: this.amountHit(c, r.currency, r.total, open),
        exact: isNumberMatch(r.number, c.q),
      };
    });
  }

  /** US-OPS-43 — by number, the vendor's reference or the vendor; "Apex Timber · $420.00 left". */
  private async vendorCredits(c: Ctx): Promise<Row[]> {
    const amounts = [vendorCredits.totalAmount];
    const rows = await this.db
      .select({ id: vendorCredits.id, number: vendorCredits.number, reference: vendorCredits.vendorReference, status: vendorCredits.status, currency: vendorCredits.currency, total: vendorCredits.totalAmount, left: vendorCredits.balanceAmount, vendor: contacts.name })
      .from(vendorCredits)
      .leftJoin(contacts, eq(vendorCredits.contactId, contacts.id))
      .where(and(eq(vendorCredits.orgId, c.orgId), this.match(c, vendorCredits.id, this.numberOrText(vendorCredits.number, c.q, contacts.name, vendorCredits.vendorReference), amounts)))
      .orderBy(...this.amountFirst(c, amounts), ...this.rank(vendorCredits.number, contacts.name, c.q), desc(vendorCredits.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: r.number ?? (r.reference ? `Draft · ${r.reference}` : "Draft vendor credit"),
      subtitle: [r.vendor, r.status === "open" ? `${c.money(r.left, r.currency)} left` : c.money(r.total, r.currency)].filter(Boolean).join(" · "),
      status: VENDOR_CREDIT_STATUS[r.status] ?? r.status,
      href: `/vendor-credits/${r.id}`,
      highlight: this.amountHit(c, r.currency, r.total),
      exact: isNumberMatch(r.number, c.q),
    }));
  }

  private async expenses(c: Ctx, ownOnly: boolean): Promise<Row[]> {
    const amounts = [expenses.amount];
    const rows = await this.db
      .select({ id: expenses.id, number: expenses.number, status: expenses.status, amount: expenses.amount, currency: expenses.currency, date: expenses.date, category: expenseCategories.name, submitter: user.name })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(user, eq(expenses.submittedByUserId, user.id))
      .where(
        and(
          eq(expenses.orgId, c.orgId),
          this.match(c, expenses.id, this.numberOrText(expenses.number, c.q, expenseCategories.name, expenses.description), amounts),
          // Field (US-OPS-20) and Staff without "See everyone's expenses" (US-TEAM-30): only their own.
          ownOnly ? eq(expenses.submittedByUserId, c.userId) : undefined,
        ),
      )
      .orderBy(...this.amountFirst(c, amounts), ...this.rank(expenses.number, expenseCategories.name, c.q), desc(expenses.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: [r.number, r.category].filter(Boolean).join(" · ") || "Expense",
      subtitle: [r.submitter, c.money(r.amount, r.currency), isoDate(r.date)].filter(Boolean).join(" · "),
      status: EXPENSE_STATUS[r.status] ?? r.status,
      href: `/expenses/${r.id}`,
      highlight: this.amountHit(c, r.currency, r.amount),
      exact: isNumberMatch(r.number, c.q),
    }));
  }
}
