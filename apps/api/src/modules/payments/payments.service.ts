import { loadEmailBrand } from "../email/email-brand";
import { renderEmail } from "../email/email-layout";
import { paymentConfirmationEmail, receiptEmail } from "../email/email-templates";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { applyPaymentCreditSchema, createPaymentSchema } from "@spine/shared";
import { formatMoney } from "@spine/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { payments, paymentAllocations, invoices, contacts, accounts } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../org/settings.service";
import { IssuedPdfService } from "../pdf/issued-pdf.service";
import { orgLocale } from "../../common/money-format";
import { requireOwnershipCapability } from "../../auth/capability.util";

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ApplyPaymentCreditInput = z.infer<typeof applyPaymentCreditSchema>;

/**
 * PRD F6 Stage 1 (Phase 2 · Money In) — record a payment against a contact,
 * allocate it across one or more invoices in the same call (S-06.1, S-06.2,
 * S-06.5), or leave it fully/partially unallocated as customer credit
 * (S-06.4). S-06.3 (oldest-first suggestion) is `suggestAllocation` below.
 * S-06.6 (receipt PDF): stored when the payment is recorded (US-INV-17,
 * `IssuedPdfService`), served by `GET /payments/:id/pdf` and (re-)emailed
 * via `sendReceiptEmail`.
 * The receivables/AR-aging view (S-06.7) is a later stage (see CHANGELOG).
 * `create()` also sends a payment-confirmation email to the paying contact
 * and an in-app + email notification to the org, see its own doc comment.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly numbering: NumberingService,
    private readonly ledger: LedgerService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly issuedPdf: IssuedPdfService,
  ) {}

  async list(orgId: string, options: { contactId?: string }) {
    const conditions = [eq(payments.orgId, orgId)];
    if (options.contactId) conditions.push(eq(payments.contactId, options.contactId));

    const rows = await this.db
      .select({ payment: payments, contactName: contacts.name })
      .from(payments)
      .leftJoin(contacts, eq(payments.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(asc(payments.date));

    return rows.map((r) => ({
      ...r.payment,
      contactName: r.contactName,
      unallocatedAmount: r.payment.amount - r.payment.allocatedAmount,
    }));
  }

  /**
   * Every payment with at least one allocation against `invoiceId` — backs
   * the invoice detail page's own "Payments" section. A real join through
   * `payment_allocations` (not a `contactId` filter over `list()` above,
   * which would also surface a payment allocated to a DIFFERENT invoice
   * for the same contact, or an unallocated one, neither of which belongs
   * here). Each row's own `amount` is the payment's full amount, not the
   * portion applied to this invoice — `allocatedToThisInvoice` is that
   * specific allocation's amount, since a single payment can legitimately
   * span several invoices (S-06.2) and the page needs to show "how much of
   * this payment applies here", not just "this payment touched this
   * invoice".
   */
  async listForInvoice(orgId: string, invoiceId: string) {
    const rows = await this.db
      .select({ payment: payments, contactName: contacts.name, allocatedToThisInvoice: paymentAllocations.amount })
      .from(paymentAllocations)
      .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
      .leftJoin(contacts, eq(payments.contactId, contacts.id))
      .where(and(eq(payments.orgId, orgId), eq(paymentAllocations.invoiceId, invoiceId)))
      .orderBy(asc(payments.date));

    return rows.map((r) => ({
      ...r.payment,
      contactName: r.contactName,
      unallocatedAmount: r.payment.amount - r.payment.allocatedAmount,
      allocatedToThisInvoice: r.allocatedToThisInvoice,
    }));
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select({ payment: payments, contactName: contacts.name })
      .from(payments)
      .leftJoin(contacts, eq(payments.contactId, contacts.id))
      .where(and(eq(payments.orgId, orgId), eq(payments.id, id)));
    if (!row) {
      throw new NotFoundException("Payment not found");
    }

    const allocations = await this.db
      .select({ allocation: paymentAllocations, invoiceNumber: invoices.number, invoiceTotal: invoices.totalAmount })
      .from(paymentAllocations)
      .leftJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
      .where(eq(paymentAllocations.paymentId, id));

    return {
      ...row.payment,
      contactName: row.contactName,
      unallocatedAmount: row.payment.amount - row.payment.allocatedAmount,
      allocations: allocations.map((a) => ({
        ...a.allocation,
        invoiceNumber: a.invoiceNumber,
        invoiceTotal: a.invoiceTotal,
      })),
    };
  }

  /** `GET /payments/:id/history` — same pattern as InvoicesService.getHistory. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "payment", id);
  }

  /**
   * S-06.3 — suggests an oldest-first allocation of `amount` across every
   * outstanding (`issued`, balance > 0) invoice for `contactId`, oldest
   * `dueDate` first (nulls last — an invoice with no due date set is
   * treated as "no particular urgency" rather than sorted first/last
   * arbitrarily). Pure computation, no writes — the caller (web UI) shows
   * this as a pre-filled starting point the user can still edit before
   * submitting `create()`, matching S-06.3's own wording ("so I usually
   * just confirm" — implying a suggestion, not an automatic commit).
   */
  /**
   * S-04.6 (Phase 3) — every balance computed in this service subtracts
   * `retentionAmount` alongside `amountPaid`/`creditedAmount`: retention is
   * posted to `Retention Receivable`, not `Accounts Receivable` (§7.2
   * "Invoice with retention"), so the retained portion was never part of
   * what a payment can be allocated against in the first place. A
   * zero-retention invoice (every invoice before Phase 3, and any
   * non-construction invoice today) has `retentionAmount = 0n`, so this is
   * a no-op for all pre-existing behavior.
   */
  async suggestAllocation(orgId: string, contactId: string, amount: bigint) {
    const outstanding = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.contactId, contactId), eq(invoices.status, "issued")));

    const withBalance = outstanding
      .map((inv) => ({ invoice: inv, balance: inv.totalAmount - inv.retentionAmount - inv.amountPaid - inv.creditedAmount }))
      .filter((row) => row.balance > 0n)
      .sort((a, b) => {
        if (!a.invoice.dueDate && !b.invoice.dueDate) return a.invoice.createdAt.getTime() - b.invoice.createdAt.getTime();
        if (!a.invoice.dueDate) return 1;
        if (!b.invoice.dueDate) return -1;
        return new Date(a.invoice.dueDate).getTime() - new Date(b.invoice.dueDate).getTime();
      });

    let remaining = amount;
    const suggestions: { invoiceId: string; invoiceNumber: string | null; amount: bigint }[] = [];
    for (const { invoice, balance } of withBalance) {
      if (remaining <= 0n) break;
      const allocate = remaining < balance ? remaining : balance;
      suggestions.push({ invoiceId: invoice.id, invoiceNumber: invoice.number, amount: allocate });
      remaining -= allocate;
    }

    return { allocations: suggestions, unallocatedAmount: remaining };
  }

  /**
   * Records a payment and, in the same transaction, writes its allocation
   * rows and posts the correct §7.2 journal entry:
   *
   * - The allocated portion posts "Payment received" — debit Bank/Cash,
   *   credit Accounts Receivable.
   * - Any unallocated remainder posts "Advance received" — debit
   *   Bank/Cash, credit Customer Advances (S-06.4).
   *
   * A single payment that's partially allocated needs BOTH postings in
   * ONE balanced entry (one Bank/Cash debit line covering the whole
   * payment amount, split across AR/Advances credit lines) rather than two
   * separate entries — the cash actually received is one real-world event,
   * and CLAUDE.md's "one business event -> one balanced journal entry"
   * framing is read here as one entry per payment, not one per §7.2 rule
   * row it happens to touch.
   *
   * `bankAccountId` is caller-supplied (mirrors InvoicesService.issue's
   * own `revenueAccountId` — the org's chart of accounts has multiple
   * cash/bank accounts, code 1000/1010 in the seed, and Stage 1 doesn't
   * assume which one a given payment landed in) — defaults to the seeded
   * "Bank Account" (code 1010) if omitted.
   *
   * Each allocation's amount is validated against the invoice's own
   * remaining balance and the payment's own remaining (unallocated)
   * amount at the app level before the DB's own trigger
   * (0020_payment_allocation_limits.sql) enforces the same invariant as
   * the actual source of truth.
   */
  /**
   * `isDemo` mirrors InvoicesService.create/QuotesService.create's own
   * convention: never client-settable via the controller (which never
   * passes it), exists solely so DemoDataService can tag a seeded payment
   * — the tag is what `deleteAll` selects on to remove exactly the demo
   * rows it created and nothing else. See demo-data.service.ts's
   * `seedInvoices`.
   */
  async create(orgId: string, actorUserId: string, input: CreatePaymentInput, bankAccountId?: string, isDemo = false) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) {
      throw new BadRequestException("Contact not found");
    }

    const totalAllocated = input.allocations.reduce((sum, a) => sum + a.amount, 0n);
    if (totalAllocated > input.amount) {
      throw new BadRequestException("Total allocated amount cannot exceed the payment amount");
    }

    const invoiceIds = input.allocations.map((a) => a.invoiceId);
    const invoiceRows = invoiceIds.length
      ? await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.id, invoiceIds)))
      : [];
    const invoiceById = new Map(invoiceRows.map((row) => [row.id, row]));

    for (const allocation of input.allocations) {
      const invoice = invoiceById.get(allocation.invoiceId);
      if (!invoice) {
        throw new BadRequestException(`Invoice ${allocation.invoiceId} not found`);
      }
      if (invoice.status !== "issued") {
        throw new BadRequestException(`Invoice ${invoice.number ?? invoice.id} is not issued and cannot receive a payment`);
      }
      // US-PAY-13: an advance (deposit) invoice can be paid; see the posting below.
      const balance = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
      if (allocation.amount > balance) {
        throw new BadRequestException(`Allocation of ${allocation.amount} exceeds invoice ${invoice.number}'s remaining balance of ${balance}`);
      }
    }

    const resolvedBankAccountId = bankAccountId ?? (await this.resolveDefaultBankAccount(orgId));

    const created = await this.db.transaction(async (tx) => {
      const number = await this.numbering.allocateNumber(tx, orgId, "receipt");

      const [payment] = await tx
        .insert(payments)
        .values({
          orgId,
          contactId: input.contactId,
          number,
          date: input.date,
          method: input.method,
          reference: input.reference ?? null,
          currency: input.currency,
          amount: input.amount,
          createdByUserId: actorUserId,
          isDemo,
        })
        .returning();

      for (const allocation of input.allocations) {
        await tx.insert(paymentAllocations).values({
          orgId,
          paymentId: payment!.id,
          invoiceId: allocation.invoiceId,
          amount: allocation.amount,
        });
        const invoice = invoiceById.get(allocation.invoiceId)!;
        await tx
          .update(invoices)
          .set({ amountPaid: invoice.amountPaid + allocation.amount, updatedAt: new Date() })
          .where(eq(invoices.id, allocation.invoiceId));
      }

      const arAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "accountsReceivable");
      // P4/P5/P5a: allocations to ordinary invoices clear AR. Everything else
      // — the unallocated part and anything allocated to an advance (deposit)
      // invoice, which never posted to AR — is held in 2200 Customer
      // Advances until it's applied to a later invoice (US-PAY-13, D-075).
      const arAllocated = input.allocations
        .filter((a) => invoiceById.get(a.invoiceId)!.type !== "advance")
        .reduce((sum, a) => sum + a.amount, 0n);
      const heldAsAdvance = input.amount - arAllocated;

      const postingLines = [{ accountId: resolvedBankAccountId, debit: input.amount, credit: 0n, contactId: input.contactId }];
      if (arAllocated > 0n) {
        postingLines.push({ accountId: arAccountId, debit: 0n, credit: arAllocated, contactId: input.contactId });
      }
      if (heldAsAdvance > 0n) {
        const advancesAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "customerAdvances");
        postingLines.push({ accountId: advancesAccountId, debit: 0n, credit: heldAsAdvance, contactId: input.contactId });
      }

      const journalEntryId = await this.ledger.postEntry(tx, {
        orgId,
        date: input.date,
        narration: `Payment ${number} received`,
        sourceType: "payment",
        sourceId: payment!.id,
        lines: postingLines,
      });

      await tx.update(payments).set({ journalEntryId }).where(eq(payments.id, payment!.id));

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "payment",
        entityId: payment!.id,
        contactId: input.contactId,
        changes: [{ field: "amount", from: null, to: input.amount.toString() }],
      });

      return payment;
    });

    // What's still held as credit includes a deposit paid against its advance invoice (US-PAY-13).
    const arAllocatedTotal = input.allocations
      .filter((a) => invoiceById.get(a.invoiceId)!.type !== "advance")
      .reduce((sum, a) => sum + a.amount, 0n);
    await this.sendConfirmation(orgId, created!.id, contact, input.amount, arAllocatedTotal);

    await this.issuedPdf.queueStore(orgId, "payment", created!.id);
    return this.getOne(orgId, created!.id);
  }

  /**
   * S-05.5's other half — applies an existing payment's sitting
   * unallocated credit (S-06.4, sitting in `Customer Advances`, account
   * 2200) against one or more invoices that weren't available (or weren't
   * chosen) when the payment was first recorded. Posts §7.2's "Advance
   * applied to invoice" row — debit Customer Advances, credit Accounts
   * Receivable — a genuinely different journal entry from `create()`'s own
   * "Payment received"/"Advance received" postings, since no new cash
   * changes hands here; money that already sits in Customer Advances is
   * simply being reclassified against a specific invoice's balance.
   *
   * Same validation shape as `create()`'s own allocation loop (invoice
   * must be `issued`, allocation can't exceed the invoice's remaining
   * balance) plus one more: the total requested can't exceed the
   * payment's own `unallocatedAmount` — there's no cash to draw beyond
   * what's actually sitting as credit.
   */
  async applyCredit(orgId: string, actorUserId: string, paymentId: string, input: ApplyPaymentCreditInput) {
    const [payment] = await this.db.select().from(payments).where(and(eq(payments.orgId, orgId), eq(payments.id, paymentId)));
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    const unallocated = payment.amount - payment.allocatedAmount;
    const totalRequested = input.allocations.reduce((sum, a) => sum + a.amount, 0n);
    if (totalRequested > unallocated) {
      throw new BadRequestException(`Requested ${totalRequested} exceeds this payment's unallocated credit of ${unallocated}`);
    }

    const invoiceIds = input.allocations.map((a) => a.invoiceId);
    const invoiceRows = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.id, invoiceIds)));
    const invoiceById = new Map(invoiceRows.map((row) => [row.id, row]));

    for (const allocation of input.allocations) {
      const invoice = invoiceById.get(allocation.invoiceId);
      if (!invoice) {
        throw new BadRequestException(`Invoice ${allocation.invoiceId} not found`);
      }
      if (invoice.status !== "issued") {
        throw new BadRequestException(`Invoice ${invoice.number ?? invoice.id} is not issued and cannot receive a payment`);
      }
      if (invoice.type === "advance") {
        throw new BadRequestException(
          `Invoice ${invoice.number ?? invoice.id} is an advance/deposit invoice — it never posts to Accounts Receivable, so credit can't be applied to it.`,
        );
      }
      const balance = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
      if (allocation.amount > balance) {
        throw new BadRequestException(`Allocation of ${allocation.amount} exceeds invoice ${invoice.number}'s remaining balance of ${balance}`);
      }
    }

    await this.db.transaction(async (tx) => {
      for (const allocation of input.allocations) {
        await tx.insert(paymentAllocations).values({
          orgId,
          paymentId: payment.id,
          invoiceId: allocation.invoiceId,
          amount: allocation.amount,
        });
        const invoice = invoiceById.get(allocation.invoiceId)!;
        await tx
          .update(invoices)
          .set({ amountPaid: invoice.amountPaid + allocation.amount, updatedAt: new Date() })
          .where(eq(invoices.id, allocation.invoiceId));
      }

      await tx
        .update(payments)
        .set({ allocatedAmount: payment.allocatedAmount + totalRequested, updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      const advancesAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "customerAdvances");
      const arAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "accountsReceivable");

      await this.ledger.postEntry(tx, {
        orgId,
        date: new Date(),
        narration: `Credit from payment ${payment.number ?? payment.id} applied to invoice(s)`,
        sourceType: "payment_credit_applied",
        sourceId: payment.id,
        lines: [
          { accountId: advancesAccountId, debit: totalRequested, credit: 0n, contactId: payment.contactId },
          { accountId: arAccountId, debit: 0n, credit: totalRequested, contactId: payment.contactId },
        ],
      });

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "updated",
        entityType: "payment",
        entityId: payment.id,
        contactId: payment.contactId,
        changes: [{ field: "allocatedAmount", from: payment.allocatedAmount.toString(), to: (payment.allocatedAmount + totalRequested).toString() }],
      });
    });

    return this.getOne(orgId, paymentId);
  }

  /**
   * Fires after `create()`'s transaction has committed — the payment and
   * its ledger posting are already durable, so neither delivery channel
   * failing may ever undo or block what already happened (same posture as
   * `QuotesService.send()`'s own email enqueue and every
   * `NotificationsService.notify()` call elsewhere in this codebase).
   * Never throws.
   *
   * Two independent channels, matching what was actually asked for:
   *  1. A confirmation email direct to the paying contact — a plain-text/
   *     HTML summary, deliberately without the receipt PDF attached (the
   *     PDF is a render-on-demand action via `sendReceiptEmail`/
   *     `GET :id/pdf` instead, so a slow PDF render never blocks or risks
   *     failing the payment-creation transaction's own post-commit
   *     confirmation). Skipped silently (not an error) if the contact has
   *     no email on file or SMTP isn't configured — graceful degradation,
   *     not a hard requirement to record the payment.
   *  2. An org notification via the existing, already-generic
   *     `NotificationsService.notify()` (email to owner/staff + an in-app
   *     row) — the same primitive S-03.7's quote-viewed/accepted
   *     notifications already use, extended here to a new "payment
   *     received" event type rather than inventing a parallel mechanism.
   */
  private async sendConfirmation(
    orgId: string,
    paymentId: string,
    contact: { id: string; name: string; email: string | null },
    amount: bigint,
    totalAllocated: bigint,
  ): Promise<void> {
    const [payment] = await this.db.select().from(payments).where(eq(payments.id, paymentId));
    if (!payment) return; // shouldn't happen — just committed — but never let a confirmation failure surface as a real error

    const currency = payment.currency;
    const amountText = formatMoney(amount, currency, await orgLocale(this.db, orgId));
    if (contact.email && this.email.isConfigured()) {
      try {
        const brand = await loadEmailBrand(this.db, orgId);
        const template = paymentConfirmationEmail({
          businessName: brand.name,
          locale: brand.locale,
          contactName: contact.name,
          number: payment.number,
          amount,
          applied: totalAllocated,
          currency,
        });
        const email = renderEmail(brand, template.content);
        await this.email.send({
          to: contact.email,
          fromName: brand.name,
          subject: template.subject,
          text: email.text,
          html: email.html,
          attachments: email.attachments,
        });
      } catch (err) {
        this.logger.warn(`Could not send payment confirmation email for payment ${paymentId}: ${(err as Error).message}`);
      }
    }

    void this.notifications.notify(orgId, {
      subject: `Payment received from ${contact.name}`,
      text: `${contact.name} paid ${amountText}${payment.number ? ` (${payment.number})` : ""}.`,
      recipientRoles: ["owner", "staff"],
      inApp: {
        type: "payment_received",
        message: `${contact.name} paid ${amountText}.`,
        link: `/payments/${paymentId}`,
      },
    });
  }

  /**
   * S-06.6 — sends (or re-sends) the receipt PDF to the paying contact on
   * demand, as a separate action from `create()`'s own automatic
   * plain-text confirmation (which fires once, at creation time, and never
   * carries an attachment). Synchronous rather than queued — unlike
   * InvoiceEmailWorker, a receipt is a short, low-volume, user-initiated
   * action (a single "resend receipt" click), not something issued in bulk
   * or needing pg-boss's retry/backoff; mirrors how `sendConfirmation`
   * itself already sends synchronously inline in `create()`.
   */
  async sendReceiptEmail(orgId: string, paymentId: string): Promise<{ sent: boolean }> {
    const [row] = await this.db
      .select({ payment: payments, contactName: contacts.name, contactEmail: contacts.email })
      .from(payments)
      .leftJoin(contacts, eq(payments.contactId, contacts.id))
      .where(and(eq(payments.orgId, orgId), eq(payments.id, paymentId)));
    if (!row) {
      throw new NotFoundException("Payment not found");
    }
    if (!row.contactEmail) {
      throw new BadRequestException("This contact has no email address on file — cannot send a receipt");
    }
    if (!this.email.isConfigured()) {
      throw new BadRequestException("SMTP is not configured — cannot send a receipt");
    }

    // US-INV-17: the receipt PDF stored when the payment was recorded.
    const { buffer, filename } = await this.issuedPdf.forEmail(orgId, "payment", paymentId);
    const brand = await loadEmailBrand(this.db, orgId);
    const template = receiptEmail({
      businessName: brand.name,
      locale: brand.locale,
      contactName: row.contactName,
      number: row.payment.number ?? "your receipt",
      amount: row.payment.amount,
      currency: row.payment.currency,
    });
    const email = renderEmail(brand, template.content);
    await this.email.send({
      to: row.contactEmail,
      fromName: brand.name,
      subject: template.subject,
      text: email.text,
      html: email.html,
      attachments: [{ filename, content: buffer, contentType: "application/pdf" }, ...email.attachments],
    });

    return { sent: true };
  }

  /**
   * A payment with no allocations can be deleted (correcting a mis-entry
   * before it's touched anything else) — this reverses its journal entry
   * via `LedgerService.reverseEntry` rather than deleting the entry itself
   * (journal_entries/journal_lines are immutable at the DB level
   * regardless). A payment with any allocation is permanent, matching
   * CLAUDE.md's posture on posted financial events — unwinding an
   * allocated payment would need to also roll back the invoices it
   * touched, which is real scope no S-06.x story asks for in Stage 1.
   */
  async delete(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(payments).where(and(eq(payments.orgId, orgId), eq(payments.id, id)));
    if (!existing) {
      throw new NotFoundException("Payment not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "payments.delete_own",
      others: "payments.delete_others",
    });
    // Any allocation, including one to an advance invoice (which doesn't count
    // towards allocatedAmount, US-PAY-13), makes the payment part of history.
    const [allocation] = await this.db.select({ id: paymentAllocations.id }).from(paymentAllocations).where(eq(paymentAllocations.paymentId, id)).limit(1);
    if (existing.allocatedAmount > 0n || allocation) {
      throw new BadRequestException("Cannot delete a payment that has been allocated to an invoice");
    }

    await this.db.transaction(async (tx) => {
      if (existing.journalEntryId) {
        await this.ledger.reverseEntry(tx, existing.journalEntryId, {
          orgId,
          date: new Date(),
          narration: `Payment ${existing.number} deleted`,
          sourceType: "payment_delete",
          sourceId: id,
        });
      }

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "payment",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "amount", from: existing.amount.toString(), to: null }],
      });

      await tx.delete(payments).where(eq(payments.id, id));
    });

    return { id };
  }

  /** Defaults to the seeded "Bank Account" (code 1010) — see create()'s own doc comment on why bankAccountId is caller-overridable. */
  private async resolveDefaultBankAccount(orgId: string): Promise<string> {
    const [row] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, "1010")));
    if (!row) {
      throw new BadRequestException(
        "No bank account found (expected code 1010, 'Bank Account'). Pass bankAccountId explicitly or restore this account.",
      );
    }
    return row.id;
  }
}
