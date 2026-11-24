import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, jobs, member, numberSequences, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-JOB-22 — every job gets the next number from the org's Job sequence;
 * migration 0061 numbered existing jobs in creation order. Requires local
 * Postgres.
 */
describe("US-JOB-22 · number every job (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];

  async function newOrg() {
    const email = `us-job-22-${randomUUID()}@example.com`;
    emails.push(email);
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Alan Brooks", createdByUserId: owner.userId }).returning();
    return { ...owner, orgId, contactId: contact!.id };
  }

  const call = (cookie: string, method: string, url: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${url}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const createJob = async (o: Awaited<ReturnType<typeof newOrg>>, name: string) => {
    const res = await call(o.cookie, "POST", "/jobs", { contactId: o.contactId, name, currency: "USD" });
    expect(res.status).toBeLessThan(300);
    return (await res.json()) as { id: string; number: string };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  });

  afterAll(async () => {
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("numbers new jobs from the Job sequence: JOB-001, JOB-002", async () => {
    const o = await newOrg();
    expect((await createJob(o, "Kitchen fit-out")).number).toBe("JOB-001");
    expect((await createJob(o, "Bathroom refit")).number).toBe("JOB-002");
  });

  it("uses a changed prefix and starting number for the next job", async () => {
    const o = await newOrg();
    await createJob(o, "First");
    expect((await call(o.cookie, "PUT", "/org/numbering/job", { prefix: "WRK", padding: 4, nextValue: 50 })).status).toBeLessThan(300);
    expect((await createJob(o, "Second")).number).toBe("WRK-0050");
  });

  it("the number shows on the job and in the list", async () => {
    const o = await newOrg();
    const job = await createJob(o, "Deck");
    const one = (await (await call(o.cookie, "GET", `/jobs/${job.id}`)).json()) as { number: string };
    expect(one.number).toBe("JOB-001");
    const list = (await (await call(o.cookie, "GET", "/jobs")).json()) as { id: string; number: string }[];
    expect(list.find((j) => j.id === job.id)?.number).toBe("JOB-001");
  });

  it("a number can't repeat within an organisation", async () => {
    const o = await newOrg();
    const job = await createJob(o, "Deck");
    const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    await expect(db.insert(jobs).values({ orgId: o.orgId, contactId: o.contactId, name: "Copy", currency: "USD", number: row!.number })).rejects.toThrow();
  });

  it("migration 0061 numbers existing jobs in creation order and moves the sequence past them", async () => {
    const o = await newOrg();
    const base = { orgId: o.orgId, contactId: o.contactId, currency: "USD" };
    const [second] = await db.insert(jobs).values({ ...base, name: "Second", createdAt: new Date(Date.now() - 1000) }).returning();
    const [first] = await db.insert(jobs).values({ ...base, name: "First", createdAt: new Date(Date.now() - 5000) }).returning();
    await db.delete(numberSequences).where(and(eq(numberSequences.orgId, o.orgId), eq(numberSequences.documentType, "job")));

    // The backfill statements only (the column and index already exist).
    const statements = readFileSync(path.resolve(__dirname, "../../../drizzle/0061_job_numbers.sql"), "utf8")
      .split("--> statement-breakpoint")
      .filter((s) => !/ALTER TABLE|CREATE UNIQUE INDEX/.test(s));
    // Scoped to this test's organisation so other test data is left alone. Migration 0108 (US-ONB-17)
    // added `is_demo` to the sequences' unique key since, so the replayed upsert names it too.
    const scoped = (statement: string) =>
      statement
        .replace(/WHERE j\.number IS NULL/, `WHERE j.number IS NULL AND j.org_id = '${o.orgId}'`)
        .replace(/FROM jobs\nGROUP BY org_id/, `FROM jobs\nWHERE org_id = '${o.orgId}'\nGROUP BY org_id`)
        .replace("ON CONFLICT (org_id, document_type)", "ON CONFLICT (org_id, document_type, is_demo)");
    for (const statement of statements) await db.execute(sql.raw(scoped(statement)));

    const numberOf = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0]!.number;
    expect(await numberOf(first!.id)).toBe("JOB-001");
    expect(await numberOf(second!.id)).toBe("JOB-002");
    expect((await createJob(o, "Third")).number).toBe("JOB-003");
  });
});
