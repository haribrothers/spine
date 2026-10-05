import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  DIGEST_LABELS,
  buildToday,
  digestDue,
  digestEnabledFor,
  digestFooter,
  digestSubject,
  greetingFor,
  type AttentionItem,
  type TodayEntry,
} from "@spine/shared";
import { and, countDistinct, eq, gte, lt, sql } from "drizzle-orm";
import { getEffectiveCapabilities } from "../../auth/capability.util";
import { orgClock } from "../../common/org-clock";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import { member, payments, quoteEvents, quotes, user } from "../../db/schema";
import { MeetingsService } from "../contacts/meetings.service";
import { loadEmailBrand } from "../email/email-brand";
import { appUrl, emailMoney, firstName, renderEmail, type EmailBrand, type EmailContent } from "../email/email-layout";
import { EmailService } from "../email/email.service";
import { MilestonesService } from "../jobs/milestones.service";
import { AttentionService } from "./attention.service";

export interface DigestRecipient {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface DigestEmail {
  subject: string;
  content: EmailContent;
}

/** Local midnight `days` from `date` (the process runs in organisation time, `TZ`). */
function localDay(date: Date, days = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * US-NTF-13 (D-093) — one email each morning: the member's attention rows
 * (the dashboard's own list, US-DASH-12), what's on today (meetings and
 * milestones), and yesterday's money received, quotes accepted and quotes
 * viewed. Nothing to report: no email. Field users get counts only — no
 * money anywhere (D-048) — and no yesterday section.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly attention: AttentionService,
    private readonly meetings: MeetingsService,
    private readonly milestones: MilestonesService,
    private readonly email: EmailService,
  ) {}

  /** Sends every digest that's due now; returns how many went out. */
  async runDue(now: Date): Promise<number> {
    const clock = orgClock(now);
    const rows = await this.db
      .select({
        orgId: member.organizationId,
        role: member.role,
        userId: user.id,
        name: user.name,
        email: user.email,
        enabled: user.digestEnabled,
        time: user.digestTime,
        days: user.digestDays,
        lastSentOn: user.digestLastSentOn,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.isActive, true));

    let sent = 0;
    for (const row of rows) {
      const due = digestDue({ enabled: digestEnabledFor(row.role, row.enabled), time: row.time.slice(0, 5), days: row.days, lastSentOn: row.lastSentOn }, clock.date, clock.time);
      if (!due) continue;
      if (!this.email.isConfigured()) {
        this.logger.warn("Daily digest skipped: SMTP is not configured.");
        return sent;
      }
      try {
        const brand = await loadEmailBrand(this.db, row.orgId);
        const digest = await this.build(row.orgId, { userId: row.userId, name: row.name, email: row.email, role: row.role }, now, brand);
        if (digest) {
          const rendered = renderEmail(brand, digest.content);
          await this.email.send({ to: row.email, fromName: brand.name, subject: digest.subject, text: rendered.text, html: rendered.html, attachments: rendered.attachments });
          sent += 1;
        }
        // Sent, or nothing to report: either way, today is done for this member.
        await this.db.update(user).set({ digestLastSentOn: clock.date }).where(eq(user.id, row.userId));
      } catch (err) {
        this.logger.error(`Daily digest for ${row.email} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return sent;
  }

  /** The digest for one member, or null when there's nothing to report. */
  async build(orgId: string, who: DigestRecipient, now: Date, brand: EmailBrand): Promise<DigestEmail | null> {
    const field = who.role === "field";
    const today = orgClock(now).date;
    const rows = await this.attention.list(orgId, who.userId);
    const todayEntries = await this.todayFor(orgId, who, now);
    const yesterday = field ? [] : await this.yesterdayFor(orgId, who.userId, now, brand.locale);

    if (rows.length === 0 && todayEntries.length === 0 && yesterday.length === 0) return null;

    const money = (item: AttentionItem) => (field || !item.total ? "" : ` · ${emailMoney(BigInt(item.total), item.currency, brand.locale)}`);
    return {
      subject: digestSubject(rows.length, today),
      content: {
        preheader: rows.length ? `${rows.length} ${rows.length === 1 ? "thing needs" : "things need"} you at ${brand.name} today.` : `Your day at ${brand.name}.`,
        heading: `${greetingFor(now.getHours())}, ${firstName(who.name)}`,
        paragraphs: [rows.length ? `Here's what needs you at ${brand.name} today.` : `Nothing needs you at ${brand.name} today.`],
        facts: rows.map((item) => ({ label: DIGEST_LABELS[item.kind], value: `${item.count}${money(item)}` })),
        sections: [
          { title: "Today", lines: todayEntries.map((e) => (e.kind === "milestone" ? `${e.when} · ${e.title} (${e.detail.replace(/^Milestone · /, "")})` : `${e.when} · ${e.title}`)) },
          { title: "Yesterday", lines: yesterday.length ? [yesterday.join(" · ")] : [] },
        ],
        button: { label: "Open dashboard", url: appUrl("/dashboard") },
        footerNote: digestFooter(who.role, brand.name),
      },
    };
  }

  /** Meetings later today and milestones due within 7 days, as on the dashboard's Today card (US-DASH-16). */
  private async todayFor(orgId: string, who: DigestRecipient, now: Date): Promise<TodayEntry[]> {
    const tomorrow = localDay(now, 1);
    const meetings = (await this.meetings.upcomingForDashboard(orgId, who.userId, { withinDays: 1, from: now })).filter((m) => m.startAt < tomorrow);
    const milestones = await this.milestones.dueAcrossJobs(orgId, { withinDays: 7, assignedToUserId: who.role === "field" ? who.userId : undefined });
    return buildToday({
      now,
      meetings: meetings.map((m) => ({ id: m.id, title: m.title, startAt: m.startAt.toISOString(), allDay: m.allDay, location: m.location })),
      milestones: milestones.map((m) => ({ milestoneId: m.milestoneId, jobId: m.jobId, jobName: m.jobName, name: m.name, dueDate: orgClock(m.dueDate!).date })),
      followups: [],
    });
  }

  /** "$5,000.00 received · 1 quote accepted ($14,250.00) · 3 quotes viewed" — money only with `reports.view_receivables`. */
  private async yesterdayFor(orgId: string, userId: string, now: Date, locale?: string): Promise<string[]> {
    const from = localDay(now, -1);
    const to = localDay(now);
    const yesterday = orgClock(from).date;
    const can = await getEffectiveCapabilities(this.db, { orgId, userId });
    const parts: string[] = [];

    if (can["reports.view_receivables"]) {
      const received = await this.db
        .select({ currency: payments.currency, total: sql<string>`sum(${payments.amount})::text` })
        .from(payments)
        .where(and(eq(payments.orgId, orgId), eq(payments.date, new Date(`${yesterday}T00:00:00Z`))))
        .groupBy(payments.currency);
      for (const r of received) if (BigInt(r.total) > 0n) parts.push(`${emailMoney(BigInt(r.total), r.currency, locale)} received`);
    }

    const accepted = await this.db
      .select({ currency: quotes.currency, count: sql<number>`count(*)::int`, total: sql<string>`sum(${quotes.totalAmount})::text` })
      .from(quotes)
      .where(and(eq(quotes.orgId, orgId), eq(quotes.status, "accepted"), gte(quotes.respondedAt, from), lt(quotes.respondedAt, to)))
      .groupBy(quotes.currency);
    for (const a of accepted) parts.push(`${a.count} ${a.count === 1 ? "quote" : "quotes"} accepted (${emailMoney(BigInt(a.total), a.currency, locale)})`);

    const [viewed] = await this.db
      .select({ count: countDistinct(quoteEvents.quoteId) })
      .from(quoteEvents)
      .where(and(eq(quoteEvents.orgId, orgId), eq(quoteEvents.type, "viewed"), gte(quoteEvents.createdAt, from), lt(quoteEvents.createdAt, to)));
    if (viewed && viewed.count > 0) parts.push(`${viewed.count} ${viewed.count === 1 ? "quote" : "quotes"} viewed`);

    return parts;
  }
}
