import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AI_NOT_ALLOWED_MESSAGE, type AiQuoteLines } from "@spine/shared";
import { createDb, type Database } from "../../../db/client";
import { aiRequests, catalogBundleLines, catalogBundles, catalogItems, member, quotes, session as sessionTable } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../../test-utils/ai-stub";

type Who = { cookie: string; userId: string };

/** US-AI-13 — draft quote lines from an enquiry. The provider is a stand-in; the catalogue search and checks are real. Requires local Postgres. */
describe("US-AI-13 · draft quote lines from an enquiry (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let stub: AiStub;
  let teamId: string;
  let tiling: string;
  let sanitary: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const fieldUser: Who = { cookie: "", userId: "" };
  const enquiry = "Hi, we'd like the 2nd-floor bathroom redone: retile floor and walls (approx 120 sq ft), new WC, basin and shower, and a glass screen. — Ananya";

  const callAs = (who: Who) => (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const call = callAs(owner);
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const refusal = async (res: Response) => ({ status: res.status, message: ((await res.json()) as { message: string }).message });
  const draft = (body: unknown, who: Who = owner) => callAs(who)("POST", "/ai/draft-quote-lines", body);
  const lastPrompt = () => (stub.requests.filter((r) => r.path === "/v1/chat/completions").at(-1)!.body as { messages: { role: string; content: string }[] }).messages.find((m) => m.role === "user")!.content;
  /** The ref the prompt gave a catalogue entry. */
  const refOf = (name: string) => new RegExp(`- ([IB]\\d+) · ${name.replace(/[&]/g, "\\$&")} ·`).exec(lastPrompt())?.[1];

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"], [fieldUser, "Marcus Webb"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-ai-13-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [fieldUser, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    teamId = (await json<{ id: string; isDefault: boolean }[]>(await call("GET", "/org/teams"))).find((t) => t.isDefault)!.id;
    const staffMember = (await db.select().from(member).where(eq(member.userId, staff.userId)))[0]!;
    await json(await call("PUT", `/org/teams/${teamId}/members`, { memberIds: [staffMember.id] }));

    // 60 unrelated items, so only the best 50 matches go — and the ones this enquiry needs.
    await db.insert(catalogItems).values(Array.from({ length: 60 }, (_, i) => ({ orgId, name: `Structural steel beam ${i + 1}`, unit: "each", defaultPriceCurrency: "INR", defaultPriceAmount: 1_000_00n })));
    const [tile] = await db.insert(catalogItems).values({ orgId, name: "Floor & wall tiling", description: "Supply and fix vitrified tiles", unit: "sq ft", defaultPriceCurrency: "INR", defaultPriceAmount: 950_00n }).returning();
    tiling = tile!.id;
    await db.insert(catalogItems).values({ orgId, name: "Glass shower screen", unit: "each", defaultPriceCurrency: "INR", archivedAt: new Date() });
    const [set] = await db.insert(catalogBundles).values({ orgId, name: "Bathroom sanitaryware set", currency: "INR", totalAmount: 48_500_00n }).returning();
    sanitary = set!.id;
    await db.insert(catalogBundleLines).values([
      { bundleId: set!.id, name: "Wall-hung WC", sortOrder: 0, quantity: 1 },
      { bundleId: set!.id, name: "Basin with pedestal", sortOrder: 1, quantity: 1 },
    ]);
    await db.insert(catalogBundles).values({ orgId, name: "Bathroom sanitaryware set (USD)", currency: "USD" });

    stub = await startAiStub();
    await json(await call("PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3.5:4b", enabled: true }));
  }, 120_000);

  afterAll(async () => {
    await stub?.close();
    await testApp?.close();
  });

  it("sends the enquiry with the 50 catalogue entries that best match it — no prices, no archived items, bundles in the quote's currency", async () => {
    stub.setReply(JSON.stringify({ lines: [] }));
    expect(await json<AiQuoteLines>(await draft({ text: enquiry, currency: "INR" }))).toEqual({ lines: [], candidates: 50 });
    const prompt = lastPrompt();
    expect(prompt).toContain(`The enquiry:\n${enquiry}`);
    expect(prompt).toContain("· Floor & wall tiling · per sq ft · Supply and fix vitrified tiles");
    expect(prompt).toContain("· Bathroom sanitaryware set · bundle · Wall-hung WC, Basin with pedestal");
    expect(prompt).not.toContain("Glass shower screen");
    expect(prompt).not.toContain("(USD)");
    expect(prompt).not.toMatch(/950|48,?500/);
    expect(prompt.match(/^- [IB]\d+ ·/gm)).toHaveLength(50);
  });

  it("returns the model's lines matched to the catalogue, and work it doesn't have by name; recorded against the draft quote", async () => {
    stub.setReply(JSON.stringify({ lines: [] }));
    await json(await draft({ text: enquiry, currency: "INR" }));
    const tileRef = refOf("Floor & wall tiling");
    const setRef = refOf("Bathroom sanitaryware set");
    stub.setReply(
      JSON.stringify({
        lines: [
          { ref: tileRef, name: "Retile floor and walls", description: "Approx 120 sq ft", quantity: 120 },
          { ref: setRef, name: "WC, basin and shower", quantity: 1 },
          { ref: null, name: "Glass shower screen", description: null, quantity: 1 },
        ],
      }),
    );
    const contact = await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Ananya Rao" }));
    const quote = await json<{ id: string }>(await call("POST", "/quotes", { contactId: contact.id, currency: "INR", lines: [] }));
    expect(await json<AiQuoteLines>(await draft({ text: enquiry, currency: "INR", quoteId: quote.id }))).toEqual({
      candidates: 50,
      lines: [
        { catalogItemId: tiling, bundleId: null, name: "Floor & wall tiling", description: "Approx 120 sq ft", quantity: 120 },
        { catalogItemId: null, bundleId: sanitary, name: "Bathroom sanitaryware set", description: null, quantity: 1 },
        { catalogItemId: null, bundleId: null, name: "Glass shower screen", description: null, quantity: 1 },
      ],
    });
    const [request] = await db.select().from(aiRequests).where(and(eq(aiRequests.orgId, orgId), eq(aiRequests.feature, "draft_quote_lines"))).orderBy(desc(aiRequests.createdAt)).limit(1);
    expect(request).toMatchObject({ outcome: "ok", entityType: "quote", entityId: quote.id });
  });

  it("only for someone who may use AI and change the quote; a quote that's been sent can't have lines drafted", async () => {
    stub.setReply(JSON.stringify({ lines: [] }));
    expect(await refusal(await draft({ text: enquiry, currency: "INR" }, staff))).toEqual({ status: 403, message: AI_NOT_ALLOWED_MESSAGE });
    await json(await call("PUT", `/org/teams/${teamId}/privileges`, { privileges: [{ capability: "ai.use", granted: true }] }));
    expect((await draft({ text: enquiry, currency: "INR" }, staff)).status).toBe(200);
    expect((await draft({ text: enquiry, currency: "INR" }, fieldUser)).status).toBe(403);

    // The Owner's draft quote: Staff without "edit others' quotes" can't draft lines for it.
    const contact = await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Rohan Mehta" }));
    const ownersQuote = await json<{ id: string }>(await call("POST", "/quotes", { contactId: contact.id, currency: "INR", lines: [] }));
    await json(await call("PUT", `/org/teams/${teamId}/privileges`, { privileges: [{ capability: "quotes.edit_others", granted: false }] }));
    expect((await draft({ text: enquiry, currency: "INR", quoteId: ownersQuote.id }, staff)).status).toBe(403);

    await db.update(quotes).set({ status: "sent" }).where(eq(quotes.id, ownersQuote.id));
    expect(await refusal(await draft({ text: enquiry, currency: "INR", quoteId: ownersQuote.id }))).toEqual({ status: 409, message: "Only a draft quote can have lines added." });
    expect((await draft({ text: enquiry, currency: "INR", quoteId: randomUUID() })).status).toBe(404);
    expect((await draft({ text: "", currency: "INR" })).status).toBe(400);
    expect((await draft({ text: "x".repeat(4001), currency: "INR" })).status).toBe(400);
  });

  it("with the feature off there's no draft", async () => {
    await json(await call("PUT", "/org/ai", { features: { draftQuoteLines: false } }));
    expect((await draft({ text: enquiry, currency: "INR" })).status).toBe(403);
    await json(await call("PUT", "/org/ai", { features: { draftQuoteLines: true } }));
  });
});
