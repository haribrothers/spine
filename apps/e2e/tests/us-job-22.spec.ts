import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-JOB-22", () => {
  test("the jobs list and job detail show the number next to the customer", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-job-22-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const contact = await page.request.post(`${API_URL}/contacts`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { type: "customer", name: "Alan Brooks" },
    });
    expect(contact.ok()).toBe(true);
    const { id: contactId } = (await contact.json()) as { id: string };
    const created = await page.request.post(`${API_URL}/jobs`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { contactId, name: "Kitchen fit-out", currency: "USD" },
    });
    expect(created.ok()).toBe(true);
    const job = (await created.json()) as { id: string; number: string };
    expect(job.number).toBe("JOB-001");

    await page.goto("/jobs");
    const row = page.getByRole("row", { name: /Kitchen fit-out/ });
    await expect(row).toContainText("JOB-001");
    await expect(row).toContainText("Alan Brooks");

    await page.goto(`/jobs/${job.id}`);
    // US-JOB-34: the number is the page title, with the customer beside it.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("JOB-001");
    await expect(page.getByTestId("job-meta")).toContainText("Alan Brooks");
  });
});
