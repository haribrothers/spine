import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

const DAY = 24 * 60 * 60 * 1000;

interface Lead { id: string; title: string; ownerUserId: string | null; stageKind: string; stageChangedAt: string; updatedAt: string; expectedCloseDate: string | null; lastActivityAt: string | null; lostReason: string | null; lostNote: string | null }
interface Quote { id: string; title: string | null; status: string; sentAt: string | null; validUntil: string | null; isExpired: boolean; isSuperseded: boolean; viewCount?: number; respondedAt: string | null; leadId: string | null }
interface Job { id: string; status: string; endDate: string | null; sourceQuoteId: string | null; costBudgetAmount: string | null; percentComplete: number | null; readyToBillCount?: number; budgetState?: string; contactId: string; createdAt: string }

/**
 * US-ONB-24 to US-ONB-28 (D-216, D-217) — demo data that shows the
 * refined screens, for Riverstone Builders and a localised demo. Requires
 * local Postgres.
 */
describe("Demo data that shows the refined screens (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  for (const demo of [{ name: "Riverstone Builders", body: {} }, { name: "India construction", body: { country: "IN", industry: "construction" } }, { name: "UK IT services", body: { country: "GB", industry: "it_services" } }]) {
    describe(demo.name, () => {
      let cookie: string;
      let ownerId: string;
      let orgId: string;
      const get = async <T>(route: string) => (await (await fetch(`${testApp.baseUrl}${route}`, { headers: { cookie } })).json()) as T;

      it("loads", async () => {
        testApp ??= await createTestApp();
        db ??= createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
        const email = `us-onb-24-${randomUUID()}@example.com`;
        emails.push(email);
        const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Demo Owner" });
        cookie = owner.cookie;
        ownerId = owner.userId;
        orgId = (await db.select().from(member).where(eq(member.userId, ownerId)))[0]!.organizationId;
        const res = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(demo.body) });
        expect(res.status).toBeLessThan(300);
      }, 180_000);

      it("US-ONB-24 · a pipeline that's being worked", async () => {
        const leads = await get<Lead[]>("/leads");
        const open = leads.filter((l) => l.stageKind === "open");
        const owners = new Set(open.map((l) => l.ownerUserId));
        expect(owners.has(ownerId)).toBe(true);
        expect(owners.size).toBe(2);
        expect(leads.filter((l) => l.stageKind !== "open").every((l) => l.ownerUserId === ownerId)).toBe(true);

        const ages = open.map((l) => Math.round((Date.now() - new Date(l.stageChangedAt).getTime()) / DAY));
        expect(new Set(ages).size).toBeGreaterThan(1);
        expect(Math.max(...ages)).toBeGreaterThanOrEqual(14);
        for (const lead of open) expect(new Date(lead.expectedCloseDate!).getTime()).toBeGreaterThan(Date.now() - DAY);
        const cold = open.filter((l) => Date.now() - Math.max(new Date(l.updatedAt).getTime(), l.lastActivityAt ? new Date(l.lastActivityAt).getTime() : 0) >= 14 * DAY);
        expect(cold).toHaveLength(1);

        const lost = leads.filter((l) => l.stageKind === "lost" && l.lostReason === "price");
        expect(lost).toHaveLength(1);
        expect(lost[0]!.lostNote).toBeTruthy();
        expect(leads.some((l) => l.stageKind === "won" && Date.now() - new Date(l.stageChangedAt).getTime() <= 30 * DAY)).toBe(true);

        const history = await get<{ kind: string; toStage: string | null; at: string }[]>(`/leads/${lost[0]!.id}/history`);
        expect(history.map((h) => h.kind).sort()).toEqual(["created", ...Array(history.length - 1).fill("stage")].sort());
        const newestFirst = [...history].sort((a, b) => b.at.localeCompare(a.at));
        expect(newestFirst[0]!.toStage).toMatch(/lost/i);
      });

      it("US-ONB-25 · quotes at every stage", async () => {
        const quotes = await get<Quote[]>("/quotes");
        expect(quotes.every((q) => q.title)).toBe(true);
        const sent = quotes.filter((q) => q.status === "sent" && !q.isSuperseded);
        expect(new Set(quotes.filter((q) => q.sentAt).map((q) => q.sentAt!.slice(0, 10))).size).toBeGreaterThan(2);
        const days = (iso: string) => (new Date(iso).getTime() - Date.now()) / DAY;
        expect(sent.some((q) => !q.isExpired && q.validUntil && days(q.validUntil) <= 7)).toBe(true);
        expect(quotes.some((q) => q.status === "sent" && q.isExpired)).toBe(true);
        expect(sent.some((q) => (q.viewCount ?? 0) >= 2)).toBe(true);
        expect(sent.some((q) => (q.viewCount ?? 0) === 0)).toBe(true);

        const now = new Date();
        const accepted = quotes.filter((q) => q.status === "accepted");
        expect(accepted.some((q) => new Date(q.respondedAt!).getMonth() === now.getMonth() && new Date(q.respondedAt!).getFullYear() === now.getFullYear())).toBe(true);
        expect(quotes.filter((q) => q.status === "rejected")).toHaveLength(1);
        expect(quotes.filter((q) => q.leadId).length).toBeGreaterThan(quotes.length / 2);

        const jobs = await get<Job[]>("/jobs");
        const fromQuote = jobs.filter((j) => j.sourceQuoteId);
        expect(fromQuote).toHaveLength(1);
        const related = await get<{ jobs: { id: string }[]; lead: { id: string } | null }>(`/quotes/${fromQuote[0]!.sourceQuoteId}/related`);
        expect(related.jobs.map((j) => j.id)).toEqual([fromQuote[0]!.id]);
        expect(related.lead).not.toBeNull();
        const activity = await get<{ type: string }[]>(`/quotes/${fromQuote[0]!.sourceQuoteId}/activity`);
        expect(activity.map((a) => a.type)).toEqual(expect.arrayContaining(["converted_to_job", "accepted", "viewed", "sent"]));
      });

      it("US-ONB-26 · jobs that need something", async () => {
        const jobs = await get<Job[]>("/jobs?include=billing,costing");
        expect(jobs).toHaveLength(3);
        expect(jobs.every((j) => j.endDate)).toBe(true);
        expect(jobs.every((j) => j.costBudgetAmount)).toBe(true);
        expect(jobs.filter((j) => (j.readyToBillCount ?? 0) > 0)).toHaveLength(1);
        expect(jobs.filter((j) => j.budgetState === "near" || j.budgetState === "over")).toHaveLength(1);
        expect(jobs.filter((j) => j.percentComplete !== null)).toHaveLength(1);
        const done = jobs.filter((j) => j.status === "completed");
        expect(done).toHaveLength(1);
        expect(new Date(done[0]!.endDate!).getTime()).toBeLessThan(Date.now());
        for (const job of jobs) {
          const contact = await get<{ addresses: { type: string }[] }>(`/contacts/${job.contactId}`);
          expect(contact.addresses.map((a) => a.type)).toContain("site");
        }
      });

      it("US-ONB-27 · a catalogue and calendar that look kept", async () => {
        const [goods] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.code, "4000"), eq(accounts.orgId, orgId)));
        const items = await get<{ incomeAccountId: string | null }[]>("/catalog-items");
        expect(items.some((i) => i.incomeAccountId === goods!.id)).toBe(true);
        expect(items.some((i) => i.incomeAccountId === null)).toBe(true);
        expect(await get<unknown[]>("/catalog-bundles")).toHaveLength(2);

        const from = new Date(Date.now() - 30 * DAY).toISOString();
        const to = new Date(Date.now() + 30 * DAY).toISOString();
        const meetings = await get<{ startAt: string }[]>(`/meetings?from=${from}&to=${to}`);
        const times = new Set(meetings.map((m) => new Date(m.startAt).toTimeString().slice(0, 5)));
        expect(times.size).toBeGreaterThanOrEqual(3);
        const soon = meetings.filter((m) => new Date(m.startAt).getTime() > Date.now() - DAY && new Date(m.startAt).getTime() < Date.now() + 14 * DAY);
        expect(soon.length).toBeGreaterThanOrEqual(3);
      });

      it("US-ONB-28 · invoices at every stage", async () => {
        const list = await get<{ id: string; status: string; dueDate: string | null; isOverdue: boolean; balanceDue: string }[]>("/invoices");
        const issued = list.filter((i) => i.status === "issued");
        expect(issued.every((i) => i.dueDate)).toBe(true);
        const owed = issued.filter((i) => BigInt(i.balanceDue) > 0n);
        expect(owed.some((i) => i.isOverdue)).toBe(true);
        const days = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / DAY);
        expect(owed.some((i) => !i.isOverdue && days(i.dueDate!) >= 0 && days(i.dueDate!) <= 7)).toBe(true);

        const activities = await Promise.all(issued.map((i) => get<{ type: string; at: string; detail: string | null }[]>(`/invoices/${i.id}/activity`)));
        const emailed = activities.flat().filter((e) => e.type === "emailed");
        const reminded = activities.find((a) => a.some((e) => e.type === "reminder_sent"));
        expect(emailed.length).toBeGreaterThan(0);
        expect(emailed.every((e) => e.detail)).toBe(true);
        expect(reminded?.some((e) => e.type === "emailed")).toBe(true);
        // A localised demo's history happened over weeks, on the days it says.
        if (demo.name !== "Riverstone Builders") {
          expect(new Set(emailed.map((e) => e.at.slice(0, 10))).size).toBeGreaterThan(1);
          const remindedAt = reminded!.find((e) => e.type === "reminder_sent")!.at;
          expect(remindedAt.slice(0, 10)).not.toBe(reminded!.find((e) => e.type === "emailed")!.at.slice(0, 10));
          const issuedDays = new Set(activities.flat().filter((e) => e.type === "issued").map((e) => e.at.slice(0, 10)));
          expect(issuedDays.size).toBeGreaterThan(5);
        }
      });

      it("US-ONB-29 · credit notes off the invoice, kept, applied or refunded, with their tax", async () => {
        type Note = { id: string; status: string; totalAmount: string; taxAmount: string; creditRemainingAmount: string; offInvoiceAmount: string; appliedAmount: string; refundedAmount: string; issuedAt: string };
        const notes = (await get<Note[]>("/credit-notes")).filter((n) => n.status === "issued");
        expect(notes.length).toBe(3);
        expect(notes.some((n) => BigInt(n.offInvoiceAmount) > 0n)).toBe(true);
        expect(notes.some((n) => BigInt(n.refundedAmount) > 0n)).toBe(true);
        expect(notes.some((n) => BigInt(n.creditRemainingAmount) > 0n)).toBe(true);
        if (demo.name !== "Riverstone Builders") {
          expect(notes.some((n) => BigInt(n.appliedAmount) > 0n)).toBe(true);
          // Their tax is taken back, and they were issued on their own days this month.
          expect(notes.every((n) => BigInt(n.taxAmount) > 0n)).toBe(true);
          expect(new Set(notes.map((n) => n.issuedAt.slice(0, 10))).size).toBeGreaterThan(1);
          const month = new Date().toISOString().slice(0, 7);
          expect(notes.every((n) => n.issuedAt.slice(0, 7) === month)).toBe(true);
        }
      });

      it("deletes the demo's bundles with it", async () => {
        const res = await fetch(`${testApp.baseUrl}/demo-data`, { method: "DELETE", headers: { cookie, "Idempotency-Key": randomUUID() } });
        expect(res.status).toBe(200);
        expect(((await res.json()) as { bundlesDeleted: number }).bundlesDeleted).toBe(2);
        expect(await get<unknown[]>("/catalog-bundles")).toHaveLength(0);
      });
    });
  }
});
