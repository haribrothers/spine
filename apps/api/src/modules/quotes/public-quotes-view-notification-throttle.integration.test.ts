import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, member, notifications, quoteEvents, quotes, user } from "../../db/schema";
import { QuotesService } from "./quotes.service";
import { PublicQuotesService } from "./public-quotes.service";
import { QuotePublicTokenService } from "./quote-public-token.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { SettingsService } from "../org/settings.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { NotificationsService } from "../notifications/notifications.service";

const PROVENANCE = { ipAddress: "127.0.0.1", userAgent: "vitest" };

/**
 * Regression coverage for the "at most one 'viewed' owner notification per
 * hour per quote" throttle (§9 "Next up" — repeat-view notification noise,
 * a long-standing, deliberately-deferred known gap, now closed).
 * `quote_events` must still get one row per view regardless of the
 * throttle (the underlying audit trail is unaffected); only the
 * `NotificationsService.notify()` call — and therefore the persisted
 * `notifications` row it writes via its own `inApp` param — should be
 * skipped for a repeat view inside the window.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("PublicQuotesService view-notification throttle (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let actorUserId: string;
  let quotesService: QuotesService;
  let publicQuotesService: PublicQuotesService;
  let tokens: QuotePublicTokenService;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(eq(user.email, createdEmails[0]!));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const auditLog = new AuditLogService(db);
    const numbering = new NumberingService(db);
    const settings = new SettingsService(db);
    const taxResolver = new TaxResolverService(db);
    tokens = new QuotePublicTokenService(db);
    // Real pg-boss needs its own onModuleInit to finish starting before
    // QueueService.send() can be called — never true when a service is
    // constructed by hand in a test. Faked here exactly like
    // notifications.service.recipient-targeting.integration.test.ts's own
    // precedent, since this test only cares about the DB rows notify()
    // writes (quote_events, notifications), not real email delivery.
    const fakeQueue = { send: async () => {} };
    const fakePush = { isConfigured: () => false };
    const notificationsService = new NotificationsService(db, fakeQueue as never, fakePush as never);

    quotesService = new QuotesService(db, auditLog, numbering, settings, fakeQueue as never, tokens, taxResolver, notificationsService);
    publicQuotesService = new PublicQuotesService(db, tokens, auditLog, notificationsService, settings);

    const ownerEmail = `qview-owner-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Quote View Owner" } });
    actorUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Test Customer" }).returning();

    const quote = await quotesService.create(orgId, actorUserId, { contactId: contact!.id, currency: "USD", lines: [] });
    await quotesService.send(orgId, quote.id, actorUserId);
  });

  async function issueTokenFor(quoteId: string): Promise<string> {
    const { token } = await db.transaction(async (tx) => tokens.issue(tx, orgId, quoteId));
    return token;
  }

  async function countViewedEvents(quoteId: string): Promise<number> {
    const rows = await db.select().from(quoteEvents).where(and(eq(quoteEvents.quoteId, quoteId), eq(quoteEvents.type, "viewed")));
    return rows.length;
  }

  async function countViewedNotifications(): Promise<number> {
    const rows = await db.select().from(notifications).where(and(eq(notifications.orgId, orgId), eq(notifications.type, "quote_viewed")));
    return rows.length;
  }

  // `PublicQuotesService.view()` calls `notify()` as fire-and-forget
  // (`void this.notifications.notify(...)`, matching every other caller's
  // convention in this codebase — the public page load must never block on
  // the owner-notification) — so the in-app `notifications` row it writes
  // can land a tick after `view()`'s own await resolves. This test asserts
  // on that DB side effect, so it needs a short wait; production code
  // itself has no such wait and doesn't need one.
  async function flushNotify(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  it("a second view within the throttle window logs a new quote_events row but does not send a second notification", async () => {
    const [quote] = await db.select().from(quotes).where(eq(quotes.orgId, orgId));
    const token = await issueTokenFor(quote!.id);

    await publicQuotesService.view(token, PROVENANCE);
    await publicQuotesService.view(token, PROVENANCE);
    await publicQuotesService.view(token, PROVENANCE);
    await flushNotify();

    expect(await countViewedEvents(quote!.id)).toBe(3);
    expect(await countViewedNotifications()).toBe(1);
  });

  it("a view after the throttle window has elapsed sends a new notification", async () => {
    const [quote] = await db.select().from(quotes).where(eq(quotes.orgId, orgId));
    const token = await issueTokenFor(quote!.id);

    await publicQuotesService.view(token, PROVENANCE);
    await flushNotify();
    expect(await countViewedNotifications()).toBe(1);

    // Backdate the one existing "viewed" event past the throttle window so
    // the next view is treated as the first one in a fresh window, without
    // needing to actually wait an hour in a test.
    const [viewedEvent] = await db
      .select()
      .from(quoteEvents)
      .where(and(eq(quoteEvents.quoteId, quote!.id), eq(quoteEvents.type, "viewed")))
      .orderBy(desc(quoteEvents.createdAt))
      .limit(1);
    await db
      .update(quoteEvents)
      .set({ createdAt: new Date(Date.now() - 61 * 60 * 1000) })
      .where(eq(quoteEvents.id, viewedEvent!.id));

    await publicQuotesService.view(token, PROVENANCE);
    await flushNotify();

    expect(await countViewedEvents(quote!.id)).toBe(2);
    expect(await countViewedNotifications()).toBe(2);
  });

  it("views on two different quotes are throttled independently", async () => {
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Second Customer" }).returning();
    const quoteB = await quotesService.create(orgId, actorUserId, { contactId: contact!.id, currency: "USD", lines: [] });
    await quotesService.send(orgId, quoteB.id, actorUserId);

    const allQuotes = await db.select().from(quotes).where(eq(quotes.orgId, orgId));
    const quoteARow = allQuotes.find((q) => q.contactId !== quoteB.contactId)!;

    const tokenA = await issueTokenFor(quoteARow.id);
    const tokenB = await issueTokenFor(quoteB.id);

    await publicQuotesService.view(tokenA, PROVENANCE);
    await publicQuotesService.view(tokenB, PROVENANCE);
    await publicQuotesService.view(tokenA, PROVENANCE);
    await publicQuotesService.view(tokenB, PROVENANCE);
    await flushNotify();

    expect(await countViewedEvents(quoteARow.id)).toBe(2);
    expect(await countViewedEvents(quoteB.id)).toBe(2);
    // One notification per quote, not throttled across quotes.
    expect(await countViewedNotifications()).toBe(2);
  });
});
