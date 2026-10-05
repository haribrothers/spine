import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { auditLog, contacts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** RFC 4180 rows, enough for these assertions (quoted fields, doubled quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

/**
 * US-SET-12 — `GET /org/audit-log.csv`: the filtered entries as CSV with
 * ISO 8601 timestamp, actor name and email, action, record type, record id
 * and a JSON diff, streamed in batches. Owner-only. Requires local Postgres.
 */
describe("US-SET-12 · export the audit log (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  let contactId: string;

  const csv = (query = "") => fetch(`${testApp.baseUrl}/org/audit-log.csv${query}`, { headers: { cookie: owner.cookie } });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-set-12-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Alex Morgan" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Bluewater, \"Hospitality\" Group", createdByUserId: owner.userId }).returning();
    contactId = contact!.id;
    await db.insert(auditLog).values([
      { orgId, actorUserId: owner.userId, action: "created", entityType: "contact", entityId: contactId, contactId, changes: [{ field: "name", from: null, to: contact!.name }], createdAt: new Date(Date.now() - 2000) },
      { orgId, actorUserId: owner.userId, action: "updated", entityType: "contact", entityId: contactId, contactId, changes: [{ field: "phone", from: "+1-555-0107", to: "+1-555-0177" }], createdAt: new Date(Date.now() - 1000) },
    ]);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("downloads the filtered entries with timestamp, actor, action, record and a JSON diff", async () => {
    const res = await csv("?action=updated");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="audit-log-\d{4}-\d{2}-\d{2}\.csv"/);
    const [header, ...rows] = parseCsv(await res.text());
    expect(header).toEqual(["timestamp", "actor_name", "actor_email", "action", "record_type", "record_id", "record", "changes"]);
    expect(rows).toHaveLength(1);
    const [ts, name, mail, action, type, id, record, changes] = rows[0]!;
    expect(new Date(ts!).toISOString()).toBe(ts);
    expect([name, mail, action, type, id, record]).toEqual(["Alex Morgan", emails[0], "updated", "Contact", contactId, 'Bluewater, "Hospitality" Group']);
    expect(JSON.parse(changes!)).toEqual([{ field: "phone", from: "+1-555-0107", to: "+1-555-0177" }]);
  });

  it("streams a log of more than 10,000 entries in batches, every row once", async () => {
    const rows = Array.from({ length: 10_500 }, (_, i) => ({ orgId, actorUserId: owner.userId, action: "bulk_test", entityType: "contact", entityId: contactId, contactId, changes: { n: i }, createdAt: new Date(Date.now() - 10_000 - (i % 50) * 1000) }));
    for (let i = 0; i < rows.length; i += 2000) await db.insert(auditLog).values(rows.slice(i, i + 2000));
    const started = Date.now();
    const res = await csv("?action=bulk_test");
    const body = await res.text();
    expect(Date.now() - started).toBeLessThan(30_000);
    const parsed = parseCsv(body).slice(1);
    expect(parsed).toHaveLength(10_500);
    expect(new Set(parsed.map((r) => JSON.parse(r[7]!).n)).size).toBe(10_500);
  }, 60_000);
});
