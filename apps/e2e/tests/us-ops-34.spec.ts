import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n", "latin1");

async function attach(request: APIRequestContext, entityType: string, entityId: string, name: string): Promise<string> {
  const upload = await request.post(`${API_URL}/files`, { multipart: { file: { name, mimeType: "application/pdf", buffer: PDF } }, headers: { "Idempotency-Key": randomUUID() } });
  expect(upload.ok(), await upload.text()).toBe(true);
  const file = (await upload.json()) as { id: string };
  const res = await request.post(`${API_URL}/attachments`, { data: { entityType, entityId, fileId: file.id }, headers: { "Idempotency-Key": randomUUID() } });
  expect(res.ok(), await res.text()).toBe(true);
  return file.id;
}

test.describe("US-OPS-34", () => {
  test("a Field user opens files on their own expense, never on an invoice", async ({ page, seededOrg }) => {
    void seededOrg;
    const invoices = (await (await page.request.get(`${API_URL}/invoices`)).json()) as { id: string }[];
    const invoiceFile = await attach(page.request, "invoice", invoices[0]!.id, "signed-contract.pdf");
    // The Owner previews it in the browser.
    const asOwner = await page.request.get(`${API_URL}/files/${invoiceFile}`);
    expect(asOwner.status()).toBe(200);
    expect(asOwner.headers()["content-disposition"]).toMatch(/^inline/);

    await page.goto("about:blank");
    await page.context().clearCookies();
    await logIn(page, DEMO_FIELD_USER);
    const categories = (await (await page.request.get(`${API_URL}/expense-categories`)).json()) as { id: string }[];
    const today = new Date().toISOString().slice(0, 10);
    const created = await page.request.post(`${API_URL}/expenses`, { data: { categoryId: categories[0]!.id, date: today, currency: "USD", amount: "6400", description: "Site fuel" }, headers: { "Idempotency-Key": randomUUID() } });
    expect(created.ok(), await created.text()).toBe(true);
    const expense = (await created.json()) as { id: string };
    await attach(page.request, "expense", expense.id, "fuel-docket.pdf");

    await page.goto(`/expenses/${expense.id}`);
    const link = page.getByTestId("attachments").getByRole("link", { name: "fuel-docket.pdf", exact: true });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect((await page.request.get(href!)).status()).toBe(200);

    expect((await page.request.get(`${API_URL}/files/${invoiceFile}`)).status()).toBe(404);
    expect((await page.request.get(`${API_URL}/attachments?entityType=invoice&entityId=${invoices[0]!.id}`)).status()).toBe(404);
  });
});
