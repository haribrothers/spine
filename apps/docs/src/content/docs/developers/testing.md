---
title: Testing
description: How Spine is tested, and what a change needs before it's done.
sidebar:
  order: 4
---

Every acceptance criterion of a story has an automated test named after the story: `us-inv-05.spec.ts` or `describe("US-INV-05", …)`.

| Kind | Where | Runs with |
|---|---|---|
| Unit | next to the code, `*.test.ts(x)` | Vitest (API, web, shared, `@spine/ui`), Jest (field app, `@spine/ui-native`) |
| Integration | `apps/api/src/**/*.integration.test.ts` | Vitest against Postgres; each test file gets its own copy of the database |
| End-to-end | `apps/e2e/tests` | Playwright against a real API and web app, with axe-core on every route in light and dark mode |
| Accessibility | `*.a11y.test.tsx` beside each component | axe in jsdom; every component and route meets WCAG 2.1 AA |

## Before a pull request

1. `pnpm lint`, `pnpm typecheck` and `pnpm test`, plus the API's integration tests if you changed the API.
2. `pnpm verify` runs everything, E2E included. CI doesn't run E2E on pull requests (only before a release), so say in the pull request which commit `pnpm verify` passed on.

The definition of done, and the QA script testers follow before a release, are in [11-testing-release](https://github.com/haribrothers/spine/blob/main/docs/prd/11-testing-release.md) and [qa-script](https://github.com/haribrothers/spine/blob/main/docs/qa-script.md).
