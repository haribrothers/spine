import { writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { axeViolations } from "./axe";
import { PHONE, sidewaysScroll, smallControls } from "./phone-helpers";
import { PANES, appRoutes, settle } from "./routes";

/**
 * US-OPS-62 (NFR-COMP-02, D-283) — every route at phone width, in light and dark, runs in the
 * `phone` Playwright project (390×844, touch, a phone user agent). Each failure names the route
 * and the check, and the route's screenshot is attached to the report.
 *
 * Two checks switch on with the stories that build what they look for. Until then they're listed
 * here, by story, and skipped; the wave that ships the story deletes its line.
 */
const WAITING_FOR: Partial<Record<Check, string>> = {
  "tab bar": "US-OPS-54 (tabs along the bottom)",
  "main action on the first screen": "US-OPS-57 and US-OPS-58 (each page marks its main action)",
};

type Check = "sideways scroll" | "tab bar" | "main action on the first screen" | "overlapping labels" | "44px controls" | "axe";

/** The bundled guide (US-SITE-12) is part of what a phone opens too. */
const HELP = ["/help/", "/help/guide/invoices/"];

type Failure = { route: string; check: Check; detail: unknown };

/** Controls in a tab row or a row of buttons that sit on top of each other: "a / b". */
async function overlappingLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
    type El = {
      children: ArrayLike<El>;
      textContent: string | null;
      getBoundingClientRect(): Rect;
      matches(s: string): boolean;
      querySelector(s: string): El | null;
      querySelectorAll(s: string): ArrayLike<El>;
      getAttribute(n: string): string | null;
      checkVisibility?(o: object): boolean;
    };
    const g = globalThis as unknown as { document: { querySelectorAll(s: string): ArrayLike<El> }; getComputedStyle(el: El): { position: string } };
    const doc = g.document;
    // A control laid over another on purpose (a card's ⋯ in its corner, the floating + button) isn't a row of labels.
    const placed = (el: El) => /absolute|fixed|sticky/.test(g.getComputedStyle(el).position);
    const sel = 'button, a[href], [role="tab"], [role="button"]';
    const visible = (el: El) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) !== false;
    };
    const label = (el: El) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
    const out = new Set<string>();
    for (const row of Array.from(doc.querySelectorAll("body *"))) {
      const kids = Array.from(row.children)
        .filter((c) => !placed(c))
        .map((c) => (c.matches(sel) ? c : c.querySelectorAll(sel).length === 1 ? c.querySelector(sel) : null))
        .filter((c): c is El => !!c && visible(c) && !placed(c));
      if (kids.length < 2) continue;
      const boxes = kids.map((k) => k.getBoundingClientRect());
      for (let i = 0; i < kids.length; i++)
        for (let j = i + 1; j < kids.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 1 && h > 1) out.add(`${label(kids[i]!)} / ${label(kids[j]!)}`);
        }
    }
    return [...out];
  });
}

/** Runs every check that applies on the page as it stands, adding to `failures`. */
async function checkPage(page: Page, route: string, failures: Failure[], { appShell }: { appShell: boolean }) {
  const before = failures.length;
  const fail = (check: Check, detail: unknown) => failures.push({ route, check, detail });
  const on = (check: Check) => !WAITING_FOR[check];

  const sideways = await sidewaysScroll(page);
  if (sideways > 0) fail("sideways scroll", `${sideways}px`);

  if (appShell && on("tab bar") && !(await page.getByRole("navigation", { name: "Main" }).isVisible())) fail("tab bar", "not shown");

  if (on("main action on the first screen")) {
    const main = page.locator("[data-main-action]").first();
    if ((await main.count()) > 0) {
      const b = await main.boundingBox();
      if (!b || b.y < 0 || b.y + b.height > PHONE.height) fail("main action on the first screen", b ? `at y=${Math.round(b.y)}` : "hidden");
    }
  }

  const overlaps = await overlappingLabels(page);
  if (overlaps.length) fail("overlapping labels", overlaps);

  const small = await smallControls(page);
  if (small.length) fail("44px controls", small);

  const axe = await axeViolations(page);
  if (axe.length) fail("axe", axe.map((v) => `${v.id}: ${v.nodes.join(" | ")}`));

  if (failures.length > before) {
    await test.info().attach(`${route} — ${failures.slice(before).map((f) => f.check).join(", ")}`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
  }
}

/** Opens a route; a navigation the page itself replaces (a redirect) isn't a failure of this check. */
async function open(page: Page, route: string) {
  await page.goto(route).catch(async (err: unknown) => {
    if (!/ERR_ABORTED|interrupted/.test(String(err))) throw err;
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  });
  await settle(page);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`US-OPS-62 · check every page at phone width (${scheme})`, () => {
    test(`every route at 390×844 in ${scheme} mode: no sideways scroll, nothing overlapping, 44px controls, no AA violations`, async ({ page, seededOrg: _ }) => {
      test.setTimeout(1_200_000);
      await page.emulateMedia({ colorScheme: scheme });
      const failures: Failure[] = [];
      try {
        for (const route of await appRoutes(page)) {
          await open(page, route);
          await checkPage(page, route, failures, { appShell: true });
        }
        for (const pane of PANES) {
          await open(page, `/dashboard?settings=${pane}`);
          await expect(page.getByTestId("settings-dialog")).toBeVisible();
          await checkPage(page, `settings:${pane}`, failures, { appShell: false });
        }
        for (const route of HELP) {
          await open(page, route);
          await checkPage(page, route, failures, { appShell: false });
        }
      } finally {
        const report = JSON.stringify(failures, null, 2);
        writeFileSync(test.info().outputPath("phone-failures.json"), report);
        await test.info().attach("phone-failures.json", { body: report, contentType: "application/json" });
      }
      expect(failures.map((f) => `${f.route} · ${f.check}: ${JSON.stringify(f.detail)}`)).toEqual([]);
    });
  });
}
