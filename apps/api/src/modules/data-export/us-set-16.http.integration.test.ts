import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DataExportSummary } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { auditLog, dataExports, files, member, session as sessionTable, user } from "../../db/schema";
import { EmailService, type SendEmailInput } from "../email/email.service";
import { QueueService } from "../queue/queue.service";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { DataExportService } from "./data-export.service";

type Who = { cookie: string; userId: string };

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) if (entry.isFile()) out.push(entry.name);
  return out;
}

/**
 * US-SET-16 — data exports stay private and short-lived: the download
 * answers 404 to anyone but an Owner of the organisation and after 7 days
 * (when the file is deleted from storage); preparing and downloading are
 * audit-logged; the ready email links to Settings › Data export, never to
 * the file. Requires local Postgres.
 */
describe("US-SET-16 · keep data exports private (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let service: DataExportService;
  const emails: string[] = [];
  const sent: SendEmailInput[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const coOwner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const outsider: Who = { cookie: "", userId: "" };
  let ready: DataExportSummary;
  let filesDir: string;
  const savedEnv = { STORAGE_DRIVER: process.env.STORAGE_DRIVER, FILES_DIR: process.env.FILES_DIR };

  const download = (who: Who | null, id = ready.id) => fetch(`${testApp.baseUrl}/org/exports/${id}/download`, { headers: who ? { cookie: who.cookie } : {} });

  async function newUser(name: string, role?: "owner" | "staff" | "field"): Promise<Who> {
    const email = `us-set-16-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    const who = await signUp(testApp.baseUrl, { email, password: "testpassword123", name });
    if (role) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    return who;
  }

  async function prepare(): Promise<DataExportSummary> {
    const res = await fetch(`${testApp.baseUrl}/org/exports`, {
      method: "POST",
      headers: { cookie: owner.cookie, "content-type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ formats: ["csv"], includeFiles: false }),
    });
    const created = (await res.json()) as DataExportSummary;
    await service.process(created.id);
    return ((await (await fetch(`${testApp.baseUrl}/org/exports`, { headers: { cookie: owner.cookie } })).json()) as { export: DataExportSummary }).export;
  }

  beforeAll(async () => {
    filesDir = await mkdtemp(path.join(tmpdir(), "spine-set16-"));
    process.env.STORAGE_DRIVER = "local";
    process.env.FILES_DIR = filesDir;
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    service = testApp.app.get(DataExportService);
    vi.spyOn(testApp.app.get(QueueService), "send").mockImplementation(async () => null);
    const emailService = testApp.app.get(EmailService);
    vi.spyOn(emailService, "isConfigured").mockReturnValue(true);
    vi.spyOn(emailService, "send").mockImplementation(async (input) => void sent.push(input));

    Object.assign(owner, await newUser("Alex Morgan"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(coOwner, await newUser("Jamie Owner", "owner"));
    Object.assign(staff, await newUser("Sarah Mendes", "staff"));
    Object.assign(field, await newUser("Marcus Webb", "field"));
    Object.assign(outsider, await newUser("Other Business"));
    ready = await prepare();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
    process.env.STORAGE_DRIVER = savedEnv.STORAGE_DRIVER;
    process.env.FILES_DIR = savedEnv.FILES_DIR;
    await rm(filesDir, { recursive: true, force: true });
  });

  it("only an Owner of the organisation can download it; everyone else gets 404", async () => {
    expect(ready.status).toBe("ready");
    const ok = await download(owner);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/zip");
    expect(ok.headers.get("cache-control")).toBe("no-store");
    await ok.arrayBuffer();
    expect((await download(coOwner)).status).toBe(200);
    for (const who of [staff, field, outsider, null]) expect((await download(who)).status).toBe(404);
    expect((await download(owner, randomUUID())).status).toBe(404);
  });

  it("is never served through /files/:id, not even to an Owner", async () => {
    const [row] = await db.select().from(dataExports).where(eq(dataExports.id, ready.id));
    expect((await fetch(`${testApp.baseUrl}/files/${row!.fileId}`, { headers: { cookie: owner.cookie } })).status).toBe(404);
  });

  it("preparing and downloading are in the audit log with the person", async () => {
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "data_export"), eq(auditLog.entityId, ready.id)));
    expect(rows.filter((r) => r.action === "prepared").map((r) => r.actorUserId)).toEqual([owner.userId]);
    expect(rows.filter((r) => r.action === "downloaded").map((r) => r.actorUserId).sort()).toEqual([owner.userId, coOwner.userId].sort());
  });

  it("the ready email links to Settings › Data export, never to the file", async () => {
    const mail = sent.find((m) => m.subject.endsWith("data export is ready"))!;
    expect(mail).toBeDefined();
    expect(mail.text).toContain("/dashboard?settings=data-export");
    expect(`${mail.text}${mail.html}`).not.toMatch(/\/org\/exports|\/files\//);
    expect((mail.attachments ?? []).some((a) => a.filename.endsWith(".zip"))).toBe(false);
  });

  it("after 7 days the link answers 404 and the file is gone from storage", async () => {
    const [row] = await db.select().from(dataExports).where(eq(dataExports.id, ready.id));
    const [stored] = await db.select().from(files).where(eq(files.id, row!.fileId!));
    expect(await listFiles(filesDir)).toContain(stored!.key.split("/").pop());
    await db.update(dataExports).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(dataExports.id, ready.id));

    expect((await download(owner)).status).toBe(404);
    const [after] = await db.select().from(dataExports).where(eq(dataExports.id, ready.id));
    expect(after).toMatchObject({ status: "expired", fileId: null });
    expect(await db.select().from(files).where(eq(files.id, stored!.id))).toHaveLength(0);
    expect(await listFiles(filesDir)).not.toContain(stored!.key.split("/").pop());
  });

  it("the hourly sweep deletes expired exports nobody opened", async () => {
    const second = await prepare();
    const [row] = await db.select().from(dataExports).where(eq(dataExports.id, second.id));
    await db.update(dataExports).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(dataExports.id, second.id));
    expect(await service.sweepExpired()).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(files).where(eq(files.id, row!.fileId!))).toHaveLength(0);
    const latest = ((await (await fetch(`${testApp.baseUrl}/org/exports`, { headers: { cookie: owner.cookie } })).json()) as { export: DataExportSummary }).export;
    expect(latest.status).toBe("expired");
  });
});
