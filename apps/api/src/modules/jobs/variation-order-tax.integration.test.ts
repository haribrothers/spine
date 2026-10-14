import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, jobs, member, quotes, taxGroupRates, taxGroups, taxRates, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PushService } from "../notifications/push.service";
import { NumberingService } from "../numbering/numbering.service";
import { InvoicesService } from "../invoices/invoices.service";
import { LedgerService } from "../ledger/ledger.service";
import { PeriodsService } from "../ledger/periods.service";
import { QueueService } from "../queue/queue.service";
import { SettingsService } from "../org/settings.service";
import { QuoteConversionGuardService } from "../org/quote-conversion-guard.service";
import { QuotePublicTokenService } from "../quotes/quote-public-token.service";
import { QuotesService } from "../quotes/quotes.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { JobsService } from "./jobs.service";
import { MilestonesService } from "./milestones.service";
import { VariationOrdersService } from "./variation-orders.service";
import { EmailLogService } from "../email/email-log.service";
import { EmailService } from "../email/email.service";
import { PlaceOfSupplyService } from "../tax/place-of-supply.service";

/**
 * Regression coverage for the variation-order line editor's tax rate/group
 * picker retrofit (CHANGELOG "Full multi-rate tax-group CRUD" follow-up).
 * A variation order is not its own document type — VariationOrdersService.
 * create delegates straight into QuotesService.create, so `taxRateId`/
 * `taxGroupId`/`isTaxInclusive` on a variation-order line flow through the
 * exact same computeQuoteTotals/TaxResolverService/computeLineTax pipeline
 * as an ordinary quote line (quotes.service.ts). This test asserts that
 * pipeline actually gets exercised end-to-end for a variation order,
 * including a compound tax group, not just the flat-percentage fallback
 * the old frontend used to send exclusively.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Variation order tax (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let ownerUserId: string;
  let variationOrdersService: VariationOrdersService;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(eq(user.email, createdEmails[0]!));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const auditLog = new AuditLogService(db);
    const queue = new QueueService(db);
    const notifications = new NotificationsService(db, new PushService(db), new EmailLogService(db, queue, new EmailService(db), new AuditLogService(db)));
    const numbering = new NumberingService(db);
    const settings = new SettingsService(db);
    const publicTokens = new QuotePublicTokenService(db);
    const taxResolver = new TaxResolverService(db);
    const conversionGuard = new QuoteConversionGuardService(db, settings);
    const ledger = new LedgerService(db, new PeriodsService(db));
    const invoices = new InvoicesService(db, auditLog, numbering, ledger, queue, conversionGuard, taxResolver, new PlaceOfSupplyService(db), new EmailLogService(db, queue, new EmailService(db), new AuditLogService(db)));
    const quotesService = new QuotesService(db, auditLog, numbering, settings, queue, publicTokens, taxResolver, new PlaceOfSupplyService(db), notifications, new EmailLogService(db, queue, new EmailService(db), new AuditLogService(db)));
    const jobsService = new JobsService(db, auditLog, conversionGuard, notifications, numbering);
    const milestonesService = new MilestonesService(db, auditLog, invoices, notifications);
    variationOrdersService = new VariationOrdersService(db, auditLog, quotesService, jobsService, milestonesService);

    const ownerEmail = `vo-tax-owner-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "VO Tax Owner" } });
    ownerUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "VO Tax Customer" }).returning();
    contactId = contact!.id;
  });

  it("resolves a variation-order line's tax group (with a compound rate) through the shared quote tax pipeline", async () => {
    const [baseRate] = await db.insert(taxRates).values({ orgId, name: "GST", rate: 15, isCompound: false }).returning();
    const [compoundRate] = await db.insert(taxRates).values({ orgId, name: "State Tax", rate: 6.5, isCompound: true }).returning();
    const [group] = await db.insert(taxGroups).values({ orgId, name: "GST + State" }).returning();
    await db.insert(taxGroupRates).values([
      { taxGroupId: group!.id, taxRateId: baseRate!.id },
      { taxGroupId: group!.id, taxRateId: compoundRate!.id },
    ]);

    const [job] = await db
      .insert(jobs)
      .values({ orgId, contactId, name: "VO Tax Job", currency: "USD", contractValueAmount: 0n, retentionPct: 0 })
      .returning();

    const variations = await variationOrdersService.create(orgId, ownerUserId, job!.id, {
      lines: [
        {
          type: "item",
          name: "Extra scope",
          quantity: 1,
          unitPriceAmount: 10000n,
          discountPercentage: 0,
          taxRatePercentage: 0,
          taxRateId: null,
          taxGroupId: group!.id,
          isTaxInclusive: false,
        },
      ],
    });

    const [created] = variations;
    expect(created).toBeDefined();

    const [quoteRow] = await db.select().from(quotes).where(eq(quotes.id, created!.quoteId));
    expect(quoteRow).toBeDefined();
    // $100.00 base: 15% GST = $15.00, then 6.5% compound State Tax on
    // ($100 + $15) = $7.4750 → rounds half-up to $7.48. Total tax = $22.48,
    // matching the FEAT-08 CHANGELOG's own worked example for this exact
    // rate combination, on a quote created via the variation-order path.
    expect(quoteRow!.taxAmount).toBe(2248n);
    expect(quoteRow!.totalAmount).toBe(12248n);
  });
});
