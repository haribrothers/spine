import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-INV-16 — payment instructions live in `business_profile` and are at
 * most 600 characters, checked by the API as well as the form. Requires
 * local Postgres.
 */
describe("US-INV-16 · set payment instructions in Settings (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-16-${randomUUID()}@example.com`;
  let cookie: string;

  const put = (value: unknown) =>
    fetch(`${testApp.baseUrl}/org/settings/business_profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: JSON.stringify({ value }),
    });
  const get = async () => ((await (await fetch(`${testApp.baseUrl}/org/settings/business_profile`, { headers: { cookie } })).json()) as { value: Record<string, unknown> }).value;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    cookie = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" })).cookie;
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("saves the instructions alongside the rest of the profile", async () => {
    const instructions = "Bank transfer to Riverstone Builders LLC\nPlease use the invoice number as the reference.";
    expect((await put({ name: "Riverstone Builders", address: "14 Harbour Road", paymentInstructions: instructions })).status).toBeLessThan(300);
    expect(await get()).toEqual({ name: "Riverstone Builders", address: "14 Harbour Road", paymentInstructions: instructions });
  });

  it("accepts exactly 600 characters", async () => {
    expect((await put({ name: "Riverstone Builders", paymentInstructions: "x".repeat(600) })).status).toBeLessThan(300);
  });

  it("refuses more than 600 characters with 'Keep this under 600 characters.' and keeps the saved value", async () => {
    await put({ name: "Riverstone Builders", paymentInstructions: "Pay by bank transfer." });
    const res = await put({ name: "Riverstone Builders", paymentInstructions: "x".repeat(601) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Keep this under 600 characters.");
    expect((await get()).paymentInstructions).toBe("Pay by bank transfer.");
  });
});
