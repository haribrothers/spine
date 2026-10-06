import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function download(page: Page, item: "export-csv" | "export-xlsx") {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByTestId(item).click()]);
  return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) };
}

test.describe("US-RPT-32", () => {
  test("Export offers CSV and Excel; files hold what's on screen, comparison and search included", async ({ page }) => {
    await signUpNewOrg(page, { name: "Export Owner", email: `e2e-rpt-32-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    await post("/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: code("4100"), amount: "1234550", date: today() });
    const maple = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    const blue = await post<{ id: string }>("/contacts", { type: "customer", name: "Bluewater Hospitality Group" });
    await post("/payments", { contactId: maple.id, date: today(), method: "cash", currency: "USD", amount: "500000" });
    await post("/payments", { contactId: blue.id, date: today(), method: "cheque", currency: "USD", amount: "70000" });

    await page.goto("/reports/profit-and-loss");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText(["CSV", "Excel (.xlsx)", "PDF"]);
    await page.keyboard.press("Escape");

    const csv = await download(page, "export-csv");
    expect(csv.name).toMatch(/^profit-and-loss-\d{4}-01-01-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = csv.bytes.toString("utf8").split("\r\n");
    expect(lines[0]).toBe("Account,Amount,Currency");
    expect(lines).toContain("4100 · Sales — Services,12345.50,USD");

    const xlsx = await download(page, "export-xlsx");
    expect(xlsx.name).toMatch(/\.xlsx$/);
    expect(xlsx.bytes.subarray(0, 2).toString()).toBe("PK");

    await page.getByRole("combobox", { name: "Compare with" }).click();
    await page.getByRole("option", { name: "Same period last year" }).click();
    await expect(page.getByTestId("pl-compare-table")).toBeVisible();
    const compared = (await download(page, "export-csv")).bytes.toString("utf8").split("\r\n");
    expect(compared[0]).toMatch(/^Account,.+,.+,Change,Change %,Currency$/);

    await page.goto("/reports/payments-received");
    await page.getByRole("textbox", { name: "Search payments" }).fill("bluewater");
    const searched = (await download(page, "export-csv")).bytes.toString("utf8");
    expect(searched).toContain("Bluewater Hospitality Group");
    expect(searched).not.toContain("Maple Ridge Developments");
  });
});
