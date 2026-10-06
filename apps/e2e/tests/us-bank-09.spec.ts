import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { test as seeded, logIn } from "./fixtures";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-BANK-09", () => {
  test("create a customer payment, an expense and other money out from statement lines; each is matched", async ({ page }) => {
    await signUpNewOrg(page, { name: "Create Owner", email: `e2e-bank-09-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    await post("/expense-categories", { name: "Fuel", accountId: Object.values(grouped).flat().find((a) => a.code === "6900")!.id });
    await post("/contacts", { type: "customer", name: "Acme Builders" });
    const csv = ["Date,Description,Reference,Amount", "2026-10-02,NEFT ACME BUILDERS,FT2610,250.00", "2026-10-04,POS 4410 SHELL PORTLAND,,-58.20", "2026-10-05,ACCOUNT FEES OCT,,-11.80"].join("\n");
    const imported = await page.request.post(`${API_URL}/money-accounts/${bank.id}/statement-imports`, {
      headers: { "Idempotency-Key": randomUUID() },
      multipart: {
        file: { name: "statement.csv", mimeType: "text/csv", buffer: Buffer.from(csv) },
        mapping: JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", reference: "Reference", amountMode: "single", amount: "Amount" }),
      },
    });
    expect(imported.ok()).toBe(true);

    await page.goto(`/banking/${bank.id}/reconcile`);
    await page.getByRole("textbox", { name: "Closing balance on the statement" }).fill("180.00");
    await page.getByRole("button", { name: "Start reconciling" }).click();
    const line = (text: string) => page.getByTestId("statement-line").filter({ hasText: text });

    // Money in: a customer payment, opened prefilled.
    await line("NEFT ACME BUILDERS").getByRole("button", { name: "Create" }).click();
    const drawer = page.getByRole("dialog", { name: "Create from statement line" });
    await expect(drawer).toContainText("Saving matches the line to the new entry.");
    await expect(drawer.getByRole("radio")).toHaveCount(3);
    for (const name of ["Customer payment", "Transfer from another account", "Other money in"]) await expect(drawer.getByRole("radio", { name })).toBeVisible();
    await drawer.getByRole("button", { name: "Continue" }).click();
    const pay = page.getByRole("dialog", { name: "Record a payment" });
    await expect(pay).toContainText("Bank Account");
    await pay.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Acme Builders" }).click();
    await expect(pay.locator('input[inputmode="decimal"]').first()).toHaveValue("250.00");
    await expect(pay.locator('input[inputmode="decimal"]').first()).toBeDisabled();
    await pay.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Recorded and matched to NEFT ACME BUILDERS.")).toBeVisible();
    await expect(line("NEFT ACME BUILDERS")).toContainText("Matched");

    // Money out: an expense, recorded and approved from the drawer.
    await line("POS 4410 SHELL PORTLAND").getByRole("button", { name: "Create" }).click();
    for (const name of ["Vendor payment", "Expense", "Transfer to another account", "Other money out", "Tax payment"]) await expect(drawer.getByRole("radio", { name })).toBeVisible();
    await drawer.getByRole("radio", { name: "Expense" }).check();
    await drawer.getByRole("combobox", { name: "Category" }).click();
    await page.getByRole("option", { name: "Fuel" }).click();
    await drawer.getByRole("button", { name: "Save and match" }).click();
    await expect(line("POS 4410 SHELL PORTLAND")).toContainText("Matched");

    // Money out: other money out, through the Money out form.
    await line("ACCOUNT FEES OCT").getByRole("button", { name: "Create" }).click();
    await drawer.getByRole("radio", { name: "Other money out" }).check();
    await drawer.getByRole("button", { name: "Continue" }).click();
    const out = page.getByRole("dialog", { name: "Money out" });
    await out.getByRole("button", { name: "Bank charges" }).click();
    await out.getByRole("button", { name: "Record money out" }).click();
    await expect(line("ACCOUNT FEES OCT")).toContainText("Matched");
    await expect(page.getByTestId("reconcile-difference")).toContainText("$0.00");
  });
});

const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

seeded.describe("US-BANK-09 rights", () => {
  seeded("an option needs its right: without 'Create/edit own payments' there's no Customer payment; Expense and Tax payment are for owners", async ({ page, seededOrg: _, browser }) => {
    const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
    const generalStaff = teams.find((t) => t.isDefault)!;
    const setRights = (privileges: { capability: string; granted: boolean }[]) =>
      page.request.put(`${API_URL}/org/teams/${generalStaff.id}/privileges`, { headers: { "Idempotency-Key": randomUUID() }, data: { privileges } });
    expect((await setRights([{ capability: "banking.reconcile", granted: true }, { capability: "banking.record", granted: true }, { capability: "payments.edit_own", granted: false }])).ok()).toBe(true);
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    const csv = ["Date,Description,Amount", "2026-10-02,NEFT RIGHTS TEST,250.00", "2026-10-03,POS RIGHTS TEST,-20.00"].join("\n");
    await page.request.post(`${API_URL}/money-accounts/${bank.id}/statement-imports`, {
      headers: { "Idempotency-Key": randomUUID() },
      multipart: { file: { name: "rights.csv", mimeType: "text/csv", buffer: Buffer.from(csv) }, mapping: JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }) },
    });

    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto(`/banking/${bank.id}/reconcile`);
    const closing = staff.getByRole("textbox", { name: "Closing balance on the statement" });
    await closing.fill("1.00");
    const startButton = staff.getByRole("button", { name: "Start reconciling" });
    if (await startButton.isVisible()) await startButton.click();
    const drawer = staff.getByRole("dialog", { name: "Create from statement line" });
    await staff.getByTestId("statement-line").filter({ hasText: "NEFT RIGHTS TEST" }).getByRole("button", { name: "Create" }).click();
    await expect(drawer.getByRole("radio", { name: "Other money in" })).toBeVisible();
    await expect(drawer.getByRole("radio", { name: "Customer payment" })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Cancel" }).click();
    await staff.getByTestId("statement-line").filter({ hasText: "POS RIGHTS TEST" }).getByRole("button", { name: "Create" }).click();
    await expect(drawer.getByRole("radio", { name: "Other money out" })).toBeVisible();
    await expect(drawer.getByRole("radio", { name: "Expense" })).toHaveCount(0);
    await expect(drawer.getByRole("radio", { name: "Tax payment" })).toHaveCount(0);
    await context.close();

    // Back to General Staff's defaults (reconciling turned viewing on too).
    expect(
      (
        await setRights([
          { capability: "banking.reconcile", granted: false },
          { capability: "banking.view", granted: false },
          { capability: "banking.record", granted: false },
          { capability: "payments.edit_own", granted: true },
        ])
      ).ok(),
    ).toBe(true);
  });
});
