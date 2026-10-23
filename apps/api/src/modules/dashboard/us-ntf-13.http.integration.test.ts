import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import {
  contacts,
  expenseCategories,
  expenses,
  invoices,
  jobAssignments,
  jobs,
  meetings,
  member,
  milestones,
  payments,
  quoteEvents,
  quotes,
  session as sessionTable,
  user,
} from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { EmailService, type SendEmailInput } from "../email/email.service";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { DigestService } from "./digest.service";

type Who = { cookie: string; userId: string; email: string };

/** Local time today, for meetings and "Send at". */
function todayAt(hours: number, minutes = 0): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * US-NTF-13 (D-093) — the daily digest: one email at the member's "Send
 * at" with their attention counts, today and yesterday; nothing to report
 * means no email; Field get no money; once a day. Requires local Postgres.
 */
describe("US-NTF-13 · get a daily digest by email (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let digest: DigestService;
  let sent: SendEmailInput[];
  const emails: string[] = [];
  let orgId: string;
  const owner = { cookie: "", userId: "", email: "" };
  const staff = { cookie: "", userId: "", email: "" };
  const field = { cookie: "", userId: "", email: "" };
  const lonely = { cookie: "", userId: "", email: "" };
  const morning = todayAt(7, 10);
  const today = orgClock(morning).date;

  const to = (who: Who) => sent.filter((m) => m.to === who.email);
  /** Everything the 7:10 run sent. */
  let morningRun: SendEmailInput[] = [];

  async function newUser(name: string, into: Who): Promise<void> {
    const email = `us-ntf-13-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(into, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }), { email });
  }

  async function join(who: Who, role: "staff" | "field") {
    await db.delete(member).where(eq(member.userId, who.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    digest = testApp.app.get(DigestService);
    await newUser("Alex Morgan", owner);
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await newUser("Sarah Mendes", staff);
    await join(staff, "staff");
    await newUser("Marcus Webb", field);
    await join(field, "field");
    await newUser("Quiet Owner", lonely);
    // Every day, so the test doesn't depend on the weekday it runs on.
    await db.update(user).set({ digestDays: "daily" }).where(inArray(user.id, [owner.userId, staff.userId, field.userId, lonely.userId]));
    await db.update(user).set({ digestEnabled: true }).where(eq(user.id, field.userId));

    const [maple] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const due = new Date(`${today}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() - 12);
    await db.insert(invoices).values({ orgId, contactId: maple!.id, status: "issued", number: "INV-0002", currency: "USD", totalAmount: 454250n, dueDate: due, issuedAt: due, createdByUserId: owner.userId });
    const [travel] = await db.insert(expenseCategories).values({ orgId, name: "Travel" }).returning();
    await db.insert(expenses).values([
      { orgId, categoryId: travel!.id, date: new Date(), currency: "USD", amount: 8500n, submittedByUserId: staff.userId },
      { orgId, categoryId: travel!.id, date: new Date(), currency: "USD", amount: 19200n, submittedByUserId: staff.userId },
      { orgId, categoryId: travel!.id, date: new Date(), currency: "USD", amount: 6400n, status: "rejected", reviewComment: "Receipt is unreadable", rejectedByUserId: owner.userId, rejectedAt: new Date(), submittedByUserId: field.userId },
    ]);
    await db.insert(meetings).values({ orgId, title: "Weekly crew scheduling", startAt: todayAt(14, 30), endAt: todayAt(15, 30), organizerUserId: owner.userId });
    const [job] = await db.insert(jobs).values({ orgId, contactId: maple!.id, name: "Marina office fit-out", currency: "USD", contractValueAmount: 9_000_000n, createdByUserId: owner.userId }).returning();
    await db.insert(jobAssignments).values({ orgId, jobId: job!.id, userId: field.userId });
    const inThreeDays = new Date(`${today}T00:00:00Z`);
    inThreeDays.setUTCDate(inThreeDays.getUTCDate() + 3);
    await db.insert(milestones).values({ orgId, jobId: job!.id, name: "Mobilisation & site setup", dueDate: inThreeDays });

    // Yesterday: a payment, an accepted quote, three quotes viewed.
    const yesterdayNoon = todayAt(12);
    yesterdayNoon.setDate(yesterdayNoon.getDate() - 1);
    const yesterday = orgClock(yesterdayNoon).date;
    await db.insert(payments).values({ orgId, contactId: maple!.id, date: new Date(`${yesterday}T00:00:00Z`), currency: "USD", amount: 500000n, method: "bank_transfer", createdByUserId: owner.userId });
    const viewed = await db
      .insert(quotes)
      .values([0, 1, 2].map((i) => ({ orgId, contactId: maple!.id, status: "sent" as const, number: `QUO-01${i}`, currency: "USD", totalAmount: 1000n, createdByUserId: owner.userId })))
      .returning();
    await db.insert(quotes).values({ orgId, contactId: maple!.id, status: "accepted", number: "QUO-0002", currency: "USD", totalAmount: 1425000n, respondedAt: yesterdayNoon, createdByUserId: owner.userId });
    await db.insert(quoteEvents).values([...viewed, viewed[0]!].map((q) => ({ orgId, quoteId: q.id, type: "viewed" as const, createdAt: yesterdayNoon })));
  }, 120_000);

  beforeEach(() => {
    sent = [];
    const email = testApp.app.get(EmailService);
    vi.spyOn(email, "isConfigured").mockReturnValue(true);
    vi.spyOn(email, "send").mockImplementation(async (input) => {
      sent.push(input);
    });
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("before 'Send at', nothing goes out", async () => {
    await digest.runDue(todayAt(6, 45));
    expect(to(owner)).toHaveLength(0);
  });

  // The run goes through every member in the shared test database (every earlier test's Owner is due at 7:10), so it gets longer than the default 5 s.
  it("at 'Send at' the Owner gets one email: attention counts, today, yesterday, Open dashboard and the footer", async () => {
    await digest.runDue(morning);
    morningRun = [...sent];
    const [mail] = to(owner);
    expect(to(owner)).toHaveLength(1);
    const day = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    expect(mail!.subject).toBe(`Your Spine day: 2 things need you · ${day}`);
    expect(mail!.text).toContain("Good morning, Alex");
    expect(mail!.text).toContain("Overdue invoices: 1 · $4,542.50");
    expect(mail!.text).toContain("Expenses waiting for approval: 2 · $277.00");
    expect(mail!.text).toContain("Today:\n2:30 PM · Weekly crew scheduling");
    expect(mail!.text).toMatch(/Due \w+ · Mobilisation & site setup \(Marina office fit-out\)/);
    expect(mail!.text).toContain("Yesterday:\n$5,000.00 received · 1 quote accepted ($14,250.00) · 3 quotes viewed");
    expect(mail!.text).toContain("Open dashboard:");
    expect(mail!.text).toContain("You get this daily digest because you're an owner of");
    expect(mail!.html).toContain("Open dashboard");
  }, 30_000);

  it("goes out once a day, however often the worker runs", async () => {
    await digest.runDue(todayAt(7, 25));
    expect(to(owner)).toHaveLength(0);
    const [row] = await db.select({ last: user.digestLastSentOn }).from(user).where(eq(user.id, owner.userId));
    expect(row!.last).toBe(today);
  });

  it("a Field user's digest has no money and says 'a member of'", async () => {
    const mail = morningRun.find((m) => m.to === field.email);
    expect(mail).toBeDefined();
    const all = `${mail!.subject}\n${mail!.text}`;
    expect(all).not.toMatch(/\$\d/);
    expect(all).toContain("Milestones due this week: 1");
    expect(all).toContain("Expenses sent back to you: 1");
    expect(all).not.toContain("Yesterday");
    expect(all).toContain("you're a member of");
  });

  it("Staff are off by default, and nothing to report means no email", async () => {
    await db.update(user).set({ digestLastSentOn: null }).where(inArray(user.id, [staff.userId, lonely.userId]));
    await digest.runDue(morning);
    expect(to(staff)).toHaveLength(0);
    expect(to(lonely)).toHaveLength(0);
    const [row] = await db.select({ last: user.digestLastSentOn }).from(user).where(eq(user.id, lonely.userId));
    expect(row!.last).toBe(today);
  });
});
