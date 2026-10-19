import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AI_NOT_ALLOWED_MESSAGE, type AiBankSuggestions, type MoneyAccount, type ReconciliationView } from "@spine/shared";
import { createDb, type Database } from "../../../db/client";
import { accounts, aiRequests, bankStatementLineMatches, member, session as sessionTable, teamMemberships, teamPrivileges, teams } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../../test-utils/ai-stub";

type Who = { cookie: string; userId: string };

/** US-AI-14 — AI suggestions while reconciling. The provider is a stand-in; the rules, candidates and checks are real. Requires local Postgres. */
describe("US-AI-14 · get AI suggestions while reconciling (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let stub: AiStub;
  let bank: MoneyAccount;
  let code: Record<string, string>;
  let recId: string;
  let maplePayment: string;
  let hdfc: string;
  const owner: Who = { cookie: "", userId: "" };
  const reconciler: Who = { cookie: "", userId: "" };
  const viewer: Who = { cookie: "", userId: "" };

  const callAs = (who: Who) => (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const call = callAs(owner);
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const refusal = async (res: Response) => ({ status: res.status, message: ((await res.json()) as { message: string }).message });
  const suggest = (who: Who = owner) => callAs(who)("POST", "/ai/bank-suggestions", { reconciliationId: recId });
  const lastPrompt = () => (stub.requests.filter((r) => r.path === "/v1/chat/completions").at(-1)!.body as { messages: { role: string; content: string }[] }).messages.find((m) => m.role === "user")!.content;
  /** A ref the prompt gave: the line, entry, category or contact on a row containing `text`. */
  const refOn = (prefix: "L" | "E" | "A" | "C", text: string) => new RegExp(`(${prefix}\\d+) · [^\\n]*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).exec(lastPrompt())?.[1];
  const view = () => call("GET", `/bank-reconciliations/${recId}`).then((r) => json<ReconciliationView>(r));

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
    for (const [who, name] of [[owner, "Priya Raman"], [reconciler, "Kavya Iyer"], [viewer, "Rahul Shah"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-ai-14-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(reconciler, ["banking.view", "banking.reconcile"]);
    await join(viewer, ["banking.view"]);
    bank = (await json<MoneyAccount[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));

    await json(await call("POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: code["3000"], amount: "1000000", date: "2026-09-01" }));
    hdfc = (await json<{ id: string }>(await call("POST", "/contacts", { type: "vendor", name: "HDFC Bank" }))).id;
    // How the business filed bank charges in September.
    await json(await call("POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6900"], contactId: hdfc, amount: "59000", date: "2026-09-12", description: "SMS ALERT CHGS" }));
    const maple = await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Maple Ridge Developments" }));
    const rao = await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Rao Constructions" }));
    // Two payments of the same amount near the line: the rules can't pick one.
    maplePayment = (await json<{ id: string }>(await call("POST", "/payments", { contactId: maple.id, date: "2026-10-02", method: "bank_transfer", currency: "USD", amount: "454250", moneyAccountId: bank.id }))).id;
    await json(await call("POST", "/payments", { contactId: rao.id, date: "2026-10-03", method: "bank_transfer", currency: "USD", amount: "454250", moneyAccountId: bank.id }));
    // One the rules do settle.
    await json(await call("POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6900"], amount: "216000", date: "2026-10-01", description: "Coastal Timber" }));

    const form = new FormData();
    form.append(
      "file",
      new Blob([["Date,Description,Amount", "2026-10-01,CHQ 000214 COASTAL TIMBER,-2160.00", "2026-10-02,NEFT-MAPLE RIDGE DEV,4542.50", "2026-10-12,SMS ALERT CHGS,-5.90"].join("\n")], { type: "text/csv" }),
      "statement-oct-2026.csv",
    );
    form.append("mapping", JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }));
    await json(await fetch(`${testApp.baseUrl}/money-accounts/${bank.id}/statement-imports`, { method: "POST", headers: { "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: form }));
    recId = (await json<ReconciliationView>(await call("POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: "2026-10-12", statementClosingBalance: "1239170" }))).id;

    stub = await startAiStub();
    await json(await call("PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3.5:4b", enabled: true }));
  }, 120_000);

  afterAll(async () => {
    await stub?.close();
    await testApp?.close();
  });

  it("asks only about the lines the rules couldn't settle, with each line's likely entries and how similar lines were filed", async () => {
    stub.setReply(JSON.stringify({ suggestions: [] }));
    expect(await json<AiBankSuggestions>(await suggest())).toMatchObject({ looked: 2, suggestions: [] });
    const prompt = lastPrompt();
    expect(prompt).toContain("· 2026-10-02 · +4,542.50 · NEFT-MAPLE RIDGE DEV");
    expect(prompt).toContain("· 2026-10-12 · -5.90 · SMS ALERT CHGS");
    expect(prompt).not.toContain("CHQ 000214 COASTAL TIMBER");
    expect(prompt).toMatch(/E\d+ · 2026-10-02 · \+4,542\.50 · Payment [^\n]* · Maple Ridge Developments/);
    expect(prompt).toContain('- "SMS ALERT CHGS" (money out) → ');
    expect(prompt).toMatch(/C\d+ · HDFC Bank \(vendor\)/);
  });

  it("keeps AI's suggestions on the reconciliation: a ranked match and a create, recorded as an AI request", async () => {
    stub.setReply(JSON.stringify({ suggestions: [] }));
    await json(await suggest());
    const mapleEntry = refOn("E", "Maple Ridge Developments");
    const raoEntry = refOn("E", "Rao Constructions");
    stub.setReply(
      JSON.stringify({
        suggestions: [
          { line: refOn("L", "NEFT-MAPLE RIDGE DEV"), entries: [mapleEntry, raoEntry], reason: "same amount; the description mentions Maple Ridge" },
          { line: refOn("L", "SMS ALERT CHGS"), entries: [], reason: "bank charges", create: { kind: "money", account: refOn("A", (await db.select().from(accounts).where(eq(accounts.id, code["6900"]!)))[0]!.name), contact: refOn("C", "HDFC Bank"), reason: "like the bank charges recorded in September" } },
        ],
      }),
    );
    const result = await json<AiBankSuggestions>(await suggest());
    const current = await view();
    const mapleLine = current.statementLines.find((l) => l.description === "NEFT-MAPLE RIDGE DEV")!.id;
    const entry = (sourceId: string) => current.entries.find((e) => e.sourceId === sourceId)!.journalLineId;
    expect(result.suggestions).toEqual([
      { statementLineId: mapleLine, rankedJournalLineIds: [entry(maplePayment), expect.any(String)], reason: "same amount; the description mentions Maple Ridge", create: null },
      {
        statementLineId: current.statementLines.find((l) => l.description === "SMS ALERT CHGS")!.id,
        rankedJournalLineIds: [],
        reason: "like the bank charges recorded in September",
        create: { kind: "money", accountId: code["6900"], accountName: expect.any(String), contactId: hdfc, contactName: "HDFC Bank", reason: "like the bank charges recorded in September" },
      },
    ]);
    // Kept: the page shows them without asking again.
    expect(current.aiSuggestions).toMatchObject({ looked: 2, suggestions: result.suggestions });
    const [request] = await db.select().from(aiRequests).where(and(eq(aiRequests.orgId, orgId), eq(aiRequests.feature, "bank_suggestions"))).orderBy(desc(aiRequests.createdAt)).limit(1);
    expect(request).toMatchObject({ outcome: "ok", entityType: "bank_reconciliation", entityId: recId });
  });

  it("nothing is matched until the person matches; a match from AI is saved as suggested by AI and its suggestion goes", async () => {
    const before = await view();
    expect(before.matches).toEqual([]);
    const maple = before.aiSuggestions!.suggestions.find((s) => s.rankedJournalLineIds.length)!;
    const ruled = before.suggestions[0]!;
    const after = await json<ReconciliationView>(
      await call("PUT", `/bank-reconciliations/${recId}/matches`, {
        matches: [
          { statementLineId: maple.statementLineId, journalLineIds: [maple.rankedJournalLineIds[0]], suggestedBy: "ai" },
          { statementLineId: ruled.statementLineId, journalLineIds: [ruled.journalLineId], suggestedBy: "rules" },
        ],
      }),
    );
    expect(after.matches.map((m) => m.suggestedBy).sort()).toEqual(["ai", "rules"]);
    const [stored] = await db.select().from(bankStatementLineMatches).where(eq(bankStatementLineMatches.statementLineId, maple.statementLineId));
    expect(stored!.suggestedBy).toBe("ai");
    expect(after.aiSuggestions!.suggestions.map((s) => s.statementLineId)).not.toContain(maple.statementLineId);
    // Saving by hand without saying who suggested it is the person's own match.
    const mine = await json<ReconciliationView>(await call("PUT", `/bank-reconciliations/${recId}/matches`, { matches: [{ statementLineId: ruled.statementLineId, journalLineIds: [ruled.journalLineId] }] }));
    expect(mine.matches).toEqual([{ statementLineId: ruled.statementLineId, journalLineIds: [ruled.journalLineId], suggestedBy: "person" }]);
  });

  it("only for someone who may reconcile and use AI; a finished reconciliation gets no suggestions", async () => {
    stub.setReply(JSON.stringify({ suggestions: [] }));
    expect((await suggest(viewer)).status).toBe(403);
    expect(await refusal(await suggest(reconciler))).toEqual({ status: 403, message: AI_NOT_ALLOWED_MESSAGE });
    await db.insert(teamPrivileges).values({ teamId: (await db.select().from(teamMemberships).innerJoin(member, eq(member.id, teamMemberships.memberId)).where(eq(member.userId, reconciler.userId)))[0]!.team_memberships.teamId, capability: "ai.use", granted: true });
    expect((await suggest(reconciler)).status).toBe(200);

    await json(await call("PUT", "/org/ai", { features: { bankSuggestions: false } }));
    expect((await suggest()).status).toBe(403);
    await json(await call("PUT", "/org/ai", { features: { bankSuggestions: true } }));
    expect((await callAs(owner)("POST", "/ai/bank-suggestions", { reconciliationId: randomUUID() })).status).toBe(404);
  });
});
