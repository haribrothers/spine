import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, creditNotes, expenses, invoices, jobs, journalEntries, journalLines, member, numberSequences, payments, quotes, user, vendorPayments } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { ContactsService } from "../contacts/contacts.service";
import { InvoicesService } from "../invoices/invoices.service";
import { VendorCreditsService } from "../purchases/vendor-credits.service";

/**
 * US-ONB-17 (D-191) — demo data takes its own number series, flags its
 * journal entries, and "Delete all demo data" removes those entries with
 * it; real entries stay immutable. Requires local Postgres.
 */
describe("US-ONB-17 · keep demo data out of my real numbers and books (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-onb-17-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let userId: string;

  const seed = async () => {
    const res = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } });
    expect(res.status).toBeLessThan(300);
  };
  const remove = async () => {
    const res = await fetch(`${testApp.baseUrl}/demo-data`, { method: "DELETE", headers: { cookie, "Idempotency-Key": randomUUID() } });
    expect(res.status).toBe(200);
    return (await res.json()) as { kept: { contacts: number }; invoicesDeleted: number };
  };
  const numbers = async (table: typeof invoices | typeof quotes | typeof creditNotes | typeof payments | typeof vendorPayments | typeof expenses | typeof jobs) =>
    (await db.select({ number: table.number }).from(table).where(and(eq(table.orgId, orgId), eq(table.isDemo, true)))).map((r) => r.number).filter((n): n is string => !!n);

  /** A customer of the business's own, invoiced and issued. */
  const realInvoice = async () => {
    const contact = await testApp.app.get(ContactsService).create(orgId, userId, { type: "customer", isCompany: true, name: `Own customer ${randomUUID().slice(0, 6)}` } as never);
    const draft = await testApp.app.get(InvoicesService).create(orgId, userId, { contactId: contact.id, type: "standard", currency: "USD", lines: [{ type: "item", name: "Consulting", quantity: 1, unitPriceAmount: 50000n, discountPercentage: 0, taxRatePercentage: 0, isTaxInclusive: false }] } as never);
    return testApp.app.get(InvoicesService).issue(orgId, draft.id, userId);
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Demo Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = m!.organizationId;
    await seed();
  }, 180_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("numbers demo documents from their own series and leaves the real series alone", async () => {
    expect(await numbers(invoices)).toEqual(expect.arrayContaining(["DEMO-INV-0001", "DEMO-INV-0002"]));
    expect((await numbers(invoices)).every((n) => n.startsWith("DEMO-INV-"))).toBe(true);
    expect((await numbers(quotes)).every((n) => n.startsWith("DEMO-QUO-"))).toBe(true);
    expect(await numbers(quotes)).toContain("DEMO-QUO-0001");
    // US-ONB-29: three credit notes.
    expect((await numbers(creditNotes)).sort()).toEqual(["DEMO-CRN-0001", "DEMO-CRN-0002", "DEMO-CRN-0003"]);
    expect((await numbers(payments)).every((n) => n.startsWith("DEMO-RCP-"))).toBe(true);
    expect(await numbers(vendorPayments)).toEqual(["DEMO-VPY-0001"]);
    expect((await numbers(expenses)).every((n) => n.startsWith("DEMO-EXP-"))).toBe(true);
    expect(await numbers(jobs)).toEqual(expect.arrayContaining(["DEMO-JOB-001", "DEMO-JOB-002", "DEMO-JOB-003"]));

    // Every entry the demo posted is flagged.
    const entries = await db.select({ isDemo: journalEntries.isDemo }).from(journalEntries).where(eq(journalEntries.orgId, orgId));
    expect(entries.length).toBeGreaterThan(10);
    expect(entries.every((e) => e.isDemo)).toBe(true);

    const own = await realInvoice();
    expect(own.number).toBe("INV-0001");
    const [entry] = await db.select({ isDemo: journalEntries.isDemo }).from(journalEntries).where(eq(journalEntries.id, own.journalEntryId!));
    expect(entry?.isDemo).toBe(false);
  });

  it("makes a document for a demo customer demo too", async () => {
    const [demoCustomer] = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.isDemo, true), eq(contacts.name, "Priya Nair")));
    const draft = await testApp.app.get(InvoicesService).create(orgId, userId, { contactId: demoCustomer!.id, type: "standard", currency: "USD", lines: [{ type: "item", name: "Extra work", quantity: 1, unitPriceAmount: 10000n, discountPercentage: 0, taxRatePercentage: 0, isTaxInclusive: false }] } as never);
    const issued = await testApp.app.get(InvoicesService).issue(orgId, draft.id, userId);
    expect(issued.isDemo).toBe(true);
    expect(issued.number).toMatch(/^DEMO-INV-\d{4}$/);
    const [entry] = await db.select({ isDemo: journalEntries.isDemo }).from(journalEntries).where(eq(journalEntries.id, issued.journalEntryId!));
    expect(entry?.isDemo).toBe(true);
  });

  it("refuses to delete or change any journal entry outside the demo deletion, and a real one inside it", async () => {
    const [demoEntry] = await db.select().from(journalEntries).where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.isDemo, true))).limit(1);
    const [realEntry] = await db.select().from(journalEntries).where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.isDemo, false))).limit(1);
    await expect(db.delete(journalEntries).where(eq(journalEntries.id, demoEntry!.id))).rejects.toThrow();
    await expect(db.update(journalEntries).set({ isDemo: false }).where(eq(journalEntries.id, demoEntry!.id))).rejects.toThrow();
    await expect(db.delete(journalLines).where(eq(journalLines.entryId, demoEntry!.id))).rejects.toThrow();
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('spine.deleting_demo', 'on', true)`);
        await tx.delete(journalEntries).where(eq(journalEntries.id, realEntry!.id));
      }),
    ).rejects.toThrow();
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('spine.deleting_demo', 'on', true)`);
        await tx.delete(journalLines).where(eq(journalLines.entryId, realEntry!.id));
      }),
    ).rejects.toThrow();
  });

  it("deletes the demo's entries with it, keeps a demo contact my own records use, and starts the demo series again", async () => {
    // A vendor credit of my own for a demo vendor: vendor credits are never demo.
    const [demoVendor] = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.isDemo, true), eq(contacts.name, "Apex Timber Supply")));
    await testApp.app.get(VendorCreditsService).create(orgId, userId, { contactId: demoVendor!.id, vendorReference: "CR-1", date: new Date(), currency: "USD", lines: [] } as never);

    const result = await remove();
    expect(result.kept).toEqual({ contacts: 1 });
    expect(result.invoicesDeleted).toBeGreaterThan(5);

    const left = await db.select().from(journalEntries).where(eq(journalEntries.orgId, orgId));
    expect(left.length).toBe(1);
    expect(left[0]!.isDemo).toBe(false);
    const lines = await db.select().from(journalLines).where(eq(journalLines.entryId, left[0]!.id));
    expect(lines.reduce((sum, l) => sum + l.debit, 0n)).toBe(50000n);

    expect(await db.select().from(jobs).where(eq(jobs.orgId, orgId))).toHaveLength(0);
    const demoContactsLeft = await db.select({ name: contacts.name }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.isDemo, true)));
    expect(demoContactsLeft).toEqual([{ name: "Apex Timber Supply" }]);
    expect(await db.select().from(numberSequences).where(and(eq(numberSequences.orgId, orgId), eq(numberSequences.isDemo, true)))).toHaveLength(0);

    const status = (await (await fetch(`${testApp.baseUrl}/demo-data/status`, { headers: { cookie } })).json()) as { hasDemoData: boolean };
    expect(status.hasDemoData).toBe(false);

    expect(await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.isDemo, true)))).toHaveLength(0);
    await seed();
    expect(await numbers(invoices)).toContain("DEMO-INV-0001");
    // The demo's people lost their membership with the deletion; loading again gives it back (US-ONB-35: six of them).
    expect(await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.isDemo, true)))).toHaveLength(6);
    const own = await realInvoice();
    expect(own.number).toBe("INV-0002");
  }, 180_000);
});
