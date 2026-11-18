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
    type Rect = { width: number; height: number; right: number; bottom: number };
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
      // The guide's prose (US-SITE-12): links in its lists and heading anchors are running text too.
      if (el.closest(".sl-markdown-content")) continue;
      // Checkbox, RadioGroupItem and Switch are buttons whose 44px tap area is drawn around them (US-OPS-61).
      if (el.closest("[data-tap-area], [role=\"checkbox\"], [role=\"switch\"]")) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      // Visually hidden (sr-only) controls are reached through their visible label.
      if (r.width <= 2 || r.height <= 2) continue;
      // Drawn off the screen until focused (a skip link): not something to tap.
      if (r.bottom <= 0 || r.right <= 0) continue;
      // Clipped away until focused (Starlight's skip link): not shown, so not something to tap.
      const style = (globalThis as unknown as { getComputedStyle(e: El): { clip: string; clipPath: string } }).getComputedStyle(el);
      if (style.clip === "rect(0px, 0px, 0px, 0px)" || style.clipPath === "inset(50%)") continue;
      if (r.width < 43.5 || r.height < 43.5) out.push(`${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40)} (${Math.round(r.width)}×${Math.round(r.height)})`);
    }
    return out;
  }, within);
}
