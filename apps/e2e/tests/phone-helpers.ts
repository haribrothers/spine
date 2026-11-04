import type { Page } from "@playwright/test";

/** US-OPS-14, US-OPS-15 (NFR-COMP-02): the phone viewport every check uses. */
export const PHONE = { width: 390, height: 844 };

/** How far the page, or its scrolling main region, scrolls sideways (0 when it doesn't). */
export async function sidewaysScroll(page: Page): Promise<number> {
  return page.evaluate(() => {
    type El = { scrollWidth: number; clientWidth: number };
    const doc = (globalThis as unknown as { document: { scrollingElement: El; querySelector(s: string): El | null } }).document;
    const main = doc.querySelector("main");
    return Math.max(doc.scrollingElement.scrollWidth - doc.scrollingElement.clientWidth, main ? main.scrollWidth - main.clientWidth : 0);
  });
}

/** Visible controls smaller than 44×44px to tap: "label (w×h)". Links inside running text, and checkboxes, radios and switches (their tap area is drawn around them), are left out. */
export async function smallControls(page: Page, within = "body"): Promise<string[]> {
  return page.evaluate((root) => {
    type Rect = { width: number; height: number };
    type El = {
      getBoundingClientRect(): Rect;
      closest(s: string): El | null;
      getAttribute(n: string): string | null;
      textContent: string | null;
      checkVisibility?(o: object): boolean;
    };
    const doc = (globalThis as unknown as { document: { querySelector(s: string): { querySelectorAll(s: string): ArrayLike<El> } | null } }).document;
    const scope = doc.querySelector(root);
    if (!scope) return [];
    const selector = 'button, [role="button"], [role="tab"], [role="menuitem"], [role="combobox"], select, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea, a[href]';
    const out: string[] = [];
    for (const el of Array.from(scope.querySelectorAll(selector))) {
      if (el.closest("p, td")) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 43.5 || r.height < 43.5) out.push(`${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40)} (${Math.round(r.width)}×${Math.round(r.height)})`);
    }
    return out;
  }, within);
}
