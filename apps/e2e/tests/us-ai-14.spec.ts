import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { startAiStub } from "./ai-stub";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

/** Two payments of the same amount near one line (the rules can't pick), a fee with nothing in Spine, and one line the rules settle. */
async function seed(page: Page) {
  const post = async <T>(path: string, data?: unknown): Promise<T> => {
    const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
    expect(res.ok(), await res.text()).toBe(true);
    return (await res.json()) as T;
  };
  const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
  const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
  const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
  await post("/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: code("3000"), amount: "1000000", date: "2026-09-01" });
  const hdfc = await post<{ id: string }>("/contacts", { type: "vendor", name: "HDFC Bank" });
  await post("/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code("6900"), contactId: hdfc.id, amount: "590", date: "2026-09-12", description: "SMS ALERT CHGS" });
  const maple = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
  const rao = await post<{ id: string }>("/contacts", { type: "customer", name: "Rao Constructions" });
  await post("/payments", { contactId: maple.id, date: "2026-10-02", method: "bank_transfer", currency: "USD", amount: "454250", moneyAccountId: bank.id });
  await post("/payments", { contactId: rao.id, date: "2026-10-03", method: "bank_transfer", currency: "USD", amount: "454250", moneyAccountId: bank.id });
  await post("/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code("6900"), amount: "216000", date: "2026-10-01", description: "Coastal Timber" });
  const csv = ["Date,Description,Amount", "2026-10-01,CHQ 000214 COASTAL TIMBER,-2160.00", "2026-10-02,NEFT-MAPLE RIDGE DEV,4542.50", "2026-10-12,SMS ALERT CHGS,-5.90"].join("\n");
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

test.describe("US-AI-14", () => {
  test("Suggest with AI: AI's matches and creates in the Suggested tab, never in Match all; matching one saves it as suggested by AI", async ({ page }) => {
    const stub = await startAiStub();
    try {
      await signUpNewOrg(page, { name: "Reconcile Owner", email: `us-ai-14-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
      expect((await page.request.put(`${API_URL}/org/ai`, { headers: { "Idempotency-Key": randomUUID() }, data: { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3.5:4b", enabled: true } })).ok()).toBe(true);
      const bank = await seed(page);

      await page.goto(`/banking/${bank.id}/reconcile`);
      await page.getByRole("textbox", { name: "Closing balance on the statement" }).fill("12,370.70");
      await page.getByRole("button", { name: "Start reconciling" }).click();
      const line = (text: string) => page.getByTestId("statement-line").filter({ hasText: text });
      await expect(line("CHQ 000214 COASTAL TIMBER")).toContainText("Suggested match");

      // First ask: the two lines the rules couldn't settle; learn the refs Spine gave them.
      stub.setReply({ suggestions: [] });
      await page.getByRole("button", { name: "Suggest with AI (2 lines)" }).click();
      await expect(page.getByTestId("ai-suggestions-note")).toContainText("AI looked at the 2 lines the rules couldn't settle · 0 suggestions.");
      const prompt = stub.lastPrompt();
      const ref = (prefix: string, text: string) => new RegExp(`(${prefix}\\d+) · [^\\n]*${text}`).exec(prompt)![1];
      stub.setReply({
        suggestions: [
          { line: ref("L", "NEFT-MAPLE RIDGE DEV"), entries: [ref("E", "Maple Ridge Developments")], reason: "same amount; the description mentions Maple Ridge" },
          { line: ref("L", "SMS ALERT CHGS"), entries: [], reason: "bank charges", create: { kind: "money", account: ref("A", "\\(expense\\)"), contact: ref("C", "HDFC Bank"), reason: "like the bank charges recorded in September" } },
        ],
      });
      await page.getByRole("button", { name: "Suggest again" }).click();

      await expect(page.getByTestId("ai-suggestions-note")).toContainText("AI looked at the 2 lines the rules couldn't settle · 2 suggestions. AI suggestions aren't in Match all — check and match each one.");
      await expect(page.getByRole("tab", { name: /^Suggested, 3/ })).toBeVisible();
      // Match all counts and matches only the rules' suggestion.
      await expect(page.getByRole("button", { name: "Match all suggested (1)" })).toBeVisible();
      await expect(line("NEFT-MAPLE RIDGE DEV").getByTestId("ai-line-suggestion")).toContainText(/AI suggests: Payment .* · Maple Ridge Developments/);
      await expect(line("NEFT-MAPLE RIDGE DEV")).toContainText("same amount; the description mentions Maple Ridge");
      await expect(line("SMS ALERT CHGS").getByTestId("ai-line-suggestion")).toContainText(/AI suggests creating: .+ · HDFC Bank/);

      // The entries panel: AI's suggestion first, marked, before the other same-amount payment.
      await line("NEFT-MAPLE RIDGE DEV").getByRole("button", { name: "NEFT-MAPLE RIDGE DEV" }).click();
      const first = page.getByTestId("spine-entry").first();
      await expect(first.getByTestId("ai-entry")).toHaveText("AI suggests");
      await expect(first).toContainText("Maple Ridge Developments");
      await expect(page.getByTestId("spine-entry").nth(1)).toContainText("Same amount");

      // Nothing is matched until Match; then it's saved as suggested by AI.
      await line("NEFT-MAPLE RIDGE DEV").getByRole("button", { name: "Match" }).click();
      await page.getByRole("tab", { name: /^Matched/ }).click();
      await expect(line("NEFT-MAPLE RIDGE DEV")).toContainText("Matched · suggested by AI");

      // Create opens with AI's kind, category and contact, each marked.
      await page.getByRole("tab", { name: /^Suggested/ }).click();
      await line("SMS ALERT CHGS").getByRole("button", { name: "Create" }).click();
      const drawer = page.getByRole("dialog", { name: "Create from statement line" });
      await expect(drawer.getByRole("radio", { name: "Other money out" })).toBeChecked();
      await expect(drawer.getByTestId("ai-create-reason")).toContainText("like the bank charges recorded in September");
      await drawer.getByRole("button", { name: "Continue" }).click();
      const out = page.getByRole("dialog", { name: "Money out" });
      await expect(out.getByTestId("ai-suggested")).toHaveCount(2);
      await out.getByRole("button", { name: "Record money out" }).click();
      await page.getByRole("alertdialog", { name: "Record money out?" }).getByRole("button", { name: "Record" }).click();
      await page.getByRole("tab", { name: /^Matched/ }).click();
      await expect(line("SMS ALERT CHGS")).toContainText("Matched · suggested by AI");
    } finally {
      await stub.close();
    }
  });
});
