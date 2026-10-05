# 00 · Overview

## What Spine is

Spine is a self-hosted business app for service and project businesses of 1–20 people — contractors, fabricators, fit-out firms, design studios. It follows the way these businesses actually work, **enquiry → quote → job → invoice → payment → books**, and derives correct double-entry accounting from those events so nobody types a journal entry. One Docker install serves one business. Owners, office staff and field crew sign in; customers act on quotes through a public link with no account. A native mobile app (iOS and Android) lets field crew see their jobs, capture photos and receipts offline, complete milestones and take a customer's signature on a quote on site.

## The problem

Small businesses run their money on a patchwork: contacts in WhatsApp, quotes in Excel, invoices in Word, receipts in a shoebox handed to an accountant once a year. The owner can't answer three questions without a phone call and a calculator:

1. Who owes me money, and for how long?
2. Did this job actually make a profit?
3. What did I earn and spend last quarter?

| Existing option | Why it doesn't fit |
|---|---|
| Zoho One | Per-user monthly cost that scales badly for a 5-person firm; every module is a separate app |
| Odoo | ERP-shaped; setup needs a consultant; the community edition drops what small firms need |
| QuickBooks / Xero | Accounting-first: the owner thinks in debits and credits from minute one |
| Spreadsheets | No audit trail, no linkage, no mobile; breaks at the first partial payment |

## Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | An owner answers the three questions above from one screen | Dashboard shows receivables aging, job profitability and month revenue with no setup beyond issuing documents |
| G2 | Accounting is an output, never an input | The everyday workflow never needs a hand-typed journal entry; only Owners may post adjusting journals for what no document covers ([D-134](12-decisions.md)); the trial balance balances after every workflow (automated test) |
| G3 | A stranger installs it without help | Clean machine with Docker → first issued invoice in under 5 minutes using only the README |
| G4 | Field crew work with bad signal | Photos, expenses and milestone completions work end-to-end in airplane mode and sync with no duplicates |
| G5 | Nothing financial is ever lost or silently changed | Issued documents are immutable; corrections are reversals or credit notes; every change is in the audit log |

## Non-goals (v1)

Out of scope for 1.0. Work planned after 1.0 is listed, with reasons, in [16-roadmap](16-roadmap.md); everything below stays out unless a decision moves it there:

- Multi-tenant SaaS hosting, including one owner account managing several organisations. One instance serves one business.
- Payroll, HR, attendance.
- Inventory with stock valuation, warehouses or manufacturing.
- Marketing automation, email campaigns, lead scoring.
- Filing tax returns or connecting to tax portals; e-invoicing and e-way bills. Spine prepares the figures and export files, such as GSTR-1 ([D-148](12-decisions.md)), and the owner or accountant files.
- Customer self-service portal with accounts.
- Multi-currency.
- Live bank feeds. Importing a statement file and reconciling it is in V1 ([D-135](12-decisions.md)).
- Native desktop app.
- Purchase orders (planned for later, [16-roadmap](16-roadmap.md)), timesheets, plugin API, public REST API for third parties.
- Cross-owner content ownership (one Owner restricting another Owner's access). All Owners are equal in v1.
- Offline creation of financial documents (quotes, invoices) on mobile.

## Licence and repository

Licence is undecided between AGPL-3.0 and MIT ([Q-01](13-risks-open-questions.md), needed before Phase 10). The repository is a pnpm/Turborepo monorepo ([03-monorepo](03-monorepo.md)).

## Personas

| Persona | Role in Spine | Reality | Primary jobs |
|---|---|---|---|
| **Alex, the owner** | Owner (Primary Owner on a fresh install) | Runs the business; feels the pain today | Sees pipeline, approves discounts, checks who owes money, reads P&L, manages people and settings |
| **Sarah, office staff** | Staff, in one or more Teams | Admin/accounts person, maybe part-time | Creates contacts, quotes and invoices; records payments and expenses; chases receivables |
| **Marcus, field crew** | Field | On site, on a phone, often with poor signal | Sees today's jobs; captures photos; submits expenses; marks milestones complete; gets a customer's signature on a quote |
| **Alan, the customer** | Customer (public link, no account) | External; opens a link from an email | Reads a quote on his phone; accepts or declines it |
| **The self-hoster** | Whoever runs the server (often the owner) | Has Docker, not necessarily ops experience | Installs, backs up, upgrades |

## Journeys

1. **First run.** Alex installs with Docker, signs up (becoming Primary Owner), runs or skips the setup wizard, loads demo data or starts clean, invites Sarah and Marcus.
2. **Quote to cash.** Sarah adds a contact, builds a quote from the catalogue, emails it. Alan opens the link and accepts. Sarah converts it to a job and an advance invoice; Alan pays; Sarah records the payment.
3. **Construction billing.** Sarah defines milestones on the job. Marcus marks a milestone complete on site with photos. Sarah raises a progress invoice; retention is held; at handover the retention is released.
4. **Money out.** Marcus photographs a fuel receipt with no signal; it syncs later. Sarah approves it and bills it to the customer. Vendor bills are recorded and paid.
5. **Books.** Alex opens the dashboard: cash in each account, receivables, payables, overdue, revenue, tax owed. Sarah imports the bank statement and reconciles it. At quarter end Alex records the GST payment, reads P&L, Balance Sheet, Cash Flow, Trial Balance and Tax Summary, downloads the GSTR-1 file, and his accountant — in a Team with read access to the statements — exports the books to Excel or Tally, posts the year-end adjusting journals with Alex, and Alex closes the period.
6. **On-site acceptance.** Marcus presents a variation quote on his phone; Alan signs on screen; the office is notified instantly.
7. **Moving in.** Alex starts using Spine mid-year: he picks a cutover date, enters the balances from his old trial balance, brings in unpaid invoices, bills and retention, checks that nothing is left in Opening Balance Adjustments and locks them.

## Success metrics

| Metric | Target |
|---|---|
| Clone → first issued invoice on a clean machine with Docker | < 5 minutes |
| Trial balance after any simulated workflow | Always balanced (CI) |
| Field app in airplane mode | Photos, expenses, milestone completion queue and replay with zero duplicates |
| List views at 10,000 records | < 300 ms |
| Reports over 12 months at 50,000 journal lines | < 2 s |
| WCAG 2.1 AA | Every `@spine/ui` component passes axe-core in CI |

## Where things are

| Need | Doc |
|---|---|
| Stack and versions | [01-tech-stack](01-tech-stack.md) |
| Architecture, ledger, offline sync | [02-architecture](02-architecture.md) |
| Repo layout and scripts | [03-monorepo](03-monorepo.md) |
| Tables and invariants | [04-data-model](04-data-model.md) |
| API conventions and routes | [05-api](05-api.md) |
| Posting rules (the accounting contract) | [06-ledger-posting-rules](06-ledger-posting-rules.md) |
| Roles, capabilities, security | [07-security](07-security.md) |
| Non-functional requirements | [08-non-functional](08-non-functional.md) |
| Design system rules | [09-design-system](09-design-system.md) and [../design/README.md](../design/README.md) |
| Phases and what's done | [10-phases](10-phases.md) and [../progress.md](../progress.md) |
| After 1.0 | [16-roadmap](16-roadmap.md) |
| Testing and release | [11-testing-release](11-testing-release.md) |
| Decisions | [12-decisions](12-decisions.md) |
| Risks and open questions | [13-risks-open-questions](13-risks-open-questions.md) |
| Glossary | [14-glossary](14-glossary.md) |
| Mobile release | [15-mobile-release](15-mobile-release.md) |
| Stories by module | [../features/](../features/) |
| Screens | [../design/screens.md](../design/screens.md) |
| Build history | `CHANGELOG.md` (repo root) |
| Manual QA script | [../qa-script.md](../qa-script.md) |
