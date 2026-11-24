import { randomUUID } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DemoDataStatus } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { expenses, files, jobPhotos, jobs, meetingOccurrenceExceptions, meetings, member } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { FilesService } from "../files/files.service";
import { PHOTOS_SKIPPED_NOTE } from "./demo-seeder.service";

/**
 * US-ONB-09 — the demo business has a recurring meeting to edit one
 * occurrence of (finding C5), and loads without its files when file
 * storage is unreachable (NFR-REL-05). The photos themselves are
 * US-JOB-38's test (finding C10); every report and the trial balance are
 * US-ONB-18's. Requires local Postgres.
 */
describe("US-ONB-09 · load demo data to explore (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;

  const owner = async () => {
    const o = await signUp(testApp.baseUrl, { email: `us-onb-09-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    const [m] = await db.select().from(member).where(eq(member.userId, o.userId));
    return { cookie: o.cookie, orgId: m!.organizationId };
  };
  const seed = (cookie: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("the weekly planning meeting repeats, so one occurrence can be changed on its own", async () => {
    const { cookie, orgId } = await owner();
    const res = await seed(cookie);
    expect(res.status).toBe(201);
    expect(((await res.json()) as { notes: string[] }).notes).toEqual([]);

    const [weekly] = await db.select().from(meetings).where(and(eq(meetings.orgId, orgId), eq(meetings.title, "Weekly crew scheduling")));
    expect(weekly!.isDemo).toBe(true);
    expect(weekly!.recurrence).toMatchObject({ frequency: "weekly", interval: 1, end: { type: "count", count: 12 } });
    const others = await db.select().from(meetings).where(and(eq(meetings.orgId, orgId), eq(meetings.isDemo, true)));
    expect(others.filter((m) => m.recurrence)).toHaveLength(1);

    // "This event": the second week moves, the series stays.
    const second = new Date(weekly!.startAt.getTime() + 7 * 24 * 3600_000);
    const moved = new Date(second.getTime() + 3600_000);
    const update = await fetch(`${testApp.baseUrl}/meetings/${weekly!.id}`, {
      method: "PUT",
      headers: { cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "occurrence", occurrenceDate: second.toISOString(), startAt: moved.toISOString(), endAt: new Date(moved.getTime() + 3600_000).toISOString() }),
    });
    expect(update.status, await update.text()).toBe(200);
    const [after] = await db.select().from(meetings).where(eq(meetings.id, weekly!.id));
    expect(after!.startAt.toISOString()).toBe(weekly!.startAt.toISOString());
    expect(await db.select().from(meetingOccurrenceExceptions).where(eq(meetingOccurrenceExceptions.meetingId, weekly!.id))).toHaveLength(1);

    // Deleting the demo takes the series and the changed occurrence with it.
    expect((await fetch(`${testApp.baseUrl}/demo-data`, { method: "DELETE", headers: { cookie, "Idempotency-Key": randomUUID() } })).status).toBe(200);
    expect(await db.select().from(meetings).where(eq(meetings.id, weekly!.id))).toHaveLength(0);
    expect(await db.select().from(meetingOccurrenceExceptions).where(eq(meetingOccurrenceExceptions.meetingId, weekly!.id))).toHaveLength(0);
  }, 120_000);

  it("every industry's planning meeting repeats", async () => {
    const { cookie, orgId } = await owner();
    expect((await seed(cookie, { country: "IN", industry: "interior_design" })).status).toBe(201);
    const recurring = (await db.select().from(meetings).where(and(eq(meetings.orgId, orgId), eq(meetings.isDemo, true)))).filter((m) => m.recurrence);
    expect(recurring.map((m) => m.title)).toEqual(["Studio planning"]);
  }, 120_000);

  it("with file storage unreachable, loads without photos, receipts or a logo and says so", async () => {
    const { cookie, orgId } = await owner();
    const filesService = testApp.app.get(FilesService);
    const spy = vi.spyOn(filesService, "upload").mockRejectedValue(new ServiceUnavailableException("The file couldn't be saved."));
    let res: Response;
    let attempts: number;
    try {
      res = await seed(cookie);
      attempts = spy.mock.calls.length;
    } finally {
      spy.mockRestore();
    }
    expect(res.status).toBe(201);
    const body = (await res.json()) as { notes: string[]; jobsCreated: number };
    expect(body.notes).toEqual([PHOTOS_SKIPPED_NOTE]);
    expect(PHOTOS_SKIPPED_NOTE).toBe("Photos skipped — file storage isn't reachable.");
    // One attempt, then no more: the rest of the demo doesn't wait on storage again.
    expect(attempts).toBe(1);
    expect(body.jobsCreated).toBe(3);

    const demoJobs = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.isDemo, true)));
    expect(demoJobs).toHaveLength(3);
    expect(await db.select().from(jobPhotos).innerJoin(jobs, eq(jobPhotos.jobId, jobs.id)).where(eq(jobs.orgId, orgId))).toHaveLength(0);
    expect(await db.select().from(files).where(eq(files.orgId, orgId))).toHaveLength(0);
    expect((await db.select().from(expenses).where(eq(expenses.orgId, orgId))).length).toBeGreaterThan(0);
    const status = (await (await fetch(`${testApp.baseUrl}/demo-data/status`, { headers: { cookie } })).json()) as DemoDataStatus;
    expect(status.hasDemoData).toBe(true);
  }, 120_000);
});
