# Spine — product spec

Spine is a self-hosted business management app for small service and project businesses: enquiry → quote → job → invoice → payment → books, with double-entry accounting derived from business events. This folder is the spec Claude Code builds against.

124 features and 339 user stories across 19 modules.

## Read in this order

1. [prd/00-overview](prd/00-overview.md) — what, who, goals, non-goals, journeys
2. [prd/01-tech-stack](prd/01-tech-stack.md) · [prd/02-architecture](prd/02-architecture.md) · [prd/03-monorepo](prd/03-monorepo.md)
3. [prd/04-data-model](prd/04-data-model.md) · [prd/05-api](prd/05-api.md) · [prd/06-ledger-posting-rules](prd/06-ledger-posting-rules.md) · [prd/07-security](prd/07-security.md)
4. [prd/08-non-functional](prd/08-non-functional.md) · [prd/09-design-system](prd/09-design-system.md)
5. [prd/10-phases](prd/10-phases.md) and [progress.md](progress.md)
6. [prd/11-testing-release](prd/11-testing-release.md) · [prd/12-decisions](prd/12-decisions.md) · [prd/13-risks-open-questions](prd/13-risks-open-questions.md) · [prd/14-glossary](prd/14-glossary.md) · [prd/15-mobile-release](prd/15-mobile-release.md)
7. The feature file for your module (below), then its screens in [design/screens.md](design/screens.md)

## Modules

| File | Module | Stories |
|---|---|---|
| [01-onboarding](features/01-onboarding.md) | Onboarding & first run | 13 |
| [02-auth](features/02-auth.md) | Sign-in & account | 12 |
| [03-crm](features/03-crm.md) | Contacts & CRM | 20 |
| [04-meetings](features/04-meetings.md) | Meetings & calendar | 12 |
| [05-catalogue](features/05-catalogue.md) | Catalogue | 8 |
| [06-quotes](features/06-quotes.md) | Quotes | 26 |
| [07-jobs](features/07-jobs.md) | Jobs & milestones | 29 |
| [08-invoicing](features/08-invoicing.md) | Invoicing & credit notes | 24 |
| [09-payments](features/09-payments.md) | Payments & receivables | 15 |
| [10-purchases](features/10-purchases.md) | Purchases & expenses | 23 |
| [11-tax](features/11-tax.md) | Tax | 7 |
| [12-reports](features/12-reports.md) | Accounting & reports | 15 |
| [13-dashboard](features/13-dashboard.md) | Dashboard | 20 |
| [14-notifications](features/14-notifications.md) | Notifications | 14 |
| [15-team](features/15-team.md) | Users, teams & permissions | 18 |
| [16-settings](features/16-settings.md) | Settings & administration | 16 |
| [17-mobile](features/17-mobile.md) | Mobile field companion | 21 |
| [18-ops](features/18-ops.md) | Self-hosting & system states | 32 |
| [19-website](features/19-website.md) | Website and help | 14 |

## Design

- Brand book, tokens, motion and one page per component: [design/README.md](design/README.md).
- Screens: all 293 screens in [design/screens.md](design/screens.md) — 172 captured from the running app, 121 drawn on the design canvas for what isn't built yet. Images are in `design/screens/`.
- Native implementation rules: [design/native-notes.md](design/native-notes.md).

## Other docs

- [qa-script.md](qa-script.md) — the manual QA script, by area.
- [DESIGN.md](DESIGN.md) — design token source (front matter) used to generate the Tailwind preset.
- [archive/spine-prd.md](archive/spine-prd.md) — the original single-file PRD, kept for history. Story ids there (`S-xx.yy`) appear as "Legacy:" lines in the feature files.
- `CHANGELOG.md` (repo root) — build history.
