import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, type CreditRegisterReport, type MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";

type Who = { cookie: string; userId: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** US-RPT-31 — credit notes and vendor credits with what was applied, refunded and is still held. Requires local Postgres. */
describe("US-RPT-31 · see credit notes, vendor credits and refunds in a period (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const ids = {} as Record<"paidInvoice" | "openInvoice" | "heldNote" | "appliedNote" | "bill" | "vendorCredit", string>;
  const numbers = {} as Record<"paidInvoice" | "openInvoice", string>;
  const customerRange = `from=${new Date().getFullYear()}-01-01&to=${iso(new Date())}`;
  const vendorRange = "from=2026-09-01&to=2026-09-30";
  const owner: Who = { cookie: "", userId: "" };
  const arOnly: Who = { cookie: "", userId: "" };
  const apOnly: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  async function join(who: Who, grants: string[]) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [arOnly, "ar"], [apOnly, "ap"]] as const) {
      const email = `us-rpt-31-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(arOnly, ["reports.view_receivables"]);
    await join(apOnly, ["reports.view_payables"]);
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const [maple] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const [timber] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();

    const service = testApp.app.get(InvoicesService);
    const issue = async (amount: string) => service.issue(orgId, (await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: maple!.id, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: amount }] }))).id, owner.userId);
    const paid = await issue("10000");
    const open = await issue("100000");
    [ids.paidInvoice, ids.openInvoice, numbers.paidInvoice, numbers.openInvoice] = [paid.id, open.id, paid.number!, open.number!];
    await json(await call(owner, "POST", "/payments", { contactId: maple!.id, date: iso(new Date()), method: "cash", currency: "USD", amount: "10000", allocations: [{ invoiceId: paid.id, amount: "10000" }] }));
    const note = async (invoiceId: string, amount: string) => {
      const created = await json<{ id: string }>(await call(owner, "POST", "/credit-notes", { invoiceId, lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: amount, taxRatePercentage: 0 }] }));
      await json(await call(owner, "POST", `/credit-notes/${created.id}/issue`));
      return created.id;
    };
    // Against a paid invoice: held as credit, then partly refunded.
    ids.heldNote = await note(paid.id, "4000");
    await json(await call(owner, "POST", "/customer-refunds", { sourceCreditNoteId: ids.heldNote, amount: "1500", date: iso(new Date()), method: "bank_transfer", moneyAccountId: bank.id }));
    // Against an open invoice.
    ids.appliedNote = await note(open.id, "20000");

    ids.bill = (await json<{ id: string }>(
      await call(owner, "POST", "/vendor-bills", { contactId: timber!.id, billNumber: "88213", date: "2026-09-01", currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: "50000", accountId: code["5000"] }] }),
    )).id;
    await json(await call(owner, "POST", `/vendor-bills/${ids.bill}/record`));
    ids.vendorCredit = (await json<{ id: string }>(
      await call(owner, "POST", "/vendor-credits", { contactId: timber!.id, billId: ids.bill, vendorReference: "CN-4471", date: "2026-09-15", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "30000", accountId: code["5000"] }] }),
    )).id;
    await json(await call(owner, "POST", `/vendor-credits/${ids.vendorCredit}/record`));
    await json(await call(owner, "POST", `/vendor-credits/${ids.vendorCredit}/apply`, { allocations: [{ billId: ids.bill, amount: "10000" }] }));
    await json(await call(owner, "POST", `/vendor-credits/${ids.vendorCredit}/refunds`, { amount: "5000", date: "2026-09-20", method: "bank_transfer", moneyAccountId: bank.id }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("each credit note: date, number, customer, invoice, amount, applied, refunded and still held", async () => {
    const report = await json<CreditRegisterReport>(await call(owner, "GET", `/reports/customer-credits?${customerRange}`));
    const held = report.rows.find((r) => r.id === ids.heldNote)!;
    expect(held).toMatchObject({ contact: { name: "Maple Ridge Developments" }, against: { number: numbers.paidInvoice }, total: "4000", applied: "0", refunded: "1500", held: "2500" });
    expect(held.number).toMatch(/^CRN-/);
    const applied = report.rows.find((r) => r.id === ids.appliedNote)!;
    expect(applied.against?.number).toBe(numbers.openInvoice);
    expect(applied).toMatchObject({ total: "20000", applied: "20000", refunded: "0", held: "0" });
    expect(applied.appliedTo.map((a) => [a.number, a.amount])).toEqual([[numbers.openInvoice, "20000"]]);
    expect(report.totals).toMatchObject({ count: 2, total: "24000", refunded: "1500" });
  });

  it("each vendor credit: the same for vendors and bills", async () => {
    const report = await json<CreditRegisterReport>(await call(owner, "GET", `/reports/vendor-credits?${vendorRange}`));
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      reference: "CN-4471",
      contact: { name: "Coastal Timber Supply" },
      against: { number: "88213", href: `/vendor-bills/${ids.bill}` },
      total: "30000",
      applied: "10000",
      refunded: "5000",
      held: "15000",
      href: `/vendor-credits/${ids.vendorCredit}`,
    });
    expect(report.rows[0]!.appliedTo.map((a) => [a.number, a.amount])).toEqual([["88213", "10000"]]);
  });

  it("credit notes need 'View receivables'; vendor credits need 'View payables'", async () => {
    expect((await call(arOnly, "GET", `/reports/customer-credits?${customerRange}`)).status).toBe(200);
    expect((await call(arOnly, "GET", `/reports/vendor-credits?${vendorRange}`)).status).toBe(403);
    expect((await call(apOnly, "GET", `/reports/vendor-credits?${vendorRange}`)).status).toBe(200);
    expect((await call(apOnly, "GET", `/reports/customer-credits?${customerRange}`)).status).toBe(403);
  });
});
