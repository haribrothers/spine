import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-QUO-24", () => {
  test("More ▾ duplicates a sent quote into a new draft whose history says where it came from", async ({ page, seededOrg: _ }) => {
    const quotes = (await (await page.request.get(`${API_URL}/quotes`)).json()) as { id: string; number: string | null; status: string; isSuperseded?: boolean }[];
    const sent = quotes.find((q) => q.status === "sent" && q.number)!;
    await page.goto(`/quotes/${sent.id}`);
    await expect(page.getByRole("heading", { name: sent.number! })).toBeVisible();

    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("menuitem", { name: "Duplicate as new draft" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Email again" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "View history" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Duplicate as new draft" }).click();

    await page.waitForURL((url) => /\/quotes\/[0-9a-f-]{36}$/.test(url.pathname) && !url.pathname.endsWith(sent.id));
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "View history" }).click();
    await expect(page.getByRole("dialog").getByText(`Duplicated from ${sent.number} by E2E Seeded Owner`)).toBeVisible();
  });
});
