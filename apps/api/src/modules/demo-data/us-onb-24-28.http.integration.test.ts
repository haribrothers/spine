import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, emailLog, files, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

const DAY = 24 * 60 * 60 * 1000;

interface Lead { id: string; title: string; ownerUserId: string | null; stageKind: string; stageChangedAt: string; updatedAt: string; expectedCloseDate: string | null; lastActivityAt: string | null; lostReason: string | null; lostNote: string | null }
interface Quote { id: string; title: string | null; status: string; sentAt: string | null; validUntil: string | null; isExpired: boolean; isSuperseded: boolean; viewCount?: number; respondedAt: string | null; leadId: string | null }
interface Job { id: string; status: string; endDate: string | null; sourceQuoteId: string | null; costBudgetAmount: string | null; percentComplete: number | null; readyToBillCount?: number; budgetState?: string; contactId: string; createdAt: string }

/**
 * US-ONB-24 to US-ONB-28 and US-ONB-30 (D-216, D-217) — demo data that shows the
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

      it("D-221 · demo payments read in order on their page, and no receipts go to demo customers", async () => {
        const payments = await get<{ id: string; date: string; appliedTo: { invoiceId: string }[] }[]>("/payments");
        expect(payments.length).toBeGreaterThan(0);
        // Newest first.
        expect([...payments].sort((a, b) => b.date.localeCompare(a.date)).map((p) => p.date)).toEqual(payments.map((p) => p.date));
        const applied_ = payments.filter((p) => p.appliedTo.length);
        expect(applied_.length).toBeGreaterThan(0);
        for (const p of applied_) {
          const activity = await get<{ type: string; at: string; actorName: string | null }[]>(`/payments/${p.id}/activity`);
          const recorded = activity.find((a) => a.type === "recorded")!;
          const applied = activity.filter((a) => a.type === "applied");
          // Recorded on its day, with the applying at the same moment and named.
          expect(recorded.at.slice(0, 10)).toBe(p.date.slice(0, 10));
          for (const a of applied) {
            expect(a.at.slice(0, 10)).toBe(p.date.slice(0, 10));
            expect(a.actorName).toBe("Demo Owner");
          }
          expect(activity.some((a) => a.type === "emailed")).toBe(false);
        }
        const receipts = await db.select({ id: emailLog.id }).from(emailLog).where(and(eq(emailLog.orgId, orgId), eq(emailLog.kind, "receipt")));
        expect(receipts).toHaveLength(0);
      });

      it("D-225 · demo bills' Activity reads on their own days, in order", async () => {
        const bills = await get<{ id: string; date: string; status: string }[]>("/vendor-bills");
        const recordedBills = bills.filter((b) => b.status !== "draft");
        expect(recordedBills.length).toBeGreaterThan(0);
        for (const b of recordedBills) {
          const activity = await get<{ type: string; at: string }[]>(`/vendor-bills/${b.id}/activity`);
          const at = (type: string) => activity.find((a) => a.type === type)?.at;
          // Entered and recorded on the bill date; paid and voided afterwards.
          expect(at("recorded")!.slice(0, 10)).toBe(b.date.slice(0, 10));
          expect(at("created")! <= at("recorded")!).toBe(true);
          for (const a of activity.filter((x) => x.type === "paid" || x.type === "voided")) expect(a.at >= at("recorded")!).toBe(true);
          expect(activity.map((a) => a.at)).toEqual([...activity.map((a) => a.at)].sort().reverse());
        }
      });

      it("US-ONB-30 · bills and vendor credits at every stage, and a recurring bill", async () => {
        const riverstone = demo.name === "Riverstone Builders";
        const bills = await get<{ id: string; billNumber: string; status: string; dueDate: string | null; totalAmount: string; amountPaid: string; balanceDue: string }[]>("/vendor-bills");
        const daysTo = (d: string | null) => (d ? Math.round((new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime() - Date.now()) / DAY) : null);
        expect(bills.filter((b) => b.status === "draft")).toHaveLength(2);
        expect(bills.filter((b) => b.status === "void")).toHaveLength(1);
        const partly = bills.filter((b) => b.status === "recorded" && BigInt(b.amountPaid) > 0n && BigInt(b.balanceDue) > 0n);
        expect(partly).toHaveLength(1);
        expect(daysTo(partly[0]!.dueDate)).toBeGreaterThanOrEqual(0);
        expect(daysTo(partly[0]!.dueDate)).toBeLessThanOrEqual(7);
        expect(bills.some((b) => b.status === "recorded" && BigInt(b.balanceDue) > 0n && (daysTo(b.dueDate) ?? 0) < 0)).toBe(true);

        const credits = await get<{ id: string; status: string; date: string; totalAmount: string; balanceAmount: string; billId: string | null }[]>("/vendor-credits");
        expect(credits).toHaveLength(riverstone ? 2 : 4);
        expect(credits.filter((c) => c.status === "draft")).toHaveLength(1);
        const partlyUsed = credits.filter((c) => c.status === "open" && BigInt(c.balanceAmount) < BigInt(c.totalAmount));
        expect(partlyUsed).toHaveLength(1);
        // It was raised against the overdue bill and applied there, on its own day after it was recorded.
        const overdue = bills.find((b) => b.id === partlyUsed[0]!.billId)!;
        expect((daysTo(overdue.dueDate) ?? 0) < 0).toBe(true);
        const activity = await get<{ type: string; at: string; linkId?: string | null }[]>(`/vendor-credits/${partlyUsed[0]!.id}/activity`);
        const at = (type: string) => activity.find((a) => a.type === type)!.at;
        expect(at("recorded").slice(0, 10)).toBe(partlyUsed[0]!.date.slice(0, 10));
        expect(at("applied") > at("recorded")).toBe(true);
        expect(activity.find((a) => a.type === "applied")!.linkId).toBe(overdue.id);
        if (!riverstone) {
          const unused = credits.filter((c) => c.status === "open" && c.balanceAmount === c.totalAmount && (daysTo(c.date) ?? 0) <= -60);
          expect(unused).toHaveLength(1);
          const used = credits.find((c) => c.status === "used")!;
          const refunds = (await get<{ refunds: { deletedAt: string | null }[] }>(`/vendor-credits/${used.id}`)).refunds;
          expect(refunds).toHaveLength(1);
        }

        const recurring = await get<{ status: string; nextRunOn: string | null; frequency: string }[]>("/recurring-bills");
        expect(recurring).toHaveLength(1);
        expect(recurring[0]).toMatchObject({ status: "active", frequency: "monthly" });
        expect(daysTo(recurring[0]!.nextRunOn)).toBeGreaterThan(0);
      });

      it("US-ONB-31 · demo expenses come with receipts and read on their own days", async () => {
        const riverstone = demo.name === "Riverstone Builders";
        const list = await get<{ id: string; date: string; status: string; description: string | null; receiptFileId: string | null; approvedAt: string | null }[]>("/expenses");
        const withReceipt = list.filter((e) => e.receiptFileId);
        expect(withReceipt).toHaveLength(riverstone ? 4 : 5);
        if (riverstone) expect(list.find((e) => e.description === "Fuel — no receipt attached")!.receiptFileId).toBeNull();
        // The receipt is a PDF served through the expense's own checks.
        const file = await fetch(`${testApp.baseUrl}/files/${withReceipt[0]!.receiptFileId}`, { headers: { cookie } });
        expect(file.status).toBe(200);
        expect(file.headers.get("content-type")).toContain("application/pdf");
        // Submitted on its date; approved the day after, never later than today.
        for (const e of list.filter((x) => x.status === "approved")) {
          const activity = await get<{ type: string; at: string }[]>(`/expenses/${e.id}/activity`);
          expect(activity.find((a) => a.type === "submitted")!.at.slice(0, 10)).toBe(e.date.slice(0, 10));
          expect(activity.find((a) => a.type === "approved")!.at >= activity.find((a) => a.type === "submitted")!.at).toBe(true);
          expect(new Date(e.approvedAt!).getTime()).toBeLessThanOrEqual(Date.now());
        }
      });

      it("US-ONB-32 · categories say what they're for; goods default to the rate expenses carry; one is archived", async () => {
        type Cat = { name: string; description: string | null; defaultTaxRateName: string | null; archivedAt: string | null };
        const cats = await get<Cat[]>("/expense-categories?includeArchived=true");
        const active = cats.filter((c) => !c.archivedAt);
        expect(active.length).toBeGreaterThan(0);
        for (const c of active) expect(c.description, c.name).toBeTruthy();
        expect(cats.find((c) => c.name === "Client entertainment")).toMatchObject({ description: "Meals and gifts for clients" });
        expect(cats.find((c) => c.name === "Client entertainment")!.archivedAt).not.toBeNull();
        const defaulted = active.filter((c) => c.defaultTaxRateName).map((c) => c.name);
        if (demo.name === "UK IT services") {
          expect(defaulted.sort()).toEqual(["Hardware for resale", "Hosting & cloud", "Software subscriptions", "Training & certification"]);
          expect(new Set(active.filter((c) => c.defaultTaxRateName).map((c) => c.defaultTaxRateName))).toEqual(new Set(["VAT 20%"]));
        } else {
          // India's GST splits by state and Riverstone's expenses carry no tax: no defaults.
          expect(defaulted).toEqual([]);
        }
        // The figures read the demo's expenses.
        const usage = await get<{ categoryId: string; expenseCount: number }[]>("/expense-categories/usage");
        expect(usage.reduce((n, u) => n + u.expenseCount, 0)).toBe((await get<unknown[]>("/expenses")).length);
      });

      it("US-ONB-33 · bills owing at every age but one, and vendor payments that read like real ones", async () => {
        const riverstone = demo.name === "Riverstone Builders";
        type Payables = { buckets: Record<string, string>; bills: { contactId: string; bucket: string; jobId: string | null }[]; vendors: { contactId: string; name: string; billCount: number }[]; dueSoon: { count: number } };
        const ap = await get<Payables>("/reports/payables");
        for (const age of ["0-30", "31-60", "90+"]) expect(BigInt(ap.buckets[age]!), age).toBeGreaterThan(0n);
        expect(ap.buckets["61-90"]).toBe("0");
        expect(ap.dueSoon.count).toBeGreaterThanOrEqual(1);
        // The part-paid bill's vendor also has the 90+ bill: two open bills to expand and pay together.
        const late = ap.bills.find((b) => b.bucket === "90+")!;
        const twoBills = ap.vendors.find((v) => v.contactId === late.contactId)!;
        expect(twoBills.billCount).toBe(2);
        if (riverstone) expect(twoBills.name).toBe("Apex Timber Supply");
        if (!riverstone) expect(ap.bills.find((b) => b.bucket === "31-60")!.jobId).not.toBeNull();

        type Payment = { id: string; method: string; reference: string | null; date: string; paidTo: { number: string }[] };
        const paid = await get<Payment[]>("/vendor-payments");
        for (const p of paid.filter((p) => p.method !== "cash")) expect(p.reference, p.method).toBeTruthy();
        if (riverstone) {
          expect(paid.map((p) => [p.method, p.reference])).toEqual([["bank_transfer", "ACH 552190"]]);
          return;
        }
        expect(new Set(paid.map((p) => p.method))).toEqual(new Set(["bank_transfer", "cheque", "cash"]));
        const ages = paid.map((p) => Math.round((Date.now() - new Date(`${p.date.slice(0, 10)}T12:00:00Z`).getTime()) / DAY));
        expect(Math.min(...ages)).toBeLessThanOrEqual(7);
        expect(Math.max(...ages)).toBeGreaterThanOrEqual(120);
        // One pays two bills; its remittance advice was emailed the day after it was recorded.
        const shared = paid.filter((p) => p.paidTo.length === 2);
        expect(shared).toHaveLength(1);
        const activity = await get<{ type: string; at: string; detail?: string | null }[]>(`/vendor-payments/${shared[0]!.id}/activity`);
        const recorded = activity.find((a) => a.type === "recorded")!;
        const emailed = activity.find((a) => a.type === "remittance_emailed")!;
        expect(emailed.detail).toMatch(/@/);
        expect(Math.round((new Date(emailed.at).getTime() - new Date(recorded.at).getTime()) / DAY)).toBe(1);
        expect(Math.round((Date.now() - new Date(recorded.at).getTime()) / DAY)).toBe(35);
        // Nothing was sent.
        expect((await db.select().from(emailLog).where(and(eq(emailLog.orgId, orgId), eq(emailLog.kind, "remittance")))).length).toBe(0);
      });

      it("US-ONB-34 · a card, transfers, money in and out, a statement and two reconciliations", async () => {
        type Account = { id: string; name: string; kind: string; balance?: string; lastReconciledOn?: string | null; unreconciledCount?: number; isDefault: boolean };
        const all = await get<Account[]>("/money-accounts");
        const card = all.find((a) => a.kind === "card" && a.name === "Business card")!;
        expect(card).toBeTruthy();
        // The subscription was paid off; the fuel is still owed.
        expect(BigInt(card.balance!)).toBeGreaterThan(0n);
        const bank = all.find((a) => a.kind === "bank" && a.isDefault)!;
        const today = new Date();
        const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
        const register = await get<{ rows: { sourceType: string; what: string }[] }>(`/money-accounts/${bank.id}/register?from=2000-01-01`);
        const kinds = register.rows.map((r) => r.what);
        expect(kinds.some((w) => /Money in — Interest Received/.test(w))).toBe(true);
        expect(kinds.some((w) => /Money out — Other Expenses/.test(w))).toBe(true);
        expect(kinds.some((w) => /Transfer to Cash in Hand/.test(w))).toBe(true);
        expect(kinds.some((w) => /Transfer to Business card/.test(w))).toBe(true);

        // Last month reconciled; this month in progress, with the SMS charge to create.
        const finished = await get<{ id: string; statementEndDate: string; finishedAt: string | null }[]>(`/bank-reconciliations?moneyAccountId=${bank.id}&status=finished`);
        expect(finished).toHaveLength(1);
        expect(finished[0]!.statementEndDate < firstOfMonth).toBe(true);
        expect(bank.lastReconciledOn).toBe(finished[0]!.statementEndDate);
        type View = { status: string; difference: string; statementLines: { description: string; status: string }[]; suggestions: unknown[]; outstanding: { amount: string }[] };
        const done = await get<View>(`/bank-reconciliations/${finished[0]!.id}`);
        expect(done.difference).toBe("0");
        // A cheque presented this month is outstanding at the end of last month.
        expect(done.outstanding.length).toBeGreaterThanOrEqual(1);
        const open = await get<{ id: string }[]>(`/bank-reconciliations?moneyAccountId=${bank.id}&status=in_progress`);
        if (today.getDate() >= 2) {
          expect(open).toHaveLength(1);
          const progress = await get<View>(`/bank-reconciliations/${open[0]!.id}`);
          expect(progress.statementLines.find((l) => l.description === "SMS ALERT CHGS")?.status).toBe("unmatched");
          expect(BigInt(progress.difference)).not.toBe(0n);
        }
      });

      it("deletes the demo's bundles, vendor credits and recurring bill with it", async () => {
        const receipts = (await get<{ receiptFileId: string | null }[]>("/expenses")).map((e) => e.receiptFileId).filter((id): id is string => !!id);
        const res = await fetch(`${testApp.baseUrl}/demo-data`, { method: "DELETE", headers: { cookie, "Idempotency-Key": randomUUID() } });
        expect(res.status).toBe(200);
        const result = (await res.json()) as { bundlesDeleted: number; vendorCreditsDeleted: number; recurringBillsDeleted: number };
        expect(result.bundlesDeleted).toBe(2);
        expect(result.vendorCreditsDeleted).toBe(demo.name === "Riverstone Builders" ? 2 : 4);
        expect(result.recurringBillsDeleted).toBe(1);
        expect(await get<unknown[]>("/catalog-bundles")).toHaveLength(0);
        expect(await get<unknown[]>("/vendor-credits")).toHaveLength(0);
        expect(await get<unknown[]>("/recurring-bills")).toHaveLength(0);
        expect(await get<unknown[]>("/vendor-bills")).toHaveLength(0);
        // US-ONB-34: the card, the statement and the reconciliations go too.
        const accountsAfter = await get<{ id: string; kind: string; isDefault: boolean }[]>("/money-accounts?includeArchived=true");
        expect(accountsAfter.find((a) => a.kind === "card")).toBeUndefined();
        const bankAfter = accountsAfter.find((a) => a.isDefault)!;
        expect(await get<unknown[]>(`/money-accounts/${bankAfter.id}/reconciliations`)).toHaveLength(0);
        expect(await get<unknown[]>(`/bank-reconciliations?moneyAccountId=${bankAfter.id}&status=in_progress`)).toHaveLength(0);
        // US-ONB-32: the archived category goes and the defaults are cleared; the template's categories stay.
        const catsAfter = await get<{ name: string; defaultTaxRateId: string | null }[]>("/expense-categories?includeArchived=true");
        expect(catsAfter.find((c) => c.name === "Client entertainment")).toBeUndefined();
        expect(catsAfter.length).toBeGreaterThan(0);
        expect(catsAfter.every((c) => c.defaultTaxRateId === null)).toBe(true);
        // US-ONB-31: the demo's receipts go with its expenses.
        const left = await db.select({ id: files.id }).from(files).where(inArray(files.id, receipts));
        expect(left).toHaveLength(0);
      });
    });
  }
});
