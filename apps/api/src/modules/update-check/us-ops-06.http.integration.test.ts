import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "@spine/shared";
import { spineVersion } from "../../common/version";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, settings } from "../../db/schema";
import { QueueService } from "../queue/queue.service";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { LATEST_RELEASE_URL, UPDATE_CHECK_KEY, UpdateCheckService } from "./update-check.service";
import { UpdateCheckWorker } from "./update-check.worker";

type Who = { cookie: string; userId: string };

const release = { tag_name: "v99.0.0", html_url: "https://github.com/haribrothers/spine/releases/tag/v99.0.0", draft: false, prerelease: false, body: "Notes" };

/** US-OPS-06 (D-055, D-269) — the daily check and the Owners-only update status. Requires local Postgres. */
describe("US-OPS-06 · tell owners a new version is available (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let service: UpdateCheckService;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const before = process.env.UPDATE_CHECK;
  const realFetch = globalThis.fetch;
  const get = (who: Who, path: string) => realFetch(`${testApp.baseUrl}${path}`, { headers: { cookie: who.cookie } });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    service = testApp.app.get(UpdateCheckService);
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-ops-06-${randomUUID()}@example.com`, password: "testpassword123", name: "Priya Raman" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [field, "field"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-ops-06-${role}-${randomUUID()}@example.com`, password: "testpassword123", name: role }));
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
  }, 60_000);

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.UPDATE_CHECK = before;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  /** Stubs GitHub; every other request (the test's own calls to the API) goes through. */
  function stubGitHub(answer: () => Response) {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.startsWith("https://api.github.com/")) return realFetch(input, init);
      calls.push({ url, init });
      return answer();
    });
    return calls;
  }

  it("the daily check asks GitHub Releases for the latest release and sends nothing about the install", async () => {
    process.env.UPDATE_CHECK = "";
    const calls = stubGitHub(() => Response.json(release));
    const record = await service.check(new Date("2026-11-04T04:17:00Z"));

    expect(record).toEqual({ latestVersion: "99.0.0", releaseUrl: release.html_url, checkedAt: "2026-11-04T04:17:00.000Z" });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.url).toBe(LATEST_RELEASE_URL);
    expect(call!.url).toBe("https://api.github.com/repos/haribrothers/spine/releases/latest");
    expect(call!.init?.method ?? "GET").toBe("GET");
    expect(call!.init?.body).toBeUndefined();
    // Only the headers GitHub needs: no version, no address, no business.
    expect(call!.init?.headers).toEqual({ Accept: "application/vnd.github+json", "User-Agent": "Spine" });
    const sent = JSON.stringify(call);
    for (const secret of [spineVersion(), process.env.APP_URL ?? "localhost:3000", orgId, owner.userId]) expect(sent).not.toContain(secret);
    const [row] = await db.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, UPDATE_CHECK_KEY)));
    expect(row?.value).toMatchObject({ latestVersion: "99.0.0" });
  });

  it("an Owner gets the running and latest versions; Staff and Field get 403", async () => {
    process.env.UPDATE_CHECK = "";
    const res = await get(owner, "/org/update-status");
    expect(res.status).toBe(200);
    expect((await res.json()) as UpdateStatus).toEqual({ current: spineVersion(), latest: "99.0.0", releaseUrl: release.html_url, checkedAt: "2026-11-04T04:17:00.000Z" });
    expect((await get(staff, "/org/update-status")).status).toBe(403);
    expect((await get(field, "/org/update-status")).status).toBe(403);
    // Nor through the generic settings routes.
    expect((await get(staff, `/org/settings/${UPDATE_CHECK_KEY}`)).status).toBe(403);
    expect(Object.keys((await (await get(owner, "/org/settings")).json()) as object)).not.toContain(UPDATE_CHECK_KEY);
  });

  it("a failed check, or a pre-release, keeps the last result", async () => {
    process.env.UPDATE_CHECK = "";
    stubGitHub(() => new Response("rate limited", { status: 403 }));
    expect(await service.check()).toBeNull();
    vi.restoreAllMocks();
    stubGitHub(() => Response.json({ ...release, tag_name: "v100.0.0-rc.1", prerelease: true }));
    expect(await service.check()).toBeNull();
    expect((await service.status(orgId)).latest).toBe("99.0.0");
  });

  it("with UPDATE_CHECK=off the server makes no outbound request, schedules nothing, and the status has no latest", async () => {
    process.env.UPDATE_CHECK = "off";
    const calls = stubGitHub(() => Response.json(release));
    const queue = testApp.app.get(QueueService);
    const schedule = vi.spyOn(queue, "schedule");
    const send = vi.spyOn(queue, "send");
    await testApp.app.get(UpdateCheckWorker).onModuleInit();
    expect(await service.check()).toBeNull();
    expect(calls).toHaveLength(0);
    expect(schedule).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect((await (await get(owner, "/org/update-status")).json()) as UpdateStatus).toEqual({ current: spineVersion() });
  });
});
