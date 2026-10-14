import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { spreadCreditAmount, type CreditNoteActivityEntry } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, journalLines, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService } from "../email/email.service";
import { QueueService } from "../queue/queue.service";

interface CreditableLine {
  invoiceLineId: string;
  quantity: number;
  leftQuantity: number;
  leftAmount: string;
  lineTotalAmount: string;
}
interface Creditable {
  leftToCredit: string;
  balanceDue: string;
  lines: CreditableLine[];
}
interface CreditNote {
  id: string;
  number: string | null;
  totalAmount: string;
  taxAmount: string;
  creditRemainingAmount: string;
  offInvoiceAmount: string;
  appliedAmount: string;
  refundedAmount: string;
  taxLines: { label: string; amount: string }[];
  lines: { invoiceLineId: string | null; taxGroupId: string | null; lineTotalAmount: string; lineTaxAmount: string }[];
  allocations: { invoiceNumber: string; amount: string }[];
}

/**
 * US-INV-36 to US-INV-41 (D-219) — the API side of credit notes you can
 * work from: crediting an invoice's lines or an amount with their tax, the
 * limits, the preview, where the money went, the activity and search.
 * Requires local Postgres.
 */
describe("Credit notes you can work from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-36-${randomUUID()}@example.com`;
  let cookie: string;
  let contactId: string;
  let gst: string;

  const call = (method: string, route: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const ok = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  /** An issued invoice: 36 × 4,200.00 and 1 × 2,40,000.00, both at a GST group of 9% + 9%. */
  async function invoice() {
    const draft = await ok<{ id: string }>(
      await call("POST", "/invoices", {
        contactId,
        currency: "INR",
        lines: [
          { type: "item", name: "Loading bay canopy", quantity: 36, unitPriceAmount: "420000", taxGroupId: gst },
          { type: "item", name: "Storm-water drainage", quantity: 1, unitPriceAmount: "24000000", taxGroupId: gst },
        ],
      }),
    );
    return ok<{ id: string; number: string; totalAmount: string }>(await call("POST", `/invoices/${draft.id}/issue`, {}));
  }
  const creditable = (invoiceId: string) => call("GET", `/credit-notes/creditable?invoiceId=${invoiceId}`).then((r) => ok<Creditable>(r));
  async function issueNote(invoiceId: string, lines: unknown[], reason = "Canopy reduced") {
    const note = await ok<CreditNote>(await call("POST", "/credit-notes", { invoiceId, reason, lines }));
    return ok<CreditNote>(await call("POST", `/credit-notes/${note.id}/issue`, {}));
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    cookie = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" })).cookie;
    contactId = (await ok<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Sahyadri Retail Pvt Ltd", email: "accounts@sahyadri.example" }))).id;
    const cgst = await ok<{ id: string }>(await call("POST", "/tax-rates", { name: "CGST 9%", rate: 9, taxType: "cgst" }));
    const sgst = await ok<{ id: string }>(await call("POST", "/tax-rates", { name: "SGST 9%", rate: 9, taxType: "sgst" }));
    gst = (await ok<{ id: string }>(await call("POST", "/tax-groups", { name: "GST 18%", taxRateIds: [cgst.id, sgst.id] }))).id;
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  describe("US-INV-36 · credit an invoice's lines, with their tax", () => {
    it("credits 12 of 36 with their tax, named and posted back to 2100, and then 24 are left", async () => {
      const inv = await invoice();
      const before = await creditable(inv.id);
      expect(before.lines.map((l) => l.leftQuantity)).toEqual([36, 1]);
      const canopy = before.lines[0]!;

      const preview = await ok<{ totalAmount: string; taxLines: { label: string; amount: string }[]; owedPart: string; creditPart: string }>(
        await call("POST", "/credit-notes/preview", { invoiceId: inv.id, lines: [{ invoiceLineId: canopy.invoiceLineId, quantity: 12, name: "x" }] }),
      );
      // 12 × 4,200.00 = 50,400.00, + 9% + 9% = 59,472.00.
      expect(preview.totalAmount).toBe("5947200");
      expect(preview.taxLines.map((t) => [t.label, t.amount])).toEqual([["CGST 9%", "453600"], ["SGST 9%", "453600"]]);
      expect(preview).toMatchObject({ owedPart: "5947200", creditPart: "0" });

      const note = await issueNote(inv.id, [{ invoiceLineId: canopy.invoiceLineId, quantity: 12, name: "x" }]);
      expect(note).toMatchObject({ totalAmount: "5947200", taxAmount: "907200", offInvoiceAmount: "5947200" });
      expect(note.lines[0]).toMatchObject({ invoiceLineId: canopy.invoiceLineId, taxGroupId: gst });
      expect(note.taxLines.map((t) => t.label)).toEqual(["CGST 9%", "SGST 9%"]);

      const posted = await db
        .select({ code: accounts.code, debit: journalLines.debit })
        .from(journalLines)
        .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
        .where(and(eq(accounts.code, "2100"), eq(journalLines.contactId, contactId)));
      expect(posted.some((l) => l.debit === 907200n)).toBe(true);

      const after = await creditable(inv.id);
      expect(after.lines[0]).toMatchObject({ leftQuantity: 24 });
    });

    it("refuses more than a line has left, and more than the invoice has left", async () => {
      const inv = await invoice();
      const [canopy] = (await creditable(inv.id)).lines;
      await issueNote(inv.id, [{ invoiceLineId: canopy!.invoiceLineId, quantity: 30, name: "x" }]);
      const tooMany = await call("POST", "/credit-notes", { invoiceId: inv.id, lines: [{ invoiceLineId: canopy!.invoiceLineId, quantity: 7, name: "x" }] });
      expect(tooMany.status).toBe(400);
      expect(((await tooMany.json()) as { message: string }).message).toBe("Line 1 has 6 left to credit.");
      // The rest of it, exactly: all that's left of the line, to the paisa.
      const rest = await issueNote(inv.id, [{ invoiceLineId: canopy!.invoiceLineId, quantity: 6, name: "x" }]);
      expect(BigInt(rest.totalAmount)).toBe(BigInt(canopy!.lineTotalAmount) - (BigInt(canopy!.lineTotalAmount) * 30n) / 36n);
      expect((await creditable(inv.id)).lines[0]).toMatchObject({ leftQuantity: 0, leftAmount: "0" });
    });

    it("spreads an amount over the lines by what's left, the parts adding up exactly, and the excess becomes credit", async () => {
      const inv = await invoice();
      // Pay all but ₹21,616, so part of a ₹50,000 credit becomes the customer's.
      await ok(await call("POST", "/payments", { contactId, date: "2026-10-02", method: "bank_transfer", currency: "INR", amount: "44000000", allocations: [{ invoiceId: inv.id, amount: "44000000" }] }));
      const c = await creditable(inv.id);
      const parts = spreadCreditAmount(c.lines.map((l) => BigInt(l.leftAmount)), 5000000n)!;
      expect(parts.reduce((s, p) => s + p, 0n)).toBe(5000000n);
      const note = await issueNote(
        inv.id,
        c.lines.map((l, i) => ({ invoiceLineId: l.invoiceLineId, creditAmount: parts[i]!.toString(), name: "x" })),
        "Goodwill",
      );
      expect(note.totalAmount).toBe("5000000");
      const owed = BigInt(c.balanceDue);
      expect(owed).toBe(2161600n);
      expect(note).toMatchObject({ offInvoiceAmount: "2161600", creditRemainingAmount: "2838400" });
      expect(spreadCreditAmount([100n, 50n], 200n)).toBeNull();
    });
  });

  describe("US-INV-38, US-INV-39, US-INV-40 · where it went and what happened", () => {
    it("shows what came off the invoice, what was applied and refunded, in the list and the activity", async () => {
      const inv = await invoice();
      await ok(await call("POST", "/payments", { contactId, date: "2026-10-02", method: "bank_transfer", currency: "INR", amount: inv.totalAmount, allocations: [{ invoiceId: inv.id, amount: inv.totalAmount }] }));
      const [canopy] = (await creditable(inv.id)).lines;
      // Fully paid: all of it becomes credit.
      const note = await issueNote(inv.id, [{ invoiceLineId: canopy!.invoiceLineId, quantity: 10, name: "x" }]);
      expect(note).toMatchObject({ offInvoiceAmount: "0", creditRemainingAmount: note.totalAmount });

      const other = await invoice();
      await ok(await call("POST", `/credit-notes/${note.id}/apply-credit`, { allocations: [{ invoiceId: other.id, amount: "1000000" }] }));
      const cash = (await ok<{ id: string; code: string }[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1000")!;
      await ok(await call("POST", "/customer-refunds", { sourceCreditNoteId: note.id, amount: "500000", date: "2026-10-03", method: "upi", moneyAccountId: cash.id }));
      // Email as if SMTP were set up (CI has none); the queued job does the sending.
      const email = testApp.app.get(EmailService);
      const configured = vi.spyOn(email, "isConfigured").mockReturnValue(true);
      const sent = vi.spyOn(email, "send").mockResolvedValue();
      await ok(await call("POST", `/credit-notes/${note.id}/send-email`, {}));
      configured.mockRestore();
      sent.mockRestore();

      const page = await ok<CreditNote>(await call("GET", `/credit-notes/${note.id}`));
      expect(page).toMatchObject({ appliedAmount: "1000000", refundedAmount: "500000", offInvoiceAmount: "0" });
      expect(page.allocations).toEqual([expect.objectContaining({ invoiceNumber: other.number, amount: "1000000" })]);
      const row = (await ok<(CreditNote & { lineNames: string[]; lastEmailedAt: string | null })[]>(await call("GET", "/credit-notes"))).find((n) => n.id === note.id)!;
      expect(row).toMatchObject({ appliedAmount: "1000000", refundedAmount: "500000", lineNames: ["Loading bay canopy"] });
      expect(row.lastEmailedAt).not.toBeNull();

      const activity = await ok<CreditNoteActivityEntry[]>(await call("GET", `/credit-notes/${note.id}/activity`));
      expect(activity.map((a) => a.type).sort()).toEqual(["applied", "emailed", "issued", "refunded"]);
      expect(activity.find((a) => a.type === "applied")).toMatchObject({ detail: other.number, amount: "1000000", actorName: "Priya Raman" });
      expect(activity.find((a) => a.type === "emailed")?.detail).toBe("accounts@sahyadri.example");
      expect([...activity].sort((a, b) => b.at.localeCompare(a.at))).toEqual(activity);

      // US-INV-37: the invoice list says how much is left to credit.
      const listed = (await ok<{ id: string; leftToCredit: string }[]>(await call("GET", "/invoices"))).find((i) => i.id === inv.id)!;
      expect(BigInt(listed.leftToCredit)).toBe(BigInt(inv.totalAmount) - BigInt(note.totalAmount));

      // Search finds it by number and by the invoice it corrects.
      const found = await ok<{ groups: { type: string; items: { title: string; href: string }[] }[] }>(await call("GET", `/search?q=${encodeURIComponent(note.number!)}`));
      expect(found.groups[0]).toMatchObject({ type: "credit_notes" });
      expect(found.groups[0]!.items[0]!.href).toBe(`/credit-notes/${note.id}`);
    });
  });
});
