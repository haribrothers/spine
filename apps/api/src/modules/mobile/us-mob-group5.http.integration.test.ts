import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { auditLog, files, jobAssignments, jobVariationOrders, member, notifications, quoteLines, quotes, settings, taxGroupRates, taxGroups, taxRates, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { bearer, bearerSignIn, customerWithJob, ownerWithFieldUser } from "./field-user.test-helper";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

interface PresentedQuote {
  id: string;
  number: string;
  status: string;
  contactName: string;
  validUntil: string;
  notes: string | null;
  subtotalAmount: string;
  totalAmount: string;
  business: { name: string; address: string | null };
  taxLines: { label: string; amount: string }[];
  lines: { name: string; quantity: number; unitPriceAmount: string; lineSubtotalAmount: string }[];
  acceptanceMethod: string | null;
  acceptedByName: string | null;
  acceptedSignerName: string | null;
  signatureFileId: string | null;
  respondedAt: string | null;
  responseComment: string | null;
}

/**
 * Phase 5 Group 5 — presenting a quote on the phone and recording the
 * customer's answer there: US-MOB-16 (read it, decline it), US-MOB-17 and
 * US-QUO-19 (accept with a name and signature), US-QUO-20 (what the office
 * reads back). Requires local Postgres.
 */
describe("Quotes presented on site (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let ctx: Awaited<ReturnType<typeof ownerWithFieldUser>>;
  let token: string;
  let jobId: string;
  let contactId: string;
  let otherJobId: string;
  let otherOrgFileId: string;
  let salesTaxGroupId: string;

  const get = (path: string, auth: Record<string, string> = bearer(token)) => fetch(`${testApp.baseUrl}${path}`, { headers: auth });
  const post = (path: string, body: unknown, auth: Record<string, string> = bearer(token)) =>
    fetch(`${testApp.baseUrl}${path}`, { method: "POST", headers: { ...auth, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const upload = async (type = "image/png", name = "signature.png") => {
    const form = new FormData();
    form.append("file", new Blob([PNG], { type }), name);
    const res = await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: bearer(token, { "Idempotency-Key": randomUUID() }), body: form });
    return ((await res.json()) as { id: string }).id;
  };

  /** A sent quote: 6 × $85.00 under "Sales Tax" 15% + "State Surcharge" 2.5%, as a variation order on `onJob` (or not on any job). */
  async function sentQuote(number: string, options: { onJob?: string | null; status?: "sent" | "draft" } = {}) {
    const [row] = await db
      .insert(quotes)
      .values({
        orgId: ctx.orgId,
        contactId,
        currency: "USD",
        status: options.status ?? "sent",
        number,
        sentAt: new Date("2026-10-03T09:00:00Z"),
        validUntil: new Date("2026-10-17T00:00:00Z"),
        subtotalAmount: 51_000n,
        taxAmount: 8_925n,
        totalAmount: 59_925n,
        notes: "Additional scope requested on site — see attached line items.",
      })
      .returning();
    await db.insert(quoteLines).values({
      quoteId: row!.id,
      sortOrder: 0,
      name: "Additional electrical outlets (site-requested)",
      quantity: 6,
      unitPriceAmount: 8_500n,
      unitPriceCurrency: "USD",
      taxGroupId: salesTaxGroupId,
      taxRatePercentage: 17.5,
      lineSubtotalAmount: 51_000n,
      lineTaxAmount: 8_925n,
      lineTotalAmount: 59_925n,
    });
    const job = options.onJob === undefined ? jobId : options.onJob;
    if (job) await db.insert(jobVariationOrders).values({ jobId: job, orgId: ctx.orgId, quoteId: row!.id });
    return row!.id;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ctx = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    ({ jobId, contactId } = await customerWithJob(db, ctx.orgId, { job: { number: "JOB-001" } }));
    otherJobId = (await customerWithJob(db, ctx.orgId)).jobId;
    await db.insert(jobAssignments).values({ jobId, userId: ctx.fieldUserId, orgId: ctx.orgId });
    await db
      .insert(settings)
      .values({ orgId: ctx.orgId, key: "business_profile", value: { name: "Riverstone Builders", address: "220 Timberline Ave, Suite 4, Burlington, VT 05401" } })
      .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: { name: "Riverstone Builders", address: "220 Timberline Ave, Suite 4, Burlington, VT 05401" } } });
    const [sales] = await db.insert(taxRates).values({ orgId: ctx.orgId, name: "Sales Tax", rate: 15, taxType: "sales_tax" }).returning();
    const [surcharge] = await db.insert(taxRates).values({ orgId: ctx.orgId, name: "State Surcharge", rate: 2.5, taxType: "other" }).returning();
    const [group] = await db.insert(taxGroups).values({ orgId: ctx.orgId, name: "Sales tax + surcharge" }).returning();
    await db.insert(taxGroupRates).values([
      { taxGroupId: group!.id, taxRateId: sales!.id },
      { taxGroupId: group!.id, taxRateId: surcharge!.id },
    ]);
    salesTaxGroupId = group!.id;
    token = (await bearerSignIn(testApp.baseUrl, ctx.fieldEmail, "testpassword123")).token!;

    // A signature uploaded in another organisation.
    const strangerEmail = `mob-stranger-${randomUUID()}@example.com`;
    emails.push(strangerEmail);
    const stranger = await signUp(testApp.baseUrl, { email: strangerEmail, password: "testpassword123", name: "Stranger" });
    const [strangerOrg] = await db.select({ id: member.organizationId }).from(member).where(eq(member.userId, stranger.userId));
    const [file] = await db
      .insert(files)
      .values({ orgId: strangerOrg!.id, key: `test/${randomUUID()}.png`, originalFilename: "signature.png", mimeType: "image/png", sizeBytes: 68, uploadedByUserId: stranger.userId })
      .returning();
    otherOrgFileId = file!.id;
  }, 60_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  describe("US-MOB-16 · present a quote to the customer on my phone", () => {
    it("reads a quote to present with the business, customer, valid-until, lines, each named tax, total and notes", async () => {
      const id = await sentQuote("QUO-0004");
      const res = await get(`/quotes/${id}`);
      expect(res.status).toBe(200);
      const quote = (await res.json()) as PresentedQuote;
      expect(quote).toMatchObject({ number: "QUO-0004", contactName: "Harborview Construction Co.", subtotalAmount: "51000", totalAmount: "59925", notes: "Additional scope requested on site — see attached line items." });
      expect(quote.validUntil.slice(0, 10)).toBe("2026-10-17");
      expect(quote.business).toEqual({ name: "Riverstone Builders", address: "220 Timberline Ave, Suite 4, Burlington, VT 05401" });
      expect(quote.lines[0]).toMatchObject({ name: "Additional electrical outlets (site-requested)", quantity: 6, unitPriceAmount: "8500", lineSubtotalAmount: "51000" });
      expect(quote.taxLines).toEqual([
        { label: "Sales Tax (15%)", amount: "7650" },
        { label: "State Surcharge (2.5%)", amount: "1275" },
      ]);
    });

    it("gives Field nothing for a quote that isn't one to present: a draft, or one on a job they aren't on (404)", async () => {
      expect((await get(`/quotes/${await sentQuote("QUO-0005", { status: "draft" })}`)).status).toBe(404);
      expect((await get(`/quotes/${await sentQuote("QUO-0006", { onJob: otherJobId })}`)).status).toBe(404);
      expect((await get(`/quotes/${await sentQuote("QUO-0007", { onJob: null })}`)).status).toBe(404);
    });

    it("records a decline with its reason, in person, and tells the office", async () => {
      const id = await sentQuote("QUO-0008");
      const res = await post(`/quotes/${id}/reject-in-person`, { comment: "The timing doesn't work for us." });
      expect(res.status).toBeLessThan(300);
      const [row] = await db.select().from(quotes).where(eq(quotes.id, id));
      expect(row).toMatchObject({ status: "rejected", acceptanceMethod: "in_person", acceptedByUserId: ctx.fieldUserId, responseComment: "The timing doesn't work for us." });
      expect(row!.respondedAt).toBeInstanceOf(Date);
      await vi.waitFor(async () => {
        const told = await db.select().from(notifications).where(and(eq(notifications.orgId, ctx.orgId), eq(notifications.type, "quote_rejected")));
        expect(told.map((n) => n.message)).toContain("Quote QUO-0008 was declined in person.");
      });
      expect((await post(`/quotes/${id}/reject-in-person`, {})).status).toBe(410);
    });

    it("refuses to decline a quote on someone else's job (404)", async () => {
      const id = await sentQuote("QUO-0009", { onJob: otherJobId });
      expect((await post(`/quotes/${id}/reject-in-person`, {})).status).toBe(404);
      expect((await db.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, id)))[0]!.status).toBe("sent");
    });
  });

  describe("US-QUO-19 · store the signature from an on-site acceptance", () => {
    it("stores the signature file, the signer's name, who recorded it and when, as in person", async () => {
      const id = await sentQuote("QUO-0010");
      const signature = await upload();
      const res = await post(`/quotes/${id}/accept-in-person`, { signatureFileId: signature, signerName: " Alan Reyes " });
      expect(res.status).toBeLessThan(300);
      const accepted = (await res.json()) as PresentedQuote;
      expect(accepted).toMatchObject({ status: "accepted", acceptanceMethod: "in_person", acceptedSignerName: "Alan Reyes", signatureFileId: signature, acceptedByName: "Marcus Webb" });
      const [row] = await db.select().from(quotes).where(eq(quotes.id, id));
      expect(row).toMatchObject({ status: "accepted", acceptanceMethod: "in_person", acceptedByUserId: ctx.fieldUserId, signatureFileId: signature, acceptedSignerName: "Alan Reyes" });
      expect(row!.respondedAt).toBeInstanceOf(Date);
    });

    it("rejects a request with no signer name (400)", async () => {
      const id = await sentQuote("QUO-0011");
      expect((await post(`/quotes/${id}/accept-in-person`, { signatureFileId: await upload() })).status).toBe(400);
      expect((await post(`/quotes/${id}/accept-in-person`, { signatureFileId: await upload(), signerName: "   " })).status).toBe(400);
      expect((await db.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, id)))[0]!.status).toBe("sent");
    });

    it("rejects a signature file from another organisation, or one that doesn't exist", async () => {
      const id = await sentQuote("QUO-0012");
      expect((await post(`/quotes/${id}/accept-in-person`, { signatureFileId: otherOrgFileId, signerName: "Alan Reyes" })).status).toBe(400);
      expect((await post(`/quotes/${id}/accept-in-person`, { signatureFileId: randomUUID(), signerName: "Alan Reyes" })).status).toBe(400);
    });

    it("refuses a quote that isn't sent", async () => {
      const id = await sentQuote("QUO-0013");
      expect((await post(`/quotes/${id}/accept-in-person`, { signatureFileId: await upload(), signerName: "Alan Reyes" })).status).toBeLessThan(300);
      expect((await post(`/quotes/${id}/accept-in-person`, { signatureFileId: await upload(), signerName: "Alan Reyes" })).status).toBe(410);
      const declined = await sentQuote("QUO-0014");
      await post(`/quotes/${declined}/reject-in-person`, {});
      expect((await post(`/quotes/${declined}/accept-in-person`, { signatureFileId: await upload(), signerName: "Alan Reyes" })).status).toBe(410);
    });

    it("refuses Field a quote on a job they aren't on, before anything else (404)", async () => {
      const id = await sentQuote("QUO-0015", { onJob: otherJobId });
      expect((await post(`/quotes/${id}/accept-in-person`, { signatureFileId: await upload(), signerName: "Alan Reyes" })).status).toBe(404);
    });
  });

  describe("US-MOB-17 · capture the customer's acceptance and signature", () => {
    it("tells Owners and office staff straight away: Quote <number> was accepted in person", async () => {
      const id = await sentQuote("QUO-0016");
      await post(`/quotes/${id}/accept-in-person`, { signatureFileId: await upload(), signerName: "Alan Reyes" });
      await vi.waitFor(async () => {
        const told = await db.select().from(notifications).where(and(eq(notifications.orgId, ctx.orgId), eq(notifications.type, "quote_accepted")));
        expect(told.map((n) => n.message)).toContain("Quote QUO-0016 was accepted in person.");
      });
      await vi.waitFor(async () => {
        const nudged = await db.select().from(notifications).where(and(eq(notifications.orgId, ctx.orgId), eq(notifications.type, "variation_order_accepted")));
        expect(nudged.some((n) => n.message.includes("QUO-0016"))).toBe(true);
      });
    });
  });

  describe("US-QUO-20 · show how a quote was accepted", () => {
    it("gives the office the signer, the witness and the signature — which Owners can open and Field can't", async () => {
      const id = await sentQuote("QUO-0017");
      const signature = await upload();
      await post(`/quotes/${id}/accept-in-person`, { signatureFileId: signature, signerName: "Alan Reyes" });
      const owner = { cookie: ctx.ownerCookie };
      const quote = (await (await get(`/quotes/${id}`, owner)).json()) as PresentedQuote;
      expect(quote).toMatchObject({ acceptanceMethod: "in_person", acceptedSignerName: "Alan Reyes", acceptedByName: "Marcus Webb", signatureFileId: signature });
      expect((await get(`/files/${signature}`, owner)).status).toBe(200);
      expect((await get(`/files/${signature}`)).status).toBe(404);
    });

    it("names the method in the quote's history", async () => {
      const id = await sentQuote("QUO-0018");
      await post(`/quotes/${id}/accept-in-person`, { signatureFileId: await upload(), signerName: "Alan Reyes" });
      const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, id), eq(auditLog.action, "accepted_in_person")));
      expect(entry!.changes).toEqual(expect.arrayContaining([{ field: "signedBy", from: null, to: "Alan Reyes" }]));
    });
  });
});
