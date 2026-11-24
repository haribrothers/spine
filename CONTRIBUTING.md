# Contributing to Spine

Thanks for helping. Spine is a self-hosted business app that small businesses run their books on, so changes are held to a high bar: they're specified first, tested, and never break the accounting rules.

## Before you start

- **Bugs:** open an issue with the bug template: what you did, what you expected, what happened, and your Spine version (Settings › About Spine).
- **Ideas and features:** open an issue with the feature template first. What's planned and what stays out of scope (multi-tenant SaaS, payroll, inventory valuation, multi-currency and more) is in [ROADMAP.md](ROADMAP.md). A pull request for something out of scope will be closed, so ask before building.
- **Security problems:** don't open an issue; follow [SECURITY.md](SECURITY.md).

## Set up

Follow [Local development setup](README.md#local-development-setup) in the README: Node 22+, pnpm 9 (`corepack enable`), and Docker for Postgres and MailDev. Then `pnpm dev`.

## How a change is made

The rules are on the [architecture page](https://spine.h4loom.com/docs/developers/architecture/#rules-every-change-follows). The short version:

1. **Start from an issue.** Agree the change in an issue first. The maintainer gives it a story id, e.g. `US-INV-05`; put that id in the pull request and the commit message.
2. **Test it.** Each acceptance criterion has an automated test named after the story (`us-inv-05.spec.ts`, or `describe("US-INV-05", …)`).
3. **Keep the docs in step.** Add a `CHANGELOG.md` entry, and if the change alters what people see, update its page in the user guide (`apps/docs/src/content/docs/guide/`). The maintainer keeps the internal specification in step.
4. **Follow the architecture.** The ledger is derived, never typed in; journal entries are immutable; money is integer minor units; issued documents are never edited or deleted; every write takes an `Idempotency-Key`; authorisation is checked on the server for every endpoint.
5. **Follow the UI rules.** Colours and sizes only from the design tokens, components from `@spine/ui` / `@spine/ui-native`, user-facing text from `@spine/shared/i18n` (`t()` / `useT()`), light and dark mode, WCAG 2.1 AA, and a confirmation before any major action.

Before you push, run `pnpm lint`, `pnpm typecheck` and `pnpm test`, plus `pnpm --filter @spine/api test:integration` if you touched the API. Before a pull request is marked ready, `pnpm verify` runs everything including the E2E suite; say in the pull request which commit it passed on.

## Pull requests

- One story (or one fix) per pull request, branched from `main`.
- Write the description for a reviewer: what changes for the people using Spine, how you tested it, and anything you weren't sure about.
- CI runs lint, typecheck, unit and integration tests, and a dependency audit on every pull request.

## Sign your commits (Developer Certificate of Origin)

Spine accepts contributions under the [Developer Certificate of Origin](https://developercertificate.org/), not a CLA. By signing off a commit you confirm you wrote it, or otherwise have the right to submit it under Spine's licence (AGPL-3.0-only). Sign off with `-s`:

```bash
git commit -s -m "US-INV-05: say why a draft can't be issued"
```

That adds `Signed-off-by: Your Name <you@example.com>` to the message. Every commit in a pull request needs it.

## Licence

By contributing you agree that your contribution is licensed under the [GNU Affero General Public License v3.0 only](LICENSE).
