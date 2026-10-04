# 09 · Design system

The design system is already built and is reused, not redesigned ([D-037](12-decisions.md)). This file says what's in `docs/design/` and the rules code must follow. The brand book is [../design/README.md](../design/README.md).

## What's in `docs/design/`

| Path | Contents |
|---|---|
| [README.md](../design/README.md) | Brand book: voice, surfaces, colour + contrast, type, spacing, radius, shadow, blur, layout, platforms, logo, icons, motion, documents and email, accessibility, rules from findings, component index |
| [tokens.json](../design/tokens.json) | Generated tokens (colour light/dark/inverse/gradients/Android roles, type, radius, spacing, breakpoints, motion, z-index, icons, focus ring, component recipes, the CSS variables) |
| [motion.md](../design/motion.md) | Durations, easing, per-pattern motion, reduced motion |
| [components/](../design/components/) | One page per component: 78 web (`@spine/ui`), 31 native (`@spine/ui-native`) |
| [index.d.ts](../design/index.d.ts) | Points to the packages' real type entry points |
| [logo/](../design/logo/) | Horizontal (light and dark) and square marks |
| [native-notes.md](../design/native-notes.md) | Native implementation rules (moved from CLAUDE.md) |
| [screens.md](../design/screens.md) and `screens/` | Every screen: captured from the app or drawn on the design canvas |

The design canvas with every drawn screen is the "Spine — New screens" artifact (link in [screens.md](../design/screens.md)).

## Rules for code

1. **Values come from tokens.** Web: CSS variables in `packages/config/tailwind-preset.css` (authored from `docs/DESIGN.md` front matter). Native: `packages/ui-native/src/tokens`. No hex values, magic spacing or arbitrary `z-[…]` in components.
2. **Use the library.** Screens compose `@spine/ui` / `@spine/ui-native` components; a new pattern becomes a library component first.
3. **One primary action per screen.** Confirmation buttons are primary unless they delete, void or remove ([D-058](12-decisions.md)).
4. **Status colours are reserved** for paid / due-soon / overdue / draft (and their workflow equivalents) and always carry a text label.
5. **Dark mode is real.** Every screen works in light and dark through tokens; text on filled controls uses `on-primary`/`on-danger` ([D-099](12-decisions.md)); dark designs for representative screens end in `Dark` in [screens.md](../design/screens.md) ([D-100](12-decisions.md)). Every themed class on native has its `dark:` pair; React Navigation / native chrome gets its theme from props, not classes ([native notes](../design/native-notes.md)).
6. **Accessibility ships with the component.** Web: axe-core test per component, enforced by `check-a11y-coverage.mjs`. Native: prop-level tests plus VoiceOver/TalkBack checks.
7. **Docs ship with the component.** Web: `apps/design-system` page + nav entry. Native: `apps/showcase-native` for `@expo/ui` components, `apps/design-system-native` for NativeWind ones ([D-034](12-decisions.md)).
8. **Icons:** Lucide, per-icon imports on native; native tab bars use SF Symbols / Material Symbols.
9. **Mobile is native-first** on both platforms; Android follows Material 3 ([D-022](12-decisions.md), [D-051](12-decisions.md)).
10. **New components in Phase 7:** `CommandPalette` (global search, US-OPS-23, built on `cmdk`), a selection toolbar for bulk actions (US-INV-23, US-PUR-21), and the KPI card with sparkline and comparison (US-DASH-14). Each ships with its doc page and axe test (D-033).
11. **Copy:** sentence case; buttons are verbs; name the thing; say what happens to people's data; errors say what to do next.

## Appendix — design-system rules moved verbatim from CLAUDE.md

- **`@spine/ui` is built once in Phase 0**, not incrementally per feature — theme tokens as CSS custom properties, dark/light mode, docs in `apps/design-system` (a custom Next.js docs app, not Storybook), WCAG 2.1 AA per component, so later phases consume a finished library instead of inventing components mid-feature.
- **Every `@spine/ui` component change ships with its `apps/design-system` doc page in the same change.** Adding a new component or updating an existing one's API/behavior always includes creating or updating its page under `apps/design-system/src/app/components/<name>/page.tsx` (and its `apps/design-system/src/lib/nav.ts` entry for new components) — the design-system app is the living spec for the library, not an afterthought, and must never drift behind `packages/ui`'s actual exports.
- **Every `@spine/ui` component ships with an automated accessibility regression test in the same change.** A new component at `packages/ui/src/components/<name>.tsx` requires a matching `packages/ui/src/components/<name>.a11y.test.tsx` (axe-core via `expectNoA11yViolations` from `packages/ui/src/test/a11y.ts`, run under vitest+jsdom, scoped to WCAG 2.1 A+AA rule tags), rendering the component in a representative default/open state (Radix overlays: actually opened via `open`/`defaultOpen` and asserted against `document.body`, since Radix portals content there) plus any states that meaningfully change its accessible semantics (variants, disabled/invalid, checked/unchecked). This is enforced, not just documented: `packages/ui/scripts/check-a11y-coverage.mjs` runs as part of `pnpm --filter @spine/ui test` and fails the build if any component lacks a matching test file — the same "ships together" pattern as the doc-page rule above, but machine-checked rather than relying on the same discipline. Added 2026-08-29 as the recommended follow-up from that day's WCAG 2.1 AA audit-and-fix pass, so future component changes get a regression net instead of a fresh manual audit each time.
