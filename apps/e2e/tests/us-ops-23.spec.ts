import { test, expect } from "./fixtures";

/** The element's running animation, read in the browser (this project has no DOM types). */
const animationName = (el: unknown) => (globalThis as unknown as { getComputedStyle(e: unknown): { animationName: string } }).getComputedStyle(el).animationName;

test.describe("US-OPS-23", () => {
  test("search works from the keyboard and is announced to screen readers", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    const editLayout = page.getByRole("button", { name: "Edit layout" });
    await editLayout.focus();

    // Opened: a dialog named "Search"; the field a combobox controlling a listbox.
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    const box = dialog.getByRole("combobox", { name: "Search" });
    await expect(box).toBeFocused();
    await page.keyboard.type("harbor");
    const listbox = dialog.getByRole("listbox");
    await expect(dialog.getByRole("option").first()).toBeVisible();
    expect(await box.getAttribute("aria-controls")).toBe(await listbox.getAttribute("id"));

    // Arrows move the highlight; the active option is the combobox's active descendant.
    const active = async () => {
      const id = await box.getAttribute("aria-activedescendant");
      return id ? page.locator(`[id="${id}"]`) : null;
    };
    const first = (await active())!;
    await expect(first).toHaveAttribute("aria-selected", "true");
    const firstText = await first.textContent();
    await page.keyboard.press("ArrowDown");
    const second = (await active())!;
    await expect(second).toHaveAttribute("aria-selected", "true");
    expect(await second.textContent()).not.toBe(firstText);
    await page.keyboard.press("ArrowUp");
    expect(await (await active())!.textContent()).toBe(firstText);

    // Enter opens the highlighted record and closes the palette.
    await page.keyboard.press("ArrowDown");
    const target = await (await active())!.textContent();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/dashboard$/);
    expect(target).toBeTruthy();

    // Escape closes and puts focus back where it was.
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Edit layout" }).focus();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Search" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit layout" })).toBeFocused();
  });

  test("with reduced motion the palette appears without scaling in", async ({ page, seededOrg: _ }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(animationName)).toBe("none");

    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.keyboard.press("ControlOrMeta+k");
    expect(await page.getByRole("dialog", { name: "Search" }).evaluate(animationName)).toBe("palette-in");
  });
});
