import { randomUUID } from "node:crypto";
import { inflateSync } from "node:zlib";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** Every text string drawn in a PDF, in order (react-pdf writes hex strings into Flate-compressed streams). */
function pdfText(buf: Buffer): string {
  let out = "";
  for (const m of buf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1");
    } catch {
      continue;
    }
    for (const h of content.matchAll(/<([0-9a-fA-F]+)>/g)) out += Buffer.from(h[1]!, "hex").toString("latin1");
    out += "\n";
  }
  return out;
}

/** The first page's width and height in points. */
function pageSize(buf: Buffer): [number, number] {
  const m = buf.toString("latin1").match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  return [Number(m![1]), Number(m![2])];
}

/** US-RPT-33 — any report as a light PDF with the business, report, range, basis, page numbers and "Prepared <date>". Requires local Postgres. */
describe("US-RPT-33 · download any report as a PDF (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  const owner: Who = { cookie: "", userId: "" };
  const range = "from=2026-01-01&to=2026-12-31";

  const get = (path: string) => fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: owner.cookie } });
  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const pdf = async (path: string) => {
    const res = await get(path);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    return { buf, disposition: res.headers.get("content-disposition") };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-rpt-33-owner-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "owner" }));
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await json(await call("PUT", "/org/settings/business_profile", { value: { name: "Riverstone Builders" } }));
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const bank = (await json<MoneyAccount[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    for (const [month, amount] of [["01", "100000"], ["02", "200000"], ["03", "300000"]] as const) {
      await json(await call("POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: code["4100"], amount, date: `2026-${month}-15` }));
    }
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("has the business name, report name, range, basis, page numbers and 'Prepared <date>'", async () => {
    const { buf, disposition } = await pdf(`/reports/profit-and-loss?${range}&format=pdf`);
    expect(disposition).toBe('attachment; filename="profit-and-loss-2026-01-01-2026-12-31.pdf"');
    const text = pdfText(buf);
    // Dashes come out in WinAnsi encoding, so match the text around them.
    for (const s of ["Riverstone Builders", "Profit & Loss", "Dec 2026 · Accrual basis", "4100 · Sales ", "6,000.00", "Prepared", "Page 1 of 1"]) expect(text, s).toContain(s);
    const [w, h] = pageSize(buf);
    expect(w).toBeLessThan(h);
  });

  it("the cash basis says so", async () => {
    expect(pdfText((await pdf(`/reports/profit-and-loss?${range}&basis=cash&format=pdf`)).buf)).toContain("Cash basis");
  });

  it("more than five amount columns turn the page landscape", async () => {
    const { buf } = await pdf(`/reports/profit-and-loss?${range}&compare=monthly&format=pdf`);
    const [w, h] = pageSize(buf);
    expect(w).toBeGreaterThan(h);
    expect(pdfText(buf)).toContain("Mar 2026");
  });

  it("is light: white page, dark text", async () => {
    const { buf } = await pdf(`/reports/trial-balance?asOf=2026-12-31&format=pdf`);
    expect(pdfText(buf)).toContain("Trial Balance");
    let fills = "";
    for (const m of buf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try {
        fills += inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1");
      } catch {
        // not a content stream
      }
    }
    expect(fills).toMatch(/1 1 1 (rg|scn)/);
    expect(fills).not.toMatch(/0\.0\d+ 0\.0\d+ 0\.0\d+ (rg|scn)[\s\S]*re f/);
  });
});
