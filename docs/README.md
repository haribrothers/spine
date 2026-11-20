# Spine — product spec

Spine is a self-hosted business management app for small service and project businesses: enquiry → quote → job → invoice → payment → books, with double-entry accounting derived from business events. This folder is the spec Claude Code builds against.

205 features and 639 user stories across 22 modules.

## Read in this order

1. [prd/00-overview](prd/00-overview.md) — what, who, goals, non-goals, journeys
2. [prd/01-tech-stack](prd/01-tech-stack.md) · [prd/02-architecture](prd/02-architecture.md) · [prd/03-monorepo](prd/03-monorepo.md)
3. [prd/04-data-model](prd/04-data-model.md) · [prd/05-api](prd/05-api.md) · [prd/06-ledger-posting-rules](prd/06-ledger-posting-rules.md) · [prd/07-security](prd/07-security.md)
4. [prd/08-non-functional](prd/08-non-functional.md) · [prd/09-design-system](prd/09-design-system.md)
5. [prd/10-phases](prd/10-phases.md) and [progress.md](progress.md)
6. [prd/11-testing-release](prd/11-testing-release.md) · [prd/12-decisions](prd/12-decisions.md) · [prd/13-risks-open-questions](prd/13-risks-open-questions.md) · [prd/14-glossary](prd/14-glossary.md) · [prd/15-mobile-release](prd/15-mobile-release.md) · [prd/16-roadmap](prd/16-roadmap.md) (after 1.0)
7. The feature file for your module (below), then its screens in [design/screens.md](design/screens.md)

## Modules

| File | Module | Stories |
|---|---|---|
| [01-onboarding](features/01-onboarding.md) | Onboarding & first run | 35 |
| [02-auth](features/02-auth.md) | Sign-in & account | 19 |
| [03-crm](features/03-crm.md) | Contacts & CRM | 28 |
| [04-meetings](features/04-meetings.md) | Meetings & calendar | 18 |
| [05-catalogue](features/05-catalogue.md) | Catalogue | 16 |
| [06-quotes](features/06-quotes.md) | Quotes | 36 |
| [07-jobs](features/07-jobs.md) | Jobs & milestones | 39 |
| [08-invoicing](features/08-invoicing.md) | Invoicing & credit notes | 41 |
| [09-payments](features/09-payments.md) | Payments & receivables | 31 |
| [10-purchases](features/10-purchases.md) | Purchases & expenses | 60 |
| [11-tax](features/11-tax.md) | Tax | 17 |
| [12-reports](features/12-reports.md) | Accounting & reports | 41 |
| [13-dashboard](features/13-dashboard.md) | Dashboard | 31 |
| [14-notifications](features/14-notifications.md) | Notifications | 14 |
| [15-team](features/15-team.md) | Users, teams & permissions | 32 |
| [16-settings](features/16-settings.md) | Settings & administration | 34 |
| [17-mobile](features/17-mobile.md) | Mobile field companion | 31 |
| [18-ops](features/18-ops.md) | Self-hosting & system states | 62 |
| [19-website](features/19-website.md) | Website and help | 14 |
| [20-banking](features/20-banking.md) | Banking | 17 |
| [21-ai](features/21-ai.md) | AI assistant | 14 |
| [22-mcp](features/22-mcp.md) | Connected agents (MCP) | 9 |

## Design

- Brand book, tokens, motion and one page per component: [design/README.md](design/README.md).
- Screens: all 371 screens in [design/screens.md](design/screens.md) — 172 captured from the running app, 199 drawn on the design canvas for what isn't built yet. Images are in `design/screens/`.
- Native implementation rules: [design/native-notes.md](design/native-notes.md).

## Other docs

- [qa-script.md](qa-script.md) — the manual QA script, by area.
- [DESIGN.md](DESIGN.md) — design token source (front matter) used to generate the Tailwind preset.
- [archive/spine-prd.md](archive/spine-prd.md) — the original single-file PRD, kept for history. Story ids there (`S-xx.yy`) appear as "Legacy:" lines in the feature files.
- `CHANGELOG.md` (repo root) — build history, current month; [changelog/](changelog/) holds earlier months.
- [research/competitor-analysis-zoho-books-tallyprime.md](research/competitor-analysis-zoho-books-tallyprime.md) — the Zoho Books and TallyPrime comparison behind Phases 8–9 and the roadmap (D-133).
