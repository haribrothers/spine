import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n", "latin1");

async function attach(request: APIRequestContext, entityId: string, name: string): Promise<void> {
  const upload = await request.post(`${API_URL}/files`, { multipart: { file: { name, mimeType: "application/pdf", buffer: PDF } }, headers: { "Idempotency-Key": randomUUID() } });
  const file = (await upload.json()) as { id: string };
  const res = await request.post(`${API_URL}/attachments`, { data: { entityType: "vendor_bill", entityId, fileId: file.id }, headers: { "Idempotency-Key": randomUUID() } });
  expect(res.ok(), await res.text()).toBe(true);
}

test.describe("US-OPS-35", () => {
  test("remove a file from a draft freely; from a recorded bill only an Owner can, with a reason", async ({ page, browser, seededOrg }) => {
    void seededOrg;
    const bills = (await (await page.request.get(`${API_URL}/vendor-bills?status=recorded`)).json()) as { id: string; contactId: string }[];
    const recorded = bills[0]!;
    const draftRes = await page.request.post(`${API_URL}/vendor-bills`, {
      data: { contactId: recorded.contactId, billNumber: `D-${randomUUID().slice(0, 6)}`, date: new Date().toISOString().slice(0, 10), currency: "USD", lines: [] },
      headers: { "Idempotency-Key": randomUUID() },
    });
    expect(draftRes.ok(), await draftRes.text()).toBe(true);
    const draft = (await draftRes.json()) as { id: string };
    await attach(page.request, draft.id, "wrong-scan.pdf");
    await attach(page.request, recorded.id, "delivery-docket-site.pdf");

    // A draft: a plain confirm.
    await page.goto(`/vendor-bills/${draft.id}`);
    const files = page.getByTestId("attachments");
    await files.getByRole("button", { name: "Remove wrong-scan.pdf" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Remove wrong-scan.pdf?");
    await expect(confirm.getByLabel("Reason")).toHaveCount(0);
    await confirm.getByRole("button", { name: "Remove attachment" }).click();
    await expect(files.getByText("wrong-scan.pdf")).toHaveCount(0);

    // A recorded bill: Staff see no Remove.
    const staffContext = await browser.newContext();
    const staff = await staffContext.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto(`/vendor-bills/${recorded.id}`);
    await expect(staff.getByTestId("attachments").getByText("delivery-docket-site.pdf")).toBeVisible();
    await expect(staff.getByTestId("attachments").getByRole("button", { name: /^Remove/ })).toHaveCount(0);
    await staffContext.close();

    // The Owner removes it with a reason.
    await page.goto(`/vendor-bills/${recorded.id}`);
    await files.getByRole("button", { name: "Remove delivery-docket-site.pdf" }).click();
    await expect(confirm).toContainText("This bill is recorded, so only an owner can remove its files, with a reason. The bill's history records it.");
    const remove = confirm.getByRole("button", { name: "Remove attachment" });
    await expect(remove).toBeDisabled();
    await confirm.getByLabel("Reason").fill("Wrong docket — belongs to bill 88240");
    await remove.click();
    await expect(files.getByText("delivery-docket-site.pdf")).toHaveCount(0);

    await page.getByRole("button", { name: "View history" }).click();
    await expect(page.getByRole("dialog")).toContainText("removed attachment delivery-docket-site.pdf — Wrong docket — belongs to bill 88240");
  });
});
