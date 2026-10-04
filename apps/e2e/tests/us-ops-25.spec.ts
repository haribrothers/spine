import { test, expect } from "@playwright/test";

async function buttonColours(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  return page.getByRole("button", { name: "Log in" }).evaluate((el) => {
    const style = getComputedStyle(el);
    return { text: style.color, fill: style.backgroundColor };
  });
}

test.describe("US-OPS-25", () => {
  test("a primary button's label is near-black on the dark-mode fill", async ({ page }) => {
    expect(await buttonColours(page, "dark")).toEqual({ text: "rgb(18, 17, 16)", fill: "rgb(107, 138, 255)" });
  });

  test("light mode keeps white text on the primary fill", async ({ page }) => {
    expect(await buttonColours(page, "light")).toEqual({ text: "rgb(255, 255, 255)", fill: "rgb(41, 84, 229)" });
  });
});
