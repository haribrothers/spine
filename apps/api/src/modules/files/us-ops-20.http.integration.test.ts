import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import {
  contacts,
  expenseCategories,
  expenses,
  invoices,
  jobAssignments,
  jobPhotos,
  jobs,
  jobVariationOrders,
  member,
  quotes,
  session as sessionTable,
  teamMemberships,
  teamPrivileges,
  teams,
  user,
} from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { IssuedPdfService } from "../pdf/issued-pdf.service";
import { MINIMAL_PDF } from "./test-photos";

type Role = "staff" | "field";

/**
 * US-OPS-20 — read routes follow 07-security. Every case here fails if its
 * guard is removed. A demo-seeded org with an Owner, a Staff member with no
 * Team grants, a Staff member granted `reports.view_receivables`, a Field
 * user assigned to one job, and an outsider from another org. Requires
 * local Postgres; files on a temp folder.
 */
describe("US-OPS-20 · close the read-access gaps (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let filesDir: string;
  const savedEnv = { STORAGE_DRIVER: process.env.STORAGE_DRIVER, FILES_DIR: process.env.FILES_DIR };
  const createdEmails: string[] = [];

  let orgId: string;
  const owner = { cookie: "", userId: "" };
  const staff = { cookie: "", userId: "" };
  const staffWithReceivables = { cookie: "", userId: "" };
  const field = { cookie: "", userId: "" };
  const outsider = { cookie: "", userId: "" };
  let assignedJobId: string;
  let otherJobId: string;

  const get = (route: string, who: { cookie: string }) => fetch(`${testApp.baseUrl}${route}`, { headers: { cookie: who.cookie } });

  async function newUser(name: string) {
    const email = `us-ops-20-${name}-${randomUUID()}@example.com`;
    createdEmails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function joinOrg(signedUp: { userId: string }, role: Role): Promise<string> {
    await db.delete(member).where(eq(member.userId, signedUp.userId));
    const [row] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: signedUp.userId, role, createdAt: new Date() })
      .returning();
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, signedUp.userId));
    return row!.id;
  }

  async function upload(who: { cookie: string }, name = "file.pdf"): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([MINIMAL_PDF], { type: "application/pdf" }), name);
    const res = await fetch(`${testApp.baseUrl}/files`, {
      method: "POST",
      headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() },
      body: form,
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { id: string }).id;
  }

  beforeAll(async () => {
    filesDir = await mkdtemp(path.join(tmpdir(), "spine-ops20-"));
    delete process.env.STORAGE_DRIVER;
    process.env.FILES_DIR = filesDir;
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");

    const o = await newUser("owner");
    Object.assign(owner, o);
    const [m] = await db.select().from(member).where(eq(member.userId, o.userId));
    orgId = m!.organizationId;
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: owner.cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);

    const s = await newUser("staff");
    Object.assign(staff, s);
    await joinOrg(s, "staff"); // no Team, so no capabilities

    const r = await newUser("staff-receivables");
    Object.assign(staffWithReceivables, r);
    const memberId = await joinOrg(r, "staff");
    const [team] = await db.insert(teams).values({ orgId, name: `Receivables ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "reports.view_receivables", granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });

    const f = await newUser("field");
    Object.assign(field, f);
    await joinOrg(f, "field");

    Object.assign(outsider, await newUser("outsider"));

    const [assigned, other] = await db.select().from(jobs).where(eq(jobs.orgId, orgId)).limit(2);
    assignedJobId = assigned!.id;
    otherJobId = other!.id;
    await db.insert(jobAssignments).values({ jobId: assignedJobId, userId: field.userId, orgId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
    await rm(filesDir, { recursive: true, force: true });
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  describe("Owner-only routes", () => {
    it("refuses GET /org/invitations to Staff and Field (403)", async () => {
      expect((await get("/org/invitations", staff)).status).toBe(403);
      expect((await get("/org/invitations", field)).status).toBe(403);
      expect((await get("/org/invitations", owner)).status).toBe(200);
    });

    it("refuses loading and removing demo data to Staff and Field (403)", async () => {
      for (const who of [staff, field]) {
        const seed = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() } });
        expect(seed.status).toBe(403);
        const remove = await fetch(`${testApp.baseUrl}/demo-data`, { method: "DELETE", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() } });
        expect(remove.status).toBe(403);
      }
    });
  });

  it("never counts a Team from another organisation towards a member's grants", async () => {
    const [outsiderMembership] = await db.select().from(member).where(eq(member.userId, outsider.userId));
    const [foreignTeam] = await db.insert(teams).values({ orgId: outsiderMembership!.organizationId, name: `Foreign ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: foreignTeam!.id, capability: "reports.view_receivables", granted: true });
    const [staffMembership] = await db.select().from(member).where(eq(member.userId, staff.userId));
    await db.insert(teamMemberships).values({ teamId: foreignTeam!.id, memberId: staffMembership!.id });

    expect((await get("/reports/invoices-due-this-week", staff)).status).toBe(403);
    const caps = (await (await get("/org/members/me/capabilities", staff)).json()) as Record<string, boolean>;
    expect(caps["reports.view_receivables"]).toBe(false);
  });

  it("needs reports.view_receivables for invoices due this week", async () => {
    expect((await get("/reports/invoices-due-this-week", staff)).status).toBe(403);
    expect((await get("/reports/invoices-due-this-week", staffWithReceivables)).status).toBe(200);
    expect((await get("/reports/invoices-due-this-week", owner)).status).toBe(200);
  });

  describe("files are served only to people who can read the owning record", () => {
    it("job photos: Field only on jobs they're assigned to", async () => {
      const onAssigned = await upload(owner, "assigned.pdf");
      const onOther = await upload(owner, "other.pdf");
      await db.insert(jobPhotos).values([
        { jobId: assignedJobId, orgId, fileId: onAssigned },
        { jobId: otherJobId, orgId, fileId: onOther },
      ]);
      expect((await get(`/files/${onAssigned}`, field)).status).toBe(200);
      expect((await get(`/files/${onOther}`, field)).status).toBe(404);
      expect((await get(`/files/${onOther}`, staff)).status).toBe(200);
    });

    it("expense receipts: Field only on their own expenses", async () => {
      const [category] = await db.select().from(expenseCategories).where(eq(expenseCategories.orgId, orgId)).limit(1);
      const base = { orgId, categoryId: category!.id, date: new Date(), currency: "USD", amount: 4200n };
      const fieldReceipt = await upload(field, "my-fuel.pdf");
      const ownerReceipt = await upload(owner, "owner-fuel.pdf");
      await db.insert(expenses).values([
        { ...base, submittedByUserId: field.userId, receiptFileId: fieldReceipt },
        { ...base, submittedByUserId: owner.userId, receiptFileId: ownerReceipt },
      ]);
      expect((await get(`/files/${fieldReceipt}`, field)).status).toBe(200);
      expect((await get(`/files/${ownerReceipt}`, field)).status).toBe(404);
      expect((await get(`/files/${ownerReceipt}`, staff)).status).toBe(200);
    });

    it("invoice PDFs: never Field; Staff and Owner yes", async () => {
      const [invoice] = await db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued"))).limit(1);
      await testApp.app.get(IssuedPdfService).getOrStore(orgId, "invoice", invoice!.id);
      const [stored] = await db.select().from(invoices).where(eq(invoices.id, invoice!.id));
      const fileId = stored!.issuedPdfFileId!;
      expect((await get(`/files/${fileId}`, field)).status).toBe(404);
      expect((await get(`/files/${fileId}`, staff)).status).toBe(200);
      expect((await get(`/files/${fileId}`, owner)).status).toBe(200);
    });

    it("quote PDFs: Field only for quotes on jobs they're assigned to", async () => {
      // A variation-order quote on the assigned job is readable by Field too,
      // so "unrelated" must be neither the job's source quote nor one of them.
      const onAssignedJob = new Set(
        (await db.select({ id: jobVariationOrders.quoteId }).from(jobVariationOrders).where(eq(jobVariationOrders.jobId, assignedJobId))).map((r) => r.id),
      );
      const candidates = (
        await db
          .select()
          .from(quotes)
          .where(and(eq(quotes.orgId, orgId), ne(quotes.status, "draft"), isNotNull(quotes.number)))
          .orderBy(quotes.createdAt)
      ).filter((q) => !onAssignedJob.has(q.id));
      const [onJob, unrelated] = candidates;
      await db.update(jobs).set({ sourceQuoteId: onJob!.id }).where(eq(jobs.id, assignedJobId));
      const service = testApp.app.get(IssuedPdfService);
      const pdfOf = async (quoteId: string) => {
        await service.getOrStore(orgId, "quote", quoteId);
        const [q] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
        return q!.issuedPdfFileId!;
      };
      expect((await get(`/files/${await pdfOf(onJob!.id)}`, field)).status).toBe(200);
      expect((await get(`/files/${await pdfOf(unrelated!.id)}`, field)).status).toBe(404);
      expect((await get(`/files/${await pdfOf(unrelated!.id)}`, staff)).status).toBe(200);
    });

    it("contact logos: every member", async () => {
      const logo = await upload(owner, "logo.pdf");
      const [contact] = await db.select().from(contacts).where(eq(contacts.orgId, orgId)).limit(1);
      await db.update(contacts).set({ logoFileId: logo }).where(eq(contacts.id, contact!.id));
      expect((await get(`/files/${logo}`, field)).status).toBe(200);
      expect((await get(`/files/${logo}`, staff)).status).toBe(200);
    });

    it("a file not attached to anything yet: only its uploader and Owners", async () => {
      const byStaff = await upload(staff, "draft-upload.pdf");
      expect((await get(`/files/${byStaff}`, staff)).status).toBe(200);
      expect((await get(`/files/${byStaff}`, owner)).status).toBe(200);
      expect((await get(`/files/${byStaff}`, field)).status).toBe(404);
      expect((await get(`/files/${byStaff}`, staffWithReceivables)).status).toBe(404);
    });

    it("anyone outside the organisation: 404", async () => {
      const logo = await upload(owner, "private.pdf");
      expect((await get(`/files/${logo}`, outsider)).status).toBe(404);
    });
  });

  describe("expenses: Field reads only their own", () => {
    it("lists only Field's own expenses, even without ?mine=true", async () => {
      const res = await get("/expenses", field);
      expect(res.status).toBe(200);
      const rows = (await res.json()) as { submittedByUserId: string }[];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.submittedByUserId === field.userId)).toBe(true);
      // Staff on no Team see only their own too (US-TEAM-30), so compare with an Owner.
      const all = (await (await get("/expenses", owner)).json()) as unknown[];
      expect(all.length).toBeGreaterThan(rows.length);
    });

    it("hides someone else's expense and its history (404)", async () => {
      const [others] = await db.select().from(expenses).where(and(eq(expenses.orgId, orgId), ne(expenses.submittedByUserId, field.userId))).limit(1);
      expect((await get(`/expenses/${others!.id}`, field)).status).toBe(404);
      expect((await get(`/expenses/${others!.id}/history`, field)).status).toBe(404);
      expect((await get(`/expenses/${others!.id}`, owner)).status).toBe(200);
    });
  });
});
