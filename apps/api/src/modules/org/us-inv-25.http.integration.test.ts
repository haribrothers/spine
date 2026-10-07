import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/** US-INV-25 — a UPI ID for payments, in the business profile. Requires local Postgres. */
describe("US-INV-25 · set my UPI ID for payments (requires local Postgres)", () => {
  let testApp: TestApp;
  let cookie = "";
  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });

  beforeAll(async () => {
    testApp = await createTestApp();
    cookie = (await signUp(testApp.baseUrl, { email: `us-inv-25-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" })).cookie;
    await call("PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("refuses a UPI ID without an @ or with spaces", async () => {
    for (const upiId of ["riverstone", "river stone@okhdfc"]) {
      const res = await call("PUT", "/org/settings/business_profile", { value: { name: "Riverstone Builders", upiId } });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe("Enter a UPI ID like name@bank.");
    }
  });

  it("saves the UPI ID, payee name and QR switch", async () => {
    const value = { name: "Riverstone Builders", upiId: "riverstone@okhdfc", upiPayeeName: "Riverstone Builders LLP", showUpiQr: true };
    expect((await call("PUT", "/org/settings/business_profile", { value })).status).toBeLessThan(300);
    const saved = (await (await call("GET", "/org/settings/business_profile")).json()) as { value: typeof value };
    expect(saved.value).toMatchObject(value);
  });
});
