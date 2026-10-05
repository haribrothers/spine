import { test, expect } from "./fixtures";

test.describe("US-DASH-15", () => {
  test("money in and out shows a bar pair per month with totals, net, legend and a month tooltip", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    const card = page.getByTestId("money-in-out");
    await expect(card.getByText("Money in and out")).toBeVisible({ timeout: 15_000 });
    await expect(card.getByRole("radio", { name: "12M" })).toHaveAttribute("aria-checked", "true");

    const totals = card.getByTestId("money-in-out-totals");
    await expect(totals.getByText("In · 12 months")).toBeVisible();
    await expect(totals.getByText("Out · 12 months")).toBeVisible();
    await expect(totals.getByText("Net", { exact: true })).toBeVisible();
    const net = totals.locator("dd[data-tone]");
    const tone = await net.getAttribute("data-tone");
    if (tone === "positive") await expect(net).toHaveText(/^\+/);
    if (tone === "negative") await expect(net).toHaveText(/^−/);

    await expect(card.getByText("Money in (payments received)")).toBeVisible();
    await expect(card.getByText("Money out (bills, expenses)")).toBeVisible();

    // Hovering a month opens its tooltip with in, out and net.
    const chart = card.locator(".recharts-wrapper");
    await chart.scrollIntoViewIfNeeded();
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
    await expect(card.getByText(/^In: /)).toBeVisible();
    await expect(card.getByText(/^Out: /)).toBeVisible();
    await expect(card.getByText(/^Net: /)).toBeVisible();

    await card.getByRole("radio", { name: "3M" }).click();
    await expect(totals.getByText("In · 3 months")).toBeVisible();
    await expect(totals.getByText("Out · 3 months")).toBeVisible();
  });
});
