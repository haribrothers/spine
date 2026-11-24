import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-SET-15", () => {
  test("Settings › Data export prepares a ZIP in the background and offers it again; Staff can't start one", async ({ page, seededOrg: _, browser }) => {
    // The link the export-ready email uses.
    await page.goto("/dashboard?settings=data-export");
    const pane = page.getByRole("dialog").getByTestId("data-export");
    await expect(pane.getByRole("heading", { name: "Data export" })).toBeVisible();
    await expect(pane.getByRole("checkbox", { name: "Records as CSV" })).toBeChecked();
    await expect(pane.getByRole("checkbox", { name: "Records as JSON" })).not.toBeChecked();
    await expect(pane.getByRole("checkbox", { name: "Files" })).toBeVisible();

    await pane.getByRole("button", { name: "Prepare export" }).click();
    await expect(pane.getByText("Large exports are prepared in the background. We'll email you when the file is ready.")).toBeVisible();

    const last = pane.getByTestId("last-export");
    await expect(last).toContainText("Last export:", { timeout: 60_000 });
    await expect(last).toContainText(/by E2E Seeded Owner · [\d.]+ (KB|MB|bytes)/);
    await expect(last).toContainText(/\(link expires in 7 days\)/);

    const [download] = await Promise.all([page.waitForEvent("download"), last.getByRole("link", { name: "Download again" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^spine-export-\d{4}-\d{2}-\d{2}\.zip$/);
    const zip = unzipSync(new Uint8Array(readFileSync((await download.path())!)));
    expect(Object.keys(zip)).toEqual(expect.arrayContaining(["README.txt", "contacts.csv", "invoices.csv"]));
    expect(strFromU8(zip["contacts.csv"]!).split("\r\n")[0]).toMatch(/^id,orgId,/);

    const context = await browser.newContext();
    const staffPage = await context.newPage();
    await logIn(staffPage, DEMO_STAFF_USER);
    const res = await staffPage.request.post(`${API_URL}/org/exports`, { headers: { "Idempotency-Key": randomUUID() }, data: { formats: ["csv"], includeFiles: false } });
    expect(res.status()).toBe(403);
    await context.close();
  });
});
