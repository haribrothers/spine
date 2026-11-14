import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../../db/client";
import { invoices, member } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";

type Who = { cookie: string; userId: string };
type Gstr1Summary = { tables: Record<string, { count: number; taxableValue: string; tax: string }>; totals: { documents: number; tax: string } };
type Gstr1File = Record<string, unknown> & { b2b?: { inv: { inum: string }[] }[]; doc_issue?: { doc_det: { doc_num: number; docs: { from: string; to: string; totnum: number }[] }[] } };
type TaxSummary = { totalTaxable: string; collectedByRate: unknown[]; adjustments: unknown; bySupplyClass: unknown };

/**
 * D-276 (answers Q-21) — a retention-release invoice isn't a supply of its
 * own: the retention was taxed on the progress invoice that held it back
 * (D-130). GSTR-1 and the Tax Summary are the same before and after the
 * release, and voiding a release changes nothing either. Requires local Postgres.
 */
describe("D-276 · GSTR-1 and the Tax Summary leave retention releases out (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const owner: Who = { cookie: "", userId: "" };
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${month}-01`;
  let progressNumber = "";
  let releaseNumber = "";
  let releaseId = "";
  let before: { gstr1: Gstr1Summary; file: Gstr1File; tax: TaxSummary };
  let after: { gstr1: Gstr1Summary; file: Gstr1File; tax: TaxSummary };

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const snapshot = async () => ({
    gstr1: await json<Gstr1Summary>(await call("GET", `/exports/gstr1?period=${month}`)),
    file: await json<Gstr1File>(await call("GET", `/exports/gstr1?period=${month}&format=json`)),
    tax: await json<TaxSummary>(await call("GET", `/org/tax/summary?from=${monthStart}&to=${today}`)),
  });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `d-276-${randomUUID()}@example.com`, password: "testpassword123", name: "owner" }));
    expect((await db.select().from(member).where(eq(member.userId, owner.userId))).length).toBe(1);

    await json(await call("PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } }));
    await json(await call("PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call("PUT", "/org/tax/profile", { registrationNumber: "29AAACK0000A1ZK", stateCode: "29", legalName: "Kaveri Builders Private Limited" }));
    const contactId = (
      await json<{ id: string }>(
        await call("POST", "/contacts", { type: "customer", isCompany: true, name: "Lakeview Homes LLP", gstTreatment: "registered", taxId: "29AABFL0000B1ZA", addresses: [{ type: "billing", line1: "8 Indiranagar", stateCode: "29", isPrimary: true }] }),
      )
    ).id;

    // A job with 10% retention, billed in one milestone: ₹1,00,000 claimed, ₹10,000 held.
    const job = await json<{ id: string }>(await call("POST", "/jobs", { contactId, name: "Villa extension", currency: "INR", contractValueAmount: "10000000", retentionPct: 10 }));
    const [milestone] = (await json<{ milestones?: { id: string }[] } | { id: string }[]>(await call("PUT", `/jobs/${job.id}/milestones`, { milestones: [{ name: "Handover", amount: 100 }] }))) as { id: string }[];
    await json(await call("POST", `/jobs/${job.id}/milestones/${milestone!.id}/complete`, {}));
    const draft = await json<{ id: string }>(await call("POST", `/jobs/${job.id}/milestones/${milestone!.id}/invoice`));
    // The RA bill carries 18% GST on the full claim, retention included (D-130).
    const gst18 = (await json<{ id: string; name: string }[]>(await call("GET", "/tax-groups"))).find((g) => g.name === "GST 18%")!.id;
    await json(await call("PUT", `/invoices/${draft.id}`, { contactId, currency: "INR", issueDate: today, lines: [{ name: "Villa extension — Handover", quantity: 1, unitPriceAmount: "10000000", taxGroupId: gst18, hsnSac: "995414" }] }));
    const progress = await json<{ number: string; retentionAmount: string }>(await call("POST", `/invoices/${draft.id}/issue`));
    expect(progress.retentionAmount).toBe("1000000");
    progressNumber = progress.number;

    before = await snapshot();
    const release = await json<{ id: string; number: string; totalAmount: string; type: string }>(await call("POST", `/jobs/${job.id}/release-retention`));
    expect(release).toMatchObject({ type: "retention_release", totalAmount: "1000000" });
    releaseNumber = release.number;
    releaseId = release.id;
    after = await snapshot();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("GSTR-1's tables, totals and HSN summary don't change when retention is released", () => {
    expect(after.gstr1.tables).toEqual(before.gstr1.tables);
    expect(after.gstr1.totals).toEqual(before.gstr1.totals);
  });

  it("the JSON names the progress invoice but not the release, in B2B or in Documents issued", () => {
    const b2bNumbers = (after.file.b2b ?? []).flatMap((c) => c.inv.map((i) => i.inum));
    expect(b2bNumbers).toContain(progressNumber);
    expect(b2bNumbers).not.toContain(releaseNumber);
    const invoiceRanges = after.file.doc_issue?.doc_det.find((d) => d.doc_num === 1)?.docs ?? [];
    expect(invoiceRanges.reduce((n, r) => n + r.totnum, 0)).toBe(1);
    expect(invoiceRanges.map((r) => r.to)).not.toContain(releaseNumber);
  });

  it("the Tax Summary's taxable sales, rates and supply classes don't change", () => {
    expect(after.tax.totalTaxable).toBe(before.tax.totalTaxable);
    expect(after.tax.collectedByRate).toEqual(before.tax.collectedByRate);
    expect(after.tax.adjustments).toEqual(before.tax.adjustments);
    expect(after.tax.bySupplyClass).toEqual(before.tax.bySupplyClass);
  });

  it("voiding a release issued in an earlier period doesn't take it off this period's taxable sales", async () => {
    // As if the release had been issued last month and voided today.
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
    await db.update(invoices).set({ issueDate: lastMonth, issuedAt: lastMonth }).where(eq(invoices.id, releaseId));
    await json(await call("POST", `/invoices/${releaseId}/void`, { reason: "Released twice" }));
    const voided = await json<TaxSummary>(await call("GET", `/org/tax/summary?from=${monthStart}&to=${today}`));
    expect(voided.totalTaxable).toBe(after.tax.totalTaxable);
    expect(voided.adjustments).toEqual(after.tax.adjustments);
  });
});
