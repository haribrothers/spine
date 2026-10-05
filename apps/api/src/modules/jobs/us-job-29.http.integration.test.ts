import { randomUUID } from "node:crypto";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoiceLines, invoices, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService } from "../email/email.service";
import { InvoiceEmailWorker } from "../invoices/invoice-email.worker";
import { InvoicesService } from "../invoices/invoices.service";
import { InvoicePdfDocument } from "../pdf/invoice-pdf.template";
import { InvoicePdfService } from "../pdf/invoice-pdf.service";
import { QueueService } from "../queue/queue.service";

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

/**
 * US-JOB-29 (D-128) — progress claim numbers: given at issue per job, kept
 * when voided and never reused, shown on the PDF and email; other invoice
 * types get none. Requires local Postgres.
 */
describe("US-JOB-29 · number each progress claim on a job (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-job-29-${randomUUID()}@example.com`;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let jobId: string;
  let jobNumber: string;
  let service: InvoicesService;

  async function draft(type: "progress" | "advance" | "standard" | "retention_release" = "progress") {
    const created = await service.create(orgId, userId, createInvoiceSchema.parse({ contactId, currency: "USD", lines: [{ name: "Claim", quantity: 1, unitPriceAmount: "437500" }] }));
    await db.update(invoices).set({ jobId, type }).where(eq(invoices.id, created.id));
    return created.id;
  }
  const claimOf = async (id: string) => (await db.select().from(invoices).where(eq(invoices.id, id)))[0]!.progressClaimNo;

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    userId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", email: `ap-${randomUUID()}@example.com`, createdByUserId: userId }).returning();
    contactId = contact!.id;
    const job = (await (
      await fetch(`${testApp.baseUrl}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie },
        body: JSON.stringify({ contactId, name: "Phase 2 townhomes", currency: "USD", contractValueAmount: "1250000" }),
      })
    ).json()) as { id: string; number: string };
    jobId = job.id;
    jobNumber = job.number;
    service = testApp.app.get(InvoicesService);
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("a draft has no claim number; issued progress invoices are claims 1, 2, 3 on the job", async () => {
    const first = await draft();
    expect(await claimOf(first)).toBeNull();
    await service.issue(orgId, first, userId);
    const second = await draft();
    await service.issue(orgId, second, userId);
    expect([await claimOf(first), await claimOf(second)]).toEqual([1, 2]);
    expect((await service.getOne(orgId, second)).progressClaimNo).toBe(2);
  });

  it("a voided claim keeps its number and the next claim continues after it", async () => {
    const [claim2] = await db.select().from(invoices).where(and(eq(invoices.jobId, jobId), eq(invoices.progressClaimNo, 2)));
    await service.void(orgId, claim2!.id, userId, "Raised against the wrong milestone");
    const next = await draft();
    await service.issue(orgId, next, userId);
    expect(await claimOf(claim2!.id)).toBe(2);
    expect(await claimOf(next)).toBe(3);
  });

  it("advance, standard and retention-release invoices get no claim number", async () => {
    for (const type of ["advance", "standard", "retention_release"] as const) {
      const id = await draft(type);
      await service.issue(orgId, id, userId);
      expect(await claimOf(id)).toBeNull();
    }
  });

  it("the PDF and email show 'Progress claim 3 · <job number>' under the invoice number", async () => {
    const [claim3] = await db.select().from(invoices).where(and(eq(invoices.jobId, jobId), eq(invoices.progressClaimNo, 3)));
    const label = await testApp.app.get(InvoicePdfService).claimLabel(claim3!);
    expect(label).toBe(`Progress claim 3 · ${jobNumber}`);
    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, claim3!.id));
    const text = textOf(InvoicePdfDocument({ invoice: claim3!, lines, contactName: "Maple Ridge Developments", contactEmail: null, business: { name: "Riverstone Builders" }, claimLabel: label }));
    expect(text[text.indexOf(claim3!.number!) + 1]).toBe(`Progress claim 3 · ${jobNumber}`);

    const emailService = testApp.app.get(EmailService);
    vi.spyOn(emailService, "isConfigured").mockReturnValue(true);
    const send = vi.spyOn(emailService, "send").mockResolvedValue();
    await testApp.app.get(InvoiceEmailWorker).process({ orgId, invoiceId: claim3!.id });
    expect(send.mock.calls[0]![0].text).toContain(`Progress claim 3 · ${jobNumber}`);

    const [voided] = await db.select().from(invoices).where(and(eq(invoices.jobId, jobId), eq(invoices.progressClaimNo, 2)));
    expect(await testApp.app.get(InvoicePdfService).claimLabel(voided!)).toBe(`Progress claim 2 (void) · ${jobNumber}`);
  });
});
