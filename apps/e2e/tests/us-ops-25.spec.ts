import { test, expect } from "@playwright/test";

async function buttonColours(page: import("@playwright/test").Page, theme: "light" | "dark") {
  // Strings, not functions: this package has no DOM types.
  await page.addInitScript({ content: `localStorage.setItem("theme", "${theme}");` });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  return (await page.evaluate(
    `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Log in"); const s = getComputedStyle(b); return { text: s.color, fill: s.backgroundColor }; })()`,
  )) as { text: string; fill: string };
}

test.describe("US-OPS-25", () => {
  test("a primary button's label is near-black on the dark-mode fill", async ({ page }) => {
    expect(await buttonColours(page, "dark")).toEqual({ text: "rgb(18, 17, 16)", fill: "rgb(107, 138, 255)" });
  });

  test("light mode keeps white text on the primary fill", async ({ page }) => {
    expect(await buttonColours(page, "light")).toEqual({ text: "rgb(255, 255, 255)", fill: "rgb(41, 84, 229)" });
  });
});
