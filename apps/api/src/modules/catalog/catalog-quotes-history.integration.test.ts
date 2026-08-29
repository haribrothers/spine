import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, member, user } from "../../db/schema";
import { CatalogService } from "./catalog.service";
import { QuotesService } from "../quotes/quotes.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { SettingsService } from "../org/settings.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { QuotePublicTokenService } from "../quotes/quote-public-token.service";

/**
 * Regression coverage for `GET /catalog-items/:id/history` and
 * `GET /quotes/:id/history` — the two remaining modules (per CHANGELOG's
 * own "Next up" tracking) that wrote `audit_log` rows via
 * `AuditLogService.record()` but had no read endpoint of their own,
 * unlike Contacts/Invoices/Payments/Credit Notes. Same
 * `AuditLogService.listForEntity` scoping already proven for those.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Catalogue/Quotes history (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let actorUserId: string;
  let catalogService: CatalogService;
  let quotesService: QuotesService;

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
    const publicTokens = new QuotePublicTokenService(db);
    // Real pg-boss needs its own onModuleInit to finish starting before
    // QueueService.send() can be called — never true when a service is
    // constructed by hand in a test. Faked here since `send()`'s queued
    // quote-send-email job isn't what this test cares about.
    const fakeQueue = { send: async () => {} };

    catalogService = new CatalogService(db, auditLog, taxResolver);
    quotesService = new QuotesService(db, auditLog, numbering, settings, fakeQueue as never, publicTokens, taxResolver);

    const ownerEmail = `catquote-history-owner-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "History Owner" } });
    actorUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Test Customer" }).returning();
    contactId = contact!.id;
  });

  describe("Catalogue", () => {
    it("returns creation and update rows, newest first, scoped to that item only", async () => {
      const item = await catalogService.create(orgId, actorUserId, {
        name: "Widget",
        unit: "each",
        defaultPriceAmount: 1000n,
        defaultPriceCurrency: "USD",
      });
      await catalogService.update(orgId, item.id, actorUserId, { name: "Widget Pro" });

      const other = await catalogService.create(orgId, actorUserId, {
        name: "Gadget",
        unit: "each",
        defaultPriceAmount: 500n,
        defaultPriceCurrency: "USD",
      });
      await catalogService.update(orgId, other.id, actorUserId, { name: "Only on other" });

      const history = await catalogService.getHistory(orgId, item.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0]!.action).toBe("updated");
      expect(history[0]!.entityType).toBe("catalog_item");
      expect(history.every((h) => h.entityId === item.id)).toBe(true);
      const changes = history.flatMap((h) => (Array.isArray(h.changes) ? (h.changes as { field: string; to: unknown }[]) : []));
      expect(changes.some((c) => c.to === "Only on other")).toBe(false);
    });

    it("throws NotFoundException for a catalog item that doesn't exist in this org", async () => {
      await expect(catalogService.getHistory(orgId, randomUUID())).rejects.toThrow(/not found/i);
    });
  });

  describe("Quotes", () => {
    it("returns creation and send rows scoped to that quote only", async () => {
      const quote = await quotesService.create(orgId, actorUserId, { contactId, currency: "USD", lines: [] });
      await quotesService.send(orgId, quote.id, actorUserId);

      const otherQuote = await quotesService.create(orgId, actorUserId, { contactId, currency: "USD", lines: [] });

      const history = await quotesService.getHistory(orgId, quote.id);
      expect(history.every((h) => h.entityType === "quote" && h.entityId === quote.id)).toBe(true);
      expect(history.some((h) => h.action === "created")).toBe(true);
      expect(history.some((h) => h.action === "sent")).toBe(true);

      const otherHistory = await quotesService.getHistory(orgId, otherQuote.id);
      expect(otherHistory.every((h) => h.entityId === otherQuote.id)).toBe(true);
    });

    it("throws NotFoundException for a quote that doesn't exist in this org", async () => {
      await expect(quotesService.getHistory(orgId, randomUUID())).rejects.toThrow(/not found/i);
    });
  });
});
