import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Capability } from "@spine/shared";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import {
  contacts,
  expenseCategories,
  expenses,
  member,
  teamMemberships,
  teamPrivileges,
  teams,
  user,
  vendorBills,
  vendorPayments,
} from "../../db/schema";
import { ExpensesService } from "./expenses.service";
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

/**
 * Regression coverage for the own/others capability split extended to
 * Purchases (Phase 2): Expenses, Expense Categories, Vendor Bills, Vendor
 * Payments. `expenses.submit`/`purchases.manage` are replaced by four
 * independent own/others capability groups. Approve/reject/record/void
 * stay as separate, dedicated (non-ownership) capabilities — not covered
 * here since they're plain @RequireCapability route gates with no
 * ownership check, same shape as CapabilityGuard's own existing tests.
 *
 * Expenses is the first resource in this pattern where Field has real
 * write access to their OWN records — `fieldAlwaysPassesOwn` in
 * `requireOwnershipCapability` preserves that; see the dedicated Field
 * test below.
 *
 * ExpensesService/VendorBillsService need heavier dependency graphs
 * (NumberingService, LedgerService, InvoicesService, etc.) than the
 * update/delete methods under test actually touch — none of them post to
 * the ledger or touch invoices/notifications, so those collaborators are
 * constructed directly without their lifecycle hooks, same pattern as
 * quotes-ownership.integration.test.ts's QueueService usage.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Purchases ownership split (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let creatorUserId: string;
  let creatorMemberId: string;
  let otherUserId: string;
  let otherMemberId: string;
  let fieldUserId: string;
  let expensesService: ExpensesService;
  let expenseCategoriesService: ExpenseCategoriesService;
  let vendorBillsService: VendorBillsService;
  let vendorPaymentsService: VendorPaymentsService;
  let categoryId: string;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  async function grantTeam(memberId: string, grants: Partial<Record<Capability, boolean>>) {
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    const rows = Object.entries(grants).map(([capability, granted]) => ({
      teamId: team!.id,
      capability: capability as Capability,
      granted: granted ?? false,
    }));
    if (rows.length) {
      await db.insert(teamPrivileges).values(rows);
    }
    return team!.id;
  }

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const auditLog = new AuditLogService(db);
    const numbering = new NumberingService(db);
    const ledger = new LedgerService(db, new PeriodsService(db));
    const taxResolver = new TaxResolverService(db);
    const queue = new QueueService(db);
    const notifications = new NotificationsService(db, queue, new PushService(db));
    const invoices = new InvoicesService(db, auditLog, numbering, ledger, queue, new QuoteConversionGuardService(db, new SettingsService(db)), taxResolver);

    expensesService = new ExpensesService(db, auditLog, numbering, ledger, notifications, invoices, new MoneyAccountsService(db, auditLog));
    expenseCategoriesService = new ExpenseCategoriesService(db, auditLog);
    vendorBillsService = new VendorBillsService(db, auditLog, ledger, taxResolver);
    vendorPaymentsService = new VendorPaymentsService(db, auditLog, numbering, ledger, new MoneyAccountsService(db, auditLog));

    const ownerEmail = `purchases-owner-${randomUUID()}@example.com`;
    const creatorEmail = `purchases-creator-${randomUUID()}@example.com`;
    const otherEmail = `purchases-other-${randomUUID()}@example.com`;
    const fieldEmail = `purchases-field-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, creatorEmail, otherEmail, fieldEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Ownership Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Test Vendor" }).returning();
    contactId = contact!.id;

    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Test Category" }).returning();
    categoryId = category!.id;

    const creator = await auth.api.signUpEmail({ body: { email: creatorEmail, password: "testpassword123", name: "Ownership Creator" } });
    creatorUserId = creator.user.id;
    await db.delete(member).where(eq(member.userId, creator.user.id));
    const [creatorMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: creator.user.id, role: "staff", createdAt: new Date() })
      .returning();
    creatorMemberId = creatorMember!.id;

    const other = await auth.api.signUpEmail({ body: { email: otherEmail, password: "testpassword123", name: "Ownership Other" } });
    otherUserId = other.user.id;
    await db.delete(member).where(eq(member.userId, other.user.id));
    const [otherMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: other.user.id, role: "staff", createdAt: new Date() })
      .returning();
    otherMemberId = otherMember!.id;

    const field = await auth.api.signUpEmail({ body: { email: fieldEmail, password: "testpassword123", name: "Ownership Field" } });
    fieldUserId = field.user.id;
    await db.delete(member).where(eq(member.userId, field.user.id));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.user.id, role: "field", createdAt: new Date() });
  });

  describe("Expenses", () => {
    function expenseInput() {
      return { categoryId, date: new Date(), currency: "USD", amount: 1000n, taxAmount: 0n, paidBy: "company" as const, isBillable: false };
    }

    it("creator with only edit_own can update their own expense but not another user's", async () => {
      await grantTeam(creatorMemberId, { "expenses.edit_own": true });
      const expense = await expensesService.create(orgId, creatorUserId, expenseInput());

      await expect(expensesService.update(orgId, expense.id, creatorUserId, { description: "Edited" })).resolves.toBeDefined();
      await expect(expensesService.update(orgId, expense.id, otherUserId, { description: "Edited by other" })).rejects.toThrow(/missing capability/i);
    });

    it("Field always passes edit_own/delete_own for their own expense, but never edit_others/delete_others", async () => {
      const expense = await expensesService.create(orgId, fieldUserId, expenseInput());

      // Field, no Team grants at all (Field never participates in the Team
      // matrix) — editing/deleting their OWN expense must still succeed.
      await expect(expensesService.update(orgId, expense.id, fieldUserId, { description: "Edited by field" })).resolves.toBeDefined();

      // A different expense created by creatorUserId — Field must NOT be
      // able to touch it, since fieldAlwaysPasses only ever applies to own.
      const othersExpense = await expensesService.create(orgId, creatorUserId, expenseInput());
      await grantTeam(creatorMemberId, { "expenses.edit_own": true });
      await expect(expensesService.update(orgId, othersExpense.id, fieldUserId, { description: "Should fail" })).rejects.toThrow(/missing capability/i);
    });

    it("delete_own vs delete_others are independent of edit_own/edit_others", async () => {
      await grantTeam(creatorMemberId, { "expenses.edit_own": true });
      const expense = await expensesService.create(orgId, creatorUserId, expenseInput());

      await grantTeam(otherMemberId, { "expenses.edit_others": true });
      await expect(expensesService.delete(orgId, expense.id, otherUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "expenses.delete_others": true });
      await expect(expensesService.delete(orgId, expense.id, otherUserId)).resolves.toBeDefined();
    });

    it("Owner bypasses the ownership check entirely, regardless of Team grants", async () => {
      const expense = await expensesService.create(orgId, creatorUserId, expenseInput());
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      await expect(expensesService.update(orgId, expense.id, ownerMembership!.userId, { description: "Edited by owner" })).resolves.toBeDefined();
    });
  });

  describe("Expense Categories", () => {
    it("creator with only edit_own can update their own category but not another user's", async () => {
      await grantTeam(creatorMemberId, { "expense_categories.edit_own": true });
      const category = await expenseCategoriesService.create(orgId, creatorUserId, { name: "Own Category" });

      await expect(expenseCategoriesService.update(orgId, category.id, creatorUserId, { name: "Renamed" })).resolves.toBeDefined();
      await expect(expenseCategoriesService.update(orgId, category.id, otherUserId, { name: "Renamed by other" })).rejects.toThrow(/missing capability/i);
    });

    it("a legacy category with no createdByUserId can only be touched via the _others capability, never _own", async () => {
      const [legacyCategory] = await db.insert(expenseCategories).values({ orgId, name: "Legacy Category", createdByUserId: null }).returning();

      await grantTeam(creatorMemberId, { "expense_categories.edit_own": true });
      await expect(expenseCategoriesService.update(orgId, legacyCategory!.id, creatorUserId, { name: "Attempted edit" })).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "expense_categories.edit_others": true });
      await expect(expenseCategoriesService.update(orgId, legacyCategory!.id, otherUserId, { name: "Successful edit" })).resolves.toBeDefined();
    });
  });

  describe("Vendor Bills", () => {
    function billInput() {
      return { contactId, billNumber: `BILL-${randomUUID().slice(0, 8)}`, date: new Date(), currency: "USD", lines: [] };
    }

    it("creator with only edit_own can update their own bill but not another user's", async () => {
      await grantTeam(creatorMemberId, { "vendor_bills.edit_own": true });
      const bill = await vendorBillsService.create(orgId, creatorUserId, billInput());

      await expect(vendorBillsService.update(orgId, bill.id, creatorUserId, { notes: "Edited" })).resolves.toBeDefined();
      await expect(vendorBillsService.update(orgId, bill.id, otherUserId, { notes: "Edited by other" })).rejects.toThrow(/missing capability/i);
    });

    it("delete_own vs delete_others are independent of edit_own/edit_others", async () => {
      await grantTeam(creatorMemberId, { "vendor_bills.edit_own": true });
      const bill = await vendorBillsService.create(orgId, creatorUserId, billInput());

      await grantTeam(otherMemberId, { "vendor_bills.edit_others": true });
      await expect(vendorBillsService.delete(orgId, bill.id, otherUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "vendor_bills.delete_others": true });
      await expect(vendorBillsService.delete(orgId, bill.id, otherUserId)).resolves.toBeDefined();
    });
  });

  describe("Vendor Payments", () => {
    it("delete_own vs delete_others gate deleting an unallocated vendor payment", async () => {
      const [payment] = await db
        .insert(vendorPayments)
        .values({ orgId, contactId, date: new Date(), method: "bank_transfer", currency: "USD", amount: 500n, createdByUserId: creatorUserId })
        .returning();

      await grantTeam(otherMemberId, { "vendor_payments.delete_own": true });
      await expect(vendorPaymentsService.delete(orgId, payment!.id, otherUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "vendor_payments.delete_others": true });
      await expect(vendorPaymentsService.delete(orgId, payment!.id, otherUserId)).resolves.toBeDefined();
    });

    it("a legacy vendor payment with no createdByUserId can only be touched via the _others capability", async () => {
      const [legacyPayment] = await db
        .insert(vendorPayments)
        .values({ orgId, contactId, date: new Date(), method: "bank_transfer", currency: "USD", amount: 500n, createdByUserId: null })
        .returning();

      await grantTeam(creatorMemberId, { "vendor_payments.delete_own": true });
      await expect(vendorPaymentsService.delete(orgId, legacyPayment!.id, creatorUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "vendor_payments.delete_others": true });
      await expect(vendorPaymentsService.delete(orgId, legacyPayment!.id, otherUserId)).resolves.toBeDefined();
    });
  });
});
