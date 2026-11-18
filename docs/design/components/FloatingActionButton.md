# FloatingActionButton

**Package:** `@spine/ui` · **Platform:** Web (under 768px) · **Source:** planned, `packages/ui/src/components/floating-action-button.tsx` · **Doc page:** planned, `apps/design-system/src/app/components/floating-action-button/page.tsx` · **Stories:** US-OPS-57, US-MTG-18

The page's main action on a phone: a round button above the tab bar, with its label at the top of the list ("New quote") that shrinks to + while the list scrolls (D-283).

**Status:** planned for the web app's phone layout ([D-283](../../prd/12-decisions.md)). Its props and exports are filled in from the source when it's built, with its doc page and axe test in the same change.

## Rules and behaviour

- One per page, and only for the page's primary action (rule 3: one primary action per screen); other actions go under the top bar's ⋯.
- Keeps its label for screen readers when it shrinks; 56px, clear of the tab bar and the home indicator; `primary` colour with `on-primary` content.
- Hidden in Select mode and while the keyboard is open.

## Accessibility

Automated check (planned): `packages/ui/src/components/floating-action-button.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
