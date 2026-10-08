import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-SET-25", () => {
  test("switching a module back on brings its pages and records back as they were", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-set-25-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const contact = await (await page.request.post(`${API_URL}/contacts`, { headers: { "Idempotency-Key": randomUUID() }, data: { type: "customer", name: "Harbour Café" } })).json();
    const job = await (await page.request.post(`${API_URL}/jobs`, { headers: { "Idempotency-Key": randomUUID() }, data: { name: "Kitchen refit", contactId: contact.id, currency: "USD" } })).json();
    const put = (jobsField: boolean) => page.request.put(`${API_URL}/org/modules`, { headers: { "Idempotency-Key": randomUUID() }, data: { leadsMeetings: true, jobsField, approvals: true, recurring: true } });

    expect((await put(false)).ok()).toBe(true);
    await page.goto(`/jobs/${job.id}`);
    await expect(page.getByTestId("module-off")).toBeVisible();

    expect((await put(true)).ok()).toBe(true);
    await page.goto(`/jobs/${job.id}`);
    await expect(page.getByRole("heading", { name: "Kitchen refit" })).toBeVisible();
    await expect(page.locator('a[aria-label="Jobs"]')).toBeVisible();
  });
});
