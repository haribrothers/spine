import { randomUUID } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { RequestMethod } from "@nestjs/common";
import { INTERCEPTORS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../db/client";
import { jobNotes, jobs, member, user } from "../db/schema";
import { createTestApp, signUp, type TestApp } from "../test-utils/test-app";

/**
 * Routes that take no Idempotency-Key, and why. Anything else that changes
 * data without the interceptor fails the introspection test below.
 */
const EXEMPT = new Set([
  // Public quote page: the customer has no session, and accepting or
  // declining is itself one-shot (a resolved quote refuses a second answer).
  "POST /public/quotes/:token/accept",
  "POST /public/quotes/:token/reject",
  // US-INV-24: a read sent as POST (the ids don't fit a URL); it changes
  // nothing, and it streams a ZIP the interceptor can't replay.
  "POST /invoices/bulk/pdf",
  // US-QUO-35: renders the unsaved quote as a PDF; it writes nothing, and the PDF isn't replayable.
  "POST /quotes/preview-pdf",
]);

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? controllerFiles(full) : full.endsWith(".controller.ts") ? [full] : [];
  });
}

/** Every non-GET route in every controller, and whether it uses IdempotencyInterceptor. */
async function mutatingRoutes(): Promise<{ route: string; idempotent: boolean }[]> {
  const routes: { route: string; idempotent: boolean }[] = [];
  for (const file of controllerFiles(path.resolve(__dirname, ".."))) {
    const mod = (await import(file)) as Record<string, unknown>;
    for (const exported of Object.values(mod)) {
      if (typeof exported !== "function" || !Reflect.hasMetadata(PATH_METADATA, exported)) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, exported));
      const classInterceptors: unknown[] = Reflect.getMetadata(INTERCEPTORS_METADATA, exported) ?? [];
      const proto = (exported as { prototype: Record<string, unknown> }).prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (typeof handler !== "function" || !Reflect.hasMetadata(METHOD_METADATA, handler)) continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
        if (method === RequestMethod.GET) continue;
        const sub = String(Reflect.getMetadata(PATH_METADATA, handler)).replace(/^\/$/, "");
        const route = `${RequestMethod[method]} /${[base, sub].filter(Boolean).join("/")}`;
        const interceptors = [...classInterceptors, ...((Reflect.getMetadata(INTERCEPTORS_METADATA, handler) as unknown[]) ?? [])];
        routes.push({ route, idempotent: interceptors.some((i) => (i as { name?: string })?.name === "IdempotencyInterceptor") });
      }
    }
  }
  return routes;
}

describe("US-OPS-08 · every mutating request is safe to repeat (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];
  let owner: { cookie: string; userId: string };
  let colleague: { cookie: string; userId: string };
  let jobIds: string[];

  const postNote = (who: { cookie: string }, jobId: string, key: string | null, body = "Arrived on site") =>
    fetch(`${testApp.baseUrl}/jobs/${jobId}/notes`, {
      method: "POST",
      headers: { cookie: who.cookie, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
      body: JSON.stringify({ body }),
    });
  const notesOn = async (jobId: string) => db.select().from(jobNotes).where(eq(jobNotes.jobId, jobId));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-ops-08-${randomUUID()}@example.com`;
    createdEmails.push(email);
    owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    const orgId = m!.organizationId;
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: owner.cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);
    jobIds = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.orgId, orgId)).limit(2)).map((j) => j.id);

    const colleagueEmail = `us-ops-08-colleague-${randomUUID()}@example.com`;
    createdEmails.push(colleagueEmail);
    colleague = await signUp(testApp.baseUrl, { email: colleagueEmail, password: "testpassword123", name: "Second Owner" });
    await db.update(member).set({ organizationId: orgId, isPrimaryOwner: false }).where(eq(member.userId, colleague.userId));
    const { session: sessionTable } = await import("../db/schema");
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, colleague.userId));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("every route that changes data uses the idempotency interceptor, apart from the listed public ones", async () => {
    const routes = await mutatingRoutes();
    expect(routes.length).toBeGreaterThan(100);
    const missing = routes.filter((r) => !r.idempotent && !EXEMPT.has(r.route)).map((r) => r.route);
    expect(missing).toEqual([]);
    // The exemptions must still exist, so the list can't silently go stale.
    for (const route of EXEMPT) expect(routes.map((r) => r.route)).toContain(route);
  });

  it("replays the first response for a repeated key instead of repeating the action", async () => {
    const key = randomUUID();
    const before = (await notesOn(jobIds[0]!)).length;
    const first = await postNote(owner, jobIds[0]!, key);
    const second = await postNote(owner, jobIds[0]!, key);
    expect(first.status).toBeLessThan(300);
    expect(second.status).toBeLessThan(300);
    expect(await second.json()).toEqual(await first.json());
    expect((await notesOn(jobIds[0]!)).length).toBe(before + 1);
  });

  it("refuses a change without a key (400)", async () => {
    expect((await postNote(owner, jobIds[0]!, null)).status).toBe(400);
  });

  it("scopes keys per user: two people sending the same key both get their change", async () => {
    const key = randomUUID();
    const before = (await notesOn(jobIds[0]!)).length;
    expect((await postNote(owner, jobIds[0]!, key, "From the owner")).status).toBeLessThan(300);
    expect((await postNote(colleague, jobIds[0]!, key, "From the colleague")).status).toBeLessThan(300);
    expect((await notesOn(jobIds[0]!)).length).toBe(before + 2);
  });

  it("scopes keys per record: the same key on another job is a new request", async () => {
    const key = randomUUID();
    const [a, b] = [(await notesOn(jobIds[0]!)).length, (await notesOn(jobIds[1]!)).length];
    await postNote(owner, jobIds[0]!, key);
    await postNote(owner, jobIds[1]!, key);
    expect((await notesOn(jobIds[0]!)).length).toBe(a + 1);
    expect((await notesOn(jobIds[1]!)).length).toBe(b + 1);
  });
});
