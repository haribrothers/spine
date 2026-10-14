import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { unzipSync, strFromU8 } from "fflate";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DataExportSummary } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { auditLog, member, session as sessionTable, settings, user } from "../../db/schema";
import { MINIMAL_PDF } from "../files/test-photos";
import { QueueService } from "../queue/queue.service";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { DataExportService } from "./data-export.service";

type Who = { cookie: string; userId: string };

/**
 * US-SET-15 (D-094) — `POST /org/exports` prepares a ZIP in the background:
 * one CSV and/or JSON per table with a header row, `files/` when asked,
 * and README.txt; `GET /org/exports` reports the latest. No secrets. Staff
 * and Field get 403. Requires local Postgres.
 */
describe("US-SET-15 · export all my data (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let exportsService: DataExportService;
  let queued: { exportId: string }[];
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  let filesDir: string;
  const savedEnv = { STORAGE_DRIVER: process.env.STORAGE_DRIVER, FILES_DIR: process.env.FILES_DIR };

  const post = (who: Who, body: unknown) =>
    fetch(`${testApp.baseUrl}/org/exports`, { method: "POST", headers: { cookie: who.cookie, "content-type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(body) });
  const latest = async () => ((await (await fetch(`${testApp.baseUrl}/org/exports`, { headers: { cookie: owner.cookie } })).json()) as { export: DataExportSummary | null }).export;
  const zipOf = async (id: string) => unzipSync(new Uint8Array(await (await fetch(`${testApp.baseUrl}/org/exports/${id}/download`, { headers: { cookie: owner.cookie } })).arrayBuffer()));

  async function prepare(body: unknown): Promise<DataExportSummary> {
    const res = await post(owner, body);
    expect(res.status).toBe(201);
    const summary = (await res.json()) as DataExportSummary;
    expect(summary.status).toBe("preparing");
    await exportsService.process(summary.id);
    return (await latest())!;
  }

  async function newUser(name: string, role?: "staff" | "field"): Promise<Who> {
    const email = `us-set-15-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    const who = await signUp(testApp.baseUrl, { email, password: "testpassword123", name });
    if (role) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    return who;
  }

  beforeAll(async () => {
    filesDir = await mkdtemp(path.join(tmpdir(), "spine-set15-"));
    process.env.STORAGE_DRIVER = "local";
    process.env.FILES_DIR = filesDir;
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    exportsService = testApp.app.get(DataExportService);
    queued = [];
    vi.spyOn(testApp.app.get(QueueService), "send").mockImplementation(async (name: string, data: object) => {
      if (name === "data-export") queued.push(data as { exportId: string });
      return null;
    });
    Object.assign(owner, await newUser("Alex Morgan"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(staff, await newUser("Sarah Mendes", "staff"));
    Object.assign(field, await newUser("Marcus Webb", "field"));

    await fetch(`${testApp.baseUrl}/contacts`, {
      method: "POST",
      headers: { cookie: owner.cookie, "content-type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ type: "customer", name: "Maple Ridge, Developments" }),
    });
    const form = new FormData();
    form.append("file", new Blob([MINIMAL_PDF], { type: "application/pdf" }), "signed contract.pdf");
    expect((await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: owner.cookie, "Idempotency-Key": randomUUID() }, body: form })).status).toBe(201);
    await db.insert(settings).values({ orgId, key: "smtp_password", value: { value: "hunter2" } });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
    process.env.STORAGE_DRIVER = savedEnv.STORAGE_DRIVER;
    process.env.FILES_DIR = savedEnv.FILES_DIR;
    await rm(filesDir, { recursive: true, force: true });
  });

  it("starts with no export", async () => {
    expect(await latest()).toBeNull();
  });

  it("prepares a ZIP of CSVs with header rows, files/ and README.txt in the background", async () => {
    const ready = await prepare({ formats: ["csv"], includeFiles: true });
    expect(queued.map((q) => q.exportId)).toContain(ready.id);
    expect(ready).toMatchObject({ status: "ready", formats: ["csv"], includeFiles: true, requestedBy: "Alex Morgan" });
    expect(ready.sizeBytes).toBeGreaterThan(0);
    expect(Date.parse(ready.expiresAt!) - Date.now()).toBeGreaterThan(6.9 * 86_400_000);

    const zip = await zipOf(ready.id);
    const names = Object.keys(zip);
    expect(names).toEqual(expect.arrayContaining(["contacts.csv", "invoices.csv", "journal_lines.csv", "members.csv", "settings.csv", "README.txt"]));
    const contacts = strFromU8(zip["contacts.csv"]!).split("\r\n");
    expect(contacts[0]).toMatch(/^id,orgId,/);
    expect(contacts.some((l) => l.includes('"Maple Ridge, Developments"'))).toBe(true);
    const pdf = names.find((n) => n.startsWith("files/") && n.endsWith("signed contract.pdf"))!;
    expect(Buffer.from(zip[pdf]!).equals(MINIMAL_PDF)).toBe(true);
    const readme = strFromU8(zip["README.txt"]!);
    expect(readme).toContain("contacts.csv — Customers and vendors. 1 row.");
    expect(readme).toContain("files/ —");
    expect(readme).toContain("never included");
  });

  it("never exports secrets", async () => {
    const ready = (await latest())!;
    const zip = await zipOf(ready.id);
    const all = Object.entries(zip)
      .filter(([n]) => !n.startsWith("files/") && n !== "README.txt")
      .map(([, v]) => strFromU8(v))
      .join("\n");
    expect(all).not.toContain("hunter2");
    expect(all).not.toMatch(/password|session_token|\$2[aby]\$/i);
    expect(Object.keys(zip).some((n) => /^(user|account|session|verification|jwks|quote_public_tokens|push_subscriptions|idempotency_keys)\./.test(n))).toBe(false);
    expect(strFromU8(zip["members.csv"]!).split("\r\n")[0]).toBe("userId,name,email,role,isActive,joinedAt");
  });

  it("offers JSON, and both formats in their own folders", async () => {
    const json = await prepare({ formats: ["json"], includeFiles: false });
    const jsonZip = await zipOf(json.id);
    expect(Object.keys(jsonZip).some((n) => n.startsWith("files/"))).toBe(false);
    const contacts = JSON.parse(strFromU8(jsonZip["contacts.json"]!)) as { name: string }[];
    expect(contacts.map((c) => c.name)).toEqual(["Maple Ridge, Developments"]);
    const both = await prepare({ formats: ["csv", "json"], includeFiles: false });
    const bothZip = await zipOf(both.id);
    expect(Object.keys(bothZip)).toEqual(expect.arrayContaining(["csv/contacts.csv", "json/contacts.json", "README.txt"]));
  });

  it("is Owner-only to prepare or list, and records the request in the audit log", async () => {
    expect((await post(staff, { formats: ["csv"], includeFiles: false })).status).toBe(403);
    expect((await post(field, { formats: ["csv"], includeFiles: false })).status).toBe(403);
    expect((await fetch(`${testApp.baseUrl}/org/exports`, { headers: { cookie: staff.cookie } })).status).toBe(403);
    expect((await post(owner, { formats: [], includeFiles: false })).status).toBe(400);
    const prepared = await db.select().from(auditLog).where(eq(auditLog.orgId, orgId));
    expect(prepared.filter((r) => r.entityType === "data_export" && r.action === "prepared" && r.actorUserId === owner.userId)).toHaveLength(3);
  });
});
