import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, StatementImportResult, StatementLine } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

const SPLIT = { date: "Txn date", dateFormat: "DD/MM/YYYY", description: "Narration", reference: "Ref no.", amountMode: "split", moneyIn: "Deposit", moneyOut: "Withdrawal", balance: "Balance" };
const HEADER = "Txn date,Narration,Ref no.,Withdrawal,Deposit,Balance";

/** US-BANK-07 — import a CSV statement: map columns once, skip lines already imported, report unreadable rows. Requires local Postgres. */
describe("US-BANK-07 · import a bank statement (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  const owner: Who = { cookie: "", userId: "" };
  const viewer: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const upload = (who: Who, csv: string | Buffer, mapping: unknown = SPLIT, name = "statement-oct-2026.csv", type = "text/csv") => {
    const form = new FormData();
    form.append("file", new Blob([typeof csv === "string" ? csv : new Uint8Array(csv)], { type }), name);
    form.append("mapping", JSON.stringify(mapping));
    return fetch(`${testApp.baseUrl}/money-accounts/${bank.id}/statement-imports`, { method: "POST", headers: { "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: form });
  };
  const get = (who: Who, path: string) => fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: who.cookie } });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;

  async function join(who: Who, role: "staff" | "field", grants: string[] = []) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role !== "staff") return;
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [viewer, "viewer"], [field, "field"]] as const) {
      const email = `us-bank-07-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(viewer, "staff", ["banking.view"]);
    await join(field, "field");
    bank = (await json<MoneyAccount[]>(await get(owner, "/money-accounts"))).find((a) => a.code === "1010")!;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("imports the readable rows, reports the rest, and saves the mapping", async () => {
    expect((await json<{ mapping: unknown }>(await get(owner, `/money-accounts/${bank.id}/statement-mapping`))).mapping).toBeNull();
    const csv = [
      HEADER,
      "01/10/2026,NEFT-MAPLE RIDGE DEV,FT26100248,,\"4,542.50\",\"48,230.40\"",
      "01/10/2026,CHQ 000214 COASTAL TIMBER,000214,\"2,160.00\",,\"43,687.90\"",
      "32/10/2026,BAD DATE,,1.00,,",
      "03/10/2026,BAD AMOUNT,,abc,,",
    ].join("\n");
    const result = await json<StatementImportResult>(await upload(owner, csv));
    expect(result).toMatchObject({ imported: 2, skipped: 0, failed: [{ row: 4, reason: 'Couldn\'t read the date "32/10/2026".' }, { row: 5, reason: "Couldn't read the amount." }] });
    const lines = await json<StatementLine[]>(await get(owner, `/money-accounts/${bank.id}/statement-lines?status=unmatched`));
    expect(lines.map((l) => [l.date, l.description, l.reference, l.amount, l.runningBalance, l.fileName])).toEqual([
      ["2026-10-01", "NEFT-MAPLE RIDGE DEV", "FT26100248", "454250", "4823040", "statement-oct-2026.csv"],
      ["2026-10-01", "CHQ 000214 COASTAL TIMBER", "000214", "-216000", "4368790", "statement-oct-2026.csv"],
    ]);
    expect((await json<{ mapping: unknown }>(await get(owner, `/money-accounts/${bank.id}/statement-mapping`))).mapping).toMatchObject(SPLIT);
  });

  it("skips lines already imported (same date, amount and description)", async () => {
    const csv = [HEADER, "01/10/2026,neft-maple  ridge dev,FT26100248,,4542.50,", "01/10/2026,CHQ 000214 COASTAL TIMBER,000214,2160.00,,", "03/10/2026,INTEREST CREDIT,,,6.12,"].join("\n");
    expect(await json<StatementImportResult>(await upload(owner, csv))).toMatchObject({ imported: 1, skipped: 2, failed: [] });
    const single = await json<StatementImportResult>(
      await upload(owner, "Date,Description,Amount\n2026-10-04,POS 4410 SHELL PORTLAND,-58.20\n", { date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }),
    );
    expect(single).toMatchObject({ imported: 1, skipped: 0 });
    const lines = await json<StatementLine[]>(await get(owner, `/money-accounts/${bank.id}/statement-lines?to=2026-10-03`));
    expect(lines.map((l) => l.description)).toEqual(["NEFT-MAPLE RIDGE DEV", "CHQ 000214 COASTAL TIMBER", "INTEREST CREDIT"]);
  });

  it("refuses files that aren't CSV, or are too big", async () => {
    const pdf = await upload(owner, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]), SPLIT, "statement.pdf", "application/pdf");
    expect(pdf.status).toBe(415);
    expect(await message(pdf)).toBe("Export the statement from your bank as CSV, then import it here.");
    const many = [HEADER, ...Array.from({ length: 5001 }, (_, i) => `01/10/2026,LINE ${i},,1.00,,`)].join("\n");
    const tooMany = await upload(owner, many);
    expect(tooMany.status).toBe(400);
    expect(await message(tooMany)).toBe("Split the statement into smaller files (up to 5,000 lines).");
    const tooBig = await upload(owner, HEADER + "\n" + "x".repeat(2 * 1024 * 1024 + 10));
    expect(tooBig.status).toBe(400);
    expect(await message(tooBig)).toBe("Split the statement into smaller files (up to 5,000 lines).");
    const wrongColumn = await upload(owner, "Date,Text,Amount\n2026-10-04,X,1\n", { date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" });
    expect(await message(wrongColumn)).toBe("The file has no column called Description. Choose another column.");
  });

  it("needs 'Reconcile accounts'; Field never", async () => {
    for (const who of [viewer, field]) {
      expect((await upload(who, HEADER + "\n")).status).toBe(403);
      expect((await get(who, `/money-accounts/${bank.id}/statement-lines`)).status).toBe(403);
      expect((await get(who, `/money-accounts/${bank.id}/statement-mapping`)).status).toBe(403);
    }
  });
});
