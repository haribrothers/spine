import { test, expect } from "./fixtures";

const PAGE = "rgb(247, 246, 243)";
const WHITE = "rgb(255, 255, 255)";

// Strings, not functions: this package has no DOM types.
const bg = (selector: string) => `getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backgroundColor`;

test.describe("US-OPS-32", () => {
  test("light mode: the page is warm grey while the sidebar, tables and secondary buttons stay white", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await expect(page.locator("table")).toBeVisible();
    expect(await page.evaluate(bg("body"))).toBe(PAGE);
    expect(await page.evaluate(bg("aside"))).toBe(WHITE);
    expect(await page.evaluate(`getComputedStyle(document.querySelector("table").parentElement).backgroundColor`)).toBe(WHITE);

    await page.goto("/dashboard");
    const editLayout = page.getByRole("button", { name: "Edit layout" });
    await expect(editLayout).toBeVisible();
    expect(await page.evaluate(`getComputedStyle([...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Edit layout")).backgroundColor`)).toBe(WHITE);
  });

  test("dark mode is unchanged", async ({ page, seededOrg: _ }) => {
    await page.addInitScript({ content: `localStorage.setItem("theme", "dark");` });
    await page.goto("/dashboard");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(bg("body"))).toBe("rgb(18, 17, 16)");
    expect(await page.evaluate(bg("aside"))).toBe("rgb(25, 24, 21)");
  });

  test("the public quote page stays white", async ({ page }) => {
    await page.goto("/quote/not-a-real-token");
    await expect(page.getByRole("heading").first()).toBeVisible();
    expect(await page.evaluate(bg("div.fixed.inset-0"))).toBe(WHITE);
  });
});
