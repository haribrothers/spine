import { describe, expect, it } from "vitest";
import { SETUP_CARD_KEYS, SETUP_CARDS, finishSettingUpLabel, setupProgress, type SetupCardStatus } from "./schemas/setup.ts";
import { FEATURE_FLAGS } from "./feature-flags.ts";

/** US-ONB-15, US-ONB-16 (D-194) — the setup cards and how progress is counted. */
describe("US-ONB-15", () => {
  it("lists fourteen cards in order, each with a line, a target and a guide page", () => {
    expect(SETUP_CARD_KEYS.map((k) => SETUP_CARDS[k].title)).toEqual([
      "Business details and logo",
      "Tax",
      "Chart of accounts",
      "Opening balances",
      "Bank and cash accounts",
      "Payment instructions",
      "Documents and emails",
      "Numbering",
      "Payment reminders",
      "Modules",
      "Invite your team",
      "Email sending",
      "Backups",
      "Field app",
    ]);
    for (const key of SETUP_CARD_KEYS) {
      expect(SETUP_CARDS[key].why.length).toBeGreaterThan(10);
      expect(SETUP_CARDS[key].guide).toMatch(/^\/help\//);
    }
    expect(SETUP_CARDS.email.target).toEqual({ guide: "self_hosting" });
    expect(SETUP_CARDS.bank_accounts.target).toEqual({ page: "/banking" });
  });

  it("counts only cards Spine can check that aren't hidden", () => {
    const cards: SetupCardStatus[] = [
      { key: "business", done: true, hidden: false },
      { key: "tax", done: false, hidden: false },
      { key: "reminders", done: false, hidden: true },
      { key: "backups", done: null, hidden: false },
    ];
    expect(setupProgress(cards)).toEqual({ done: 1, total: 2, toDo: 1, notNeeded: 1 });
    expect(finishSettingUpLabel(3)).toBe("Finish setting up Spine — 3 left");
  });

  it("keeps the bundled guide links off until Phase 12 (US-SITE-11)", () => {
    expect(FEATURE_FLAGS.bundledHelp).toBe(false);
  });
});
