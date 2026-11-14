import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PHOTO_ALREADY_DELETED_MESSAGE, PHOTO_LOCKED, PHOTO_NOT_YOURS, PHOTO_NOT_YOURS_MESSAGE, PHOTO_REASON_REQUIRED_MESSAGE, REASON_REQUIRED, photoLockedMessage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { jobAssignments, jobPhotos, jobs, member, milestones, session as sessionTable, teamMemberships, teamPrivileges, teams } from "../../db/schema";
import { customerWithJob } from "../mobile/field-user.test-helper";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { billPhoto } from "../../test-utils/bill-documents";

type Who = { cookie: string; userId: string };
type Photo = { id: string; fileId: string; caption: string | null; locked: boolean; lockedBy: string | null; canDelete: boolean };
type Activity = { type: string; actorName: string | null; detail: string | null };

/**
 * US-JOB-39 (D-277) — the person who added a photo can delete it while it's
 * open; Owners and Staff granted "Delete others' job photos" can delete
 * other people's; a locked photo (job Completed or Cancelled, milestone
 * invoiced) is Owner-only with a reason. The row is marked removed, the
 * change audited, and the stored file deleted. Requires local Postgres.
 */
describe("US-JOB-39 · delete a job photo added by mistake (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let jobId: string;
  let otherJobId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const staffOthers: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const refusal = async (res: Response) => {
    const body = (await res.json()) as { error?: string; message: string };
    return { status: res.status, error: body.error, message: body.message };
  };
  const addPhoto = async (who: Who, onJob: string, extra: { caption?: string; milestoneId?: string } = {}) => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(billPhoto())], { type: "image/png" }), "site.png");
    const file = await json<{ id: string }>(await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() }, body: form }));
    const photo = await json<{ id: string }>(await call(who, "POST", `/jobs/${onJob}/photos`, { fileId: file.id, ...extra }));
    return { id: photo.id, fileId: file.id };
  };
  const list = async (who: Who, onJob = jobId) => json<Photo[]>(await call(who, "GET", `/jobs/${onJob}/photos`));
  const remove = (who: Who, photoId: string, body?: unknown, onJob = jobId) => call(who, "DELETE", `/jobs/${onJob}/photos/${photoId}`, body ?? {});

  async function join(who: Who, role: "staff" | "field", capabilities: string[] = []) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const [row] = await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() }).returning();
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (capabilities.length) {
      const [team] = await db.insert(teams).values({ orgId, name: `Photos ${randomUUID()}` }).returning();
      await db.insert(teamPrivileges).values(capabilities.map((capability) => ({ teamId: team!.id, capability, granted: true })));
      await db.insert(teamMemberships).values({ teamId: team!.id, memberId: row!.id });
    }
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [field, "Marcus Webb"], [staff, "Kavya Iyer"], [staffOthers, "Ravi Kumar"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-job-39-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(field, "field");
    await join(staff, "staff", ["jobs.open", "job_photos.edit_own"]);
    await join(staffOthers, "staff", ["jobs.open", "job_photos.edit_own", "job_photos.edit_others"]);
    ({ jobId } = await customerWithJob(db, orgId));
    ({ jobId: otherJobId } = await customerWithJob(db, orgId));
    await db.insert(jobAssignments).values({ jobId, userId: field.userId, orgId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("the person who added a photo deletes it while the job is open: it leaves the list, its file is deleted and the activity says so", async () => {
    const mine = await addPhoto(field, jobId, { caption: "Wrong site" });
    expect((await list(field)).find((p) => p.id === mine.id)).toMatchObject({ locked: false, lockedBy: null, canDelete: true });

    expect((await json<{ id: string }>(await remove(field, mine.id))).id).toBe(mine.id);
    expect((await list(field)).map((p) => p.id)).not.toContain(mine.id);
    expect((await call(owner, "GET", `/files/${mine.fileId}`)).status).toBe(404);
    const [row] = await db.select().from(jobPhotos).where(eq(jobPhotos.id, mine.id));
    expect(row).toMatchObject({ removedByUserId: field.userId, removalReason: null, fileId: null });
    expect(row!.removedAt).not.toBeNull();

    const activity = await json<Activity[]>(await call(owner, "GET", `/jobs/${jobId}/activity`));
    expect(activity.find((a) => a.type === "photo_removed")).toMatchObject({ actorName: "Marcus Webb", detail: "Wrong site" });

    expect(await refusal(await remove(field, mine.id))).toMatchObject({ status: 404, message: PHOTO_ALREADY_DELETED_MESSAGE });
  });

  it("someone else's photo: Field and Staff without the grant are refused; Owners and Staff granted it can delete it", async () => {
    const ownersPhoto = await addPhoto(owner, jobId);
    // Each list says whether this person may delete it, by the same rules.
    for (const [who, may] of [[field, false], [staff, false], [staffOthers, true], [owner, true]] as const) {
      expect((await list(who)).find((p) => p.id === ownersPhoto.id)?.canDelete, who === field ? "field" : who === staff ? "staff" : who === owner ? "owner" : "staffOthers").toBe(may);
    }
    expect(await refusal(await remove(field, ownersPhoto.id))).toEqual({ status: 403, error: PHOTO_NOT_YOURS, message: PHOTO_NOT_YOURS_MESSAGE });
    expect(await refusal(await remove(staff, ownersPhoto.id))).toEqual({ status: 403, error: PHOTO_NOT_YOURS, message: PHOTO_NOT_YOURS_MESSAGE });
    expect((await remove(staffOthers, ownersPhoto.id)).status).toBe(200);

    const fieldsPhoto = await addPhoto(field, jobId);
    expect((await remove(owner, fieldsPhoto.id)).status).toBe(200);
  });

  it("Field can't reach a photo on a job they aren't assigned to", async () => {
    const elsewhere = await addPhoto(owner, otherJobId);
    expect((await remove(field, elsewhere.id, {}, otherJobId)).status).toBe(404);
  });

  it("a completed milestone's photos stay open; once it's invoiced they lock, and only an Owner can delete one, with a reason", async () => {
    const [milestone] = await db.insert(milestones).values({ jobId, orgId, name: "Steel structure", status: "completed", amount: 100 }).returning();
    const first = await addPhoto(field, jobId, { milestoneId: milestone!.id, caption: "Roof trusses" });
    const second = await addPhoto(field, jobId, { milestoneId: milestone!.id });
    expect((await list(field)).find((p) => p.id === first.id)).toMatchObject({ locked: false });

    await db.update(milestones).set({ status: "invoiced" }).where(eq(milestones.id, milestone!.id));
    expect((await list(field)).find((p) => p.id === first.id)).toMatchObject({ locked: true, lockedBy: "milestone_invoiced", canDelete: false });
    expect((await list(owner)).find((p) => p.id === first.id)).toMatchObject({ locked: true, canDelete: true });
    expect(await refusal(await remove(field, first.id))).toEqual({ status: 409, error: PHOTO_LOCKED, message: photoLockedMessage("milestone_invoiced") });
    expect(await refusal(await remove(staffOthers, first.id))).toMatchObject({ status: 409, error: PHOTO_LOCKED });
    expect(await refusal(await remove(owner, first.id))).toEqual({ status: 400, error: REASON_REQUIRED, message: PHOTO_REASON_REQUIRED_MESSAGE });
    expect(await refusal(await remove(owner, first.id, { reason: "   " }))).toMatchObject({ status: 400, error: REASON_REQUIRED });

    expect((await remove(owner, first.id, { reason: "Shows the neighbour's house" })).status).toBe(200);
    const [row] = await db.select().from(jobPhotos).where(eq(jobPhotos.id, first.id));
    expect(row!.removalReason).toBe("Shows the neighbour's house");
    const activity = await json<Activity[]>(await call(owner, "GET", `/jobs/${jobId}/activity`));
    expect(activity.find((a) => a.type === "photo_removed" && a.detail?.includes("neighbour"))).toMatchObject({ actorName: "Priya Raman", detail: "Roof trusses · Shows the neighbour's house" });
    // The other photo is still there, still locked.
    expect((await list(owner)).find((p) => p.id === second.id)).toMatchObject({ locked: true });
  });

  it("a Completed or Cancelled job locks all its photos", async () => {
    const photo = await addPhoto(field, jobId);
    for (const [status, lockedBy] of [["completed", "job_completed"], ["cancelled", "job_cancelled"]] as const) {
      await db.update(jobs).set({ status }).where(eq(jobs.id, jobId));
      expect((await list(field)).find((p) => p.id === photo.id)).toMatchObject({ locked: true, lockedBy });
      expect(await refusal(await remove(field, photo.id))).toEqual({ status: 409, error: PHOTO_LOCKED, message: photoLockedMessage(lockedBy) });
    }
    await db.update(jobs).set({ status: "active" }).where(eq(jobs.id, jobId));
    expect((await remove(field, photo.id)).status).toBe(200);
  });
});
