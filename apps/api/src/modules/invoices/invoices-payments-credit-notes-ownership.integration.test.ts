import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Capability } from "@spine/shared";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, member, payments, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
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
 * Regression coverage for the own/others capability split extended to
 * Invoices, Payments, and Credit Notes (Phase 4, the final phase of the
 * PRD §9 rollout): `invoices.manage` is replaced by three independent
 * own/others capability groups. Workflow actions (issue/void/send/
 * send_reminder/apply_credit/send_receipt) are plain @RequireCapability
 * route gates with no per-record ownership check, so they're not covered
 * here — same scoping precedent as every prior phase's own test file.
 * Payments has no update route at all, so only its delete_own/delete_others
 * pair is exercised, mirroring vendor-payments' own precedent.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Invoices/Payments/Credit Notes ownership split (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let creatorUserId: string;
  let creatorMemberId: string;
  let otherUserId: string;
  let otherMemberId: string;
  let invoicesService: InvoicesService;
  let paymentsService: PaymentsService;
  let creditNotesService: CreditNotesService;

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
    const settings = new SettingsService(db);
    const conversionGuard = new QuoteConversionGuardService(db, settings);
    const notifications = new NotificationsService(db, queue, new PushService(db));
    const email = new EmailService();
    const paymentPdf = new PaymentPdfService(db, settings);

    invoicesService = new InvoicesService(db, auditLog, numbering, ledger, queue, conversionGuard, taxResolver);
    paymentsService = new PaymentsService(db, auditLog, numbering, ledger, email, notifications, settings, paymentPdf);
    creditNotesService = new CreditNotesService(db, auditLog, numbering, ledger);

    const ownerEmail = `ipc-owner-${randomUUID()}@example.com`;
    const creatorEmail = `ipc-creator-${randomUUID()}@example.com`;
    const otherEmail = `ipc-other-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, creatorEmail, otherEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Ownership Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Test Customer" }).returning();
    contactId = contact!.id;

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
  });

  function invoiceInput() {
    return { contactId, type: "standard" as const, currency: "USD", lines: [] };
  }

  describe("Invoices", () => {
    it("creator with only edit_own can update their own draft invoice but not another user's", async () => {
      await grantTeam(creatorMemberId, { "invoices.edit_own": true });
      const invoice = await invoicesService.create(orgId, creatorUserId, invoiceInput());

      await expect(invoicesService.update(orgId, invoice.id, creatorUserId, { notes: "Edited" })).resolves.toBeDefined();
      await expect(invoicesService.update(orgId, invoice.id, otherUserId, { notes: "Edited by other" })).rejects.toThrow(/missing capability/i);
    });

    it("ownership check runs before the draft-only status check — a non-owner gets 403, not 400, on a non-draft invoice", async () => {
      await grantTeam(creatorMemberId, { "invoices.edit_own": true, "invoices.issue": true });
      const invoice = await invoicesService.create(orgId, creatorUserId, {
        ...invoiceInput(),
        lines: [{ type: "item", name: "Service", quantity: 1, unitPriceAmount: 1000n, discountPercentage: 0, taxRatePercentage: 0, isTaxInclusive: false }],
      });
      await invoicesService.issue(orgId, invoice.id, creatorUserId);

      // otherUserId has zero grants — must be rejected for missing
      // capability (403), not "only a draft can be edited" (400), even
      // though the invoice is also no longer a draft.
      await expect(invoicesService.update(orgId, invoice.id, otherUserId, { notes: "x" })).rejects.toThrow(/missing capability/i);
    });

    it("delete_own vs delete_others are independent of edit_own/edit_others", async () => {
      await grantTeam(creatorMemberId, { "invoices.edit_own": true });
      const invoice = await invoicesService.create(orgId, creatorUserId, invoiceInput());

      await grantTeam(otherMemberId, { "invoices.edit_others": true });
      await expect(invoicesService.delete(orgId, invoice.id, otherUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "invoices.delete_others": true });
      await expect(invoicesService.delete(orgId, invoice.id, otherUserId)).resolves.toBeDefined();
    });

    it("Owner bypasses the ownership check entirely, regardless of Team grants", async () => {
      const invoice = await invoicesService.create(orgId, creatorUserId, invoiceInput());
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      await expect(invoicesService.update(orgId, invoice.id, ownerMembership!.userId, { notes: "Edited by owner" })).resolves.toBeDefined();
    });
  });

  describe("Payments", () => {
    it("delete_own vs delete_others gate deleting an unallocated payment", async () => {
      const [payment] = await db
        .insert(payments)
        .values({ orgId, contactId, date: new Date(), method: "bank_transfer", currency: "USD", amount: 500n, createdByUserId: creatorUserId })
        .returning();

      await grantTeam(otherMemberId, { "payments.delete_own": true });
      await expect(paymentsService.delete(orgId, payment!.id, otherUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "payments.delete_others": true });
      await expect(paymentsService.delete(orgId, payment!.id, otherUserId)).resolves.toBeDefined();
    });

    it("a legacy payment with no createdByUserId can only be touched via the _others capability, never _own", async () => {
      const [legacyPayment] = await db
        .insert(payments)
        .values({ orgId, contactId, date: new Date(), method: "bank_transfer", currency: "USD", amount: 500n, createdByUserId: null })
        .returning();

      await grantTeam(creatorMemberId, { "payments.delete_own": true });
      await expect(paymentsService.delete(orgId, legacyPayment!.id, creatorUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "payments.delete_others": true });
      await expect(paymentsService.delete(orgId, legacyPayment!.id, otherUserId)).resolves.toBeDefined();
    });
  });

  describe("Credit Notes", () => {
    async function issuedInvoice() {
      const invoice = await invoicesService.create(orgId, creatorUserId, {
        ...invoiceInput(),
        lines: [{ type: "item", name: "Service", quantity: 1, unitPriceAmount: 1000n, discountPercentage: 0, taxRatePercentage: 0, isTaxInclusive: false }],
      });
      return invoicesService.issue(orgId, invoice.id, creatorUserId);
    }

    it("creator with only edit_own can update their own draft credit note but not another user's", async () => {
      await grantTeam(creatorMemberId, { "invoices.edit_own": true, "invoices.issue": true, "credit_notes.edit_own": true });
      const invoice = await issuedInvoice();
      const creditNote = await creditNotesService.create(orgId, creatorUserId, { invoiceId: invoice.id, lines: [] });

      await expect(creditNotesService.update(orgId, creditNote.id, creatorUserId, { reason: "Edited" })).resolves.toBeDefined();
      await expect(creditNotesService.update(orgId, creditNote.id, otherUserId, { reason: "Edited by other" })).rejects.toThrow(/missing capability/i);
    });

    it("delete_own vs delete_others are independent of edit_own/edit_others", async () => {
      await grantTeam(creatorMemberId, { "invoices.edit_own": true, "invoices.issue": true, "credit_notes.edit_own": true });
      const invoice = await issuedInvoice();
      const creditNote = await creditNotesService.create(orgId, creatorUserId, { invoiceId: invoice.id, lines: [] });

      await grantTeam(otherMemberId, { "credit_notes.edit_others": true });
      await expect(creditNotesService.delete(orgId, creditNote.id, otherUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "credit_notes.delete_others": true });
      await expect(creditNotesService.delete(orgId, creditNote.id, otherUserId)).resolves.toBeDefined();
    });

    it("Owner bypasses the ownership check entirely, regardless of Team grants", async () => {
      const invoice = await issuedInvoice();
      const creditNote = await creditNotesService.create(orgId, creatorUserId, { invoiceId: invoice.id, lines: [] });
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      await expect(
        creditNotesService.update(orgId, creditNote.id, ownerMembership!.userId, { reason: "Edited by owner" }),
      ).resolves.toBeDefined();
    });
  });
});
