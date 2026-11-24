import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "./client";
import { taxRates, user } from "./schema";
import { createTestApp, signUp, type TestApp } from "../test-utils/test-app";

/** US-TAX-07 — exact rates through the real API, and the real→numeric conversion. Requires local Postgres. */
describe("US-TAX-07 · store rates, quantities and percentages exactly (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-tax-07-${randomUUID()}@example.com`;
  let cookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    cookie = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Tax Owner" })).cookie;
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("saves a tax rate of 8.875% and reads back exactly 8.875", async () => {
    const res = await fetch(`${testApp.baseUrl}/tax-rates`, {
      method: "POST",
      headers: { cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New York", rate: 8.875 }),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; rate: number };
    expect(created.rate).toBe(8.875);
    const [row] = await db.execute<{ rate: string }>(sql`select rate::text from tax_rates where id = ${created.id}`);
    expect(row?.rate).toBe("8.8750");
    const [read] = await db.select().from(taxRates).where(eq(taxRates.id, created.id));
    expect(read?.rate).toBe(8.875);
  });

  it("converting existing real values to numeric(18,4) keeps their decimal value", async () => {
    // What migration 0056 does to every rate/quantity column, on values that floats can't hold exactly.
    const table = `tmp_real_${randomUUID().replace(/-/g, "")}`;
    await db.execute(sql.raw(`create temporary table ${table} (v real)`));
    await db.execute(sql.raw(`insert into ${table} values (8.875), (7.3), (0.1), (33.3333), (12.5)`));
    await db.execute(sql.raw(`alter table ${table} alter column v set data type numeric(18, 4)`));
    const rows = await db.execute<{ v: string }>(sql.raw(`select v::text as v from ${table}`));
    expect(rows.map((r) => r.v).sort((a, b) => Number(a) - Number(b))).toEqual(["0.1000", "7.3000", "8.8750", "12.5000", "33.3333"]);
  });
});
