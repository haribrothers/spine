import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DemoDataStatus } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoices, member } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-SET-08 — "Delete all demo data" removes every demo row and the demo
 * people's access, and keeps the person's own records. What deletion
 * removes row by row is US-ONB-17's test; Owner-only is US-OPS-20's.
 * Requires local Postgres.
 */
describe("US-SET-08 · remove demo data and keep my real data (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("deletes the demo and the demo people's access, keeps my own records, and the pane's status says so", async () => {
    const o = await signUp(testApp.baseUrl, { email: `us-set-08-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    const cookie = o.cookie;
    const orgId = (await db.select().from(member).where(eq(member.userId, o.userId)))[0]!.organizationId;
    const call = (method: string, path: string, body?: unknown) =>
      fetch(`${testApp.baseUrl}${path}`, { method, headers: { cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const status = async () => (await (await call("GET", "/demo-data/status")).json()) as DemoDataStatus;

    expect((await status()).hasDemoData).toBe(false);
    expect((await call("POST", "/demo-data/seed")).status).toBe(201);
    const mine = (await (await call("POST", "/contacts", { type: "customer", name: "Real Customer Ltd" })).json()) as { id: string };
    expect(await status()).toMatchObject({ hasDemoData: true, loaded: { businessName: "Riverstone Builders" } });
    const demoPeople = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.isDemo, true)));
    expect(demoPeople.length).toBeGreaterThan(0);

    expect((await call("DELETE", "/demo-data")).status).toBe(200);

    expect(await status()).toMatchObject({ hasDemoData: false, loaded: null });
    expect(await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.isDemo, true)))).toHaveLength(0);
    expect(await db.select().from(invoices).where(eq(invoices.orgId, orgId))).toHaveLength(0);
    // The demo people are no longer members, so the guards give them nothing here; the Owner stays.
    expect(await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.isDemo, true)))).toHaveLength(0);
    expect((await db.select().from(member).where(eq(member.organizationId, orgId))).map((m) => m.userId)).toEqual([o.userId]);
    expect((await db.select().from(contacts).where(eq(contacts.id, mine.id)))[0]).toMatchObject({ name: "Real Customer Ltd", isDemo: false });
  }, 120_000);
});
