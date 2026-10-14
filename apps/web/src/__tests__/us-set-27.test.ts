import { describe, expect, it } from "vitest";
import { emailsApiQuery, emailsQuery, filterEmails, hasEmailFilters, matchesEmailSearch, parseEmailsState } from "../app/(app)/emails/emails-list-state";
import { pageAccessFor } from "../lib/page-access";
import { email } from "./email-log-fixtures";

const now = new Date("2026-10-11T12:00:00Z");

describe("US-SET-27 · see every email Spine sends", () => {
  it("keeps the search, status, kind, range, record, card, sort and page in the address, leaving defaults out", () => {
    const state = parseEmailsState(new URLSearchParams("q=halcyon&status=failed&status=retrying&kind=invoice_reminder&range=90&record=r1&card=failed&sort=when.asc&page=2"));
    expect(state).toEqual({ q: "halcyon", status: ["failed", "retrying"], kind: ["invoice_reminder"], range: "90", record: "r1", card: "failed", sort: { key: "when", direction: "asc" }, page: 2 });
    expect(parseEmailsState(new URLSearchParams(emailsQuery(state)))).toEqual(state);
    expect(emailsQuery(parseEmailsState(new URLSearchParams("status=nope&kind=nope&range=5&card=nope")))).toBe("");
    expect(hasEmailFilters(parseEmailsState(new URLSearchParams("sort=when.desc")))).toBe(false);
    expect(hasEmailFilters(parseEmailsState(new URLSearchParams("range=7")))).toBe(true);
  });

  it("asks the API for the range, and one record's emails", () => {
    expect(emailsApiQuery(parseEmailsState(new URLSearchParams("range=7&record=r1")), new Date(2026, 9, 11, 12))).toBe("from=2026-10-04&entityId=r1");
    expect(emailsApiQuery(parseEmailsState(new URLSearchParams("")), new Date(2026, 9, 11, 12))).toBe("from=2026-09-11");
  });

  it("matches the recipient, their name, the subject, the record's number and the kind", () => {
    const e = email();
    for (const q of ["ananya.rao@", "ANANYA RAO", "bathroom", "quo-0034", "quote"]) expect(matchesEmailSearch(e, q)).toBe(true);
    expect(matchesEmailSearch(e, "invoice")).toBe(false);
  });

  it("the Waiting and Failed cards, status and kind filter together", () => {
    const list = [
      email({ id: "sent" }),
      email({ id: "queued", status: "queued", sentAt: null }),
      email({ id: "retrying", status: "retrying", kind: "invoice" }),
      email({ id: "failed", status: "failed", failedAt: "2026-10-10T09:00:00Z" }),
      email({ id: "old-failure", status: "failed", failedAt: "2026-09-01T09:00:00Z" }),
    ];
    const ids = (query: string) => filterEmails(list, parseEmailsState(new URLSearchParams(query)), now).map((e) => e.id);
    expect(ids("card=waiting")).toEqual(["queued", "retrying"]);
    expect(ids("card=failed")).toEqual(["failed"]);
    expect(ids("status=failed")).toEqual(["failed", "old-failure"]);
    expect(ids("card=waiting&kind=invoice")).toEqual(["retrying"]);
  });

  it("is Owner-only: Staff and Field get the no-access page", () => {
    expect(pageAccessFor("/emails", "owner", null)).toEqual({ state: "allowed" });
    expect(pageAccessFor("/emails", "staff", {})).toMatchObject({ state: "denied", pageName: "Email log", ownerOnly: true });
    expect(pageAccessFor("/emails", "field", {})).toMatchObject({ state: "denied", pageName: "Email log" });
  });
});
