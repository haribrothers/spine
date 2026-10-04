import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-ONB-12 — the setup checklist is the Owners' alone. Requires local Postgres. */
describe("US-ONB-12 · show the setup checklist to owners only (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const secondOwner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const checklist = async (who: Who) => (await fetch(`${testApp.baseUrl}/dashboard/checklist`, { headers: { cookie: who.cookie } })).json() as Promise<Record<string, unknown>>;
  const dismiss = (who: Who) =>
    fetch(`${testApp.baseUrl}/dashboard/checklist/dismiss`, { method: "POST", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() } });

  async function newMember(name: string, role: "owner" | "staff" | "field"): Promise<Who> {
    const email = `us-onb-12-${name}-${randomUUID()}@example.com`;
    createdEmails.push(email);
    const who = await signUp(testApp.baseUrl, { email, password: "testpassword123", name });
    await db.delete(member).where(eq(member.userId, who.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    return who;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-onb-12-owner-${randomUUID()}@example.com`;
    createdEmails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" }));
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = m!.organizationId;
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: owner.cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);
    Object.assign(secondOwner, await newMember("second-owner", "owner"));
    Object.assign(staff, await newMember("staff", "staff"));
    Object.assign(field, await newMember("field", "field"));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("hides the checklist from Staff and Field", async () => {
    expect(await checklist(staff)).toEqual({ visible: false });
    expect(await checklist(field)).toEqual({ visible: false });
  });

  it("shows it to Owners, where demo data doesn't count as their own records", async () => {
    expect(await checklist(owner)).toMatchObject({ visible: true, hasCustomer: false, hasItem: false, hasSentQuote: false, dismissed: false });
  });

  it("only Owners can dismiss it, and dismissing hides it for every Owner", async () => {
    expect((await dismiss(staff)).status).toBe(403);
    expect(await checklist(owner)).toMatchObject({ dismissed: false });
    expect((await dismiss(owner)).status).toBeLessThan(300);
    expect(await checklist(secondOwner)).toMatchObject({ visible: true, dismissed: true });
  });
});
