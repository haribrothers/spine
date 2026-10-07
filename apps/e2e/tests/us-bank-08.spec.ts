import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

/** Entries in Spine and a statement for the first days of October. */
async function seed(page: Page) {
  const post = async <T>(path: string, data?: unknown): Promise<T> => {
    const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
    expect(res.ok(), await res.text()).toBe(true);
    return (await res.json()) as T;
  };
  const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
  const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
  const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
  const out = (amount: string, date: string, description: string) => post("/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code("6900"), amount, date, description });
  await post("/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: code("3000"), amount: "1000000", date: "2026-09-15" });
  const contact = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
  await post("/payments", { contactId: contact.id, date: "2026-10-02", method: "bank_transfer", currency: "USD", amount: "454250", moneyAccountId: bank.id });
  await out("216000", "2026-10-01", "Coastal Timber");
  await out("5820", "2026-10-04", "Fuel");
  await out("6000", "2026-10-04", "Card part A");
  await out("4000", "2026-10-04", "Card part B");
  const csv = [
    "Date,Description,Amount",
    "2026-10-01,CHQ 000214 COASTAL TIMBER,-2160.00",
    "2026-10-01,NEFT-MAPLE RIDGE DEV,4542.50",
    "2026-10-03,INTEREST CREDIT,6.12",
    "2026-10-04,POS 4410 SHELL PORTLAND,-58.20",
    "2026-10-04,CARD SETTLEMENT,-100.00",
  ].join("\n");
  const res = await page.request.post(`${API_URL}/money-accounts/${bank.id}/statement-imports`, {
    headers: { "Idempotency-Key": randomUUID() },
    multipart: {
      file: { name: "statement-oct-2026.csv", mimeType: "text/csv", buffer: Buffer.from(csv) },
      mapping: JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }),
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return bank;
}

test.describe("US-BANK-08", () => {
  test("suggested matches, matching several entries to one line, excluding, saved as you go", async ({ page }) => {
    await signUpNewOrg(page, { name: "Reconcile Owner", email: `e2e-bank-08-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const bank = await seed(page);

    await page.goto(`/banking/${bank.id}`);
    await page.getByRole("link", { name: "Reconcile" }).click();
    await expect(page.getByRole("heading", { name: "Reconcile Bank Account" })).toBeVisible();
    await page.getByRole("textbox", { name: "Closing balance on the statement" }).fill("12,230.42");
    await page.getByRole("button", { name: "Start reconciling" }).click();

    const cards = page.getByTestId("reconcile-cards");
    await expect(cards).toContainText("Cleared in Spine$10,000.00opening $10,000.00 + 0 matched");
    await expect(page.getByTestId("reconcile-difference")).toContainText("$2,230.42");
    const line = (text: string) => page.getByTestId("statement-line").filter({ hasText: text });
    await expect(line("NEFT-MAPLE RIDGE DEV")).toContainText("Suggested match");
    await expect(line("CHQ 000214 COASTAL TIMBER")).toContainText("Suggested match");
    await expect(line("CARD SETTLEMENT")).toContainText("Unmatched");

    await line("NEFT-MAPLE RIDGE DEV").getByRole("button", { name: "Match" }).click();
    await expect(line("NEFT-MAPLE RIDGE DEV")).toContainText("Matched");
    await line("CHQ 000214 COASTAL TIMBER").getByRole("button", { name: "Match" }).click();
    await expect(line("CHQ 000214 COASTAL TIMBER")).toContainText("Matched");

    // "Not this one", then match by hand.
    await line("POS 4410 SHELL PORTLAND").getByRole("button", { name: "Not this one" }).click();
    await expect(line("POS 4410 SHELL PORTLAND")).toContainText("Unmatched");
    await line("POS 4410 SHELL PORTLAND").getByRole("button", { name: "POS 4410 SHELL PORTLAND" }).click();
    await page.getByRole("checkbox", { name: /Money out — Other Expenses.*−\$58\.20/ }).check();
    await page.getByTestId("match-bar").getByRole("button", { name: "Match" }).click();
    await expect(line("POS 4410 SHELL PORTLAND")).toContainText("Matched");

    // Several entries to one line, only when they add up.
    await line("CARD SETTLEMENT").getByRole("button", { name: "CARD SETTLEMENT" }).click();
    await page.getByRole("checkbox", { name: /−\$60\.00/ }).check();
    await expect(page.getByTestId("match-bar")).toContainText("Selected entries add up to −$60.00; the line is −$100.00.");
    await expect(page.getByTestId("match-bar").getByRole("button", { name: "Match" })).toBeDisabled();
    await page.getByRole("checkbox", { name: /−\$40\.00/ }).check();
    await expect(page.getByTestId("match-bar")).toContainText("2 entries add up to the line.");
    await page.getByTestId("match-bar").getByRole("button", { name: "Match" }).click();
    await expect(line("CARD SETTLEMENT")).toContainText("Matched");

    // Exclude a line that shouldn't be in the books.
    await line("INTEREST CREDIT").getByRole("button", { name: "Exclude" }).click();
    await page.getByRole("dialog").getByRole("textbox", { name: "Note" }).fill("Reversed by the bank");
    await page.getByRole("dialog").getByRole("button", { name: "Exclude line" }).click();
    await expect(line("INTEREST CREDIT")).toContainText("Excluded — Reversed by the bank");

    await expect(page.getByTestId("reconcile-difference")).toContainText("$0.00");
    await expect(cards).toContainText("opening $10,000.00 + 5 matched");
    await expect(page.getByTestId("reconcile-footer")).toContainText("Spine agrees with the statement");

    // Leave and come back: the matches are saved.
    await page.reload();
    await expect(line("CARD SETTLEMENT")).toContainText("Matched");
    await expect(page.getByTestId("reconcile-difference")).toContainText("$0.00");
    await line("CARD SETTLEMENT").getByRole("button", { name: "Unmatch CARD SETTLEMENT" }).click();
    await expect(page.getByTestId("reconcile-footer")).toContainText("Difference \u2212$100.00 — match or create entries until it's zero.");
  });
});
