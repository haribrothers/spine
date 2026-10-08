import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TaxProfile, TaxProfileUpdate } from "@spine/shared";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };
interface Contact {
  id: string;
  taxId: string | null;
  gstTreatment: string | null;
  stateCode: string | null;
  addresses?: { type: string; stateCode: string | null }[];
}

const INVALID = "This GSTIN isn't valid — check the 15 characters.";
// Valid GSTINs (check character included): Karnataka and Tamil Nadu.
const KARNATAKA = "29AAACK0000A1ZK";
const TAMIL_NADU = "33AABCU9603R1ZM".slice(0, 14);

/** US-TAX-12 — the business's and its contacts' GST registration. Requires local Postgres. */
describe("US-TAX-12 · record my GSTIN and state, and each customer's (requires local Postgres)", () => {
  let testApp: TestApp;
  const owner: Who = { cookie: "", userId: "" };
  let tamilNadu: string;

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const refused = async (res: Response) => {
    expect(res.status, await res.clone().text()).toBe(400);
    return ((await res.json()) as { message: string }).message;
  };
  const profile = (body: unknown) => call("PUT", "/org/tax/profile", body);

  beforeAll(async () => {
    testApp = await createTestApp();
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-tax-12-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
    const { gstinCheckCharacter } = await import("@spine/shared");
    tamilNadu = TAMIL_NADU + gstinCheckCharacter(TAMIL_NADU);
    await json(await profile({ country: "IN" }));
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("saves the GSTIN, legal and trade name, state and registration date, keeping the country", async () => {
    const res = await json<TaxProfileUpdate>(
      await profile({ registrationNumber: KARNATAKA.toLowerCase(), stateCode: "29", legalName: "Kaveri Interiors Private Limited", tradeName: "Kaveri Interiors", registeredOn: "2017-07-01", returnPeriod: "monthly" }),
    );
    expect(res.added).toBe(0);
    expect(res.profile).toMatchObject({ country: "IN", registrationNumber: KARNATAKA, stateCode: "29", legalName: "Kaveri Interiors Private Limited", tradeName: "Kaveri Interiors", registeredOn: "2017-07-01" });
    expect(await json<TaxProfile>(await call("GET", "/org/tax/profile"))).toMatchObject({ registrationNumber: KARNATAKA, stateCode: "29" });
  });

  it("refuses a GSTIN with a bad format or check character, and one from another state", async () => {
    expect(await refused(await profile({ registrationNumber: "29AAACK0000A1ZL", stateCode: "29" }))).toBe(INVALID);
    expect(await refused(await profile({ registrationNumber: "29AAACK0000", stateCode: "29" }))).toBe(INVALID);
    expect(await refused(await profile({ registrationNumber: KARNATAKA, stateCode: "33" }))).toBe("This GSTIN belongs to Karnataka.");
    // Changing only the state checks it against the saved GSTIN.
    expect(await refused(await profile({ stateCode: "33" }))).toBe("This GSTIN belongs to Karnataka.");
  });

  it("a union-territory business gets its CGST + UTGST groups back", async () => {
    const ut = { cookie: "", userId: "" };
    Object.assign(ut, await signUp(testApp.baseUrl, { email: `us-tax-12-ut-${randomUUID()}@example.com`, password: "testpassword123", name: "UT" }));
    const as = (method: string, path: string, body?: unknown) =>
      fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: ut.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    await json(await as("PUT", "/org/tax/profile", { country: "IN" }));
    const { gstinCheckCharacter } = await import("@spine/shared");
    const chandigarh = "04AAACK0000A1Z" + gstinCheckCharacter("04AAACK0000A1Z");
    await json(await as("PUT", "/org/tax/profile", { registrationNumber: chandigarh, stateCode: "04", legalName: "UT Works" }));
    const groups = await json<{ name: string; archivedAt: string | null; taxRates: { name: string; archivedAt: string | null }[] }[]>(await as("GET", "/tax-groups?includeArchived=true"));
    const ut18 = groups.find((g) => g.name === "GST 18% (UT)")!;
    expect(ut18.archivedAt).toBeNull();
    expect(ut18.taxRates.every((r) => r.archivedAt === null)).toBe(true);
    // Retired slabs stay archived.
    expect(groups.find((g) => g.name === "GST 28% (UT)")!.archivedAt).not.toBeNull();
  });

  it("a contact has a GST treatment; registered and SEZ need a valid GSTIN; the state is filled from it", async () => {
    const create = (body: Record<string, unknown>) => call("POST", "/contacts", { type: "customer", isCompany: true, name: `Lakeview ${randomUUID().slice(0, 4)}`, ...body });
    expect(await refused(await create({ gstTreatment: "registered" }))).toBe("Enter the GSTIN — it's needed for a registered business or SEZ.");
    expect(await refused(await create({ gstTreatment: "sez", taxId: "29AAACK0000A1ZL" }))).toBe(INVALID);
    expect(await refused(await create({ gstTreatment: "registered", taxId: KARNATAKA, stateCode: "33" }))).toBe("This GSTIN belongs to Karnataka.");

    const registered = await json<Contact>(await create({ gstTreatment: "registered", taxId: tamilNadu.toLowerCase() }));
    expect(registered).toMatchObject({ gstTreatment: "registered", taxId: tamilNadu, stateCode: "33" });

    const consumer = await json<Contact>(await create({ gstTreatment: "consumer", stateCode: "29" }));
    expect(consumer).toMatchObject({ gstTreatment: "consumer", taxId: null, stateCode: "29" });

    // Switching to registered later needs the GSTIN too.
    expect(await refused(await call("PUT", `/contacts/${consumer.id}`, { gstTreatment: "registered" }))).toBe("Enter the GSTIN — it's needed for a registered business or SEZ.");
    await json(await call("PUT", `/contacts/${consumer.id}`, { gstTreatment: "registered", taxId: KARNATAKA }));
    expect(await json<Contact>(await call("GET", `/contacts/${consumer.id}`))).toMatchObject({ gstTreatment: "registered", taxId: KARNATAKA, stateCode: "29" });
  });

  it("keeps a state on each address", async () => {
    const contact = await json<Contact>(
      await call("POST", "/contacts", {
        type: "customer",
        name: "Harbour Café",
        gstTreatment: "unregistered",
        addresses: [
          { type: "billing", line1: "12 MG Road", city: "Bengaluru", stateCode: "29" },
          { type: "site", line1: "4 Beach Road", city: "Chennai", stateCode: "33" },
        ],
      }),
    );
    const read = await json<Contact>(await call("GET", `/contacts/${contact.id}`));
    expect(read.addresses!.map((a) => [a.type, a.stateCode]).sort()).toEqual([
      ["billing", "29"],
      ["site", "33"],
    ]);
  });

  it("imports GSTIN and state columns", async () => {
    const results = await json<{ index: number; contact?: Contact; error?: string }[]>(
      await call("POST", "/contacts/import", {
        rows: [
          { type: "customer", name: "Imported Registered", taxId: tamilNadu, gstTreatment: "registered" },
          { type: "customer", name: "Imported Consumer", stateCode: "29" },
          { type: "customer", name: "Imported Bad", taxId: "29AAACK0000A1ZL", gstTreatment: "registered" },
        ],
      }),
    );
    expect(results[0]!.contact).toMatchObject({ taxId: tamilNadu, gstTreatment: "registered", stateCode: "33" });
    expect(results[1]!.contact).toMatchObject({ stateCode: "29" });
    expect(results[2]!.error).toBe(INVALID);
  });
});
