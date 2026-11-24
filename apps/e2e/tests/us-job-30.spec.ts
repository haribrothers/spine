import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { api, contact, quote, send } from "./quote-seed";
import { fieldUserOn, jobWithMilestones } from "./job-seed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-JOB-30", () => {
  test("New job from the list: says what's missing, fills the site from the contact, and opens the job on Milestones", async ({ page, seededOrg: _ }) => {
    const name = `Ananya Rao ${randomUUID().slice(0, 4)}`;
    const customer = await api(page, "POST", "/contacts", {
      type: "customer",
      name,
      addresses: [{ type: "site", line1: "14, 3rd Cross", city: "HSR Layout", state: "Bengaluru", postalCode: "560102", isPrimary: true }],
    });

    await page.goto("/jobs");
    await page.getByRole("button", { name: "New job" }).click();
    const drawer = page.getByTestId("new-job-drawer");
    await expect(drawer.getByRole("heading", { name: "New job" })).toBeVisible();
    await drawer.getByRole("button", { name: "Create job" }).click();
    await expect(drawer.getByText("Choose who the job is for.")).toBeVisible();
    await expect(drawer.getByText("Give the job a name.")).toBeVisible();

    await drawer.getByRole("combobox", { name: "Contact" }).click();
    await page.getByRole("option", { name }).click();
    await expect(drawer.getByRole("textbox", { name: "Site address" })).toHaveValue("14, 3rd Cross, HSR Layout, Bengaluru 560102");
    await expect(drawer.getByText(`From ${name}'s address — change it if the work is elsewhere.`)).toBeVisible();
    await drawer.getByRole("textbox", { name: "Job name" }).fill("Bathroom refit — 2nd floor");
    await drawer.getByRole("textbox", { name: "Contract value" }).fill("2247.90");
    await drawer.getByRole("textbox", { name: "Retention %" }).fill("5");
    await drawer.getByRole("button", { name: "Create job" }).click();

    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}/);
    await expect(page.getByText(/^Job (DEMO-)?JOB-\d+ created$/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/JOB-\d+/);
    await expect(page.getByTestId("milestones-empty")).toContainText("Set up how this job is billed");
    await expect(page.getByRole("button", { name: "Add milestones" })).toBeVisible();
    const id = page.url().split("/jobs/")[1]!.split("?")[0]!;
    const job = await api<{ contactId: string; contractValueAmount: string; retentionPct: number; siteAddress: string }>(page, "GET", `/jobs/${id}`);
    expect(job).toMatchObject({ contactId: customer.id, contractValueAmount: "224790", retentionPct: 5, siteAddress: "14, 3rd Cross, HSR Layout, Bengaluru 560102" });
  });

  test("an end date before the start is refused with what to do", async ({ page, seededOrg: _ }) => {
    const c = await contact(page, `Dates ${randomUUID().slice(0, 4)}`);
    const res = await page.request.post(`${API_URL}/jobs`, { headers: { "Idempotency-Key": randomUUID() }, data: { contactId: c.id, name: "Dates", currency: "USD", startDate: "2026-12-01", endDate: "2026-11-01" } });
    expect(res.status()).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("End the job on or after its start date.");
  });

  test("Start from an accepted quote converts it, and the job says where it came from", async ({ page, seededOrg: _ }) => {
    const c = await contact(page, `Quote customer ${randomUUID().slice(0, 4)}`);
    const q = await quote(page, c.id, { title: "Warehouse extension", lines: [{ name: "Steel structure", price: "6800000" }] });
    const sent = await send(page, q.id);
    const link = await api<{ url: string }>(page, "POST", `/quotes/${q.id}/link`);
    await page.request.post(`${API_URL}/public/quotes/${encodeURIComponent(decodeURIComponent(link.url.split("/quote/")[1]!))}/accept`, { data: {} });

    await page.goto("/jobs");
    await page.getByRole("button", { name: "New job" }).click();
    const drawer = page.getByTestId("new-job-drawer");
    await drawer.getByRole("button", { name: "Choose a quote" }).click();
    await drawer.getByRole("combobox", { name: "Accepted quote" }).click();
    await page.getByRole("option", { name: new RegExp(sent.number) }).click();
    await expect(drawer.getByText(/contract value \$68,000\.00/)).toBeVisible();
    await drawer.getByRole("button", { name: "Create job" }).click();

    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("job-meta").getByRole("link", { name: sent.number })).toHaveAttribute("href", `/quotes/${q.id}`);

    // It's converted now, so it isn't offered again.
    await page.goto("/jobs");
    await page.getByRole("button", { name: "New job" }).click();
    await page.getByTestId("new-job-drawer").getByRole("button", { name: "Choose a quote" }).click();
    const picker = page.getByTestId("new-job-from-quote");
    await expect(picker).toBeVisible();
    if (await picker.getByRole("combobox", { name: "Accepted quote" }).isVisible()) {
      await picker.getByRole("combobox", { name: "Accepted quote" }).click();
      await expect(page.getByRole("option", { name: new RegExp(sent.number) })).toHaveCount(0);
    }
  });

  test("without the right to create jobs there's no New job", async ({ page, seededOrg: _, browser }) => {
    const { job } = await jobWithMilestones(page);
    const fieldPage = await fieldUserOn(page, browser, job.id);
    await fieldPage.goto("/jobs");
    await expect(fieldPage.getByRole("row").filter({ hasText: job.name })).toBeVisible();
    await expect(fieldPage.getByRole("button", { name: "New job" })).toHaveCount(0);
  });
});
