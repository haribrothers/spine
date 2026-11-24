import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { migrateOnStart } from "../../db/migrate-on-start";
import { contacts, member, organization, settings, user } from "../../db/schema";
import { databaseName, maintenanceUrl } from "../../test-utils/integration-databases";
import type { TestApp } from "../../test-utils/test-app";
import type { DemoBootstrapService } from "./demo-bootstrap.service";

/**
 * US-OPS-02 (D-086) — `SEED_DEMO` loads the demo business on first start
 * with no owner, and the first sign-up becomes its Primary Owner. "First
 * start" needs an empty database, so this file makes its own: a new
 * database, migrated, that the app is pointed at before it loads.
 * Requires local Postgres.
 */
describe("US-OPS-02 · start with demo data from an environment flag (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let bootstrap: DemoBootstrapService;
  let signUp: typeof import("../../test-utils/test-app").signUp;
  let freshUrl: string;
  const logs: string[] = [];
  const env = { SEED_DEMO: process.env.SEED_DEMO, SPINE_ALLOW_OPEN_SIGNUP: process.env.SPINE_ALLOW_OPEN_SIGNUP, DATABASE_URL: process.env.DATABASE_URL };

  beforeAll(async () => {
    const base = process.env.DATABASE_URL!;
    const name = `${databaseName(base)}_ops02`;
    const admin = postgres(maintenanceUrl(base), { max: 1, onnotice: () => {} });
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
    await admin.end();
    const url = new URL(base);
    url.pathname = `/${name}`;
    freshUrl = url.toString();
    await migrateOnStart(freshUrl);

    process.env.DATABASE_URL = freshUrl;
    delete process.env.SEED_DEMO;
    // Real sign-up rules: the test default keeps sign-up open.
    process.env.SPINE_ALLOW_OPEN_SIGNUP = "false";
    const record = (message: unknown) => void logs.push(String(message));
    vi.spyOn(Logger.prototype, "log").mockImplementation(record);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(record);
    vi.spyOn(Logger.prototype, "error").mockImplementation(record);

    const harness = await import("../../test-utils/test-app");
    signUp = harness.signUp;
    testApp = await harness.createTestApp();
    const { DemoBootstrapService } = await import("./demo-bootstrap.service");
    bootstrap = testApp.app.get(DemoBootstrapService);
    db = createDb(freshUrl);
  }, 180_000);

  afterAll(async () => {
    await testApp?.close();
    vi.restoreAllMocks();
    Object.assign(process.env, env);
    const admin = postgres(maintenanceUrl(env.DATABASE_URL!), { max: 1, onnotice: () => {} });
    await admin.unsafe(`drop database if exists "${databaseName(freshUrl)}" with (force)`).catch(() => undefined);
    await admin.end();
  });

  const signupStatus = async () => (await (await fetch(`${testApp.baseUrl}/public/signup-status`)).json()) as { open: boolean; newInstall: boolean };

  it("with SEED_DEMO unset, starting creates nothing", async () => {
    expect(await db.select().from(user)).toHaveLength(0);
    expect(await db.select().from(organization)).toHaveLength(0);
    expect(await bootstrap.run(undefined)).toBe("off");
    expect(await bootstrap.run("false")).toBe("off");
    expect(await db.select().from(organization)).toHaveLength(0);
  });

  it("an unknown value loads nothing and says what SEED_DEMO takes", async () => {
    expect(await bootstrap.run("yes please")).toBe("invalid");
    expect(await bootstrap.run("FR:construction")).toBe("invalid");
    expect(logs.some((l) => l.includes("isn't true, false or a country and an industry (e.g. IN:interior_design)"))).toBe(true);
    expect(await db.select().from(organization)).toHaveLength(0);
  });

  it("SEED_DEMO=true on an empty database loads the default demo business with no owner, and says the first sign-up owns it", async () => {
    process.env.SEED_DEMO = "true";
    await bootstrap.onApplicationBootstrap();
    expect(logs).toContain("Demo data loaded — the first person to sign up becomes its owner.");

    const orgs = await db.select().from(organization);
    expect(orgs.map((o) => o.name)).toEqual(["Riverstone Builders"]);
    const people = await db.select().from(member).where(eq(member.organizationId, orgs[0]!.id));
    expect(people.some((m) => m.isPrimaryOwner)).toBe(false);
    expect(people.every((m) => m.isDemo)).toBe(true);
    expect((await db.select().from(contacts).where(and(eq(contacts.orgId, orgs[0]!.id), eq(contacts.isDemo, true)))).length).toBeGreaterThan(0);
    expect(await signupStatus()).toMatchObject({ open: true, newInstall: true });
  }, 180_000);

  it("the first person to sign up becomes the demo business's Primary Owner, with onboarding skipped", async () => {
    const [demo] = await db.select().from(organization);
    const owner = await signUp(testApp.baseUrl, { email: `us-ops-02-${randomUUID()}@example.com`, password: "testpassword123", name: "First Person" });

    expect(await db.select().from(organization)).toHaveLength(1);
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    expect(membership).toMatchObject({ organizationId: demo!.id, role: "owner", isPrimaryOwner: true, isDemo: false });
    const owners = await db.select().from(member).where(and(eq(member.organizationId, demo!.id), eq(member.role, "owner")));
    expect(owners.map((m) => m.userId)).toEqual([owner.userId]);
    expect(await db.select().from(settings).where(eq(settings.key, "demo_awaiting_owner"))).toHaveLength(0);

    const onboarding = (await (await fetch(`${testApp.baseUrl}/org/settings/onboarding_status`, { headers: { cookie: owner.cookie } })).json()) as { value: { skipped: boolean } };
    expect(onboarding.value.skipped).toBe(true);
    const status = (await (await fetch(`${testApp.baseUrl}/demo-data/status`, { headers: { cookie: owner.cookie } })).json()) as { hasDemoData: boolean; loaded: { businessName: string } };
    expect(status).toMatchObject({ hasDemoData: true, loaded: { businessName: "Riverstone Builders" } });
    const list = await fetch(`${testApp.baseUrl}/contacts`, { headers: { cookie: owner.cookie } });
    expect(list.status).toBe(200);
  }, 120_000);

  it("after that, sign-up is invite-only again", async () => {
    expect(await signupStatus()).toMatchObject({ open: false, newInstall: false });
    await expect(signUp(testApp.baseUrl, { email: `us-ops-02-late-${randomUUID()}@example.com`, password: "testpassword123", name: "Late" })).rejects.toThrow(/403/);
  });

  it("starting again with SEED_DEMO=true and data in the database does nothing, and says it was skipped", async () => {
    logs.length = 0;
    await bootstrap.onApplicationBootstrap();
    expect(logs).toContain("Demo seeding skipped — the database already has data, so SEED_DEMO only loads into an empty one.");
    expect(await db.select().from(organization)).toHaveLength(1);
  });

  it("two sign-ups at the same moment can't both own a waiting demo business", async () => {
    const { claimDemoBusiness, DEMO_AWAITING_OWNER_KEY } = await import("../../auth/signup-policy");
    const now = new Date();
    const orgId = randomUUID();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of ids) await db.insert(user).values({ id, name: id, email: `${id}@example.com`, emailVerified: false, createdAt: now, updatedAt: now });
    await db.insert(organization).values({ id: orgId, name: "Race", slug: `org-${orgId}`, createdAt: now });
    await db.insert(settings).values({ orgId, key: DEMO_AWAITING_OWNER_KEY, value: { placeholderUserId: ids[0] } });
    const claims = await Promise.all([claimDemoBusiness(db, ids[1]!), claimDemoBusiness(db, ids[2]!)]);
    expect(claims.filter(Boolean)).toEqual([orgId]);
    expect(await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.isPrimaryOwner, true)))).toHaveLength(1);
  });
});
