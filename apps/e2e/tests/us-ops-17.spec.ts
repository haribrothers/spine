import { writeFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { axeViolations, type AxeViolation } from "./axe";
import { PANES, appRoutes, settle } from "./routes";

test.describe("US-OPS-17 · pass an accessibility audit of every screen", () => {
  test("every web route with demo data has no WCAG 2.1 AA violations, in light and dark mode", async ({ page, seededOrg: _ }) => {
    test.setTimeout(900_000);
    const targets = await appRoutes(page);
    const found: Record<string, AxeViolation[]> = {};
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of targets) {
        await page.goto(path);
        await settle(page);
        const v = await axeViolations(page);
        if (v.length) found[`${scheme} ${path}`] = v;
      }
      for (const pane of PANES) {
        await page.goto(`/dashboard?settings=${pane}`);
        await expect(page.getByTestId("settings-dialog")).toBeVisible();
        await settle(page);
        const v = await axeViolations(page);
        if (v.length) found[`${scheme} settings:${pane}`] = v;
      }
    }
    writeFileSync(test.info().outputPath("axe-violations.json"), JSON.stringify(found, null, 2));
    expect(found).toEqual({});
  });
});
