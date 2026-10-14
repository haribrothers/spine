import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { unzipSync } from "fflate";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { InvoicesService } from "./invoices.service";

/**
 * US-INV-24 (D-097) — `POST /invoices/bulk/pdf`: one ZIP of the selected
 * invoices' stored PDFs, drafts skipped and reported, at most 100.
 * Requires local Postgres.
 */
describe("US-INV-24 · download several invoice PDFs at once (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-24-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let invoicesService: InvoicesService;

  const bulk = (ids: string[]) =>
    fetch(`${testApp.baseUrl}/invoices/bulk/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: JSON.stringify({ ids }),
    });

  async function invoice(issue = true) {
    const draft = await invoicesService.create(
      orgId,
      userId,
      createInvoiceSchema.parse({ contactId, currency: "USD", lines: [{ name: "Kitchen fit-out", quantity: 1, unitPriceAmount: "220000" }] }),
    );
    return issue ? (await invoicesService.issue(orgId, draft.id, userId)) : draft;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Sunstone Retail Fitouts", createdByUserId: userId }).returning();
    contactId = contact!.id;
    invoicesService = testApp.app.get(InvoicesService);
  }, 120_000);

  beforeEach(() => {
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("downloads one ZIP named invoices-<date>.zip with each invoice's stored PDF; drafts are skipped and reported", async () => {
    const first = await invoice();
    const second = await invoice();
    const draft = await invoice(false);

    const res = await bulk([first.id, second.id, draft.id]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="invoices-${orgClock().date}.zip"`);
    const skipped = JSON.parse(decodeURIComponent(res.headers.get("x-spine-skipped")!)) as { id: string; reason: string }[];
    expect(skipped).toEqual([{ id: draft.id, label: null, reason: "It's a draft — drafts have no PDF to download yet." }]);

    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual([`${first.number}.pdf`, `${second.number}.pdf`].sort());
    // The same bytes as the stored PDF a single download serves (US-INV-17).
    const single = Buffer.from(await (await fetch(`${testApp.baseUrl}/invoices/${first.id}/pdf`, { headers: { cookie } })).arrayBuffer());
    expect(Buffer.from(files[`${first.number}.pdf`]!).equals(single)).toBe(true);
  });

  it("only drafts: nothing to download", async () => {
    const res = await bulk([(await invoice(false)).id]);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("None of these invoices has a PDF yet — drafts are skipped. Issue them first.");
  });

  it("more than 100: 'Select 100 or fewer invoices.'", async () => {
    const res = await bulk(Array.from({ length: 101 }, () => randomUUID()));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Select 100 or fewer invoices.");
  });
});
