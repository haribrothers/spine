import type { ReactTestInstance } from "react-test-renderer";

/**
 * React Native has no axe-core equivalent — there's no DOM to run axe
 * against, so `packages/ui` (`src/test/a11y.ts`)'s `expectNoA11yViolations`
 * pattern can't be ported literally. This asserts against RN's own
 * accessibility props instead: every interactive element RNTL's
 * `getByRole` can find must have a non-empty `accessibilityLabel` (or
 * visible text RN derives one from) and, for elements with a
 * true/false-shaped state (checked/expanded/disabled), a correctly-set
 * `accessibilityState` — the two failure modes an actual screen reader
 * user would hit that a plain render-and-snapshot test wouldn't catch.
 *
 * This is intentionally narrower than axe-core's full ruleset (contrast
 * checking, landmark structure, etc. don't apply the same way to a
 * component-level RN render) — it targets the specific "would a screen
 * reader announce something a user can act on" question each component's
 * own a11y test exercises per state, matching this package's discipline
 * doc comment in check-a11y-coverage.mjs.
 */
/**
 * A component's accessible name can come from an explicit
 * `accessibilityLabel`, a direct string child, OR (the common case for a
 * button wrapping its label in its own `<Text>`, e.g. this package's
 * `Button`) a nested `Text` element's own string content — RN's
 * accessibility tree composes a container's name from its descendant
 * `Text` nodes the same way a real screen reader would, so this walks the
 * rendered tree rather than only checking `element.props.children`
 * directly.
 *
 * Matches descendants by component NAME ("Text"), not by importing RN's
 * `Text` and comparing `node.type === Text` — that reference comparison is
 * fragile across Jest's module registry (a real, reproduced failure while
 * building this: `Text` imported here resolved to a different module
 * instance than the one `button.tsx` renders with, so the identity check
 * silently failed even though the exact same node was genuinely present
 * in the tree — confirmed by dumping `findAll` output during debugging).
 * `displayName`/`name` string matching has no such identity dependency.
 */
export function expectAccessibleRole(element: ReactTestInstance, role: string) {
  expect(element.props.accessibilityRole ?? element.props.role).toBe(role);
  const label = element.props.accessibilityLabel;
  const hasTextDescendant = element
    .findAll((node) => {
      const type = node.type as { displayName?: string; name?: string } | string;
      const name = typeof type === "string" ? type : (type.displayName ?? type.name ?? "");
      return name === "Text";
    })
    .some((node) => node.children.some((child) => typeof child === "string" && child.trim().length > 0));
  if (!label && !hasTextDescendant) {
    throw new Error(
      `Element with role "${role}" has no accessibilityLabel and no visible text descendant — a screen reader would announce nothing meaningful for it.`,
    );
  }
}

export function expectAccessibilityState(element: ReactTestInstance, expected: Record<string, unknown>) {
  const state = element.props.accessibilityState ?? {};
  for (const [key, value] of Object.entries(expected)) {
    expect(state[key]).toBe(value);
  }
}
