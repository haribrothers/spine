import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, organization, settings, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService } from "../email/email.service";

/**
 * US-TEAM-15 — the organisation carries the business name: saving the
 * business profile renames it, invitations use it, and migration 0062
 * fixes existing installs. Requires local Postgres.
 */
describe("US-TEAM-15 · use the business name everywhere the organisation is named (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-team-15-${randomUUID()}@example.com`;
  let owner: { cookie: string; userId: string };
  let orgId: string;

  const saveProfile = (value: unknown) =>
    fetch(`${testApp.baseUrl}/org/settings/business_profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie },
      body: JSON.stringify({ value }),
    });
  const orgName = async () => (await db.select().from(organization).where(eq(organization.id, orgId)))[0]!.name;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Alex Morgan" });
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("starts as '<Owner>'s Organisation' and takes the business name when the profile is saved", async () => {
    expect(await orgName()).toBe("Alex Morgan's Organisation");
    expect((await saveProfile({ name: "Riverstone Builders" })).status).toBeLessThan(300);
    expect(await orgName()).toBe("Riverstone Builders");
  });

  it("an empty business name leaves the organisation's name alone", async () => {
    await saveProfile({ name: "Riverstone Builders" });
    await saveProfile({ name: "  " });
    expect(await orgName()).toBe("Riverstone Builders");
  });

  it("the invitation email says '<inviter> invited you to join <Business> as staff.'", async () => {
    await saveProfile({ name: "Riverstone Builders" });
    vi.spyOn(EmailService.prototype, "isConfigured").mockReturnValue(true);
    const send = vi.spyOn(EmailService.prototype, "send").mockResolvedValue();
    const invitee = `invitee-${randomUUID()}@example.com`;
    const res = await fetch(`${testApp.baseUrl}/org/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie },
      body: JSON.stringify({ email: invitee, role: "staff" }),
    });
    expect(res.status).toBeLessThan(300);
    // The invitee's email: the queue is shared by every test file, so another file's leftover email can be sent too.
    const sent = send.mock.calls.map(([mail]) => mail).find((mail) => mail.to === invitee)!;
    expect(sent.subject).toBe("Alex Morgan invited you to join Riverstone Builders on Spine");
    expect(sent.text).toContain("Alex Morgan invited you to join Riverstone Builders as staff.");
  });

  it("migration 0062 copies the business name into the organisation name where they differ", async () => {
    await db.update(settings).set({ value: { name: "Harbour Electrical" } }).where(eq(settings.orgId, orgId));
    await db.update(organization).set({ name: "Alex Morgan's Organisation" }).where(eq(organization.id, orgId));
    const migration = readFileSync(path.resolve(__dirname, "../../../drizzle/0062_org_name_from_business.sql"), "utf8");
    await db.execute(sql.raw(migration));
    expect(await orgName()).toBe("Harbour Electrical");
  });
});
