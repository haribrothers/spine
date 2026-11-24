import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";

/** Every item of the open menu: its label, whether it has a hidden icon, the gap, the icon's size and colours. */
async function openMenuItems(page: Page) {
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu.getByRole("menuitem").evaluateAll((items) => {
    // The browser's own types aren't in this project; just what's read here.
    type Box = { width: number; height: number };
    type El = { textContent: string | null; getAttribute(name: string): string | null; querySelector(sel: string): El | null; getBoundingClientRect(): Box };
    type Style = { columnGap: string; minHeight: string; color: string };
    const styleOf = (el: El) => (globalThis as unknown as { getComputedStyle(e: El): Style }).getComputedStyle(el);
    return (items as unknown as El[]).map((item) => {
      const svg = item.querySelector(":scope > svg");
      const style = styleOf(item);
      const box = svg?.getBoundingClientRect();
      return {
        label: item.textContent?.trim() ?? "",
        hidden: svg?.getAttribute("aria-hidden") === "true",
        gap: style.columnGap,
        minHeight: style.minHeight,
        iconSize: box ? `${box.width}x${box.height}` : null,
        iconColor: svg ? styleOf(svg).color : null,
        textColor: style.color,
      };
    });
  });
}

test.describe("US-OPS-37", () => {
  test("row and page menus: an icon on every action, one spacing, destructive last and red", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-ops-37-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await api(page, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks", email: `a-${randomUUID()}@halcyon.example` });
    const draft = await api(page, "POST", "/invoices", { contactId: c.id, currency: "USD", dueDate: isoDays(-5), lines: [{ type: "item", name: "Site work", quantity: 1, unitPriceAmount: "50000" }] });
    const invoice = await api<{ id: string; number: string }>(page, "POST", `/invoices/${draft.id}/issue`, {});

    await page.goto("/invoices");
    await page.getByRole("button", { name: `Actions for ${invoice.number}` }).click();
    const items = await openMenuItems(page);
    expect(items.map((i) => i.label)).toContain("Record payment");
    for (const item of items) {
      expect(item.hidden, item.label).toBe(true);
      expect(item.gap, item.label).toBe("10px");
      expect(item.minHeight, item.label).toBe("32px");
      expect(item.iconSize, item.label).toBe("14x14");
    }
    const last = items.at(-1)!;
    expect(last.label).toBe("Void");
    expect(last.iconColor).toBe(last.textColor);
    expect(items[0]!.iconColor).not.toBe(items[0]!.textColor); // muted, not the text colour
    await page.keyboard.press("Escape");

    // The invoice page's More menu is the same.
    await page.goto(`/invoices/${invoice.id}`);
    await page.getByRole("button", { name: "More" }).click();
    for (const item of await openMenuItems(page)) {
      expect(item.hidden, item.label).toBe(true);
      expect(item.gap, item.label).toBe("10px");
    }
  });
});
