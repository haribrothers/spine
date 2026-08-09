import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { createPaymentSchema } from "@spine/shared";
import { toDecimalString } from "@spine/shared";
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

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * PRD F6 Stage 1 (Phase 2 · Money In) — record a payment against a contact,
 * allocate it across one or more invoices in the same call (S-06.1, S-06.2,
 * S-06.5), or leave it fully/partially unallocated as customer credit
 * (S-06.4). S-06.3 (oldest-first suggestion) is `suggestAllocation` below.
 * Receipt PDF (S-06.6) and the receivables/AR-aging view (S-06.7) are a
 * later stage (see CHANGELOG). `create()` also sends a payment-confirmation
 * email to the paying contact and an in-app + email notification to the
 * org, see its own doc comment.
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
  async suggestAllocation(orgId: string, contactId: string, amount: bigint) {
    const outstanding = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.contactId, contactId), eq(invoices.status, "issued")));

    const withBalance = outstanding
      .map((inv) => ({ invoice: inv, balance: inv.totalAmount - inv.amountPaid }))
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
      const balance = invoice.totalAmount - invoice.amountPaid;
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
      const unallocatedAmount = input.amount - totalAllocated;

      const postingLines = [{ accountId: resolvedBankAccountId, debit: input.amount, credit: 0n, contactId: input.contactId }];
      if (totalAllocated > 0n) {
        postingLines.push({ accountId: arAccountId, debit: 0n, credit: totalAllocated, contactId: input.contactId });
      }
      if (unallocatedAmount > 0n) {
        const advancesAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "customerAdvances");
        postingLines.push({ accountId: advancesAccountId, debit: 0n, credit: unallocatedAmount, contactId: input.contactId });
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

    await this.sendConfirmation(orgId, created!.id, contact, input.amount, totalAllocated);

    return this.getOne(orgId, created!.id);
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
   *  1. A confirmation email direct to the paying contact (S-06.6's own
   *     framing — "so the customer has proof" — read here as a plain-text/
   *     HTML summary rather than a PDF attachment; `PaymentPdfService`
   *     doesn't exist yet, that's the rest of S-06.6, tracked separately
   *     in CHANGELOG). Skipped silently (not an error) if the contact has
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
    const amountText = `${toDecimalString({ amount, currency })} ${currency}`;
    const unallocated = amount - totalAllocated;

    const business = await this.settings.get<{ name?: string }>(orgId, "business_profile");
    const businessName = business?.name || "Spine";

    if (contact.email && this.email.isConfigured()) {
      try {
        const allocationLine =
          totalAllocated > 0n
            ? `${toDecimalString({ amount: totalAllocated, currency })} ${currency} was applied to your invoice${totalAllocated === amount ? "" : "s"}.`
            : null;
        const creditLine =
          unallocated > 0n ? `${toDecimalString({ amount: unallocated, currency })} ${currency} is held as credit on your account.` : null;

        await this.email.send({
          to: contact.email,
          subject: `${businessName} received your payment (${payment.number ?? ""})`.trim(),
          text: [
            `Hi ${contact.name},`,
            "",
            `${businessName} has received your payment of ${amountText}${payment.number ? ` (${payment.number})` : ""}.`,
            ...(allocationLine ? ["", allocationLine] : []),
            ...(creditLine ? ["", creditLine] : []),
            "",
            "This is an automated confirmation — please reply directly with any questions.",
          ].join("\n"),
          html: [
            `<p>Hi ${escapeHtml(contact.name)},</p>`,
            `<p>${escapeHtml(businessName)} has received your payment of ${escapeHtml(amountText)}${payment.number ? ` (${escapeHtml(payment.number)})` : ""}.</p>`,
            ...(allocationLine ? [`<p>${escapeHtml(allocationLine)}</p>`] : []),
            ...(creditLine ? [`<p>${escapeHtml(creditLine)}</p>`] : []),
            `<p style="color:#888;font-size:12px;">This is an automated confirmation — please reply directly with any questions.</p>`,
          ].join("\n"),
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
    if (existing.allocatedAmount > 0n) {
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
