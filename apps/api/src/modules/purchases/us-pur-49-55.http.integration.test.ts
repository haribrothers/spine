import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PossibleDuplicateVendorPayment, VendorBillActivityEntry, VendorPaymentActivityEntry, VendorPaymentsSummary } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { bankReconciliations, bankStatementImports, bankStatementLineMatches, bankStatementLines, contacts, journalEntries, journalLines, member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService } from "../email/email.service";

type Who = { cookie: string; userId: string };

/**
 * US-PUR-49 to US-PUR-55 (D-229) — a vendor payment's page data and
 * Activity, deleting an allocated payment (refused once reconciled), the
 * list's cards and rows, the same-payment warning, the remittance advice
 * and search. Requires local Postgres.
 */
describe("US-PUR-49 to US-PUR-55 · vendor payments you can work from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let vendorId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const today = new Date().toISOString().slice(0, 10);

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
  const bill = async (billNumber: string, amount: string, dueDate = "2025-01-15") => {
    const created = await json<{ id: string }>(
      await call(owner, "POST", "/vendor-bills", { contactId: vendorId, billNumber, date: "2025-01-01", dueDate, currency: "USD", lines: [{ type: "item", name: "JCB hire", quantity: 1, unitPriceAmount: amount }] }),
    );
    await json(await call(owner, "POST", `/vendor-bills/${created.id}/record`));
    return created;
  };
  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const newUser = async (name: string) => {
      const email = `us-pur-49-${name.split(" ")[0]!.toLowerCase()}-${randomUUID()}@example.com`;
      emails.push(email);
      return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
    };
    Object.assign(owner, await newUser("Priya Raman"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(field, await newUser("Marcus Webb"));
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Ridgeline Equipment Rentals", email: "accounts@ridgeline.example", createdByUserId: owner.userId }).returning();
    vendorId = vendor!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-PUR-49, US-PUR-51: the page shows what it paid and its Activity; the list names the bills, newest first", async () => {
    const a = await bill("RTE-3302", "40000", "2025-01-10");
    const b = await bill("RTE-3340", "23600", "2025-02-01");
    const older = await json<{ id: string }>(await call(owner, "POST", "/vendor-payments", { contactId: vendorId, date: "2025-03-01", method: "cash", currency: "USD", amount: "1000", allocations: [{ billId: b.id, amount: "1000" }] }));
    const payment = await json<{ id: string; number: string }>(
      await call(owner, "POST", "/vendor-payments", { contactId: vendorId, date: today, method: "bank_transfer", reference: "NEFT 4471", currency: "USD", amount: "48000", allocations: [{ billId: a.id, amount: "40000" }, { billId: b.id, amount: "8000" }] }),
    );

    const page = await json<{ paidTo: { billNumber: string; amount: string; billBalance: string; dueDate: string | null }[]; reconciled: boolean }>(await call(owner, "GET", `/vendor-payments/${payment.id}`));
    expect(page.reconciled).toBe(false);
    expect(page.paidTo).toEqual([
      expect.objectContaining({ billNumber: "RTE-3302", amount: "40000", billBalance: "0", dueDate: "2025-01-10" }),
      expect.objectContaining({ billNumber: "RTE-3340", amount: "8000", billBalance: "14600", dueDate: "2025-02-01" }),
    ]);

    const activity = await json<VendorPaymentActivityEntry[]>(await call(owner, "GET", `/vendor-payments/${payment.id}/activity`));
    expect(activity.map((e) => e.type)).toEqual(["applied", "applied", "recorded"]);
    expect(activity[2]).toMatchObject({ amount: "48000", actorName: "Priya Raman", method: "bank_transfer" });
    expect(activity.filter((e) => e.type === "applied").map((e) => e.detail).sort()).toEqual(["RTE-3302", "RTE-3340"]);

    const rows = await json<{ id: string; paidTo: { number: string }[]; moneyAccountName: string | null }[]>(await call(owner, "GET", "/vendor-payments"));
    expect(rows.findIndex((r) => r.id === payment.id)).toBeLessThan(rows.findIndex((r) => r.id === older.id));
    expect(rows.find((r) => r.id === payment.id)!.paidTo.map((p) => p.number)).toEqual(["RTE-3302", "RTE-3340"]);
    expect(rows.find((r) => r.id === payment.id)!.moneyAccountName).toBeTruthy();

    // Field never reaches it.
    expect((await call(field, "GET", `/vendor-payments/${payment.id}`)).status).toBe(403);
  });

  it("US-PUR-51: the cards — paid this month and last, and overdue bills to pay", async () => {
    const summary = await json<VendorPaymentsSummary>(await call(owner, "GET", "/vendor-payments/summary"));
    expect(summary.currency).toBe("USD");
    expect(BigInt(summary.paidThisMonth)).toBeGreaterThanOrEqual(48000n);
    expect(summary.paidThisMonthCount).toBeGreaterThanOrEqual(1);
    // RTE-3340 still owes 14,600 and is long overdue.
    expect(BigInt(summary.toPay)).toBe(14600n);
    expect(summary.toPayCount).toBe(1);
  });

  it("US-PUR-50: deleting an allocated payment puts the bills' balances back, reverses its entry and tells the bills", async () => {
    const c = await bill("RTE-3355", "11800");
    const payment = await json<{ id: string; number: string; journalEntryId: string }>(
      await call(owner, "POST", "/vendor-payments", { contactId: vendorId, date: today, method: "upi", currency: "USD", amount: "11800", allocations: [{ billId: c.id, amount: "11800" }] }),
    );
    expect((await json<{ balanceDue: string }>(await call(owner, "GET", `/vendor-bills/${c.id}`))).balanceDue).toBe("0");

    const deleted = await json<{ id: string; number: string }>(await call(owner, "DELETE", `/vendor-payments/${payment.id}`));
    expect(deleted.number).toBe(payment.number);
    expect((await json<{ balanceDue: string }>(await call(owner, "GET", `/vendor-bills/${c.id}`))).balanceDue).toBe("11800");
    expect((await call(owner, "GET", `/vendor-payments/${payment.id}`)).status).toBe(404);
    const reversal = await db.select().from(journalEntries).where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.sourceType, "vendor_payment_delete"), eq(journalEntries.sourceId, payment.id)));
    expect(reversal).toHaveLength(1);

    const billActivity = await json<VendorBillActivityEntry[]>(await call(owner, "GET", `/vendor-bills/${c.id}/activity`));
    expect(billActivity[0]).toMatchObject({ type: "payment_deleted", amount: "11800", detail: payment.number });
    expect(billActivity.find((e) => e.type === "paid")).toMatchObject({ amount: "11800", detail: payment.number });
  });

  it("US-PUR-50: a payment matched to a bank statement line can't be deleted until it's unmatched", async () => {
    const d = await bill("RTE-3360", "5000");
    const payment = await json<{ id: string; number: string; journalEntryId: string; moneyAccountId: string }>(
      await call(owner, "POST", "/vendor-payments", { contactId: vendorId, date: today, method: "bank_transfer", currency: "USD", amount: "5000", allocations: [{ billId: d.id, amount: "5000" }] }),
    );
    const [imported] = await db.insert(bankStatementImports).values({ orgId, moneyAccountId: payment.moneyAccountId, fileName: "hdfc.csv", importedCount: 1, skippedCount: 0 } as never).returning();
    const [rec] = await db.insert(bankReconciliations).values({ orgId, moneyAccountId: payment.moneyAccountId, statementEndDate: today, statementClosingBalance: 0n } as never).returning();
    const [line] = await db
      .insert(bankStatementLines)
      .values({ orgId, moneyAccountId: payment.moneyAccountId, importId: imported!.id, date: today, description: "NEFT RIDGELINE", amount: -5000n, dedupeKey: randomUUID(), status: "matched", reconciliationId: rec!.id })
      .returning();
    const [bankLine] = await db.select().from(journalLines).where(and(eq(journalLines.entryId, payment.journalEntryId)));
    await db.insert(bankStatementLineMatches).values({ statementLineId: line!.id, journalLineId: bankLine!.id, reconciliationId: rec!.id } as never);

    expect((await json<{ reconciled: boolean }>(await call(owner, "GET", `/vendor-payments/${payment.id}`))).reconciled).toBe(true);
    const refused = await call(owner, "DELETE", `/vendor-payments/${payment.id}`);
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain(`${payment.number} is matched to a bank statement line. Unmatch it in Banking first, then delete it.`);
    expect((await json<{ balanceDue: string }>(await call(owner, "GET", `/vendor-bills/${d.id}`))).balanceDue).toBe("0");
  });

  it("US-PUR-53: the same vendor and amount within 3 days, or the same reference, is flagged", async () => {
    const q = (amount: string, date: string, reference = "") => call(owner, "GET", `/vendor-payments/possible-duplicates?contactId=${vendorId}&amount=${amount}&date=${date}&reference=${encodeURIComponent(reference)}`);
    const near = await json<PossibleDuplicateVendorPayment[]>(await q("48000", today));
    expect(near.map((p) => p.amount)).toContain("48000");
    expect(await json<PossibleDuplicateVendorPayment[]>(await q("48001", today))).toEqual([]);
    const byRef = await json<PossibleDuplicateVendorPayment[]>(await q("99999", "2020-01-01", " neft 4471 "));
    expect(byRef[0]).toMatchObject({ reference: "NEFT 4471", method: "bank_transfer" });
  });

  it("US-PUR-54: the remittance advice downloads as a PDF and emails the vendor with it attached", async () => {
    const [payment] = (await json<{ id: string; number: string; paidTo: unknown[] }[]>(await call(owner, "GET", "/vendor-payments"))).filter((p) => p.paidTo.length === 2);
    const pdf = await call(owner, "GET", `/vendor-payments/${payment!.id}/remittance.pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    expect(pdf.headers.get("content-disposition")).toContain(`remittance-${payment!.number}.pdf`);

    const draft = await json<{ to: string | null; subject: string; body: string }>(await call(owner, "GET", `/vendor-payments/${payment!.id}/remittance/draft`));
    expect(draft.to).toBe("accounts@ridgeline.example");
    expect(draft.subject).toContain(`Remittance advice — ${payment!.number}`);
    expect(draft.body).toContain("against your RTE-3302");

    const emailService = testApp.app.get(EmailService);
    vi.spyOn(emailService, "isConfigured").mockReturnValue(true);
    const sent = vi.spyOn(emailService, "send").mockResolvedValue();
    await json(await call(owner, "POST", `/vendor-payments/${payment!.id}/remittance/send`, { to: draft.to, subject: draft.subject, body: draft.body }));
    // Only the remittance counts: the app's own queue may send another email (e.g. a receipt queued
    // earlier in this file) while the spy is on.
    const remittances = sent.mock.calls.filter(([email]) => email.log?.kind === "remittance");
    expect(remittances).toHaveLength(1);
    const args = remittances[0]![0];
    expect(args.to).toBe("accounts@ridgeline.example");
    expect(args.attachments?.some((a) => a.filename === `remittance-${payment!.number}.pdf`)).toBe(true);
    expect(args.log).toMatchObject({ kind: "remittance", entityType: "vendor_payment", entityId: payment!.id });
    const activity = await json<VendorPaymentActivityEntry[]>(await call(owner, "GET", `/vendor-payments/${payment!.id}/activity`));
    expect(activity[0]).toMatchObject({ type: "remittance_emailed", detail: "accounts@ridgeline.example" });

    // A bad address stays in the dialog; without email set up it says so.
    expect((await call(owner, "POST", `/vendor-payments/${payment!.id}/remittance/send`, { to: "nope", subject: "x", body: "y" })).status).toBe(400);
    vi.spyOn(emailService, "isConfigured").mockReturnValue(false);
    expect((await call(owner, "POST", `/vendor-payments/${payment!.id}/remittance/send`, { to: draft.to, subject: "x", body: "y" })).status).toBe(503);
    vi.restoreAllMocks();
  });

  it("US-PUR-55: search finds a vendor payment by number or reference; Field gets no group", async () => {
    const [payment] = await json<{ id: string; number: string }[]>(await call(owner, "GET", "/vendor-payments"));
    const groups = (await json<{ groups: { type: string; items: { href: string }[] }[] }>(await call(owner, "GET", `/search?q=${encodeURIComponent(payment!.number)}`))).groups;
    expect(groups.find((g) => g.type === "vendor_payments")!.items[0]!.href).toBe(`/vendor-payments/${payment!.id}`);
    const byRef = (await json<{ groups: { type: string }[] }>(await call(owner, "GET", "/search?q=NEFT%204471"))).groups;
    expect(byRef.some((g) => g.type === "vendor_payments")).toBe(true);
    const asField = (await json<{ groups: { type: string }[] }>(await call(field, "GET", `/search?q=${encodeURIComponent(payment!.number)}`))).groups;
    expect(asField.some((g) => g.type === "vendor_payments")).toBe(false);
  });
});
