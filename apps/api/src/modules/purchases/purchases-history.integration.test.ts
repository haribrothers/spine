import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, expenseCategories, member, user } from "../../db/schema";
import { ExpensesService } from "./expenses.service";
import { FilesService } from "../files/files.service";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { VendorBillsService } from "./vendor-bills.service";
import { VendorPaymentsService } from "./vendor-payments.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";
import { NotificationsService } from "../notifications/notifications.service";
import { InvoicesService } from "../invoices/invoices.service";
import { QueueService } from "../queue/queue.service";
import { PushService } from "../notifications/push.service";
import { QuoteConversionGuardService } from "../org/quote-conversion-guard.service";
import { SettingsService } from "../org/settings.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { PeriodsService } from "../ledger/periods.service";
import { MoneyAccountsService } from "../banking/money-accounts.service";
import { EmailLogService } from "../email/email-log.service";
import { EmailService } from "../email/email.service";
import { PlaceOfSupplyService } from "../tax/place-of-supply.service";

/**
 * Regression coverage for `GET /expenses/:id/history`,
 * `GET /expense-categories/:id/history`, `GET /vendor-bills/:id/history`,
 * and `GET /vendor-payments/:id/history` — the four Purchases-module
 * resources that already wrote `audit_log` rows via
 * `AuditLogService.record()` but had no read endpoint of their own, same
 * gap as Catalogue/Quotes before catalog-quotes-history.integration.test.ts.
 * Same `AuditLogService.listForEntity` scoping already proven there —
 * asserts entries are scoped to one record and don't leak into a sibling
 * record's history, plus 404 for a nonexistent id.
 *
 * Dependency wiring for each service mirrors
 * purchases-ownership.integration.test.ts exactly (heavier collaborators
 * like NumberingService/LedgerService/InvoicesService constructed directly
 * without their lifecycle hooks, since history reads don't touch them).
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Purchases history (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let actorUserId: string;
  let categoryId: string;
  let expensesService: ExpensesService;
  let expenseCategoriesService: ExpenseCategoriesService;
  let vendorBillsService: VendorBillsService;
  let vendorPaymentsService: VendorPaymentsService;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const auditLog = new AuditLogService(db);
    const numbering = new NumberingService(db);
    const ledger = new LedgerService(db, new PeriodsService(db));
    const taxResolver = new TaxResolverService(db);
    const queue = new QueueService(db);
    const notifications = new NotificationsService(db, new PushService(db), new EmailLogService(db, queue, new EmailService(db), new AuditLogService(db)));
    const invoices = new InvoicesService(db, auditLog, numbering, ledger, queue, new QuoteConversionGuardService(db, new SettingsService(db)), taxResolver, new PlaceOfSupplyService(db), new EmailLogService(db, queue, new EmailService(db), new AuditLogService(db)));

    expensesService = new ExpensesService(db, auditLog, numbering, ledger, notifications, invoices, new MoneyAccountsService(db, auditLog), new FilesService(db));
    expenseCategoriesService = new ExpenseCategoriesService(db, auditLog);
    vendorBillsService = new VendorBillsService(db, auditLog, ledger, taxResolver, new PlaceOfSupplyService(db));
    vendorPaymentsService = new VendorPaymentsService(db, auditLog, numbering, ledger, new MoneyAccountsService(db, auditLog));

    const ownerEmail = `purchases-history-owner-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "History Owner" } });
    actorUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Test Vendor" }).returning();
    contactId = contact!.id;

    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Test Category" }).returning();
    categoryId = category!.id;
  });

  describe("Expenses", () => {
    function expenseInput() {
      return { categoryId, date: new Date(), currency: "USD", amount: 1000n, taxAmount: 0n, paidBy: "company" as const, isBillable: false };
    }

    it("returns creation and update rows scoped to that expense only", async () => {
      const expense = await expensesService.create(orgId, actorUserId, expenseInput());
      await expensesService.update(orgId, expense.id, actorUserId, { description: "Fuel for site visit" });

      const other = await expensesService.create(orgId, actorUserId, expenseInput());
      await expensesService.update(orgId, other.id, actorUserId, { description: "Only on other" });

      const history = await expensesService.getHistory(orgId, expense.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.every((h) => h.entityType === "expense" && h.entityId === expense.id)).toBe(true);
      expect(history.some((h) => h.action === "created")).toBe(true);
      expect(history.some((h) => h.action === "updated")).toBe(true);

      const otherHistory = await expensesService.getHistory(orgId, other.id);
      expect(otherHistory.every((h) => h.entityId === other.id)).toBe(true);
    });

    it("throws NotFoundException for an expense that doesn't exist in this org", async () => {
      await expect(expensesService.getHistory(orgId, randomUUID())).rejects.toThrow(/not found/i);
    });
  });

  describe("Expense Categories", () => {
    it("returns creation and update rows scoped to that category only", async () => {
      const category = await expenseCategoriesService.create(orgId, actorUserId, { name: "Fuel" });
      await expenseCategoriesService.update(orgId, category.id, actorUserId, { name: "Fuel & Tolls" });

      const other = await expenseCategoriesService.create(orgId, actorUserId, { name: "Tools" });
      await expenseCategoriesService.update(orgId, other.id, actorUserId, { name: "Only on other" });

      const history = await expenseCategoriesService.getHistory(orgId, category.id);
      expect(history.every((h) => h.entityType === "expense_category" && h.entityId === category.id)).toBe(true);
      const changes = history.flatMap((h) => (Array.isArray(h.changes) ? (h.changes as { field: string; to: unknown }[]) : []));
      expect(changes.some((c) => c.to === "Only on other")).toBe(false);

      const otherHistory = await expenseCategoriesService.getHistory(orgId, other.id);
      expect(otherHistory.every((h) => h.entityId === other.id)).toBe(true);
    });

    it("throws NotFoundException for a category that doesn't exist in this org", async () => {
      await expect(expenseCategoriesService.getHistory(orgId, randomUUID())).rejects.toThrow(/not found/i);
    });
  });

  describe("Vendor Bills", () => {
    function billInput() {
      return { contactId, billNumber: `BILL-${randomUUID().slice(0, 8)}`, date: new Date(), currency: "USD", lines: [] };
    }

    it("returns creation and update rows scoped to that bill only", async () => {
      const bill = await vendorBillsService.create(orgId, actorUserId, billInput());
      await vendorBillsService.update(orgId, bill.id, actorUserId, { notes: "Confirmed with vendor" });

      const other = await vendorBillsService.create(orgId, actorUserId, billInput());
      await vendorBillsService.update(orgId, other.id, actorUserId, { notes: "Only on other" });

      const history = await vendorBillsService.getHistory(orgId, bill.id);
      expect(history.every((h) => h.entityType === "vendor_bill" && h.entityId === bill.id)).toBe(true);
      expect(history.some((h) => h.action === "created")).toBe(true);

      const otherHistory = await vendorBillsService.getHistory(orgId, other.id);
      expect(otherHistory.every((h) => h.entityId === other.id)).toBe(true);
    });

    it("throws NotFoundException for a vendor bill that doesn't exist in this org", async () => {
      await expect(vendorBillsService.getHistory(orgId, randomUUID())).rejects.toThrow(/not found/i);
    });
  });

  describe("Vendor Payments", () => {
    async function recordedBill(amount: bigint) {
      const bill = await vendorBillsService.create(orgId, actorUserId, {
        contactId,
        billNumber: `BILL-${randomUUID().slice(0, 8)}`,
        date: new Date(),
        currency: "USD",
        lines: [{ type: "item" as const, name: "Materials", quantity: 1, unitPriceAmount: amount, taxRatePercentage: 0, isTaxInclusive: false }],
      });
      return vendorBillsService.record(orgId, bill.id, actorUserId);
    }

    it("returns creation rows scoped to that payment only, and 404s for a nonexistent one", async () => {
      const bill = await recordedBill(500n);
      const otherBill = await recordedBill(750n);

      const payment = await vendorPaymentsService.create(orgId, actorUserId, {
        contactId,
        date: new Date(),
        method: "bank_transfer",
        currency: "USD",
        amount: 500n,
        allocations: [{ billId: bill.id, amount: 500n }],
      });
      const otherPayment = await vendorPaymentsService.create(orgId, actorUserId, {
        contactId,
        date: new Date(),
        method: "bank_transfer",
        currency: "USD",
        amount: 750n,
        allocations: [{ billId: otherBill.id, amount: 750n }],
      });

      const history = await vendorPaymentsService.getHistory(orgId, payment.id);
      expect(history.every((h) => h.entityType === "vendor_payment" && h.entityId === payment.id)).toBe(true);
      expect(history.some((h) => h.action === "created")).toBe(true);

      const otherHistory = await vendorPaymentsService.getHistory(orgId, otherPayment.id);
      expect(otherHistory.every((h) => h.entityId === otherPayment.id)).toBe(true);

      await expect(vendorPaymentsService.getHistory(orgId, randomUUID())).rejects.toThrow(/not found/i);
    });
  });
});
