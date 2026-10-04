# 01 · Onboarding & first run

A linear setup wizard that runs after the first owner signs up, configures the business in eight short steps, and can be skipped at any point. Every step stays editable later in Settings, demo data can replace manual setup, and a dashboard checklist guides the first real transaction.

**Screens:** `OnbWelcome` (P1), `OnbBusinessProfile` (P1), `OnbIndustryTemplate` (P1), `OnbCurrencyLocale` (P1), `OnbFinancialYear` (P1), `OnbTaxRate` (P1), `OnbNumbering` (P1), `OnbChartOfAccounts` (P1), `OnbInviteTeam` (P1), `OnbInviteTeamSent` (P2), `DashboardSetupChecklist` (P1), `DashboardCaughtUp` (P1), `DashboardStaffRedesign` (P1)
**Depends on:** 02 Sign-in & account (first owner exists), 16 Settings (same panes reused), 15 Team (invitations).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-ONB-01 | Wizard shell: welcome, stepper, skip, revisit in Settings | P1 | 0 | `OnbWelcome`, `OnbBusinessProfile`, `OnbChartOfAccounts` |
| F-ONB-02 | Setup steps: business, currency and year, tax and numbering, accounts, team | P1 | 0 | `OnbBusinessProfile`, `OnbCurrencyLocale`, `OnbFinancialYear`, `OnbTaxRate`, `OnbNumbering`, `OnbChartOfAccounts`, `OnbInviteTeam`, `OnbInviteTeamSent` |
| F-ONB-03 | Industry template | P1 | 3 | `OnbIndustryTemplate` |
| F-ONB-04 | Load demo data | P1 | 8 | `OnbWelcome` |
| F-ONB-05 | Setup checklist on the dashboard | P1 | 1 | `DashboardSetupChecklist` |

## User stories

### US-ONB-01 · Start the setup wizard after signing up
**Feature:** F-ONB-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `OnbWelcome`
**As** a new owner, **I want** a short guided setup right after I create my account, **so that** I know exactly what to configure before I start.

Legacy: S-12.1

**Acceptance criteria**
- **Given** I have just created the first account on a fresh instance, **when** sign-up completes, **then** I land on `/onboarding` showing "Welcome to Spine" with the buttons "Set up my business", "Just show me around (use defaults)" (loads demo data, US-ONB-09) and "Skip to dashboard".
- **Given** I am on the welcome screen, **when** I choose "Set up my business", **then** the stepper shows eight steps in this order: Business, Template, Currency, Fiscal year, Tax, Numbering, Accounts, Team, with Business active.
- **Given** I am on any step, **when** I press "Continue" with valid input, **then** the step is saved and the stepper marks it done with a check.
- **Given** onboarding is already finished or skipped, **when** I open `/onboarding` again, **then** I am taken to the dashboard.
- **Given** a staff or field user signs in, **when** they reach the app, **then** they never see the wizard.

**Implementation notes**
- API: `GET /org/settings/onboarding`, `PUT /org/settings/onboarding` (onboarding state in `settings`).
- Data: `settings` keys written by each step (see 04-data-model conventions).
- UI: `apps/web/src/app/onboarding/page.tsx`, `Stepper`, `Card`, `Button` from `@spine/ui`.
- Edge: refreshing mid-wizard resumes at the first unsaved step.
- Phases: the Template step's effect on jobs ships with Phase 3 (US-ONB-04); until then the choice is saved but changes nothing. The demo-data fixes in US-ONB-09 ship in Phase 8; the button itself is built.

### US-ONB-02 · Skip setup at any step
**Feature:** F-ONB-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `OnbWelcome`, `OnbBusinessProfile`
**As** a new owner, **I want** to skip the wizard entirely or part-way, **so that** I can migrate data by import or explore first.

Legacy: S-12.11

**Acceptance criteria**
- **Given** I am on the welcome screen or any step, **when** I press "Skip to dashboard", **then** onboarding is marked finished and I land on `/dashboard`.
- **Given** I skipped before any step, **when** I use the app, **then** every feature works with system defaults (currency from `CURRENCY`, default numbering, seeded chart of accounts).
- **Given** I skipped, **when** I open Settings, **then** every wizard step is available there to complete later.
- **Given** I skipped, **when** I view the dashboard, **then** the "Get started" checklist is shown.

**Implementation notes**
- API: `PUT /org/settings/onboarding` with `{ completed: true }`.
- UI: every step renders the "Skip to dashboard" ghost button (D-021).
- Edge: skipping never deletes values already saved by earlier steps.

### US-ONB-03 · Enter my business details
**Feature:** F-ONB-02 · **Priority:** P1 · **Phase:** 0 · **Screens:** `OnbBusinessProfile`
**As** a new owner, **I want** to enter my business name, logo, address and industry in one step, **so that** documents are branded from day one.

Legacy: S-12.2

**Acceptance criteria**
- **Given** I am on the Business step, **when** I view it, **then** I see "Business name" (required), "Logo", "Address" and "Industry" with the helper "Free text — the next step picks a template that pre-configures the app.".
- **Given** the business name is empty, **when** I press "Continue", **then** the field shows an error and the step isn't saved.
- **Given** I click the logo square, **when** I pick an image up to 10 MB, **then** it uploads and the square shows "Logo uploaded".
- **Given** the upload fails, **when** the error returns, **then** I see "Could not upload logo." and can retry.
- **Given** I save the step, **when** I later issue a quote PDF, **then** it shows this name, address and logo.

**Implementation notes**
- API: `PUT /org/settings/business_profile`, `POST /files`.
- Data: `settings.business_profile`; `files`. Must also update `organization.name` (see US-TEAM-15).
- UI: `BusinessProfileStep`, reused in Settings with save label "Save".
- Edge: logo upload while object storage is down shows the error and the rest of the step still saves.

### US-ONB-04 · Pick an industry template
**Feature:** F-ONB-03 · **Priority:** P1 · **Phase:** 3 · **Screens:** `OnbIndustryTemplate`
**As** a new owner, **I want** to choose Construction, General Services or Generic, **so that** the app shows the features my kind of business uses.

Legacy: S-12.3

**Acceptance criteria**
- **Given** I am on the Template step, **when** I view it, **then** I see "Pick an industry template" with three radio cards: "Construction / Contracting", "General Services" and "Generic", Generic selected by default.
- **Given** I choose "Construction / Contracting" and continue, **when** I open a job, **then** milestones and retention are shown by default.
- **Given** I choose "General Services" or "Generic", **when** I open a job, **then** the milestones and retention sections start collapsed on every job and can be expanded on any job.
- **Given** I picked a template, **when** I change it later in Settings › Industry template, **then** defaults change for new records and existing records are untouched.

**Implementation notes**
- API: `PUT /org/settings/industry_template`.
- Data: `settings.industry_template`.
- UI: `IndustryTemplateStep`; radio cards are keyboard operable (arrow keys).
- Edge: a template never removes a feature — it only sets defaults and visibility (PRD F12).

### US-ONB-05 · Set currency, locale and financial year
**Feature:** F-ONB-02 · **Priority:** P1 · **Phase:** 0 · **Screens:** `OnbCurrencyLocale`, `OnbFinancialYear`
**As** a new owner, **I want** to set my currency, locale and financial-year start, **so that** documents and reports use the right defaults immediately.

Legacy: S-12.4

**Acceptance criteria**
- **Given** I am on the Currency step, **when** I view it, **then** I see "Currency" (helper "ISO 4217 code, e.g. USD, EUR, INR.") and "Locale" (helper "Controls date and number formatting.").
- **Given** I choose a currency and locale and continue, **when** I create a quote, **then** amounts use that currency and dates and numbers use that locale's format.
- **Given** I am on the Fiscal year step, **when** I choose a month in "Financial year starts on", **then** reports' default period follows that month (document numbers never reset by year, [D-077](../prd/12-decisions.md)).
- **Given** documents already exist, **when** I change the currency later in Settings, **then** I'm warned that existing documents keep their currency (Spine is single-currency).

**Implementation notes**
- API: `PUT /org/settings/currency`, `PUT /org/settings/fiscal_year`.
- Data: `settings.currency`, financial-year key.
- UI: `CurrencyLocaleStep`, `FinancialYearStep`.
- Edge: no multi-currency (non-goal); one currency per organisation.

### US-ONB-06 · Confirm a default tax rate and document numbering
**Feature:** F-ONB-02 · **Priority:** P1 · **Phase:** 0 · **Screens:** `OnbTaxRate`, `OnbNumbering`
**As** a new owner, **I want** to confirm my tax rate and document number prefixes, **so that** my first quote is priced and numbered correctly.

Legacy: S-12.5, S-10.5

**Acceptance criteria**
- **Given** I am on the Tax step, **when** I enter "Tax name" (helper "e.g. VAT, GST, Sales Tax") and "Rate (%)" and continue, **then** a named tax rate is created and becomes the default for new lines.
- **Given** I am on the Numbering step, **when** I view it, **then** I see one row per document (Quote, Invoice, Credit Note, Receipt, Expense, Job, Vendor Payment) with "Prefix", "Padding" and "Starting number".
- **Given** I set a starting number of 1042 for invoices, **when** I issue my first invoice, **then** it gets number 1042 with the chosen prefix and padding.
- **Given** a document type already has issued numbers, **when** I try to set its starting number at or below the last issued one, **then** saving is refused with a message naming the last issued number.

**Implementation notes**
- API: `PUT /org/tax/default-rate`, `GET /org/numbering`, `PUT /org/numbering/:documentType`.
- Data: `tax_rates`, `settings.default_tax_rate`, `number_sequences`.
- UI: `TaxRateStep`, `NumberingStep`.
- Edge: the default prefix pattern vs PRD `QUO-{YYYY}-{0000}` is open (Q-06).

### US-ONB-07 · Review the chart of accounts
**Feature:** F-ONB-02 · **Priority:** P1 · **Phase:** 0 · **Screens:** `OnbChartOfAccounts`
**As** a new owner, **I want** to see the accounts Spine will use and rename the ones I care about, **so that** I understand what I'm getting without knowing accounting.

Legacy: S-12.6, S-09.1

**Acceptance criteria**
- **Given** I reach the Accounts step, **when** it loads, **then** the seeded default chart is listed grouped by Assets, Liabilities, Equity, Income and Expenses with codes.
- **Given** an account is a system account, **when** I view its row, **then** it shows "System" and cannot be renamed.
- **Given** a non-system account, **when** I choose "Rename", enter a name and save, **then** the new name is used everywhere.
- **Given** I press "Continue" without changes, **when** the step saves, **then** the default chart is kept as is.

**Implementation notes**
- API: `GET /org/accounts`, `PUT /org/accounts/:id`.
- Data: `accounts` (seeded per org from `db/seed/chart-of-accounts.ts`).
- UI: `ChartOfAccountsStep`, reused in Settings › Chart of accounts (must say "Save", US-SET-14).
- Edge: system account codes (06-ledger-posting-rules) are never renamed or deleted.

### US-ONB-08 · Invite my team as the last step
**Feature:** F-ONB-02 · **Priority:** P1 · **Phase:** 0 · **Screens:** `OnbInviteTeam`, `OnbInviteTeamSent`
**As** a new owner, **I want** to invite colleagues before I finish setup, **so that** everyone can start the same day.

Legacy: S-12.7

**Acceptance criteria**
- **Given** I am on the Team step, **when** I view it, **then** I see "Email" (placeholder "teammate@example.com"), "Role" with "Staff" and "Field", and "Send invite".
- **Given** I enter a valid email and press "Send invite", **when** the invite is created, **then** a line "Invited <email> as <role>" appears and an email is queued.
- **Given** I have sent no invites, **when** I view the footer, **then** the button reads "Skip — finish setup"; after one invite it reads "Finish".
- **Given** I press "Finish", **when** setup completes, **then** I land on the dashboard.
- **Given** the email address already has a pending invite, **when** I send again, **then** I see "Could not send invite." with the reason.

**Implementation notes**
- API: `POST /org/invitations`.
- Data: Better Auth `invitation`.
- UI: `InviteTeamStep` (also embedded on Team › Users without its footer).
- Edge: Owner is never offered as a role at invite time (D-020).

### US-ONB-09 · Load demo data to explore
**Feature:** F-ONB-04 · **Priority:** P1 · **Phase:** 8 · **Screens:** `OnbWelcome`
**As** an evaluator, **I want** to load a realistic sample business with one click, **so that** I can see every screen working before I commit real data.

Legacy: S-12.8

**Acceptance criteria**
- **Given** I am on the welcome screen, **when** I press "Just show me around (use defaults)", **then** a sample contracting business (Riverstone Builders) is created with contacts, catalogue items, leads, quotes in several states, three jobs, invoices with payments and retention, vendor bills, expenses, meetings and a staff and field user.
- **Given** demo data loaded, **when** I open every report, **then** each renders non-empty figures and the trial balance balances.
- **Given** demo data is loaded, **when** I open Settings › Demo data and confirm "Delete all demo data", **then** only rows marked as demo are removed and my own records remain.
- **Given** the demo data includes a recurring meeting, **when** I edit it, **then** the "This event" / "All events" choice appears (finding C5).
- **Given** demo job photos are seeded, **when** I open a job's Photos tab, **then** each shows a real image, not a blank tile (finding C10).

**Implementation notes**
- API: `POST /demo-data/seed`, `DELETE /demo-data`, `GET /demo-data/status`.
- Data: `is_demo` columns; demo users' memberships.
- UI: `WelcomeStep`, `SettingsDemoData`.
- Edge: seeding twice doesn't duplicate users (memberships are re-pointed).
- Status: seeding, status and deletion are built (Phase 1); this story stays open for the recurring-meeting and photo criteria (findings C5, C10).
- Security: seeding and deleting demo data are Owner-only (US-OPS-20).

### US-ONB-10 · Follow a checklist to my first transaction
**Feature:** F-ONB-05 · **Priority:** P1 · **Phase:** 1 · **Screens:** `DashboardSetupChecklist`
**As** a new owner, **I want** a short checklist on my dashboard, **so that** I'm never staring at an empty screen.

Legacy: S-12.9

**Acceptance criteria**
- **Given** the organisation has no customers, items or sent quotes, **when** I open the dashboard, **then** a "Get started" card lists "Add your first customer", "Create your first item" and "Send your first quote".
- **Given** I create my first customer, **when** I return to the dashboard, **then** "Add your first customer" is checked and struck through.
- **Given** all three are done, **when** the dashboard loads, **then** the card dismisses itself permanently.
- **Given** I press "Dismiss", **when** I reload on any device, **then** the card stays hidden.
- **Given** the card was never dismissed and all customers were later deleted, **when** I open the dashboard, **then** the first item is unchecked again.

**Implementation notes**
- API: `GET /dashboard/checklist`, `POST /dashboard/checklist/dismiss`.
- Data: checklist state in `settings`.
- UI: `setup-checklist.tsx`; each item links to its page.
- Edge: demo rows don't count — the checklist tracks the owner's own first records. Showing it to Owners only is US-ONB-12 (Phase 6).

### US-ONB-11 · Change any setup answer later
**Feature:** F-ONB-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `OnbBusinessProfile`, `OnbChartOfAccounts`
**As** an owner, **I want** every onboarding choice editable in Settings, **so that** an early decision isn't permanent.

Legacy: S-12.10, S-10.1

**Acceptance criteria**
- **Given** onboarding is finished, **when** I open Settings, **then** Business profile, Industry template, Currency & locale, Financial year, Tax, Numbering and Chart of accounts are listed.
- **Given** I open one of those panes, **when** I view it, **then** it shows the value I chose in the wizard.
- **Given** I change a value and press "Save", **when** it saves, **then** a "Saved" confirmation appears and new records use the new value.
- **Given** I am staff or field, **when** I open the user menu, **then** "Settings" is not listed.

**Implementation notes**
- API: same routes as each step.
- UI: each step component takes `saveLabel`; Settings must pass "Save" — not yet true for Industry template and Chart of accounts (US-SET-14).
- Edge: none of the panes trigger the wizard again.

### US-ONB-12 · Show the setup checklist to owners only
**Feature:** F-ONB-05 · **Priority:** P2 · **Phase:** 6 · **Screens:** `DashboardCaughtUp`, `DashboardStaffRedesign`
**As** a staff member, **I want** my dashboard free of the owner's setup tasks, **so that** I'm not asked to do things that aren't mine.

Review finding: Stage 5 #8

**Acceptance criteria**
- **Given** a Staff or Field user, **when** they open the dashboard, **then** the "Get started" card isn't shown.
- **Given** an Owner, **when** the card renders in the redesigned dashboard (hidden until Phase 7 ships US-DASH-12; until then the current card keeps its copy), **then** it reads "Three steps to your first sent quote. Only owners see this." and each step links to its page ("Contacts", "Catalogue", "New quote").
- **Given** a Staff or Field user, **when** they call `GET /dashboard/checklist`, **then** it returns `{ visible: false }`.
- **Given** an Owner with demo data loaded and no records of their own, **when** they open the dashboard, **then** "Add your first customer" is unchecked (demo rows don't count).
- **Given** any Owner dismisses the card, **when** other Owners open the dashboard, **then** it stays hidden for them too (dismissal is per organisation).

**Implementation notes**
- API: `GET /dashboard/checklist` checks the caller's role.
- UI: `setup-checklist.tsx` renders nothing when `visible` is false.
