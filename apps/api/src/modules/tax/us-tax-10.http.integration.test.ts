import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, taxRates } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };
interface Rate {
  id: string;
  name: string;
  rate: number;
  taxType: string;
}
interface Group {
  id: string;
  name: string;
  scope: string;
  taxRates: Rate[];
}

/** US-TAX-10 — rates carry a tax type; an Indian GST group must be a GST mix. Requires local Postgres. */
describe("US-TAX-10 · give each rate a tax type (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const rate = (name: string, value: number, taxType?: string) => call("POST", "/tax-rates", { name, rate: value, taxType }).then((r) => json<Rate>(r));
  const setCountry = (country: string) => call("PUT", "/org/settings/tax_profile", { value: { country } }).then((r) => json(r));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-tax-10-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("gives rates saved without a type (as before the upgrade) the type Other, and they keep working", async () => {
    const [legacy] = await db.insert(taxRates).values({ orgId, name: "Old tax", rate: 10 }).returning();
    expect(legacy!.taxType).toBe("other");
    const listed = await json<Rate[]>(await call("GET", "/tax-rates"));
    expect(listed.find((r) => r.id === legacy!.id)?.taxType).toBe("other");
    const group = await json<Group>(await call("POST", "/tax-groups", { name: "Old group", taxRateIds: [legacy!.id] }));
    expect(group.scope).toBe("any");
  });

  it("saves and changes a rate's tax type", async () => {
    const created = await rate("VAT 20%", 20, "vat");
    expect(created.taxType).toBe("vat");
    const updated = await json<Rate>(await call("PUT", `/tax-rates/${created.id}`, { taxType: "sales_tax" }));
    expect(updated.taxType).toBe("sales_tax");
    expect((await call("POST", "/tax-rates", { name: "Bad", rate: 5, taxType: "luxury" })).status).toBe(400);
  });

  it("lets a group outside India mix any rates", async () => {
    await setCountry("GB");
    const a = await rate("State 6%", 6, "sales_tax");
    const b = await rate("City 2%", 2, "sales_tax");
    const group = await json<Group>(await call("POST", "/tax-groups", { name: "Combined", taxRateIds: [a.id, b.id] }));
    expect(group.scope).toBe("any");
  });

  it("for India, takes CGST + SGST (or UTGST) at the same rate, optionally with cess, or a single IGST rate, and sets the scope", async () => {
    await setCountry("IN");
    const cgst = await rate("CGST 9%", 9, "cgst");
    const sgst = await rate("SGST 9%", 9, "sgst");
    const utgst = await rate("UTGST 9%", 9, "utgst");
    const igst = await rate("IGST 18%", 18, "igst");
    const cess = await rate("Cess 12%", 12, "cess");

    expect((await json<Group>(await call("POST", "/tax-groups", { name: "GST 18%", taxRateIds: [cgst.id, sgst.id] }))).scope).toBe("intra");
    expect((await json<Group>(await call("POST", "/tax-groups", { name: "GST 18% (UT)", taxRateIds: [cgst.id, utgst.id, cess.id] }))).scope).toBe("intra");
    const inter = await json<Group>(await call("POST", "/tax-groups", { name: "IGST 18% + cess", taxRateIds: [igst.id, cess.id], scope: "any" }));
    expect(inter.scope).toBe("inter");

    // Renaming keeps the mix and its scope.
    expect((await json<Group>(await call("PUT", `/tax-groups/${inter.id}`, { name: "IGST 18% with cess" }))).scope).toBe("inter");
  });

  it("for India, refuses any other mix with the GST group message", async () => {
    const cgst = await rate("CGST 2.5%", 2.5, "cgst");
    const sgst = await rate("SGST 9% b", 9, "sgst");
    const igst = await rate("IGST 5%", 5, "igst");
    for (const ids of [[cgst.id, sgst.id], [cgst.id, igst.id], [cgst.id]]) {
      const res = await call("POST", "/tax-groups", { name: "Wrong", taxRateIds: ids });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe("A GST group is CGST + SGST (or UTGST) at the same rate, optionally with cess.");
    }
  });
});
