import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, member, user } from "../../db/schema";
import { InvoicesService } from "./invoices.service";
import { PaymentsService } from "../payments/payments.service";
import { CreditNotesService } from "../credit-notes/credit-notes.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";
import { PeriodsService } from "../ledger/periods.service";
import { QueueService } from "../queue/queue.service";
import { QuoteConversionGuardService } from "../org/quote-conversion-guard.service";
import { SettingsService } from "../org/settings.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PushService } from "../notifications/push.service";
import { PaymentPdfService } from "../pdf/payment-pdf.service";

/**
 * Regression coverage for `GET /invoices/:id/history`, `GET /payments/:id/
 * history`, and `GET /credit-notes/:id/history` — new read endpoints
 * against `AuditLogService.record()`'s existing writes (§9 "no GET /:id/
 * history endpoint for invoices, credit notes, or payments" known gap,
 * now closed). Verifies each `getHistory` correctly scopes to ONE
 * document's own rows via the new `AuditLogService.listForEntity`
 * (entityType+entityId), not `listForContact`'s broader "everything tied
 * to this contact" scope — a contact with an invoice AND a payment must
 * not see the payment's history rows under the invoice's history, or
 * vice versa.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Invoices/Payments/Credit Notes history (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let actorUserId: string;
  let invoicesService: InvoicesService;
  let paymentsService: PaymentsService;
  let creditNotesService: CreditNotesService;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(eq(user.email, createdEmails[0]!));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const auditLog = new AuditLogService(db);
    const numbering = new NumberingService(db);
    const ledger = new LedgerService(db, new PeriodsService(db));
    const taxResolver = new TaxResolverService(db);
    const queue = new QueueService(db);
    const settings = new SettingsService(db);
    const conversionGuard = new QuoteConversionGuardService(db, settings);
    const notifications = new NotificationsService(db, queue, new PushService(db));
    const email = new EmailService();
    const paymentPdf = new PaymentPdfService(db, settings);

    invoicesService = new InvoicesService(db, auditLog, numbering, ledger, queue, conversionGuard, taxResolver);
    paymentsService = new PaymentsService(db, auditLog, numbering, ledger, email, notifications, settings, paymentPdf);
    creditNotesService = new CreditNotesService(db, auditLog, numbering, ledger);

    const ownerEmail = `history-owner-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "History Owner" } });
    actorUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Test Customer" }).returning();
    contactId = contact!.id;
  });

  function invoiceInput() {
    return { contactId, type: "standard" as const, currency: "USD", lines: [] };
  }

  describe("Invoices", () => {
    it("returns creation and update rows, newest first, with the actor's name resolved", async () => {
      const invoice = await invoicesService.create(orgId, actorUserId, invoiceInput());
      await invoicesService.update(orgId, invoice.id, actorUserId, { notes: "Rush order" });

      const history = await invoicesService.getHistory(orgId, invoice.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0]!.action).toBe("updated");
      expect(history[0]!.entityType).toBe("invoice");
      expect(history[0]!.entityId).toBe(invoice.id);
      expect(history[0]!.actorName).toBe("History Owner");
      expect(history[0]!.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: "notes", to: "Rush order" })]));

      const createdRow = history.find((h) => h.action === "created");
      expect(createdRow).toBeDefined();
    });

    it("does not include another invoice's history rows", async () => {
      const invoiceA = await invoicesService.create(orgId, actorUserId, invoiceInput());
      const invoiceB = await invoicesService.create(orgId, actorUserId, invoiceInput());
      await invoicesService.update(orgId, invoiceB.id, actorUserId, { notes: "Only on B" });

      const historyA = await invoicesService.getHistory(orgId, invoiceA.id);
      expect(historyA.every((h) => h.entityId === invoiceA.id)).toBe(true);
      const changesA = historyA.flatMap((h) => (Array.isArray(h.changes) ? (h.changes as { field: string; to: unknown }[]) : []));
      expect(changesA.some((c) => c.to === "Only on B")).toBe(false);
    });

    it("throws NotFoundException for an invoice that doesn't exist in this org", async () => {
      await expect(invoicesService.getHistory(orgId, randomUUID())).rejects.toThrow(/not found/i);
    });
  });

  describe("Payments", () => {
    it("returns the creation row for a payment, scoped to that payment only", async () => {
      const payment = await paymentsService.create(orgId, actorUserId, {
        contactId,
        date: new Date(),
        method: "bank_transfer",
        currency: "USD",
        amount: 500n,
        allocations: [],
      });

      const history = await paymentsService.getHistory(orgId, payment.id);
      expect(history).toHaveLength(1);
      expect(history[0]!.action).toBe("created");
      expect(history[0]!.entityType).toBe("payment");
      expect(history[0]!.entityId).toBe(payment.id);
    });
  });

  describe("Credit Notes", () => {
    it("returns issue history scoped to that credit note only, not the whole contact", async () => {
      const invoice = await invoicesService.create(orgId, actorUserId, {
        ...invoiceInput(),
        lines: [{ type: "item", name: "Service", quantity: 1, unitPriceAmount: 1000n, discountPercentage: 0, taxRatePercentage: 0, isTaxInclusive: false }],
      });
      const issuedInvoice = await invoicesService.issue(orgId, invoice.id, actorUserId);
      const creditNote = await creditNotesService.create(orgId, actorUserId, {
        invoiceId: issuedInvoice.id,
        lines: [{ type: "item", name: "Refund", quantity: 1, unitPriceAmount: 500n, taxRatePercentage: 0 }],
      });
      await creditNotesService.issue(orgId, creditNote.id, actorUserId);

      const history = await creditNotesService.getHistory(orgId, creditNote.id);
      expect(history.every((h) => h.entityType === "credit_note" && h.entityId === creditNote.id)).toBe(true);
      expect(history.some((h) => h.action === "issued")).toBe(true);

      // The invoice's own history must not leak the credit note's rows, and
      // vice versa — confirms listForEntity is scoped by entityType+entityId,
      // not by the shared contactId both documents carry.
      const invoiceHistory = await invoicesService.getHistory(orgId, invoice.id);
      expect(invoiceHistory.every((h) => h.entityType === "invoice")).toBe(true);
    });
  });
});
