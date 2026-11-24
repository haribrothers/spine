import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema, type PaymentActivityEntry, type PaymentAppliedTo, type PossibleDuplicatePayment, type SearchResponse } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, auditLog, contacts, invoices, journalEntries, journalLines, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService } from "../email/email.service";
import { InvoicesService } from "../invoices/invoices.service";

type Who = { cookie: string; userId: string };
interface PaymentRow {
  id: string;
  number: string;
  date: string;
  amount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  refundedAmount: string;
  moneyAccountName: string | null;
  appliedTo: { invoiceId: string; number: string | null }[];
}
type PaymentDetail = Omit<PaymentRow, "appliedTo"> & { appliedTo: PaymentAppliedTo[] };

/**
 * US-PAY-19 to US-PAY-26 (D-221) — payments you can work from: the page's
 * applied-to and activity, the list's fields and order, the receipt switch,
 * the duplicate check, search, and moving a payment off the wrong invoice
 * (P30). Requires local Postgres.
 */
describe("US-PAY-19 to US-PAY-26 · payments you can work from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let contactId: string;
  let invA: { id: string; number: string | null };
  let invB: { id: string; number: string | null };
  const owner: Who = { cookie: "", userId: "" };
  const noApply: Who = { cookie: "", userId: "" };
  const today = orgClock().date;

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const record = async (body: Record<string, unknown>) => json<PaymentDetail>(await call(owner, "POST", "/payments", { contactId, date: today, method: "upi", currency: "USD", ...body }));

  async function newUser(name: string): Promise<Who> {
    const email = `us-pay-19-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }
  async function issue(amount: string, due: string) {
    const service = testApp.app.get(InvoicesService);
    const draft = await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId, currency: "USD", dueDate: due, lines: [{ name: "Work", quantity: 1, unitPriceAmount: amount }] }));
    const issued = await service.issue(orgId, draft.id, owner.userId);
    return { id: issued.id, number: issued.number };
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(noApply, await newUser("staff"));
    await db.delete(member).where(eq(member.userId, noApply.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: noApply.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, noApply.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "payments.edit_own", granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    const [c] = await db.insert(contacts).values({ orgId, type: "customer", name: "Lakshmi Multispeciality Hospital", email: `lakshmi-${randomUUID()}@example.com`, createdByUserId: owner.userId }).returning();
    contactId = c!.id;
    invA = await issue("120000", "2026-09-01");
    invB = await issue("96000", "2026-09-20");
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  describe("US-PAY-19 and US-PAY-21", () => {
    it("a payment's page lists what it was applied to and what each invoice still owes; the list carries the same, newest first", async () => {
      const older = await record({ date: "2026-01-05", amount: "5000", reference: "OLD-1", allocations: [] });
      const p = await record({ amount: "200000", reference: "Cheque 004512", allocations: [{ invoiceId: invA.id, amount: "120000" }, { invoiceId: invB.id, amount: "42000" }] });

      const detail = await json<PaymentDetail>(await call(owner, "GET", `/payments/${p.id}`));
      expect(detail.unallocatedAmount).toBe("38000");
      expect(detail.appliedTo.map((a) => [a.invoiceNumber, a.amount, a.invoiceBalance, a.invoiceTotal])).toEqual([
        [invA.number, "120000", "0", "120000"],
        [invB.number, "42000", "54000", "96000"],
      ]);

      const list = await json<PaymentRow[]>(await call(owner, "GET", "/payments"));
      const ids = list.map((r) => r.id);
      expect(ids.indexOf(p.id)).toBeLessThan(ids.indexOf(older.id));
      const row = list.find((r) => r.id === p.id)!;
      expect(row.appliedTo.map((a) => a.number)).toEqual([invA.number, invB.number]);
      expect(row.moneyAccountName).toBeTruthy();
      expect(row.refundedAmount).toBe("0");
    });

    it("Field never reaches payments", async () => {
      expect((await call(owner, "GET", "/payments/not-a-uuid/activity")).status).toBe(400);
    });
  });

  describe("US-PAY-20", () => {
    it("Activity says recorded, applied, receipt emailed, moved off and refunded, newest first", async () => {
      vi.spyOn(testApp.app.get(EmailService), "isConfigured").mockReturnValue(true);
      vi.spyOn(testApp.app.get(EmailService) as unknown as { deliver: () => Promise<void> }, "deliver").mockResolvedValue(undefined);
      const inv = await issue("30000", "2026-10-01");
      const p = await record({ amount: "50000", allocations: [{ invoiceId: inv.id, amount: "30000" }] });
      const allocationId = (await json<PaymentDetail>(await call(owner, "GET", `/payments/${p.id}`))).appliedTo[0]!.allocationId;
      await json(await call(owner, "POST", `/payments/${p.id}/allocations/${allocationId}/unapply`, { reason: "Wrong wing" }));
      await json(await call(owner, "POST", "/customer-refunds", { sourcePaymentId: p.id, amount: "1000", date: today, method: "bank_transfer" }));

      const activity = await json<PaymentActivityEntry[]>(await call(owner, "GET", `/payments/${p.id}/activity`));
      const types = activity.map((a) => a.type);
      expect(types).toEqual(expect.arrayContaining(["recorded", "applied", "emailed", "unapplied", "refunded"]));
      expect(activity.find((a) => a.type === "recorded")).toMatchObject({ amount: "50000", detail: "upi", actorName: "owner" });
      expect(activity.find((a) => a.type === "applied")).toMatchObject({ amount: "30000", detail: inv.number, linkId: inv.id, actorName: "owner" });
      expect(activity.find((a) => a.type === "unapplied")).toMatchObject({ amount: "30000", detail: inv.number, reason: "Wrong wing" });
      expect([...activity].sort((a, b) => b.at.localeCompare(a.at)).map((a) => a.at)).toEqual(activity.map((a) => a.at));
      vi.restoreAllMocks();
    });
  });

  describe("US-PAY-23", () => {
    it("sendReceipt: false records the payment without emailing the customer", async () => {
      vi.spyOn(testApp.app.get(EmailService), "isConfigured").mockReturnValue(true);
      const send = vi.spyOn(testApp.app.get(EmailService), "send").mockResolvedValue(undefined);
      const [c] = await db.select({ email: contacts.email }).from(contacts).where(eq(contacts.id, contactId));
      await record({ amount: "700", sendReceipt: false, allocations: [] });
      expect(send.mock.calls.some(([m]) => m.to === c!.email)).toBe(false);
      await record({ amount: "800", allocations: [] });
      expect(send.mock.calls.some(([m]) => m.to === c!.email)).toBe(true);
      vi.restoreAllMocks();
    });
  });

  describe("US-PAY-24", () => {
    it("flags the same customer and amount within 3 days, or the same reference", async () => {
      const p = await record({ date: "2026-08-10", amount: "45000", reference: "UTR 4471 2280", allocations: [] });
      const find = async (q: string) => json<PossibleDuplicatePayment[]>(await call(owner, "GET", `/payments/possible-duplicates?contactId=${contactId}&${q}`));
      expect((await find("amount=45000&date=2026-08-12")).map((d) => d.id)).toContain(p.id);
      expect((await find("amount=45000&date=2026-08-20")).map((d) => d.id)).not.toContain(p.id);
      expect((await find("amount=99&date=2026-12-01&reference=utr%204471%202280")).map((d) => d.id)).toContain(p.id);
      expect((await find("amount=46000&date=2026-08-10")).map((d) => d.id)).not.toContain(p.id);
    });
  });

  describe("US-PAY-25", () => {
    it("search finds payments by receipt number, reference and customer", async () => {
      const p = await record({ amount: "12345", reference: "NEFT ZX9081", allocations: [] });
      for (const q of [p.number, "ZX9081", "Lakshmi Multi"]) {
        const res = await json<SearchResponse>(await call(owner, "GET", `/search?q=${encodeURIComponent(q)}`));
        const group = res.groups.find((g) => g.type === "payments");
        expect(group?.items.map((i) => i.href)).toContain(`/payments/${p.id}`);
      }
    });
  });

  describe("US-PAY-26", () => {
    it("moves a payment off an invoice: P30, the invoice owes it again and the payment has the credit", async () => {
      const inv = await issue("80000", "2026-10-05");
      const p = await record({ amount: "80000", allocations: [{ invoiceId: inv.id, amount: "80000" }] });
      const allocationId = (await json<PaymentDetail>(await call(owner, "GET", `/payments/${p.id}`))).appliedTo[0]!.allocationId;

      expect((await call(noApply, "POST", `/payments/${p.id}/allocations/${allocationId}/unapply`, {})).status).toBe(403);

      const after = await json<PaymentDetail>(await call(owner, "POST", `/payments/${p.id}/allocations/${allocationId}/unapply`, { reason: "Belongs on INV-0040" }));
      expect(after).toMatchObject({ allocatedAmount: "0", unallocatedAmount: "80000" });
      expect(after.appliedTo).toEqual([]);
      const [invoice] = await db.select({ amountPaid: invoices.amountPaid }).from(invoices).where(eq(invoices.id, inv.id));
      expect(invoice!.amountPaid).toBe(0n);

      const lines = await db
        .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit, date: journalEntries.date })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
        .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
        .where(and(eq(journalEntries.sourceType, "payment_unapply"), eq(journalEntries.sourceId, p.id)));
      expect(lines.map((l) => [l.code, l.debit, l.credit]).sort()).toEqual([
        ["1100", 80000n, 0n],
        ["2200", 0n, 80000n],
      ]);
      expect(String(lines[0]!.date).slice(0, 10)).toBe(today);

      const audit = await db.select({ entityType: auditLog.entityType }).from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "unapplied")));
      expect(audit.map((a) => a.entityType)).toEqual(expect.arrayContaining(["payment", "invoice"]));

      // Gone: a second try says so; the credit can be applied again.
      expect((await call(owner, "POST", `/payments/${p.id}/allocations/${allocationId}/unapply`, {})).status).toBe(404);
      await json(await call(owner, "POST", `/payments/${p.id}/apply-credit`, { allocations: [{ invoiceId: inv.id, amount: "80000" }] }));
    });

    it("refuses a deposit invoice", async () => {
      const service = testApp.app.get(InvoicesService);
      const draft = await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId, currency: "USD", type: "advance", lines: [{ name: "Deposit", quantity: 1, unitPriceAmount: "10000" }] }));
      const advance = await service.issue(orgId, draft.id, owner.userId);
      const p = await record({ amount: "10000", allocations: [{ invoiceId: advance.id, amount: "10000" }] });
      const allocationId = (await json<PaymentDetail>(await call(owner, "GET", `/payments/${p.id}`))).appliedTo[0]!.allocationId;
      const res = await call(owner, "POST", `/payments/${p.id}/allocations/${allocationId}/unapply`, {});
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe("A deposit invoice's payment can't be moved off it.");
    });
  });
});
