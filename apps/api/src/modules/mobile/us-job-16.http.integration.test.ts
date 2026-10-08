import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, user } from "../../db/schema";
import { createTestApp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { bearer, bearerSignIn, customerWithJob, ownerWithFieldUser } from "./field-user.test-helper";

/**
 * US-JOB-16 — the phone's job feed (`GET /jobs?assignedToMe=true`) lists
 * exactly the jobs the caller is on the crew of, for every role. Requires
 * local Postgres.
 */
describe("US-JOB-16 · show field crew only their assigned jobs (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let ctx: Awaited<ReturnType<typeof ownerWithFieldUser>>;
  let token: string;
  const jobIds: string[] = [];

  const feed = async (headers: Record<string, string>) => {
    const res = await fetch(`${testApp.baseUrl}/jobs?assignedToMe=true`, { headers });
    expect(res.status).toBe(200);
    return ((await res.json()) as { id: string }[]).map((j) => j.id).sort();
  };
  const crew = (method: "POST" | "DELETE", jobId: string) =>
    fetch(`${testApp.baseUrl}/jobs/${jobId}/assignees${method === "DELETE" ? `/${ctx.fieldUserId}` : ""}`, {
      method,
      headers: { cookie: ctx.ownerCookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify({ userId: ctx.fieldUserId }) : undefined,
    });

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ctx = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    for (let i = 0; i < 3; i++) jobIds.push((await customerWithJob(db, ctx.orgId)).jobId);
    token = (await bearerSignIn(testApp.baseUrl, ctx.fieldEmail, "testpassword123")).token!;
  }, 60_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("lists exactly the two jobs Marcus is assigned to", async () => {
    expect((await crew("POST", jobIds[0]!)).status).toBeLessThan(300);
    expect((await crew("POST", jobIds[1]!)).status).toBeLessThan(300);
    expect(await feed(bearer(token))).toEqual([jobIds[0], jobIds[1]].sort());
  });

  it("drops a job from his list once he's taken off its crew", async () => {
    expect((await crew("DELETE", jobIds[1]!)).status).toBe(200);
    expect(await feed(bearer(token))).toEqual([jobIds[0]]);
    expect((await fetch(`${testApp.baseUrl}/jobs/${jobIds[1]}`, { headers: bearer(token) })).status).toBe(404);
  });

  it("gives an Owner who is on no crew an empty feed", async () => {
    const [owner] = await db.select().from(member).where(eq(member.organizationId, ctx.orgId));
    expect(owner).toBeTruthy();
    expect(await feed({ cookie: ctx.ownerCookie })).toEqual([]);
  });
});
