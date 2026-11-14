import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

/**
 * US-SITE-02 (D-275) — the home page in a browser: the pinned "How it works"
 * story, its step buttons, the theme carried into the docs, the reduced-motion
 * list and accessibility in both themes. Serves what `pnpm site:build` wrote
 * (verify's "sites" step runs before E2E); the build's own HTML checks are
 * scripts/us-site-02.test.mjs.
 */
const dist = join(__dirname, "../../site/dist");
const types: Record<string, string> = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp", ".json": "application/json" };

let server: Server;
let base = "";

test.describe("US-SITE-02 · a home page for people discovering Spine", () => {
  test.skip(!existsSync(join(dist, "index.html")), "Run pnpm site:build first (pnpm verify does).");

  test.beforeAll(async () => {
    server = createServer((req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
      let file = join(dist, path);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!file.startsWith(dist) || !existsSync(file)) {
        res.writeHead(404, { "content-type": "text/html" }).end(readFileSync(join(dist, "404.html")));
        return;
      }
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const states = (page: Page) => page.locator(".stp").evaluateAll((els) => els.map((el) => el.getAttribute("data-state")).join(","));

  test("scrolling the pinned story moves the job through the six steps to a balanced entry; a step's button jumps to it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/`);
    const flow = page.locator("#flow");
    await expect(flow).toHaveAttribute("data-static", "0");
    await flow.scrollIntoViewIfNeeded();
    await expect.poll(() => states(page)).toBe("now,next,next,next,next,next");
    await expect(page.locator(".copy[data-active='1'] h3")).toHaveText("Capture it once");

    await page.getByRole("button", { name: "Invoice" }).click();
    await expect.poll(() => states(page)).toBe("done,done,done,now,next,next");
    await expect(page.locator(".doc[data-active='1']")).toContainText("Amount due");

    await page.getByRole("button", { name: "Books" }).click();
    await expect.poll(() => states(page)).toBe("done,done,done,done,done,now");
    const entry = page.locator(".doc[data-active='1']");
    await expect(entry.getByRole("table")).toContainText("Retention Receivable");
    await expect(entry.getByText("Debits equal credits")).toBeVisible();
  });

  test("the theme picked here is the one the docs open in", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`${base}/`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    await page.goto(`${base}/docs/`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.goto(`${base}/`);
    await page.getByRole("button", { name: "Match my system" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("with reduced motion nothing moves or hides: How it works is the list and each demo shows its end", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/`);
    await expect(page.locator("#flow")).toHaveAttribute("data-static", "1");
    for (const title of ["Capture it once", "Accepted from a phone", "Milestones and retention", "Bill the milestone in one click", "Money in, matched", "The books keep themselves"]) {
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
    await expect(page.locator(".tile[data-steps='4']")).toHaveAttribute("data-step", "3");
    await expect(page.getByText("Accepted — thank you")).toBeVisible();
  });

  test("on a phone the story is the list", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/`);
    await expect(page.locator("#flow")).toHaveAttribute("data-static", "1");
    await expect(page.getByRole("heading", { name: "The books keep themselves" })).toBeVisible();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`meets WCAG 2.1 AA in ${scheme} mode, and a missing page gets the site's 404`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(`${base}/`);
      await expectNoAxeViolations(page);
      await page.goto(`${base}/no-such-page/`);
      await expect(page.getByRole("heading", { name: "There's no page here" })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
});
