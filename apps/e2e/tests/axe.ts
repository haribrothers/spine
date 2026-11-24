import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** axe-core, injected into the page as a script (this package has no DOM types, so it runs as a string). */
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

export interface AxeViolation {
  id: string;
  impact: string | null;
  nodes: string[];
}

/** WCAG 2.1 A and AA violations on the page as it stands (contrast included), in whatever theme it's showing. */
export async function axeViolations(page: Page, exclude: string[] = []): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: AXE_SOURCE });
  return (await page.evaluate(`(async () => {
    const result = await window.axe.run({ exclude: ${JSON.stringify(exclude.map((s) => [s]))} }, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\\n").slice(1, 2).join("")),
    }));
  })()`)) as AxeViolation[];
}

export async function expectNoAxeViolations(page: Page, exclude: string[] = []): Promise<void> {
  expect(await axeViolations(page, exclude)).toEqual([]);
}
