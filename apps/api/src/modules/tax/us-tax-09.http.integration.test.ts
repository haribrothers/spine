import { randomUUID } from "node:crypto";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, type TaxProfile, type TaxProfileUpdate } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoiceLines, invoices, member, session as sessionTable, taxRates } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { InvoicePdfDocument } from "../pdf/invoice-pdf.template";

/** Every string a react-pdf element tree would print, in order. */
function textOf(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (typeof element.type === "function") return textOf((element.type as (p: unknown) => ReactNode)(element.props));
    return textOf(element.props.children);
  }
  return [];
}

type Who = { cookie: string; userId: string };
interface Rate {
  id: string;
  name: string;
  rate: number;
  taxType: string;
  archivedAt: string | null;
}
interface Group {
  id: string;
  name: string;
  scope: string;
  archivedAt: string | null;
  taxRates: Rate[];
}

/** US-TAX-09 — a country seeds its preset once; changing country adds, never changes. Requires local Postgres. */
describe("US-TAX-09 · start with my country's tax rates (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const newOwner = async (label: string) => {
    const who: Who = { cookie: "", userId: "" };
    Object.assign(who, await signUp(testApp.baseUrl, { email: `us-tax-09-${label}-${randomUUID()}@example.com`, password: "testpassword123", name: label }));
    return who;
  };
  const setCountry = (who: Who, country: string) => call(who, "PUT", "/org/tax/profile", { country }).then((r) => json<TaxProfileUpdate>(r));
  const rates = (who: Who) => call(who, "GET", "/tax-rates?includeArchived=true").then((r) => json<Rate[]>(r));
  const groups = (who: Who) => call(who, "GET", "/tax-groups?includeArchived=true").then((r) => json<Group[]>(r));
  const layout = async (who: Who) => (await json<{ value: { invoice?: { title?: string } } | null }>(await call(who, "GET", "/org/settings/document_layout"))).value;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newOwner("owner"));
    Object.assign(staff, await newOwner("staff"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("India creates the GST rates as CGST, SGST and UTGST halves and IGST, grouped as GST n%, with 12% and 28% archived", async () => {
    const res = await setCountry(owner, "IN");
    expect(res.added).toBe(32);
    expect(res.profile.country).toBe("IN");

    const all = await rates(owner);
    const byName = (name: string) => all.find((r) => r.name === name);
    expect(byName("CGST 9%")).toMatchObject({ rate: 9, taxType: "cgst", archivedAt: null });
    expect(byName("SGST 9%")).toMatchObject({ rate: 9, taxType: "sgst", archivedAt: null });
    expect(byName("IGST 18%")).toMatchObject({ rate: 18, taxType: "igst", archivedAt: null });
    expect(byName("CGST 0.125%")?.rate).toBe(0.125);
    expect(byName("IGST 28%")?.archivedAt).not.toBeNull();

    const gs = await groups(owner);
    const gst18 = gs.find((g) => g.name === "GST 18%")!;
    expect(gst18.scope).toBe("intra");
    expect(gst18.archivedAt).toBeNull();
    expect(gst18.taxRates.map((r) => r.name).sort()).toEqual(["CGST 9%", "SGST 9%"]);
    for (const slab of [12, 28]) expect(gs.find((g) => g.name === `GST ${slab}%`)?.archivedAt).not.toBeNull();
    for (const slab of [0, 0.25, 3, 5, 40]) expect(gs.find((g) => g.name === `GST ${slab}%`)?.archivedAt).toBeNull();

    expect((await json<TaxProfile>(await call(owner, "GET", "/org/tax/profile"))).country).toBe("IN");
  });

  it("seeds only once — choosing India again adds nothing", async () => {
    expect((await setCountry(owner, "IN")).added).toBe(0);
    expect((await rates(owner)).filter((r) => r.name === "CGST 9%")).toHaveLength(1);
  });

  it("changing country later adds the new preset's rates and keeps every existing rate unchanged", async () => {
    const [mine] = await db.select().from(taxRates).where(and(eq(taxRates.orgId, orgId), eq(taxRates.name, "CGST 9%")));
    const before = await rates(owner);
    const res = await setCountry(owner, "GB");
    expect(res.added).toBe(4);
    const after = await rates(owner);
    expect(after).toHaveLength(before.length + 4);
    for (const r of before) expect(after.find((a) => a.id === r.id)).toEqual(r);
    expect(after.find((r) => r.id === mine!.id)).toMatchObject({ name: "CGST 9%", rate: 9 });
    expect(after.filter((r) => ["VAT 20%", "VAT 5%", "VAT 0%", "Exempt"].includes(r.name)).map((r) => r.taxType)).toEqual(["vat", "vat", "vat", "vat"]);
    expect((await layout(owner))?.invoice?.title).toBe("VAT invoice");
  });

  it("reuses a rate the owner already has with the same name and rate", async () => {
    const fresh = await newOwner("reuse");
    await json(await call(fresh, "POST", "/tax-rates", { name: "VAT 20%", rate: 20 }));
    expect((await setCountry(fresh, "GB")).added).toBe(3);
    const vat = (await rates(fresh)).filter((r) => r.name === "VAT 20%");
    expect(vat).toHaveLength(1);
    expect(vat[0]!.taxType).toBe("other");
  });

  it.each([
    ["AU", "GST 10%", 10],
    ["NZ", "GST 15%", 15],
    ["AE", "VAT 5%", 5],
    ["SA", "VAT 15%", 15],
  ])("%s creates its standard rate, a zero rate and exempt, and titles invoices \"Tax invoice\"", async (country, standard, percent) => {
    const fresh = await newOwner(country);
    expect((await setCountry(fresh, country)).added).toBe(3);
    const all = await rates(fresh);
    expect(all.find((r) => r.name === standard)?.rate).toBe(percent);
    expect(all.filter((r) => r.rate === 0)).toHaveLength(2);
    expect((await layout(fresh))?.invoice?.title).toBe("Tax invoice");
  });

  it("another country adds no rates and leaves the title alone", async () => {
    const fresh = await newOwner("other");
    expect(await setCountry(fresh, "other")).toEqual({ profile: { country: "other" }, added: 0 });
    expect(await rates(fresh)).toEqual([]);
    expect(await layout(fresh)).toBeNull();
  });

  it("keeps the return period when the country changes", async () => {
    const fresh = await newOwner("period");
    await json(await call(fresh, "PUT", "/org/settings/tax_profile", { value: { returnPeriod: "quarterly" } }));
    expect((await setCountry(fresh, "NZ")).profile).toEqual({ returnPeriod: "quarterly", country: "NZ" });
  });

  it("lets any member read the profile and only the Owner change it; refuses an unknown country", async () => {
    expect((await json<TaxProfile>(await call(staff, "GET", "/org/tax/profile"))).country).toBe("GB");
    expect((await call(staff, "PUT", "/org/tax/profile", { country: "IN" })).status).toBe(403);
    expect((await call(owner, "PUT", "/org/tax/profile", { country: "FR" })).status).toBe(400);
  });

  it("prints the preset's title on the invoice PDF; a deposit invoice keeps its own", async () => {
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Alan Brooks", createdByUserId: owner.userId }).returning();
    const draft = await testApp.app
      .get(InvoicesService)
      .create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: contact!.id, currency: "GBP", lines: [{ name: "Survey", quantity: 1, unitPriceAmount: "10000", taxRatePercentage: 0 }] }));
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, draft.id));
    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, draft.id));
    const title = (await layout(owner))?.invoice?.title;
    const render = (type: "standard" | "advance") => textOf(InvoicePdfDocument({ invoice: { ...invoice!, type }, lines, contactName: "Alan Brooks", contactEmail: null, business: null, title }));
    expect(render("standard")).toContain("VAT INVOICE");
    expect(render("advance")).toContain("DEPOSIT INVOICE");
    expect(textOf(InvoicePdfDocument({ invoice: invoice!, lines, contactName: "Alan Brooks", contactEmail: null, business: null }))).toContain("INVOICE");
  });

  it("the preset's 0% rates say whether they're zero-rated or exempt (D-182)", async () => {
    const fresh = await newOwner("classes");
    await setCountry(fresh, "GB");
    const all = await json<(Rate & { supplyClass: string | null })[]>(await call(fresh, "GET", "/tax-rates"));
    expect(Object.fromEntries(all.map((r) => [r.name, r.supplyClass]))).toEqual({ "VAT 20%": null, "VAT 5%": null, "VAT 0%": "zero_rated", Exempt: "exempt" });
  });
});
