import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-SET-13", () => {
  test("contact history opens from a History button and reads as sentences", async ({ page }) => {
    await signUpNewOrg(page, { name: "Sarah Mendes", email: `us-set-13-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const created = await page.request.post(`${API_URL}/contacts`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { type: "customer", name: "Bluewater Hospitality Group", phone: "+1-555-0107" },
    });
    expect(created.ok()).toBe(true);
    const { id } = (await created.json()) as { id: string };
    const updated = await page.request.put(`${API_URL}/contacts/${id}`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { phone: "+1-555-0177" },
    });
    expect(updated.ok()).toBe(true);

    await page.goto(`/contacts/${id}`);
    await expect(page.getByRole("tab", { name: "Timeline" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "History" })).toHaveCount(0);

    await page.getByRole("button", { name: "View history" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Sarah Mendes changed the phone from +1-555-0107 to +1-555-0177")).toBeVisible();
    await expect(dialog.getByText("Sarah Mendes created this contact")).toBeVisible();
    await expect(dialog).not.toContainText("undefined");
  });
});
