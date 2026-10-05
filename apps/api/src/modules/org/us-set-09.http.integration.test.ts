import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-SET-09 — the organisation theme is the `branding.themePreset` setting:
 * one of the four presets, changed by an Owner, read by every member.
 * Requires local Postgres.
 */
describe("US-SET-09 · pick a theme for the whole organisation (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const ownerEmail = `us-set-09-owner-${randomUUID()}@example.com`;
  const staffEmail = `us-set-09-staff-${randomUUID()}@example.com`;
  let ownerCookie: string;
  let staffCookie: string;

  const put = (cookie: string, value: unknown) =>
    fetch(`${testApp.baseUrl}/org/settings/branding`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: JSON.stringify({ value }),
    });
  const get = async (cookie: string) =>
    ((await (await fetch(`${testApp.baseUrl}/org/settings/branding`, { headers: { cookie } })).json()) as { value: Record<string, unknown> | null }).value;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email: ownerEmail, password: "testpassword123", name: "Owner" });
    ownerCookie = owner.cookie;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    const orgId = membership!.organizationId;

    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [ownerEmail, staffEmail]));
  });

  it("has no theme until one is chosen (the app falls back to Spine Blue)", async () => {
    expect(await get(ownerCookie)).toBeNull();
  });

  it("an Owner saves Harbour Teal and every member reads it", async () => {
    expect((await put(ownerCookie, { themePreset: "harbour-teal" })).status).toBeLessThan(300);
    expect(await get(ownerCookie)).toEqual({ themePreset: "harbour-teal" });
    expect(await get(staffCookie)).toEqual({ themePreset: "harbour-teal" });
  });

  it("keeps other branding fields when the theme changes", async () => {
    expect((await put(ownerCookie, { themePreset: "plum", documentFooter: "Thank you" })).status).toBeLessThan(300);
    expect(await get(ownerCookie)).toEqual({ themePreset: "plum", documentFooter: "Thank you" });
  });

  it("refuses a theme that isn't one of the presets and keeps the saved one", async () => {
    const res = await put(ownerCookie, { themePreset: "neon" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Choose one of the listed themes.");
    expect((await get(ownerCookie))?.themePreset).toBe("plum");
  });

  it("Reset to Spine defaults saves Spine Blue", async () => {
    expect((await put(ownerCookie, { themePreset: "spine-blue" })).status).toBeLessThan(300);
    expect((await get(staffCookie))?.themePreset).toBe("spine-blue");
  });

  it("Staff can't change the theme", async () => {
    expect((await put(staffCookie, { themePreset: "graphite" })).status).toBe(403);
    expect((await get(ownerCookie))?.themePreset).toBe("spine-blue");
  });
});
