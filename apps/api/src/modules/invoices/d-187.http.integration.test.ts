import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, teamMemberships, teamPrivileges, teams } from "../../db/schema";
import { pdfText } from "../../test-utils/pdf-text";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { IssuedPdfService } from "../pdf/issued-pdf.service";

type Who = { cookie: string; userId: string };
type Invoice = { id: string; orgId: string; number: string; amountPaid: string; balanceDue: string; upiQrAmount: string | null };

/** D-187 — "Apply credit first" when issuing, so the UPI QR asks for what's left. Requires local Postgres. */
describe("D-187 · apply the customer's credit as an invoice is issued (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let contactId: string;
  let bank: MoneyAccount;
  const owner: Who = { cookie: "", userId: "" };
  const clerk: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const draft = async (amount: string) => json<{ id: string }>(await call(owner, "POST", "/invoices", { contactId, currency: "INR", lines: [{ name: "Modular kitchen", quantity: 1, unitPriceAmount: amount }] }));
  const deposit = async (amount: string) => json(await call(owner, "POST", "/payments", { contactId, date: "2026-09-01", method: "upi", currency: "INR", amount, moneyAccountId: bank.id }));
  const pdf = async (invoice: Invoice) => {
    await testApp.app.get(IssuedPdfService).getOrStore(invoice.orgId, "invoice", invoice.id);
    return pdfText(Buffer.from(await (await call(owner, "GET", `/invoices/${invoice.id}/pdf`)).arrayBuffer()));
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [clerk, "clerk"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `d-187-${name}-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    // A clerk who may issue invoices but not apply credit.
    await db.delete(member).where(eq(member.userId, clerk.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: clerk.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, clerk.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Billing ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "invoices.issue", granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });

    await json(await call(owner, "PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } }));
    await json(await call(owner, "PUT", "/org/settings/business_profile", { value: { name: "Kaveri Interiors", upiId: "kaveriinteriors@okhdfc" } }));
    contactId = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Lakeview Homes" }))).id;
    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("issuing with 'Apply credit first' uses the deposit, and the QR code asks for what's left", async () => {
    await deposit("5000000");
    const invoice = await draft("11800000");
    expect(await json<{ amount: string }>(await call(owner, "GET", `/invoices/${invoice.id}/available-credit`))).toEqual({ amount: "5000000" });
    const issued = await json<Invoice>(await call(owner, "POST", `/invoices/${invoice.id}/issue`, { applyCredit: true }));
    expect(issued).toMatchObject({ amountPaid: "5000000", balanceDue: "6800000", upiQrAmount: "6800000" });
    expect(await pdf(issued)).toContain("Scan to pay ₹68,000.00 with any UPI app");
    expect(await json<{ amount: string }>(await call(owner, "GET", `/invoices/${invoice.id}/available-credit`))).toEqual({ amount: "0" });
  });

  it("when the credit covers it all, nothing is due at issue and there's no QR code", async () => {
    await deposit("2000000");
    const issued = await json<Invoice>(await call(owner, "POST", `/invoices/${(await draft("1500000")).id}/issue`, { applyCredit: true }));
    expect(issued).toMatchObject({ amountPaid: "1500000", balanceDue: "0", upiQrAmount: null });
    expect(await pdf(issued)).not.toContain("Scan to pay");
  });

  it("issuing without it leaves the credit alone", async () => {
    const issued = await json<Invoice>(await call(owner, "POST", `/invoices/${(await draft("1000000")).id}/issue`));
    expect(issued).toMatchObject({ amountPaid: "0", upiQrAmount: "1000000" });
    // The ₹5,000 left over from the last deposit is still there.
    expect(await json<{ amount: string }>(await call(owner, "GET", `/invoices/${issued.id}/available-credit`))).toEqual({ amount: "500000" });
  });

  it("someone who can issue but not apply credit can't ask for it", async () => {
    const invoice = await draft("1000000");
    const res = await call(clerk, "POST", `/invoices/${invoice.id}/issue`, { applyCredit: true });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { message: string }).message).toBe("You don't have permission to apply credit. Issue it without, or ask an owner.");
    expect((await call(clerk, "POST", `/invoices/${invoice.id}/issue`)).status).toBeLessThan(300);
  });
});
