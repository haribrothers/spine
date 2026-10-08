import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-SET-24", () => {
  test("a switched-off module leaves no trace: sidebar, pages, settings panes, reports, Teams and quote actions", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-set-24-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const put = (data: unknown) => page.request.put(`${API_URL}/org/modules`, { headers: { "Idempotency-Key": randomUUID() }, data });
    expect((await put({ leadsMeetings: false, jobsField: false, approvals: true, recurring: true })).ok()).toBe(true);
    await page.goto("/dashboard");

    // Sidebar links carry their name as aria-label; breadcrumbs don't.
    const sidebarLink = (name: string) => page.locator(`a[aria-label="${name}"]`);
    await expect(sidebarLink("Contacts")).toBeVisible();
    for (const gone of ["Jobs", "Pipeline", "Meetings"]) await expect(sidebarLink(gone)).toHaveCount(0);

    await page.goto("/jobs");
    await expect(page.getByTestId("module-off")).toContainText("Jobs & field is switched off. An owner can switch it on in Settings › Modules.");
    await page.goto("/meetings");
    await expect(page.getByTestId("module-off")).toContainText("Leads & meetings is switched off. An owner can switch it on in Settings › Modules.");

    await page.goto("/reports");
    await expect(page.getByRole("link", { name: "Profit & Loss" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Job profitability" })).toHaveCount(0);

    await page.getByRole("button", { name: /Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const sections = page.getByRole("dialog").getByTestId("settings-sections");
    await expect(sections.getByRole("button", { name: "Modules" })).toBeVisible();
    for (const gone of ["Pipeline stages", "Upcoming meetings", "Meeting reminders"]) await expect(sections.getByRole("button", { name: gone })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // A quote has no "Convert to job".
    const contact = await (await page.request.post(`${API_URL}/contacts`, { headers: { "Idempotency-Key": randomUUID() }, data: { type: "customer", name: "Lakeview Homes", email: "lakeview@example.com" } })).json();
    const quote = await (await page.request.post(`${API_URL}/quotes`, { headers: { "Idempotency-Key": randomUUID() }, data: { contactId: contact.id, currency: "USD", lines: [{ name: "Deck", quantity: 1, unitPriceAmount: "100000" }] } })).json();
    await page.request.post(`${API_URL}/quotes/${quote.id}/send`, { headers: { "Idempotency-Key": randomUUID() }, data: {} });
    // Accepted in person, so its convert actions show.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const signature = await (await page.request.post(`${API_URL}/files`, { headers: { "Idempotency-Key": randomUUID() }, multipart: { file: { name: "signature.png", mimeType: "image/png", buffer: png } } })).json();
    expect((await page.request.post(`${API_URL}/quotes/${quote.id}/accept-in-person`, { headers: { "Idempotency-Key": randomUUID() }, data: { signatureFileId: signature.id } })).ok()).toBe(true);
    await page.goto(`/quotes/${quote.id}`);
    await expect(page.getByRole("button", { name: "Convert to invoice" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Convert to job" })).toHaveCount(0);

    // Teams: no jobs or leads privileges.
    const team = await (await page.request.post(`${API_URL}/org/teams`, { headers: { "Idempotency-Key": randomUUID() }, data: { name: "Office" } })).json();
    await page.goto(`/team/teams/${team.id}`);
    await page.getByRole("tab", { name: "Privileges" }).click();
    await expect(page.getByText("Manage Invoices").first()).toBeVisible();
    await expect(page.getByText("Manage Jobs")).toHaveCount(0);
    await expect(page.getByText("Manage Leads")).toHaveCount(0);
  });
});
