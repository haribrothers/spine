import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, quotes, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { QUOTE_SEND_EMAIL_QUEUE, type QuoteSendEmailJobData } from "./quote-email.worker";
import { QuotePublicTokenService } from "./quote-public-token.service";

/**
 * US-QUO-22 — an emailed quote link keeps working until the quote is
 * replaced, including every link the demo data emails. Requires local
 * Postgres.
 */
describe("US-QUO-22 · emailed links keep working until the quote is replaced (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-quo-22-${randomUUID()}@example.com`;
  let orgId: string;
  /** Every quote link the demo seed emailed. */
  let emailed: { quoteId: string; token: string }[];

  const open = (token: string) => fetch(`${testApp.baseUrl}/public/quotes/${encodeURIComponent(token)}`);

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;

    const send = vi.spyOn(testApp.app.get(QueueService), "send");
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: owner.cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);
    emailed = send.mock.calls
      .filter(([queue]) => queue === QUOTE_SEND_EMAIL_QUEUE)
      .map(([, data]) => data as QuoteSendEmailJobData)
      .filter((d) => d.orgId === orgId && d.publicToken)
      .map((d) => ({ quoteId: d.quoteId, token: d.publicToken! }));
    send.mockRestore();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("every demo quote that's sent and current has an emailed link that opens", async () => {
    const orgQuotes = await db.select().from(quotes).where(eq(quotes.orgId, orgId));
    const replaced = new Set(orgQuotes.map((q) => q.parentQuoteId).filter(Boolean));
    const current = orgQuotes.filter((q) => q.status === "sent" && !replaced.has(q.id));
    expect(current.length).toBeGreaterThan(0);
    for (const quote of current) {
      const links = emailed.filter((e) => e.quoteId === quote.id);
      expect(links.length, `${quote.number} was emailed`).toBeGreaterThan(0);
      for (const link of links) expect((await open(link.token)).status, `${quote.number}'s link`).toBe(200);
    }
  });

  it("the revised demo quote: the old link shows the unavailable page and the revision's link opens", async () => {
    const revised = (await db.select().from(quotes).where(eq(quotes.orgId, orgId))).find((q) => q.parentQuoteId);
    expect(revised, "the demo revises a quote").toBeTruthy();
    const oldLink = emailed.find((e) => e.quoteId === revised!.parentQuoteId);
    expect(oldLink, "the replaced version was emailed").toBeTruthy();
    const res = await open(oldLink!.token);
    expect(res.status).toBe(410);
    expect(((await res.json()) as { status: string }).status).toBe("expired");

    // Finding C8: the revision is sent too, so the customer has a link that works.
    expect(revised!.status).toBe("sent");
    const newLink = emailed.find((e) => e.quoteId === revised!.id);
    expect(newLink, "the revision was emailed").toBeTruthy();
    expect((await open(newLink!.token)).status).toBe(200);
  });

  it("emailing a quote twice never invalidates the first link", async () => {
    const replaced = new Set((await db.select().from(quotes).where(eq(quotes.orgId, orgId))).map((q) => q.parentQuoteId));
    const { quoteId } = emailed.find((e) => !replaced.has(e.quoteId))!;
    const tokens = testApp.app.get(QuotePublicTokenService);
    const first = await db.transaction((tx) => tokens.issue(tx, orgId, quoteId));
    const second = await db.transaction((tx) => tokens.issue(tx, orgId, quoteId));
    expect((await open(first.token)).status).toBe(200);
    expect((await open(second.token)).status).toBe(200);
  });

  it("a link lasts 30 days", async () => {
    const tokens = testApp.app.get(QuotePublicTokenService);
    const issued = await db.transaction((tx) => tokens.issue(tx, orgId, emailed[0]!.quoteId));
    const days = (issued.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });
});
