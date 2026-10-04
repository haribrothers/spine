import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, member, quotePublicTokens, settings, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QuotePublicTokenService } from "./quote-public-token.service";
import { QuotesService } from "./quotes.service";

/**
 * US-QUO-21 — a link we sent that no longer works shows whose quote it was
 * and how to reach them; a link that matches nothing shows nothing about
 * anyone. Requires local Postgres.
 */
describe("US-QUO-21 · a branded page for an expired or invalid link (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-quo-21-${randomUUID()}@example.com`;
  let orgId: string;
  let userId: string;
  let quoteId: string;
  let tokens: QuotePublicTokenService;
  const profile = { name: "Riverstone Builders", address: "14 Harbour Road, Marina District", email: "hello@riverstone.example", phone: "+1 555 0100" };

  const open = (token: string) => fetch(`${testApp.baseUrl}/public/quotes/${encodeURIComponent(token)}`);
  const issue = () => db.transaction((tx) => tokens.issue(tx, orgId, quoteId));
  const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    userId = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" })).userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    await db.insert(settings).values({ orgId, key: "business_profile", value: profile }).onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: profile } });
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Alan Brooks", createdByUserId: userId }).returning();
    const quotes = testApp.app.get(QuotesService);
    const quote = await quotes.create(orgId, userId, {
      contactId: contact!.id,
      currency: "USD",
      lines: [{ type: "item", name: "Outlets", quantity: 1, unitPriceAmount: 51000n, discountPercentage: 0, taxRatePercentage: 0 }],
    } as never);
    quoteId = quote.id;
    await quotes.send(orgId, quoteId, userId);
    tokens = testApp.app.get(QuotePublicTokenService);
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("a current link still loads the quote", async () => {
    const { token } = await issue();
    expect((await open(token)).status).toBe(200);
  });

  it("a replaced (revoked) link answers 410 with the business's name, address, email and phone", async () => {
    const { token, nonce } = await issue();
    await db.update(quotePublicTokens).set({ revokedAt: new Date() }).where(eq(quotePublicTokens.nonce, nonce));
    const res = await open(token);
    expect(res.status).toBe(410);
    const body = (await res.json()) as { status: string; business: Record<string, unknown> };
    expect(body.status).toBe("expired");
    expect(body.business).toEqual({ ...profile, logoDataUri: null });
  });

  it("a link past its 30 days answers 410 with the business", async () => {
    const { nonce } = await issue();
    const token = await new SignJWT({ quoteId, orgId, nonce })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 40 * 86400)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10 * 86400)
      .sign(secret());
    const res = await open(token);
    expect(res.status).toBe(410);
    expect(((await res.json()) as { business: { name: string } }).business.name).toBe("Riverstone Builders");
  });

  it("a token that matches nothing answers 404 'isn't valid' with no business details", async () => {
    for (const token of ["not-a-token", await new SignJWT({ quoteId, orgId, nonce: "made-up" }).setProtectedHeader({ alg: "HS256" }).sign(secret())]) {
      const res = await open(token);
      expect(res.status).toBe(404);
      const text = await res.text();
      expect(JSON.parse(text)).toMatchObject({ status: "invalid" });
      expect(text).not.toContain("Riverstone");
    }
  });

  it("a token signed with another key reveals nothing", async () => {
    const { nonce } = await issue();
    const forged = await new SignJWT({ quoteId, orgId, nonce }).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode("not-our-secret"));
    const res = await open(forged);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("Riverstone");
  });
});
