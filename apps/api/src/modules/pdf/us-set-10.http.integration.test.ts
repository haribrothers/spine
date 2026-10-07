import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, creditNotes, member, payments, quotes, user } from "../../db/schema";
import { pdfText } from "../../test-utils/pdf-text";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { loadEmailBrand } from "../email/email-brand";
import { InvoicesService } from "../invoices/invoices.service";
import { IssuedPdfService } from "./issued-pdf.service";


/** True when some content stream sets the fill colour to `hex` (`r g b scn` in DeviceRGB, within rounding). */
function usesFill(buf: Buffer, hex: string): boolean {
  const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  for (const m of buf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1");
    } catch {
      continue;
    }
    for (const c of content.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (?:rg|scn)\b/g)) {
      if ([1, 2, 3].every((i) => Math.abs(Number(c[i]) - want[i - 1]!) < 0.01)) return true;
    }
  }
  return false;
}

/**
 * US-SET-10 — the document colour and footer from Settings › Branding are
 * checked by the API and printed on every new quote, invoice, credit note,
 * receipt and email; issued documents keep their stored PDF. Real routes on
 * a demo-seeded org. Requires local Postgres.
 */
describe("US-SET-10 · put my brand colour and footer on documents (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let filesDir: string;
  const savedEnv = { STORAGE_DRIVER: process.env.STORAGE_DRIVER, FILES_DIR: process.env.FILES_DIR };
  const email = `us-set-10-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let userId: string;
  const FOOTER = "Riverstone Builders · Licence 4471 · Payment due within 21 days.";
  const TEAL = "#0D6E6E";

  const putBranding = (value: unknown) =>
    fetch(`${testApp.baseUrl}/org/settings/branding`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: JSON.stringify({ value }),
    });
  const getBranding = async () =>
    ((await (await fetch(`${testApp.baseUrl}/org/settings/branding`, { headers: { cookie } })).json()) as { value: Record<string, unknown> | null }).value;
  async function pdf(route: string): Promise<Buffer> {
    const res = await fetch(`${testApp.baseUrl}${route}`, { headers: { cookie } });
    expect(res.status, route).toBe(200);
    return Buffer.from(await res.arrayBuffer());
  }
  async function draftInvoice(): Promise<string> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.orgId, orgId)).limit(1);
    const created = await testApp.app.get(InvoicesService).create(
      orgId,
      userId,
      createInvoiceSchema.parse({ contactId: contact!.id, currency: "USD", lines: [{ name: "Site visit", quantity: 1, unitPriceAmount: "12500" }] }),
    );
    return created.id;
  }

  beforeAll(async () => {
    filesDir = await mkdtemp(path.join(tmpdir(), "spine-set10-"));
    delete process.env.STORAGE_DRIVER;
    process.env.FILES_DIR = filesDir;
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Branding Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = membership!.organizationId;
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
    await rm(filesDir, { recursive: true, force: true });
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("refuses a colour below 4.5:1 on white, saying how readable it is, and keeps the saved branding", async () => {
    expect((await putBranding({ themePreset: "spine-blue", documentColor: TEAL })).status).toBeLessThan(300);
    const res = await putBranding({ themePreset: "spine-blue", documentColor: "#8FB3FF" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Too light to read on white (2.0:1). Pick a darker colour — documents need at least 4.5:1.");
    expect((await getBranding())?.documentColor).toBe(TEAL);
  });

  it("refuses something that isn't a #RRGGBB colour, and a footer over 300 characters", async () => {
    const bad = await putBranding({ documentColor: "teal" });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toBe("Enter a colour as # and six hex digits, e.g. #2954E5.");
    const long = await putBranding({ documentFooter: "x".repeat(301) });
    expect(long.status).toBe(400);
    expect(((await long.json()) as { message: string }).message).toBe("Keep the footer under 300 characters.");
  });

  it("issued invoices keep their stored PDF when branding changes", async () => {
    const id = await draftInvoice();
    await testApp.app.get(InvoicesService).issue(orgId, id, userId);
    await testApp.app.get(IssuedPdfService).getOrStore(orgId, "invoice", id);
    const original = await pdf(`/invoices/${id}/pdf`);

    expect((await putBranding({ themePreset: "spine-blue", documentColor: TEAL, documentFooter: FOOTER })).status).toBeLessThan(300);
    const later = await pdf(`/invoices/${id}/pdf`);
    expect(later.equals(original)).toBe(true);
    expect(pdfText(later)).not.toContain("Licence 4471");
  });

  it("new and draft invoices, quotes, credit notes and receipts print the footer and use the document colour", async () => {
    expect((await putBranding({ themePreset: "spine-blue", documentColor: TEAL, documentFooter: FOOTER })).status).toBeLessThan(300);

    const invoice = await pdf(`/invoices/${await draftInvoice()}/pdf`);
    const [draftQuote] = await db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.status, "draft"))).limit(1);
    // Seeded issued credit notes and receipts have no stored PDF yet, so their first download renders with today's branding.
    const [creditNote] = await db.select().from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.status, "issued"), isNull(creditNotes.issuedPdfFileId))).limit(1);
    const [receipt] = await db.select().from(payments).where(and(eq(payments.orgId, orgId), isNull(payments.issuedPdfFileId))).limit(1);
    const documents = {
      invoice,
      quote: await pdf(`/quotes/${draftQuote!.id}/pdf`),
      creditNote: await pdf(`/credit-notes/${creditNote!.id}/pdf`),
      receipt: await pdf(`/payments/${receipt!.id}/pdf`),
    };
    for (const [kind, buf] of Object.entries(documents)) {
      expect(pdfText(buf), kind).toContain(FOOTER);
      expect(usesFill(buf, TEAL), `${kind} uses the document colour`).toBe(true);
    }
  });

  it("documents fall back to Spine Blue and no footer when nothing is set", async () => {
    expect((await putBranding({ themePreset: "spine-blue" })).status).toBeLessThan(300);
    const buf = await pdf(`/invoices/${await draftInvoice()}/pdf`);
    expect(usesFill(buf, "#2954E5")).toBe(true);
    expect(pdfText(buf)).not.toContain("Licence 4471");
  });

  it("emails use the same colour and footer", async () => {
    expect((await putBranding({ themePreset: "spine-blue", documentColor: TEAL, documentFooter: FOOTER })).status).toBeLessThan(300);
    const brand = await loadEmailBrand(db, orgId);
    expect(brand.color).toBe(TEAL);
    expect(brand.footer).toContain(FOOTER);
  });
});
