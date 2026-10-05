import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { catalogItems, member, quoteLines, quotes, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { QUOTE_SEND_EMAIL_QUEUE } from "./quote-email.worker";

interface QuoteRow {
  id: string;
  number: string | null;
  status: string;
  contactId: string;
  version: number;
  parentQuoteId: string | null;
  validUntil: string | null;
  notes: string | null;
  termsAndConditions: string | null;
  emailStatus: string | null;
  lines: { name: string; sortOrder: number; unitPriceAmount: string; taxRateId: string | null; taxRatePercentage: number }[];
}

/**
 * US-QUO-24 — "Duplicate as new draft" and "Email again". Real routes on a
 * demo-seeded org. Requires local Postgres.
 */
describe("US-QUO-24 · duplicate a quote as a new draft (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-quo-24-${randomUUID()}@example.com`;
  const staffEmail = `us-quo-24-staff-${randomUUID()}@example.com`;
  let cookie: string;
  let staffCookie: string;
  let orgId: string;

  const call = async (method: string, route: string, who = cookie) =>
    fetch(`${testApp.baseUrl}${route}`, { method, headers: { "Idempotency-Key": randomUUID(), cookie: who } });
  const getQuote = async (id: string) => (await (await call("GET", `/quotes/${id}`)).json()) as QuoteRow;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);

    // A Staff member in a Team that may read but not create quotes.
    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Readers ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "quotes.edit_own", granted: false });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, staffEmail]));
  });

  async function sentQuote(): Promise<QuoteRow> {
    const [row] = await db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.status, "sent"), isNotNull(quotes.number))).limit(1);
    return getQuote(row!.id);
  }

  it("creates a new draft with the same contact, lines, notes and terms, no number, version 1 and a fresh validity date", async () => {
    const original = await sentQuote();
    const res = await call("POST", `/quotes/${original.id}/duplicate`);
    expect(res.status).toBeLessThan(300);
    const copy = (await res.json()) as QuoteRow;
    expect(copy).toMatchObject({ status: "draft", number: null, version: 1, parentQuoteId: null, contactId: original.contactId, notes: original.notes, termsAndConditions: original.termsAndConditions });
    expect(copy.lines.map((l) => [l.name, l.unitPriceAmount])).toEqual(original.lines.map((l) => [l.name, l.unitPriceAmount]));
    expect(new Date(copy.validUntil!).getTime()).toBeGreaterThan(Date.now());
  });

  it("copies the original lines' prices, not today's catalogue prices", async () => {
    const original = await sentQuote();
    const [line] = await db.select().from(quoteLines).where(and(eq(quoteLines.quoteId, original.id), isNotNull(quoteLines.catalogItemId))).limit(1);
    expect(line, "a demo quote line comes from the catalogue").toBeTruthy();
    await db.update(catalogItems).set({ defaultPriceAmount: 999_999n }).where(eq(catalogItems.id, line!.catalogItemId!));
    const copy = (await (await call("POST", `/quotes/${original.id}/duplicate`)).json()) as QuoteRow;
    // Matched by position: a quote can repeat a line name.
    expect(copy.lines.find((l) => l.sortOrder === line!.sortOrder)?.unitPriceAmount).toBe(line!.unitPriceAmount.toString());
  });

  it("the copy's history opens with 'Duplicated from <number>'", async () => {
    const original = await sentQuote();
    const copy = (await (await call("POST", `/quotes/${original.id}/duplicate`)).json()) as QuoteRow;
    const history = (await (await call("GET", `/quotes/${copy.id}/history`)).json()) as { action: string; changes: { field: string; to: unknown }[] }[];
    expect(history.at(-1)).toMatchObject({ action: "duplicated", changes: [{ field: "duplicatedFrom", to: original.number }] });
  });

  it("is refused without quotes.edit_own", async () => {
    const original = await sentQuote();
    expect((await call("POST", `/quotes/${original.id}/duplicate`, staffCookie)).status).toBe(403);
  });

  it("'Email again' re-queues a sent quote's email with a fresh link; a draft can't be emailed again", async () => {
    const original = await sentQuote();
    const send = vi.spyOn(testApp.app.get(QueueService), "send");
    const res = await call("POST", `/quotes/${original.id}/resend`);
    expect(res.status).toBeLessThan(300);
    expect(((await res.json()) as QuoteRow).emailStatus).toBe("pending");
    const job = send.mock.calls.find(([queue]) => queue === QUOTE_SEND_EMAIL_QUEUE)?.[1] as { quoteId: string; publicToken: string } | undefined;
    expect(job?.quoteId).toBe(original.id);
    expect((await fetch(`${testApp.baseUrl}/public/quotes/${encodeURIComponent(job!.publicToken)}`)).status).toBe(200);
    send.mockRestore();

    const draft = (await (await call("POST", `/quotes/${original.id}/duplicate`)).json()) as QuoteRow;
    const refused = await call("POST", `/quotes/${draft.id}/resend`);
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { message: string }).message).toBe("Only a sent quote can be emailed again.");
  });
});
