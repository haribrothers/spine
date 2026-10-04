import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/** RFC 4180 is overkill here: the demo's values contain no quotes or commas except the quoted contact names. */
function parse(csv: string): string[][] {
  return csv.split("\r\n").map((line) => (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []).slice(0, -1).map((f) => f.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')));
}

/**
 * US-PAY-10 / US-PUR-14 — receivables and payables export: one row per open
 * document with its bucket, plain decimal amounts, currency in its own
 * column, and the on-screen search applied. Requires local Postgres.
 */
describe("US-PAY-10, US-PUR-14 · export receivables and payables to CSV (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let seeded: { cookie: string };
  let empty: { cookie: string };

  const get = (who: { cookie: string }, path: string) => fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: who.cookie } });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const a = `us-pay-10-${randomUUID()}@example.com`;
    const b = `us-pur-14-${randomUUID()}@example.com`;
    emails.push(a, b);
    seeded = await signUp(testApp.baseUrl, { email: a, password: "testpassword123", name: "Owner" });
    empty = await signUp(testApp.baseUrl, { email: b, password: "testpassword123", name: "Owner" });
    const res = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: seeded.cookie, "Idempotency-Key": randomUUID() } });
    expect(res.status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-PAY-10: one row per open invoice with its bucket, decimal amounts and a currency column", async () => {
    const report = (await (await get(seeded, "/reports/receivables")).json()) as { invoices: { number: string; balanceDue: string; bucket: string }[] };
    const res = await get(seeded, "/reports/receivables/export.csv");
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="receivables-.*\.csv"/);
    const [header, ...rows] = parse(await res.text());
    expect(header).toEqual(["Invoice #", "Contact", "Currency", "Due date", "Total", "Balance due", "Days overdue", "Bucket"]);
    expect(rows).toHaveLength(report.invoices.length);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row[2]).toMatch(/^[A-Z]{3}$/);
      expect(row[4]).toMatch(/^-?\d+\.\d{2}$/);
      expect(row[5]).toMatch(/^-?\d+\.\d{2}$/);
      expect(row[7]).toBe(report.invoices.find((i) => i.number === row[0])!.bucket);
    }
  });

  it("US-PAY-10: the search on screen narrows the file the same way", async () => {
    const all = parse(await (await get(seeded, "/reports/receivables/export.csv")).text()).slice(1);
    const target = all[0]!;
    const byNumber = parse(await (await get(seeded, `/reports/receivables/export.csv?search=${encodeURIComponent(target[0]!.toLowerCase())}`)).text()).slice(1);
    expect(byNumber.map((r) => r[0])).toEqual([target[0]]);
    const byContact = parse(await (await get(seeded, `/reports/receivables/export.csv?search=${encodeURIComponent(target[1]!.toUpperCase())}`)).text()).slice(1);
    expect(byContact.every((r) => r[1] === target[1])).toBe(true);
    expect(parse(await (await get(seeded, "/reports/receivables/export.csv?search=no-such-thing")).text())).toHaveLength(1);
  });

  it("US-PUR-14: one row per open bill with its bucket and decimal amounts", async () => {
    const report = (await (await get(seeded, "/reports/payables")).json()) as { bills: unknown[] };
    const [header, ...rows] = parse(await (await get(seeded, "/reports/payables/export.csv")).text());
    expect(header).toEqual(["Bill #", "Contact", "Currency", "Due date", "Total", "Balance due", "Days overdue", "Bucket"]);
    expect(rows).toHaveLength(report.bills.length);
    for (const row of rows) {
      expect(row[2]).toMatch(/^[A-Z]{3}$/);
      expect(row[5]).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it("US-PUR-14: with no open bills the file has only the header row", async () => {
    const lines = (await (await get(empty, "/reports/payables/export.csv")).text()).split("\r\n");
    expect(lines).toEqual(["Bill #,Contact,Currency,Due date,Total,Balance due,Days overdue,Bucket"]);
  });
});
