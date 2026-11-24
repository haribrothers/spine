import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, jobs, jobVariationOrders, member, notifications, quotes, user } from "../../db/schema";
import { QuotesService } from "./quotes.service";
import { PublicQuotesService } from "./public-quotes.service";
import { QuotePublicTokenService } from "./quote-public-token.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { SettingsService } from "../org/settings.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailLogService } from "../email/email-log.service";
import { EmailService } from "../email/email.service";
import { PlaceOfSupplyService } from "../tax/place-of-supply.service";

const PROVENANCE = { ipAddress: "127.0.0.1", userAgent: "vitest" };

/**
 * Regression coverage for "quote rejected" now firing an owner notification
 * (previously only "viewed"/"accepted" did, per S-03.7's literal wording —
 * closed as a "Next up" item once real usage confirmed owners want to know
 * about rejections just as promptly as acceptances).
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("PublicQuotesService respond() owner notifications (requires local Postgres)", () => {
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
    const fakeQueue = { send: async () => {} };
    const fakePush = { isConfigured: () => false };
    const notificationsService = new NotificationsService(db, fakePush as never, new EmailLogService(db, fakeQueue as never, new EmailService(db), new AuditLogService(db)));

    quotesService = new QuotesService(db, auditLog, numbering, settings, fakeQueue as never, tokens, taxResolver, new PlaceOfSupplyService(db), notificationsService, new EmailLogService(db, fakeQueue as never, new EmailService(db), new AuditLogService(db)));
    publicQuotesService = new PublicQuotesService(db, tokens, auditLog, notificationsService, settings);

    const ownerEmail = `qrespond-owner-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Quote Respond Owner" } });
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

  async function countNotificationsOfType(type: string): Promise<number> {
    const rows = await db.select().from(notifications).where(and(eq(notifications.orgId, orgId), eq(notifications.type, type)));
    return rows.length;
  }

  async function flushNotify(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  it("rejecting a quote sends a quote_rejected owner notification", async () => {
    const [quote] = await db.select().from(quotes).where(eq(quotes.orgId, orgId));
    const token = await issueTokenFor(quote!.id);

    await publicQuotesService.reject(token, "Too expensive", PROVENANCE);
    await flushNotify();

    expect(await countNotificationsOfType("quote_rejected")).toBe(1);
    expect(await countNotificationsOfType("quote_accepted")).toBe(0);
  });

  it("accepting a quote still sends a quote_accepted owner notification, not quote_rejected", async () => {
    const [quote] = await db.select().from(quotes).where(eq(quotes.orgId, orgId));
    const token = await issueTokenFor(quote!.id);

    await publicQuotesService.accept(token, undefined, PROVENANCE);
    await flushNotify();

    expect(await countNotificationsOfType("quote_accepted")).toBe(1);
    expect(await countNotificationsOfType("quote_rejected")).toBe(0);
  });

  it("accepting an ordinary (non-variation) quote does not send a variation_order_accepted notification", async () => {
    const [quote] = await db.select().from(quotes).where(eq(quotes.orgId, orgId));
    const token = await issueTokenFor(quote!.id);

    await publicQuotesService.accept(token, undefined, PROVENANCE);
    await flushNotify();

    expect(await countNotificationsOfType("variation_order_accepted")).toBe(0);
  });

  it("accepting a variation order's quote sends both quote_accepted and variation_order_accepted notifications", async () => {
    const [contact] = await db.select().from(contacts).where(eq(contacts.orgId, orgId));
    const [job] = await db
      .insert(jobs)
      .values({ orgId, contactId: contact!.id, name: "Test Job", currency: "USD" })
      .returning();

    const variationQuote = await quotesService.create(orgId, actorUserId, { contactId: contact!.id, currency: "USD", lines: [] });
    await quotesService.send(orgId, variationQuote.id, actorUserId);
    await db.insert(jobVariationOrders).values({ jobId: job!.id, quoteId: variationQuote.id, orgId, createdByUserId: actorUserId });

    const token = await issueTokenFor(variationQuote.id);

    await publicQuotesService.accept(token, undefined, PROVENANCE);
    await flushNotify();

    expect(await countNotificationsOfType("quote_accepted")).toBe(1);
    expect(await countNotificationsOfType("variation_order_accepted")).toBe(1);

    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.orgId, orgId), eq(notifications.type, "variation_order_accepted")));
    expect(notification?.link).toBe(`/jobs/${job!.id}?tab=variations`);
  });

  it("rejecting a variation order's quote does not send a variation_order_accepted notification", async () => {
    const [contact] = await db.select().from(contacts).where(eq(contacts.orgId, orgId));
    const [job] = await db
      .insert(jobs)
      .values({ orgId, contactId: contact!.id, name: "Test Job", currency: "USD" })
      .returning();

    const variationQuote = await quotesService.create(orgId, actorUserId, { contactId: contact!.id, currency: "USD", lines: [] });
    await quotesService.send(orgId, variationQuote.id, actorUserId);
    await db.insert(jobVariationOrders).values({ jobId: job!.id, quoteId: variationQuote.id, orgId, createdByUserId: actorUserId });

    const token = await issueTokenFor(variationQuote.id);

    await publicQuotesService.reject(token, "Not needed", PROVENANCE);
    await flushNotify();

    expect(await countNotificationsOfType("variation_order_accepted")).toBe(0);
  });
});
