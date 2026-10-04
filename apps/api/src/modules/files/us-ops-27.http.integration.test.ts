import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { files, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { signFileLink } from "./file-link";

interface FileResponse {
  id: string;
  orgId: string;
  key: string;
  storageDriver: string;
  sizeBytes: number;
}

/**
 * US-OPS-27 through the real routes: a fresh install (no storage
 * settings) stores uploads with the local driver and `GET /files/:id`
 * streams them with type, size, ETag and range support. Requires local
 * Postgres; storage is a temp folder.
 */
describe("US-OPS-27 · files over HTTP with the local driver (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let filesDir: string;
  const savedEnv = { STORAGE_DRIVER: process.env.STORAGE_DRIVER, FILES_DIR: process.env.FILES_DIR };
  const createdEmails: string[] = [];

  let ownerCookie: string;
  let otherOrgCookie: string;
  let orgId: string;
  let uploaded: FileResponse;
  // A real PDF header: uploads are type-checked from their bytes (US-OPS-29).
  const content = Buffer.from("%PDF-1.7 0123456789 site-plan");

  beforeAll(async () => {
    filesDir = await mkdtemp(path.join(tmpdir(), "spine-files-http-"));
    // A fresh install: no storage settings beyond where the volume is mounted.
    delete process.env.STORAGE_DRIVER;
    process.env.FILES_DIR = filesDir;

    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");

    const ownerEmail = `us-ops-27-owner-${randomUUID()}@example.com`;
    const otherEmail = `us-ops-27-other-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, otherEmail);
    const owner = await signUp(testApp.baseUrl, { email: ownerEmail, password: "testpassword123", name: "Files Owner" });
    ownerCookie = owner.cookie;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = membership!.organizationId;
    otherOrgCookie = (await signUp(testApp.baseUrl, { email: otherEmail, password: "testpassword123", name: "Other Org" })).cookie;

    const form = new FormData();
    form.append("file", new Blob([content], { type: "application/pdf" }), "../../etc/site plan.pdf");
    const res = await fetch(`${testApp.baseUrl}/files`, {
      method: "POST",
      headers: { cookie: ownerCookie, "Idempotency-Key": randomUUID() },
      body: form,
    });
    expect(res.status).toBe(201);
    uploaded = (await res.json()) as FileResponse;
  });

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length > 0) {
      await db.delete(user).where(inArray(user.email, createdEmails));
    }
    await rm(filesDir, { recursive: true, force: true });
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("saves the upload under the files folder, at a path built from ids only", async () => {
    expect(uploaded.storageDriver).toBe("local");
    expect(uploaded.key).toBe(`${orgId}/${uploaded.id.slice(0, 2)}/${uploaded.id}`);
    const info = await stat(path.join(filesDir, uploaded.key));
    expect(info.size).toBe(content.length);
    const [row] = await db.select().from(files).where(eq(files.id, uploaded.id));
    expect(row?.storageDriver).toBe("local");
  });

  it("streams the file back with its type, size, ETag and range support", async () => {
    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`, { headers: { cookie: ownerCookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-length")).toBe(String(content.length));
    expect(res.headers.get("etag")).toBe(`"${uploaded.id}"`);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(content);
  });

  it("answers a range request with 206 and just those bytes", async () => {
    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`, {
      headers: { cookie: ownerCookie, range: "bytes=11-14" },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 11-14/${content.length}`);
    expect(await res.text()).toBe("2345");
  });

  it("answers an impossible range with 416", async () => {
    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`, {
      headers: { cookie: ownerCookie, range: `bytes=${content.length}-` },
    });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe(`bytes */${content.length}`);
  });

  it("answers 304 when the browser already has this version", async () => {
    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`, {
      headers: { cookie: ownerCookie, "if-none-match": `"${uploaded.id}"` },
    });
    expect(res.status).toBe(304);
  });

  it("refuses a request with no session and no signed link (401)", async () => {
    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`);
    expect(res.status).toBe(401);
  });

  it("hides another organisation's file (404)", async () => {
    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`, { headers: { cookie: otherOrgCookie } });
    expect(res.status).toBe(404);
  });

  it("serves the file without a session through a valid signed link", async () => {
    const { exp, sig } = signFileLink(uploaded.id, process.env.AUTH_SECRET!);
    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}?exp=${exp}&sig=${sig}`);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(content);
  });

  it("refuses an expired or tampered signed link (403)", async () => {
    const expired = signFileLink(uploaded.id, process.env.AUTH_SECRET!, 60, Date.now() - 10 * 60 * 1000);
    const expiredRes = await fetch(`${testApp.baseUrl}/files/${uploaded.id}?exp=${expired.exp}&sig=${expired.sig}`);
    expect(expiredRes.status).toBe(403);

    const fresh = signFileLink(uploaded.id, process.env.AUTH_SECRET!);
    const tamperedRes = await fetch(`${testApp.baseUrl}/files/${uploaded.id}?exp=${fresh.exp + 1}&sig=${fresh.sig}`);
    expect(tamperedRes.status).toBe(403);
  });

  it("answers 404 for an id that isn't a file id", async () => {
    const res = await fetch(`${testApp.baseUrl}/files/not-a-uuid`, { headers: { cookie: ownerCookie } });
    expect(res.status).toBe(404);
  });
});
