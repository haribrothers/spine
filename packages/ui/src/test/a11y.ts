import axe, { type RunOptions } from "axe-core";

/**
 * Scoped to the WCAG 2.1 A+AA rule set to match docs/DESIGN.md's audited
 * bar (see the 2026-08-06 CHANGELOG entry) rather than axe-core's full
 * default rule set, which also flags best-practice/experimental rules
 * outside that scope.
 */
const RUN_OPTIONS: RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  },
};

/**
 * Asserts zero axe-core violations against WCAG 2.1 A+AA. Wraps axe-core
 * directly rather than a jest-axe/vitest-axe adapter — vitest-axe@0.1.0's
 * matcher entrypoint ships a broken build (see git history for the details
 * hit when this was first wired up), and a plain thrown error gives an
 * equally readable failure without depending on it.
 */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe.run(container, RUN_OPTIONS);
  if (results.violations.length > 0) {
    const details = results.violations
      .map((violation) => {
        const nodes = violation.nodes.map((node) => `    ${node.target.join(", ")}\n      ${node.failureSummary}`).join("\n");
        return `  ${violation.id} (${violation.impact}): ${violation.help}\n${nodes}\n    ${violation.helpUrl}`;
      })
      .join("\n\n");
    throw new Error(`Expected no accessibility violations, found ${results.violations.length}:\n\n${details}`);
  }
}
