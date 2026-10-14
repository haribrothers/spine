import { randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { files, jobPhotos, jobs, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { DEMO_SITE_PHOTOS } from "./demo-seeder.service";

const DEMO_DIR = path.resolve(__dirname, "../../../assets/demo");

/**
 * US-JOB-38 (D-215) — the demo's jobs show real site photos, bundled with
 * their sources and licence, and go when the demo data is deleted.
 * Requires local Postgres.
 */
describe("US-JOB-38 · show real site photos in the demo (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-job-38-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;

  const demoPhotos = async () =>
    db
      .select({ jobId: jobPhotos.jobId, milestoneId: jobPhotos.milestoneId, fileId: jobPhotos.fileId, name: files.originalFilename, mimeType: files.mimeType, sizeBytes: files.sizeBytes })
      .from(jobPhotos)
      .innerJoin(jobs, eq(jobPhotos.jobId, jobs.id))
      .innerJoin(files, eq(jobPhotos.fileId, files.id))
      .where(and(eq(jobs.orgId, orgId), eq(jobs.isDemo, true)));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Demo Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const res = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } });
    expect(res.status).toBeLessThan(300);
  }, 180_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("bundles each photo under 150 KB, with its source and licence recorded", () => {
    const sources = readFileSync(path.join(DEMO_DIR, "SOURCES.md"), "utf8");
    expect(sources).toContain("Unsplash License");
    for (const name of DEMO_SITE_PHOTOS) {
      expect(statSync(path.join(DEMO_DIR, name)).size).toBeLessThan(150 * 1024);
      expect(sources).toMatch(new RegExp(`\`${name}\` \\| https://unsplash\\.com/photos/\\S+ \\| \\S`));
    }
  });

  it("gives every demo job real site photos in place of the 1 × 1 placeholder", async () => {
    const photos = await demoPhotos();
    expect(photos.length).toBeGreaterThan(0);
    for (const photo of photos) {
      expect(photo.mimeType).toBe("image/jpeg");
      expect(DEMO_SITE_PHOTOS).toContain(photo.name);
      expect(photo.sizeBytes).toBeGreaterThan(10_000);
    }
    // Each job's kick-off photo is the next one along, and milestones have their own.
    const kickOffs = photos.filter((p) => !p.milestoneId);
    const jobCount = new Set(photos.map((p) => p.jobId)).size;
    expect(new Set(kickOffs.map((p) => p.fileId)).size).toBe(Math.min(jobCount, DEMO_SITE_PHOTOS.length));
  });

  it("deletes the demo jobs' photos with the demo data", async () => {
    const res = await fetch(`${testApp.baseUrl}/demo-data`, { method: "DELETE", headers: { cookie, "Idempotency-Key": randomUUID() } });
    expect(res.status).toBe(200);
    expect(await demoPhotos()).toEqual([]);
  });
});
