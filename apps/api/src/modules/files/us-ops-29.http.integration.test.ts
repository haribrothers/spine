import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { files, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { sha256 } from "./files.service";
import { fileKey } from "./storage/storage-driver";
import { MINIMAL_PDF, gpsLatitudeBytes, jpegWithGps, orientationEntry } from "./test-photos";
import { UNSUPPORTED_TYPE_MESSAGE } from "./upload-safety";

interface FileResponse {
  id: string;
  key: string;
  mimeType: string;
  originalFilename: string;
}

/**
 * US-OPS-29 through the real routes, with the local driver on a temp
 * folder. Requires local Postgres.
 */
describe("US-OPS-29 · only safe uploads are accepted and served (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let filesDir: string;
  const savedEnv = { STORAGE_DRIVER: process.env.STORAGE_DRIVER, FILES_DIR: process.env.FILES_DIR };
  const createdEmails: string[] = [];
  let ownerCookie: string;
  let orgId: string;

  async function post(bytes: Buffer, name: string, claimedType: string) {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: claimedType }), name);
    return fetch(`${testApp.baseUrl}/files`, {
      method: "POST",
      headers: { cookie: ownerCookie, "Idempotency-Key": randomUUID() },
      body: form,
    });
  }

  beforeAll(async () => {
    filesDir = await mkdtemp(path.join(tmpdir(), "spine-ops29-http-"));
    delete process.env.STORAGE_DRIVER;
    process.env.FILES_DIR = filesDir;
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");

    const email = `us-ops-29-owner-${randomUUID()}@example.com`;
    createdEmails.push(email);
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Upload Owner" });
    ownerCookie = owner.cookie;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = membership!.organizationId;
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

  it.each([
    ["a text file named like a PDF", Buffer.from("root:x:0:0:root:/root:/bin/bash\n"), "passwd.pdf", "application/pdf"],
    ["an HTML page claiming to be a photo", Buffer.from("<html><script>alert(1)</script></html>"), "photo.jpg", "image/jpeg"],
    ["an SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "logo.svg", "image/svg+xml"],
  ])("refuses %s with 415", async (_, bytes, name, claimedType) => {
    const res = await post(bytes, name, claimedType);
    expect(res.status).toBe(415);
    expect(((await res.json()) as { message: string }).message).toBe(UNSUPPORTED_TYPE_MESSAGE);
  });

  it("stores the type read from the bytes, not the one the browser claimed", async () => {
    const res = await post(MINIMAL_PDF, "quote.pdf", "text/plain");
    expect(res.status).toBe(201);
    expect(((await res.json()) as FileResponse).mimeType).toBe("application/pdf");
  });

  it("removes GPS location from a photo and keeps its orientation", async () => {
    const res = await post(jpegWithGps(), "site.jpg", "image/jpeg");
    expect(res.status).toBe(201);
    const uploaded = (await res.json()) as FileResponse;

    const stored = await readFile(path.join(filesDir, uploaded.key));
    expect(stored.includes(gpsLatitudeBytes())).toBe(false);
    expect(stored.includes(orientationEntry())).toBe(true);
    const [row] = await db.select().from(files).where(eq(files.id, uploaded.id));
    expect(row?.checksumSha256).toBe(sha256(stored));

    const served = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`, { headers: { cookie: ownerCookie } });
    expect(Buffer.from(await served.arrayBuffer()).includes(gpsLatitudeBytes())).toBe(false);
  });

  it("serves files with nosniff, the stored type and inline display for photos and PDFs", async () => {
    const uploaded = (await (await post(MINIMAL_PDF, "invoice.pdf", "application/pdf")).json()) as FileResponse;
    const res = await fetch(`${testApp.baseUrl}/files/${uploaded.id}`, { headers: { cookie: ownerCookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^inline; filename="invoice.pdf"/);
  });

  it("downloads (never renders) a file of any other type stored before type checks existed", async () => {
    const id = randomUUID();
    const key = fileKey(orgId, id);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await mkdir(path.join(filesDir, path.dirname(key)), { recursive: true });
    await writeFile(path.join(filesDir, key), svg);
    await db.insert(files).values({
      id,
      orgId,
      key,
      storageDriver: "local",
      originalFilename: "old-logo.svg",
      mimeType: "image/svg+xml",
      sizeBytes: svg.length,
      checksumSha256: sha256(svg),
    });

    const res = await fetch(`${testApp.baseUrl}/files/${id}`, { headers: { cookie: ownerCookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  it("keeps a path-like file name as a label only", async () => {
    // Hand-built multipart body: fetch's FormData would trim the name to "passwd.pdf".
    const boundary = `----spine${randomUUID()}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="../../etc/passwd.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      MINIMAL_PDF,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await fetch(`${testApp.baseUrl}/files`, {
      method: "POST",
      headers: { cookie: ownerCookie, "Idempotency-Key": randomUUID(), "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(res.status).toBe(201);
    const uploaded = (await res.json()) as FileResponse;
    // The multipart parser keeps only the base name; either way it's just a label.
    expect(uploaded.originalFilename).toBe("passwd.pdf");
    expect(uploaded.key).toBe(fileKey(orgId, uploaded.id));
    expect(uploaded.key).not.toContain("passwd");
    // Nothing was written outside the files folder.
    expect(await readdir(path.join(filesDir, ".."))).not.toContain("etc");
  });
});
