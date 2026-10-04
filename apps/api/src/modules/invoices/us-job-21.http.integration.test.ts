import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { percentageOf } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { invoices, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

interface InvoiceDetail {
  totalAmount: string;
  retentionAmount: string;
  subtotalAmount: string;
  discountAmount: string;
  balanceDue: string;
  job: { id: string; name: string } | null;
  milestone: { id: string; name: string; percent: number | null } | null;
  retention: { percent: string; heldOnJob: string } | null;
}

/** US-JOB-21 — a progress invoice shows what was held back. Demo-seeded org. Requires local Postgres. */
describe("US-JOB-21 · show retention on a progress invoice (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-job-21-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;

  const detail = async (id: string) => (await (await fetch(`${testApp.baseUrl}/invoices/${id}`, { headers: { cookie } })).json()) as InvoiceDetail;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = m!.organizationId;
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("shows the job, the milestone, retention held and the amount due on a progress invoice", async () => {
    const [withRetention] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued"), gt(invoices.retentionAmount, 0n)))
      .limit(1);
    const invoice = await detail(withRetention!.id);

    expect(invoice.job?.id).toBe(withRetention!.jobId);
    expect(invoice.job?.name).toBeTruthy();
    expect(invoice.milestone?.id).toBe(withRetention!.milestoneId);
    expect(invoice.retention?.percent).toBe(
      percentageOf(withRetention!.retentionAmount, withRetention!.subtotalAmount - withRetention!.discountAmount),
    );
    expect(Number(invoice.retention?.percent)).toBeGreaterThan(0);

    // Held on the job so far: the 1150 balance for the job, i.e. retention on its issued invoices not yet released.
    const onJob = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.jobId, withRetention!.jobId!), eq(invoices.status, "issued")));
    const releasedTypes = onJob.filter((i) => i.type === "retention_release").reduce((sum, i) => sum + i.totalAmount, 0n);
    const held = onJob.reduce((sum, i) => sum + i.retentionAmount, 0n) - releasedTypes;
    expect(BigInt(invoice.retention!.heldOnJob)).toBe(held);

    // Amount due excludes retention.
    expect(BigInt(invoice.balanceDue)).toBe(withRetention!.totalAmount - withRetention!.retentionAmount - withRetention!.amountPaid - withRetention!.creditedAmount);
  });

  it("has no retention details on an invoice without retention", async () => {
    const [plain] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.retentionAmount, 0n), isNull(invoices.jobId)))
      .limit(1);
    const invoice = await detail(plain!.id);
    expect(invoice.retention).toBeNull();
    expect(invoice.job).toBeNull();
  });

  it("formats a retention percentage to two decimals without trailing zeros", () => {
    expect(percentageOf(43750n, 437500n)).toBe("10");
    expect(percentageOf(750n, 10000n)).toBe("7.5");
    expect(percentageOf(1n, 3n)).toBe("33.33");
  });
});
