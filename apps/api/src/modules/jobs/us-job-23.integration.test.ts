import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { auditLog, contacts, jobs, member, quotes, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QuotesService } from "../quotes/quotes.service";
import { jobNameFromQuote } from "./job-name";
import { JobsService } from "./jobs.service";

/**
 * US-JOB-23 — a job converted from a quote is named after the quote's
 * first item and the customer, " (2)" on a repeat; old "Job for QUO-…"
 * names are renamed by migration 0060 with a history entry. Requires local
 * Postgres.
 */
describe("US-JOB-23 · name new jobs after their quote (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-job-23-${randomUUID()}@example.com`;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let jobsService: JobsService;

  async function acceptedQuote(lines: { type: "item" | "heading"; name: string }[]) {
    const quotesService = testApp.app.get(QuotesService);
    const quote = await quotesService.create(orgId, userId, {
      contactId,
      currency: "USD",
      lines: lines.map((l) => ({ ...l, quantity: 1, unitPriceAmount: l.type === "item" ? 10000n : 0n, discountPercentage: 0, taxRatePercentage: 0 })),
    } as never);
    await quotesService.send(orgId, quote.id, userId);
    await db.update(quotes).set({ status: "accepted" }).where(eq(quotes.id, quote.id));
    return (await db.select().from(quotes).where(eq(quotes.id, quote.id)))[0]!;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    userId = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" })).userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    contactId = (await db.insert(contacts).values({ orgId, type: "customer", name: "Sunstone Retail Fitouts", createdByUserId: userId }).returning())[0]!.id;
    jobsService = testApp.app.get(JobsService);
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("names the job '<first item> — <customer>', and ' (2)' when converted again", async () => {
    const quote = await acceptedQuote([{ type: "item", name: "Project management" }, { type: "item", name: "Window installation" }]);
    const first = await jobsService.createFromQuote(orgId, userId, quote.id);
    expect(first.name).toBe("Project management — Sunstone Retail Fitouts");
    const second = await jobsService.createFromQuote(orgId, userId, quote.id, 0, true);
    expect(second.name).toBe("Project management — Sunstone Retail Fitouts (2)");
  });

  it("skips headings to find the first item", async () => {
    const quote = await acceptedQuote([{ type: "heading", name: "Stage 1" }, { type: "item", name: "Site survey & assessment" }]);
    expect((await jobsService.createFromQuote(orgId, userId, quote.id)).name).toBe("Site survey & assessment — Sunstone Retail Fitouts");
  });

  it("the naming rule's fallbacks", () => {
    expect(jobNameFromQuote(null, "Alan Brooks", 1)).toBe("Work for Alan Brooks");
    expect(jobNameFromQuote("Outlets", null, 3)).toBe("Outlets (3)");
    expect(jobNameFromQuote(" ", " ", 1)).toBe("New job");
  });

  it("migration 0060 renames 'Job for <number>' jobs by the same rules and records it in history; renamed jobs are left alone", async () => {
    const quote = await acceptedQuote([{ type: "item", name: "Flooring installation (LVP)" }]);
    const base = { orgId, contactId, currency: "USD", contractValueAmount: 10000n, sourceQuoteId: quote.id, createdByUserId: userId };
    const [old1] = await db.insert(jobs).values({ ...base, name: `Job for ${quote.number}`, createdAt: new Date(Date.now() - 2000) }).returning();
    const [old2] = await db.insert(jobs).values({ ...base, name: `Job for ${quote.number}`, createdAt: new Date(Date.now() - 1000) }).returning();
    const [custom] = await db.insert(jobs).values({ ...base, name: "Shop floor — phase 2" }).returning();

    const migration = readFileSync(path.resolve(__dirname, "../../../drizzle/0060_job_names_from_quotes.sql"), "utf8");
    await db.execute(sql.raw(migration));

    const byId = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0]!.name;
    expect(await byId(old1!.id)).toBe("Flooring installation (LVP) — Sunstone Retail Fitouts");
    expect(await byId(old2!.id)).toBe("Flooring installation (LVP) — Sunstone Retail Fitouts (2)");
    expect(await byId(custom!.id)).toBe("Shop floor — phase 2");

    const [history] = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "job"), eq(auditLog.entityId, old1!.id)));
    expect(history!.changes).toEqual([{ field: "name", from: `Job for ${quote.number}`, to: "Flooring installation (LVP) — Sunstone Retail Fitouts" }]);
  });
});
