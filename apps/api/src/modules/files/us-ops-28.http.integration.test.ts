import { randomUUID } from "node:crypto";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { files, member, notifications, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { FileIntegrityWorker } from "./file-integrity.worker";
import { DAMAGED_FILE_MESSAGE, sha256 } from "./files.service";

const pdf = (content: string) => Buffer.from(`%PDF-1.7\n${content}`);

interface FileResponse {
  id: string;
  key: string;
}

/**
 * US-OPS-28 through the real routes and the real weekly worker, with the
 * local driver on a temp folder. Requires local Postgres.
 */
describe("US-OPS-28 · stored files are proved intact (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let filesDir: string;
  const savedEnv = { STORAGE_DRIVER: process.env.STORAGE_DRIVER, FILES_DIR: process.env.FILES_DIR };
  const createdEmails: string[] = [];

  let orgId: string;
  let ownerUserId: string;
  let ownerCookie: string;
  let staffCookie: string;

  /** Uploads a PDF whose body is `content` (uploads are type-checked from their bytes, US-OPS-29). */
  async function upload(content: string, name = "receipt.pdf"): Promise<FileResponse> {
    const form = new FormData();
    form.append("file", new Blob([pdf(content)], { type: "application/pdf" }), name);
    const res = await fetch(`${testApp.baseUrl}/files`, {
      method: "POST",
      headers: { cookie: ownerCookie, "Idempotency-Key": randomUUID() },
      body: form,
    });
    expect(res.status).toBe(201);
    return (await res.json()) as FileResponse;
  }

  async function row(id: string) {
    const [found] = await db.select().from(files).where(eq(files.id, id));
    return found!;
  }

  beforeAll(async () => {
    filesDir = await mkdtemp(path.join(tmpdir(), "spine-ops28-http-"));
    delete process.env.STORAGE_DRIVER;
    process.env.FILES_DIR = filesDir;
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");

    const ownerEmail = `us-ops-28-owner-${randomUUID()}@example.com`;
    const staffEmail = `us-ops-28-staff-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, staffEmail);
    const owner = await signUp(testApp.baseUrl, { email: ownerEmail, password: "testpassword123", name: "Integrity Owner" });
    ownerCookie = owner.cookie;
    ownerUserId = owner.userId;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = membership!.organizationId;

    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Integrity Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  });

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length > 0) await db.delete(user).where(inArray(user.email, createdEmails));
    await rm(filesDir, { recursive: true, force: true });
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("stores each upload's SHA-256 with the file record", async () => {
    const content = "receipt for fuel, 42.00";
    const uploaded = await upload(content);
    expect((await row(uploaded.id)).checksumSha256).toBe(sha256(pdf(content)));
  });

  it("answers 409 with the restore message when a file's bytes no longer match", async () => {
    const uploaded = await upload("original signed quote");
    await writeFile(path.join(filesDir, uploaded.key), "bit rot happened here");

    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`, { headers: { cookie: ownerCookie } });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { message: string }).message).toBe(DAMAGED_FILE_MESSAGE);
    expect((await row(uploaded.id)).integrityProblem).toBe("damaged");
  });

  it("answers 409 when a file's bytes are missing", async () => {
    const uploaded = await upload("photo that will vanish");
    await unlink(path.join(filesDir, uploaded.key));

    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`, { headers: { cookie: ownerCookie } });
    expect(res.status).toBe(409);
    expect((await row(uploaded.id)).integrityProblem).toBe("missing");
  });

  it("shows Owners how many files are damaged or missing, and which", async () => {
    const res = await fetch(`${testApp.baseUrl}/files/integrity`, { headers: { cookie: ownerCookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { problemCount: number; message: string; files: { label: string; problem: string }[] };
    expect(body.problemCount).toBe(2);
    expect(body.message).toBe("2 stored files are damaged or missing — restore from your latest backup.");
    expect(body.files.map((f) => f.problem).sort()).toEqual(["damaged", "missing"]);
    expect(body.files[0]!.label).toBe("File “receipt.pdf”");
  });

  it("keeps the integrity summary Owner-only (403 for Staff)", async () => {
    const res = await fetch(`${testApp.baseUrl}/files/integrity`, { headers: { cookie: staffCookie } });
    expect(res.status).toBe(403);
  });

  it("the weekly run notifies Owners naming the affected records, and clears files that are intact again", async () => {
    const damaged = await upload("will be damaged", "damaged.pdf");
    await writeFile(path.join(filesDir, damaged.key), "garbage");
    const repaired = await upload("restored from backup", "repaired.pdf");
    await writeFile(path.join(filesDir, repaired.key), "garbage");
    await fetch(`${testApp.baseUrl}/files/${repaired.id}`, { headers: { cookie: ownerCookie } });
    expect((await row(repaired.id)).integrityProblem).toBe("damaged");
    // The owner restores the file from a backup.
    await writeFile(path.join(filesDir, repaired.key), pdf("restored from backup"));

    const problems = await testApp.app.get(FileIntegrityWorker).run();

    expect(problems.get(orgId)?.map((f) => f.id)).toContain(damaged.id);
    expect((await row(repaired.id)).integrityProblem).toBeNull();
    expect((await row(damaged.id)).integrityProblem).toBe("damaged");
    expect((await row(damaged.id)).integrityCheckedAt).not.toBeNull();

    // The run's own warning (the newest): how many it counts depends on the files already in this database.
    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.orgId, orgId), eq(notifications.recipientUserId, ownerUserId), eq(notifications.type, "files_damaged")))
      .orderBy(desc(notifications.createdAt))
      .limit(1);
    expect(notification?.message).toMatch(/^\d+ stored files? (is|are) damaged or missing — restore from your latest backup\./);
    expect(notification?.message).toContain("File “damaged.pdf”");
  });

  it("backfills a checksum for a file stored before checksums existed", async () => {
    const legacy = await upload("uploaded before US-OPS-28");
    await db.update(files).set({ checksumSha256: null }).where(eq(files.id, legacy.id));

    await testApp.app.get(FileIntegrityWorker).run();

    const after = await row(legacy.id);
    expect(after.checksumSha256).toBe(sha256(pdf("uploaded before US-OPS-28")));
    expect(after.integrityProblem).toBeNull();
  });

  it("shows nothing and sends nothing when every file matches", async () => {
    const cleanEmail = `us-ops-28-clean-${randomUUID()}@example.com`;
    createdEmails.push(cleanEmail);
    const clean = await signUp(testApp.baseUrl, { email: cleanEmail, password: "testpassword123", name: "Clean Owner" });
    const [membership] = await db.select().from(member).where(eq(member.userId, clean.userId));
    const form = new FormData();
    form.append("file", new Blob([pdf("intact")], { type: "application/pdf" }), "logo.pdf");
    await fetch(`${testApp.baseUrl}/files`, {
      method: "POST",
      headers: { cookie: clean.cookie, "Idempotency-Key": randomUUID() },
      body: form,
    });

    await testApp.app.get(FileIntegrityWorker).run();

    const res = await fetch(`${testApp.baseUrl}/files/integrity`, { headers: { cookie: clean.cookie } });
    expect(((await res.json()) as { problemCount: number; message: string | null })).toMatchObject({ problemCount: 0, message: null });
    const sent = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.orgId, membership!.organizationId), eq(notifications.type, "files_damaged")));
    expect(sent).toEqual([]);
  });
});
