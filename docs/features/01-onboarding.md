# 01 · Onboarding & first run

A linear setup wizard that runs after the first owner signs up, configures the business in eight short steps, and can be skipped at any point. Every step stays editable later in Settings, demo data can replace manual setup, and a dashboard checklist guides the first real transaction.

**Screens:** `OnbWelcome` (P1), `OnbBusinessProfile` (P1), `OnbIndustryTemplate` (P1), `OnbCurrencyLocale` (P1), `OnbFinancialYear` (P1), `OnbTaxRate` (P1), `OnbNumbering` (P1), `OnbChartOfAccounts` (P1), `OnbInviteTeam` (P1), `OnbInviteTeamSent` (P2), `DashboardSetupChecklist` (P1), `DashboardCaughtUp` (P1), `DashboardStaffRedesign` (P1), `ExpenseCategoriesConstruction` (P1), `OnbTaxCountry` (P1), `SettingsModules` (P1), `SetupSpine` (P1), `OnbStart` (P2), `OnbStartDark` (P2), `OnbStageBusiness` (P2), `OnbStageMoney` (P2), `OnbStageDocuments` (P2), `OnbStageBooks` (P2), `OnbStageDark` (P2), `OnbNarrow` (P2), `OnbFinish` (P2), `OnbFinishDark` (P2)
**Depends on:** 02 Sign-in & account (first owner exists), 16 Settings (same panes reused), 15 Team (invitations).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-ONB-01 | Wizard shell: welcome, stepper, skip, revisit in Settings | P1 | 0 | `OnbWelcome`, `OnbBusinessProfile`, `OnbChartOfAccounts` |
| F-ONB-02 | Setup steps: business, currency and year, tax and numbering, accounts, team | P1 | 0 | `OnbBusinessProfile`, `OnbCurrencyLocale`, `OnbFinancialYear`, `OnbTaxRate`, `OnbNumbering`, `OnbChartOfAccounts`, `OnbInviteTeam`, `OnbInviteTeamSent` |
| F-ONB-03 | Industry template | P1 | 3 | `OnbIndustryTemplate`, `ExpenseCategoriesConstruction` |
| F-ONB-04 | Load demo data, by country and industry | P1 | 11 (9 for US-ONB-17–US-ONB-19, US-ONB-21) | `OnbWelcome`, `SettingsDemoData` |
| F-ONB-05 | Setup checklist on the dashboard | P1 | 1 | `DashboardSetupChecklist` |
| F-ONB-06 | Set up Spine page | P1 | 9 | `SetupSpine` |
| F-ONB-07 | Setup in four stages: live preview, tips, time left and a finish screen | P2 | Refinements | `OnbStart`, `OnbStageBusiness`, `OnbStageMoney`, `OnbStageDocuments`, `OnbStageBooks`, `OnbFinish` |
| F-ONB-08 | Demo data that shows the refined screens: a worked pipeline, quotes at every stage, jobs that need something, a kept catalogue and a busy calendar, invoices, credit notes, bills and vendor credits at every stage, expenses with their receipts, categories that guide, vendor payments and payables to pay from, banking with reconciliations | P2 | Refinements | — (data; the refined screens of D-211 to D-215) |

## User stories

### US-ONB-01 · Start the setup wizard after signing up
**Feature:** F-ONB-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `OnbWelcome`
**As** a new owner, **I want** a short guided setup right after I create my account, **so that** I know exactly what to configure before I start.

Legacy: S-12.1

**Acceptance criteria**
- **Given** I have just created the first account on a fresh instance, **when** sign-up completes, **then** I land on `/onboarding` showing "Welcome to Spine" with the buttons "Set up my business", "Just show me around (use defaults)" (loads demo data, US-ONB-09) and "Skip to dashboard".
- **Given** I am on the welcome screen, **when** I choose "Set up my business", **then** the steps run in this order: Business, Template, Currency, Fiscal year, Tax, Numbering, Accounts, Team, with Business active. Since US-ONB-22 they're grouped into four stages (Business · Money · Documents · Books & team).
- **Given** I am on any step, **when** I press "Continue" with valid input, **then** the step is saved and the stepper marks it done with a check.
- **Given** onboarding is already finished or skipped, **when** I open `/onboarding` again, **then** I am taken to the dashboard.
- **Given** a staff or field user signs in, **when** they reach the app, **then** they never see the wizard.

**Implementation notes**
- API: `GET /org/settings/onboarding`, `PUT /org/settings/onboarding` (onboarding state in `settings`).
- Data: `settings` keys written by each step (see 04-data-model conventions).
- UI: `apps/web/src/app/onboarding/page.tsx`, `Stepper`, `Card`, `Button` from `@spine/ui`.
- Edge: refreshing mid-wizard resumes at the first unsaved step.
- Phases: the Template step's effect on jobs ships with Phase 3 (US-ONB-04); until then the choice is saved but changes nothing. The demo-data fixes in US-ONB-09 ship in Phase 11; the button itself is built.

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
- **Given** I press "Finish" (or "Skip — finish setup"), **when** setup completes, **then** I see the finish screen (US-ONB-23), and "Go to dashboard" takes me there.
- **Given** the email address already has a pending invite, **when** I send again, **then** I see "Could not send invite." with the reason.

**Implementation notes**
- API: `POST /org/invitations`.
- Data: Better Auth `invitation`.
- UI: `InviteTeamStep` (also embedded on Team › Users without its footer).
- Edge: Owner is never offered as a role at invite time (D-020).

### US-ONB-09 · Load demo data to explore
**Feature:** F-ONB-04 · **Priority:** P1 · **Phase:** 11 · **Screens:** `OnbWelcome`
**As** an evaluator, **I want** to load a realistic sample business with one click, **so that** I can see every screen working before I commit real data.

Legacy: S-12.8

**Acceptance criteria**
- **Given** I am on the welcome screen, **when** I press "Just show me around (use defaults)" and load the default choice (United States, Construction / Contracting — US-ONB-18), **then** a sample contracting business (Riverstone Builders) is created with contacts, catalogue items, leads, quotes in several states, three jobs, invoices with payments and retention, vendor bills, expenses, meetings and a staff and field user.
- **Given** demo data loaded, **when** I open every report, **then** each renders non-empty figures and the trial balance balances.
- **Given** demo data is loaded, **when** I open Settings › Demo data and confirm "Delete all demo data", **then** only rows marked as demo are removed and my own records remain.
- **Given** the demo data includes a recurring meeting, **when** I edit it, **then** the "This event" / "All events" choice appears (finding C5).
- **Given** demo job photos are seeded, **when** I open a job's Photos tab, **then** each shows a real image, not a blank tile (finding C10).
- **Given** object storage is unreachable, **when** demo data is seeded, **then** seeding still succeeds without photos and the response notes "Photos skipped — file storage isn't reachable" (today it fails with 500; NFR-REL-05).

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

### US-ONB-13 · Start a construction business with site cost categories
**Feature:** F-ONB-03 · **Priority:** P1 · **Phase:** 7 · **Screens:** `OnbIndustryTemplate`, `ExpenseCategoriesConstruction`
**As** the owner of a construction business, **I want** the usual site cost categories set up for me, **so that** job costs split into materials, labour, subcontractors and plant from day one.

Decision: D-129

**Acceptance criteria**
- **Given** the Template step, **when** I view "Construction / Contracting", **then** its description adds "Sets up cost categories for materials, labour, subcontractors, plant hire, fuel and freight, and site overheads.".
- **Given** I choose it and continue (or choose it later in Settings › Industry template), **when** it saves, **then** accounts 5300 "Plant & Equipment Hire", 5400 "Fuel & Freight" and 5500 "Site Overheads & Permits" exist and Expenses › Categories lists "Materials" (5000), "Subcontractors" (5100), "Site labour" (5200), "Plant & equipment hire" (5300), "Fuel & freight" (5400) and "Site overheads & permits" (5500).
- **Given** an account code or a category name that already exists, **when** the template is applied, **then** it's left as it is and not duplicated; a clash is listed in a note ("Kept your existing account 5300 · Vehicle Lease").
- **Given** the template is applied twice, **when** I check, **then** nothing is created the second time.
- **Given** I switch to "General Services" or "Generic", **when** it saves, **then** the categories and accounts stay (they may already be used) and I can archive categories myself.
- **Given** the seeded categories, **when** I open them, **then** they're ordinary categories: renamed, remapped or archived like any other.

**Implementation notes**
- API: `PUT /org/settings/industry_template` with `construction` runs the seed in the same transaction; response gains `seeded: { accounts: string[], categories: string[], kept: string[] }`.
- Data: rows in `accounts` (not system accounts) and `expense_categories` (`created_by_user_id` = the Owner who chose the template).
- Edge: the seed never deletes or remaps anything; demo data (US-ONB-09) uses the same categories when the template is Construction.


### US-ONB-14 · Start with the modules my industry needs
**Feature:** F-ONB-03 · **Priority:** P2 · **Phase:** 9 · **Screens:** `OnbIndustryTemplate`, `SettingsModules`
**As** a new owner, **I want** the template to switch on what my kind of business uses, **so that** Spine starts simple.

Decision: D-154

**Acceptance criteria**
- **Given** the Template step, **when** I pick "Construction / Contracting" or "General Services", **then** every module is on.
- **Given** "Generic", **when** I continue, **then** Jobs & field is off and the step says "Jobs are switched off — turn them on in Settings › Modules if you need them.".
- **Given** I change the template later in Settings, **when** I save, **then** modules aren't changed ("Modules stay as they are. Change them in Settings › Modules.").

**Implementation notes**
- `PUT /org/settings/industry_template` sets `settings.modules` only when the organisation has never saved modules.

### US-ONB-15 · Open a setup page that shows what's left
**Feature:** F-ONB-06 · **Priority:** P1 · **Phase:** 9 · **Screens:** `SetupSpine`
**As** a new owner, **I want** one page showing every setup step and whether it's done, **so that** I finish setting up without guessing.

Decisions: D-155, D-194

**Acceptance criteria**
- **Given** the user menu › "Set up Spine" (Owners only), **when** it opens, **then** cards show "Business details and logo", "Tax", "Chart of accounts", "Opening balances", "Bank and cash accounts", "Payment instructions", "Documents and emails", "Numbering", "Payment reminders", "Modules", "Invite your team", "Email sending", "Backups" and "Field app", each "Done" or "To do" with one line on why it matters.
- **Given** the cards, **when** progress shows, **then** the header reads "<n> of <m> done". Backups isn't counted until Spine can check it (Phase 11); its card says "Spine can't check backups yet — whoever runs the server sets them up. Not counted below.". Field app only shows while Jobs & field is on.
- **Given** demo data is loaded, **when** the page opens, **then** it says "Demo data is loaded — these reflect the demo business. Delete it in Settings › Data to set up your own." and the cards count the demo's settings as they stand.
- **Given** a card's state, **when** the data changes (e.g. opening balances locked), **then** it shows "Done" without a manual tick (D-194 lists what each card checks); "Mark as not needed" moves a card to "Not needed" for this organisation, where "Show again" brings it back.
- **Given** the dashboard's setup checklist, **when** its three steps are done, **then** it shows "Finish setting up Spine — <n> left" linking here until every card is done or hidden.
- **Given** a Staff or Field user, **when** they open the page, **then** they see the no-access page.

**Implementation notes**
- API: `GET /org/setup-status` (roles: owner) → `{ cards: [{ key, done: boolean | null, hidden }], demoLoaded }`; `PUT /org/setup-status/:key/hidden { hidden }` (the same shape back); `GET /dashboard/checklist` gains `setupLeft`.
- Shared: `SETUP_CARDS` (title, line, target, guide) and `setupProgress` in `schemas/setup.ts`.
- UI: `/setup` (`SetupView`); the user menu's "Set up Spine"; the checklist's "Finish setting up Spine — <n> left".

### US-ONB-16 · Go from each setup card to its setting and its guide
**Feature:** F-ONB-06 · **Priority:** P2 · **Phase:** 9 · **Screens:** `SetupSpine`
**As** a new owner, **I want** each card to take me to the right place, **so that** setup is a few clicks.

**Acceptance criteria**
- **Given** a card, **when** I press "Set up" (or "Review" when done), **then** the matching Settings pane, Banking page or Opening balances opens, and closing it returns me to the setup page.
- **Given** "How it works" on a card, **when** I press it, **then** the user-guide page for that topic opens (bundled help, US-SITE-11; hidden until Phase 11 ships).
- **Given** "Email sending" or "Backups", **when** they're not configured, **then** the card explains it's set by whoever runs the server and links to the self-hosting guide.

**Implementation notes**
- Card targets are in `SETUP_CARDS`: a Settings pane opens over the page (closing it re-reads the cards), or Banking, Opening balances or Team › Users opens. Email sending and Backups link to the README's self-hosting section until the docs site ships (Q-15).
- "How it works" links to each card's bundled guide page, behind `FEATURE_FLAGS.bundledHelp` (`packages/shared/src/feature-flags.ts`) until Phase 11.

### US-ONB-17 · Keep demo data out of my real numbers and books
**Feature:** F-ONB-04 · **Priority:** P1 · **Phase:** 9 · **Screens:** `OnbWelcome`, `SettingsDemoData`
**As** an owner who explored with demo data, **I want** deleting it to leave no trace, **so that** my own invoice numbers start at 0001 and my books hold only my own business.

Decision: D-191

**Acceptance criteria**
- **Given** demo data is loaded, **when** I open its documents, **then** they're numbered from their own series: `DEMO-QUO-0001`, `DEMO-INV-0001`, `DEMO-CRN-0001`, `DEMO-RCP-0001`, `DEMO-VPY-0001`, `DEMO-EXP-0001`, `DEMO-JOB-001`.
- **Given** demo data is loaded, **when** I issue my first invoice to my own customer, **then** it's `INV-0001` (the real series hasn't moved).
- **Given** demo data is loaded, **when** I create a quote, invoice or payment for a demo customer, a bill or vendor payment for a demo vendor, or an expense on a demo job, **then** it's demo too: it takes a `DEMO-` number and goes when the demo data is deleted.
- **Given** demo data was deleted, **when** I open the Trial Balance, Profit and Loss, General ledger, Day book, Tax Summary, GSTR-1, Receivables, the dashboard or the Tally export, **then** nothing from the demo appears, and every demo contact and job is gone.
- **Given** demo data was deleted and is loaded again, **when** I look at its invoices, **then** they start at `DEMO-INV-0001` again.
- **Given** I recorded something of my own against demo data that isn't demo (a refund, vendor credit or bank entry for a demo contact), **when** I delete the demo data, **then** that record and its contact stay, and the confirmation says "Kept 1 demo contact that your own records use.".
- **Given** any journal entry, **when** anything other than "Delete all demo data" tries to change or delete it — or that deletion meets an entry that isn't demo — **then** the database refuses.

**Implementation notes**
- Data: `number_sequences.is_demo` (unique per organisation, document type and `is_demo`); `journal_entries.is_demo`, written by `LedgerService.postEntry` from the source document; a `BEFORE INSERT` trigger on quotes, invoices, payments, credit notes, vendor bills, vendor payments and jobs sets `is_demo` from the contact, and on expenses from the job. The immutability triggers allow a delete only for `is_demo` entries while `spine.deleting_demo` is on.
- API: `NumberingService.allocateNumber(tx, orgId, type, { demo })`; `DELETE /demo-data` returns `kept: { contacts }` as well as the counts.
- Edge: deletion order is payments and vendor payments, credit notes, invoices, bills, expenses, quotes, demo journal entries, then jobs and contacts that nothing else uses.

### US-ONB-18 · Choose the country and industry of the demo business
**Feature:** F-ONB-04 · **Priority:** P1 · **Phase:** 9 · **Screens:** `OnbWelcome`, `SettingsDemoData`
**As** an evaluator, **I want** a demo business like mine, **so that** what I explore has my tax, my currency and my kind of work.

Decision: D-192

**Acceptance criteria**
- **Given** the welcome screen, **when** I press "Just show me around (use defaults)", **then** a dialog "Explore a demo business" asks for Country and Industry and has "Load demo business" and "Cancel".
- **Given** no tax country is set, **when** the dialog opens, **then** Country is guessed from my time zone (Asia/Kolkata → India (GST), Europe/London → United Kingdom (VAT), anything not listed → United States (sales tax)), and Industry is Construction / Contracting.
- **Given** Country lists United States (sales tax), India (GST), United Kingdom (VAT), Australia (GST), New Zealand (GST), United Arab Emirates (VAT) and Saudi Arabia (VAT), and Industry lists Construction / Contracting, Interior design & fit-out, Trades (electrical, plumbing, HVAC), IT services & agency and Professional services, **when** I pick India and Interior design and load, **then** the dashboard shows an Indian interior design business in rupees, and its tax country, currency, financial year and industry template are India's and Interior design's.
- **Given** any country and industry except the default (Riverstone Builders keeps its data, US-ONB-09), **when** it's loaded, **then** there's about six months of history ending today: invoices issued across those months in date order, payments after their invoices, at least one overdue invoice, bills, approved and waiting expenses, quotes in several states, leads and meetings; every report renders figures and the Trial Balance balances.
- **Given** my business has records of its own, **when** I open Settings › Data › "Load demo data", **then** Country is my tax country and can't be changed ("Demo data uses your business's country: India (GST)."), only Industry can be picked, and loading changes none of my settings.
- **Given** demo data is loaded, **when** I open Settings › Data, **then** it says which ("Tarang Interiors · India (GST) · Interior design & fit-out") and offers only "Delete all demo data".
- **Given** the API, **when** demo data is loaded for another country while the business has records of its own, **then** it answers 409 `DEMO_COUNTRY_LOCKED`; when demo data is already loaded, 409 `DEMO_DATA_LOADED` ("Demo data is already loaded. Delete it first to load another demo business.").
- **Given** `POST /demo-data/seed` without a body, **when** it runs, **then** it loads US construction (Riverstone Builders) as before.

**Implementation notes**
- API: `POST /demo-data/seed` body `{ country?, industry? }`; `GET /demo-data/status` → `{ hasDemoData, loaded: { country, industry, businessName } | null, country: DemoCountry | null, countryLocked }`. Owner-only, as before (US-OPS-20).
- Shared: `packages/shared/src/demo/` — `DEMO_COUNTRIES`, `DEMO_INDUSTRIES`, the country packs (`countries.ts`), the industry packs (`industries/`) on a shared six-month timeline (`scenario.ts`), Riverstone (`riverstone.ts`), `guessDemoCountry(timeZone)` and `buildDemoPlan(country, industry)`, whose days are relative to today. The API's `DemoSeederService` runs a plan through the real services, every dated step in date order.
- UI: `DemoBusinessDialog`, used by `WelcomeStep` and `SettingsDemoData`.
- Edge: the business profile, logo and GST registration are only set when empty; demo users are the same two people for every demo.

### US-ONB-19 · Explore an Indian GST business
**Feature:** F-ONB-04 · **Priority:** P1 · **Phase:** 9 · **Screens:** `OnbWelcome`
**As** an evaluator in India, **I want** the demo to show real GST work, **so that** I can judge invoices, GSTR-1 and the Tax Summary before entering my own.

Decision: D-192

**Acceptance criteria**
- **Given** India with any industry, **when** it's loaded, **then** the business is in Bengaluru, Karnataka (29), with a valid GSTIN, legal and trade name, monthly returns, "We export under LUT" on, INR in `en-IN` (₹1,00,000.00), a financial year from April and a UPI ID that pays no one.
- **Given** its contacts, **then** they include registered businesses in Karnataka and in another state, consumers, an SEZ unit, an overseas client where the industry exports, registered vendors and one unregistered vendor, each with GST treatment, GSTIN where registered, and a billing address with its state.
- **Given** its catalogue, **then** every item has an HSN or SAC code and its intra-state GST group and inter-state IGST rate at the current slabs.
- **Given** its invoices, **then** each has the place of supply and tax the app itself would choose: CGST + SGST within Karnataka, IGST to other states and SEZ units with payment of tax, and zero-rated exports and SEZ supplies under LUT.
- **Given** GSTR-1 for the current month and the one before, **when** I review it, **then** B2B (with an SEZ invoice), B2CS, CDNR and the HSN summary have rows in at least one month, B2CL has an invoice above ₹1,00,000, EXP has an export where the industry exports, US-TAX-17 lists no problems, and the totals equal the Tax Summary.
- **Given** its bills, **then** input GST from registered Karnataka and out-of-state vendors shows on the Tax Summary's paid side, and the unregistered vendor's bill has none.

**Implementation notes**
- Content: India's prices (in rupees), HSN/SAC codes and GST slabs are written by hand on every item and typed line of each industry pack (`in: { price, hsnSac, slab }`), checked against the slabs from 22 September 2025; its contacts, GST treatments and PANs are in `countries.ts`. The second SEZ invoice is zero-rated by hand (under LUT); the voided invoice is raised and voided the same day, so this month's GSTR-1 and Tax Summary agree.
- Edge: India's demos don't release retention until [Q-21](../prd/13-risks-open-questions.md) is answered.
- Edge: the business isn't in a union territory, so UTGST isn't shown.

### US-ONB-20 · Start from a template for my industry
**Feature:** F-ONB-03 · **Priority:** P1 · **Phase:** 9 · **Screens:** `OnbIndustryTemplate`, `ExpenseCategoriesConstruction`, `SettingsModules`
**As** the owner of an interior design firm, a trade business, an IT agency or a professional practice, **I want** a template for my kind of work, **so that** my cost categories and modules fit from day one.

Decision: D-193

**Acceptance criteria**
- **Given** the Template step or Settings › Industry template, **when** I view it, **then** it lists Construction / Contracting, Interior design & fit-out, Trades (electrical, plumbing, HVAC), IT services & agency, Professional services, General Services and Generic, each with a line saying what it sets up.
- **Given** I choose Interior design & fit-out, Trades, IT services & agency or Professional services, **when** it saves, **then** its accounts and expense categories exist (D-193), and Expenses › Categories says "Set up by the <template> template: …".
- **Given** an account code or category name that already exists, **when** the template is applied, **then** it's kept and listed as kept, and applying the template twice creates nothing the second time.
- **Given** Professional services on a business that has never saved its modules, **when** I continue, **then** Jobs & field is off and the step says "Jobs are switched off — turn them on in Settings › Modules if you need them."; the other new templates start with every module on.

**Implementation notes**
- Shared: `INDUSTRY_TEMPLATES` (label, description, accounts, categories) in `schemas/industry-template.ts`; `templateModules` turns jobs off for Generic and Professional services.
- API: `IndustryTemplateService.seedTemplate(tx, orgId, template)` replaces `seedConstruction` for every template that has accounts or categories; `PUT /org/settings/industry_template` returns `seeded` for each of them.

### US-ONB-21 · Explore a VAT or GST business in my country
**Feature:** F-ONB-04 · **Priority:** P2 · **Phase:** 9 · **Screens:** `OnbWelcome`
**As** an evaluator in the UK, Australia, New Zealand, the UAE or Saudi Arabia, **I want** a demo in my currency and tax, **so that** what I see matches how I'd use Spine.

Decision: D-192

**Acceptance criteria**
- **Given** the United Kingdom, Australia, New Zealand, the UAE or Saudi Arabia with any industry, **when** it's loaded, **then** the business, contacts and addresses are local, amounts are in GBP, AUD, NZD, AED or SAR at local price levels, and the country's preset rates are set up.
- **Given** its invoices and bills, **then** lines carry the standard rate, plus a zero-rated or exempt line wherever the industry has one, and the Tax Summary shows them by rate and class.
- **Given** the United Kingdom, **when** I open an invoice PDF, **then** it's titled "VAT invoice".

**Implementation notes**
- Content: each industry pack localised by the country pack (names, addresses, phone formats, price scale rounded to whole local units, tax roles mapped to preset rates).

### US-ONB-22 · Set up my business in four short stages with a live preview
**Feature:** F-ONB-07 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `OnbStart`, `OnbStartDark`, `OnbStageBusiness`, `OnbStageMoney`, `OnbStageDocuments`, `OnbStageBooks`, `OnbStageDark`, `OnbNarrow`
**As** a new owner, **I want** setup to feel short and show me what my answers do, **so that** I finish it instead of skipping it.

Decision: D-208

**Acceptance criteria**
- **Given** I land on `/onboarding`, **when** it opens, **then** one side shows:
  - "Welcome to Spine, <first name>";
  - "Four short stages, about 6 minutes. Skip anything — it's all in Settings later.";
  - the four stages, each with one line: **Business** "Your name, logo and kind of work", **Money** "Currency, financial year and tax", **Documents** "How your quotes and invoices are numbered", **Books & team** "Your accounts and the people you work with";
  - "Set up my business", "Just show me around (use defaults)" and "Skip to dashboard" (US-ONB-01, US-ONB-02, US-ONB-18).

  The other side shows Spine's own screens drawn small (dashboard, an invoice, the phone app) with placeholder lines instead of names and amounts, and the people from the signed-out pages (D-207).
- **Given** I choose "Set up my business", **when** a step shows, **then** a rail lists the four stages with their steps (Business: Details, Template · Money: Currency, Financial year, Tax · Documents: Numbering · Books & team: Accounts, Team). Done steps are ticked, the current step is marked, and under it "About <n> min left" counts down as steps are done.
- **Given** any step, **when** I look under the form, **then** a tip says why it matters and where to change it later, e.g. "Spine uses one currency for everything. The locale decides how dates and numbers look." · "Change it later in Settings › Currency & locale.".
- **Given** the Business, Money or Documents stage, **when** I type or pick, **then** a preview beside the form shows the start of my first invoice and updates before I save: my logo, business name and address; the date and an example amount in my currency and locale; my tax name and rate on a line; and the invoice number my numbering will give (e.g. "INV-0001"). Until I've typed a name it says "Your business".
- **Given** the Books & team stage, **when** it shows, **then** the preview turns to "Your books": the account groups with how many accounts each has, and "Your team" with everyone I've invited and their role.
- **Given** any step after the first, **when** I press "Back" (above the step, beside where I am), **then** the previous step opens with what I saved.
- **Given** a window narrower than 1280 px, **when** a step shows, **then** the preview is left out; below 1024 px the rail becomes a bar at the top ("Stage 2 of 4 · Money · About 4 min left") with a progress line.
- **Given** a screen reader, **when** it reads a step, **then** it hears where it is ("Stage 2 of 4 · Money · Step 1 of 3"), the step's heading, the form and the tip; the rail is a "Setup steps" list with the current step marked and done steps read as "(done)"; it skips the preview and the drawn screens.
- **Given** Reduce Motion, **when** steps change, **then** nothing slides; the preview changes without animating.

**Implementation notes**
- UI: `apps/web/src/app/onboarding/page.tsx` gets a new shell (`OnboardingShell`: rail, step area, tip, preview); the step components stay and keep their labels ("Continue", "Skip to dashboard"). Each step that feeds the preview (Business, Currency, Tax country, Default tax rate, Numbering) gains an optional `onChange(value)`, so the preview sees unsaved input. `OnboardingPreview` formats money with `formatMoney` and the number with `formatDocumentNumber` (both `@spine/shared`; the numbering service uses the same one), so those can't disagree with the real invoice; the date is shown in the chosen locale, as on the web's screens. A preset country's tax line is its usual rate (India's 18% as CGST 9% + SGST 9%, otherwise the highest standard rate).
- Data: no new API. The preview reads the saved settings each step already loads (`business_profile`, `currency`, `/org/tax/profile`, `/org/numbering`, `/org/accounts`) plus invitations sent in this session.
- Content: stages, steps, minutes and tips live in one list (`ONBOARDING_STAGES`) in the web app.
- Edge: Tax's GST details (India) and "Default tax rate" (another country) are part of the Tax step, so they don't change the count of steps.

### US-ONB-23 · Finish setup on a screen that shows what's next
**Feature:** F-ONB-07 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `OnbFinish`, `OnbFinishDark`
**As** a new owner, **I want** to see that setup is done and what to do first, **so that** I start working straight away.

Decision: D-208

**Acceptance criteria**
- **Given** the Team step, **when** I press "Finish" or "Skip — finish setup", **then** onboarding is marked finished and a finish screen shows "You're set up" and "Spine is ready for <business name>." (or "Spine is ready." without a name).
- **Given** the finish screen, **when** it shows, **then** it lists what I set, each with a "Change" link to its Settings pane: Business (name), Money (currency and tax), Documents (first invoice number), Team ("2 invites sent" or "Just you for now").
- **Given** the finish screen, **when** I look for what's next, **then** three cards link to "Add your first customer", "Add something you sell" and "Send your first quote", and a line "See what's left to set up — <n> left" opens the Set up Spine page (US-ONB-15).
- **Given** the finish screen, **when** I press "Go to dashboard", **then** I land on the dashboard; refreshing the finish screen also goes there, since onboarding is finished.
- **Given** I skipped setup or loaded a demo business, **when** I leave onboarding, **then** I go straight to the dashboard, without the finish screen (US-ONB-02, US-ONB-18).
- **Given** Reduce Motion, **when** the finish screen opens, **then** its tick and people show still.

**Implementation notes**
- UI: `/onboarding` checks `onboarding_status` when it opens and sends a finished or skipped onboarding to the dashboard (US-ONB-01). A `done` state (`FinishStep`) is shown after `PUT /org/settings/onboarding_status { completedAt }` succeeds. The "<n> left" comes from `GET /org/setup-status` with `setupProgress` (`@spine/shared`); if that call fails, the line reads "See what's left to set up".
- Links: customer → `/contacts/new`, catalogue → `/catalog`, quote → `/quotes/new`; "Change" opens Settings at the matching pane.

### US-ONB-24 · Explore a pipeline that's being worked
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`PipelineBoard`, `LeadDrawer` with demo data)
**As** an evaluator, **I want** the demo's pipeline to look like one a team is working, **so that** the board's owners, ages, nudges and history show what they're for.

Decision: D-216

**Acceptance criteria**
- **Given** any demo (Riverstone Builders included), **when** it's loaded, **then** its open leads belong to the owner who loaded it and to Sarah Mendes (the demo Staff person), so cards show both and the Owner filter narrows to each; won and lost leads are the owner's.
- **Given** the board, **when** it shows, **then** open leads have been in their stage for different lengths of time (from a few days to about three weeks), each has an expected close date in the next two months, and exactly one says "No activity for 14 days".
- **Given** the lost lead, **when** I open it, **then** it says why it was lost ("Price") with a note.
- **Given** any lead's drawer, **when** I look at its history, **then** it shows when it was created and each stage it moved through, with who and when, ending in its current stage.
- **Given** the strip above the board, **when** it shows, **then** "Won this month" and "Win rate" count the demo's won and lost leads (the won lead closed within the last 30 days).

**Implementation notes**
- Shared: each plan lead gains `owner` ("owner" | "staff"), `daysInStage`, `expectedCloseInDays`, `lostReason` and `lostNote`; `cold` marks the one lead with no activity for 14 days.
- API: `DemoSeederService` creates the demo people before the contacts; it writes `stage_changed_at`, `updated_at`, `expected_close_date`, `lost_reason` and `lost_note`, and the lead's audit trail (created, then one `stageId` change per stage, dated) as the app would have.

### US-ONB-25 · Explore quotes at every stage
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`QuotesListRefined`, `QuoteDetailRefined`, `QuoteDetailAcceptedRefined` with demo data)
**As** an evaluator, **I want** the demo's quotes to be at every stage, **so that** the cards, countdowns, views and panels have something to show.

Decision: D-216

**Acceptance criteria**
- **Given** any demo, **when** it's loaded, **then** every quote has a title.
- **Given** the quotes list, **when** it shows, **then** sent quotes were sent on different days over the last few weeks; one sent quote expires within 7 days and one has expired.
- **Given** a sent quote, **when** the customer has looked at it, **then** the list shows "Viewed 2×" (or more) with the last view on a recent day; at least one sent quote hasn't been viewed.
- **Given** the cards, **when** they show, **then** one quote was accepted this month (for the customer whose lead is won) and one declined with a comment (for the customer whose lead is lost), so "Won this month" and "Win rate" have figures.
- **Given** the newest job, **when** I open it, **then** it says "From QUO-…": it was made from an accepted quote for its contract, whose Related panel lists the job and whose Activity says "Converted to a job".
- **Given** a quote for a customer with a lead, **when** I open it, **then** its Related panel shows the lead.

**Implementation notes**
- Shared: each plan quote gains `title`, `sentInDays`, `views` (count and last view), `respondedInDays` and `comment`; `outcome` gains "accepted" and "declined"; a job's `fromQuote` adds its contract quote (one lump-sum line at the contract value, with the job's milestone tax).
- API: sent through `QuotesService.send` and answered through the customer link (`PublicQuotesService.accept`/`reject`), then their send, view and answer dates and audit rows are set to the plan's days; views are `quote_events` rows. The job is created with the quote as its source (`JobsService.create`'s `sourceQuoteId`), so its contract value stays the plan's.

### US-ONB-26 · Explore jobs that need something
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`JobsListRefined`, `JobDetailRefined`, `JobDetailCompleted` with demo data)
**As** an evaluator, **I want** the demo's jobs to need billing, watching and closing, **so that** the Jobs cards, next steps and figures show what they do.

Decision: D-216

**Acceptance criteria**
- **Given** any demo with jobs, **when** it's loaded, **then** every job has an end date, the finished job's in the past.
- **Given** the job in progress, **when** I look at it, **then** a completed milestone hasn't been invoiced yet: "Ready to bill" counts it and the job's next step is "Invoice <milestone>".
- **Given** the jobs, **when** they show, **then** each has a cost budget and the newest is near it ("Over or near budget" shows 1 for people who can see job profitability), and one job has a % complete estimate.
- **Given** the finished job, **when** I open it, **then** its status is Completed; where the demo releases retention it's released, and otherwise (India, Q-21) it's held and "Release retention" is the next step.
- **Given** a customer with a job, **when** I start a new job for them, **then** the drawer fills in their site address.

**Implementation notes**
- Shared: each plan job gains `endInDays`, `budget` ("near" or a share of the contract), `percentComplete` and `status`; a milestone gains `completeInDays` (completed, not invoiced).
- API: the near budget is set after the timeline from the job's journal-line cost, so it's near whatever the costs come to; customers with a job get a "site" address, the job's site.

### US-ONB-27 · Explore a catalogue and calendar that look kept
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`CatalogueRefined`, `MeetingsCalendar` with demo data)
**As** an evaluator, **I want** the demo's catalogue and calendar to look like a business's, **so that** bundles, income accounts and the calendar's lists aren't empty.

Decision: D-216

**Acceptance criteria**
- **Given** any demo, **when** it's loaded, **then** goods (materials, fixtures, hardware) post to 4000 Sales — Goods, so "No income account" counts only the services, which post to 4100 (a professional practice sells only services).
- **Given** the catalogue, **when** I open Bundles, **then** the demo has two bundles made from its items, offered in a quote's line picker.
- **Given** the calendar, **when** it opens, **then** meetings start at different times of day, at least three fall in the next two weeks (one tomorrow), and the mini calendar and "Upcoming" show them.

**Implementation notes**
- Shared: items gain `income` ("goods" | "services"); a plan gains `bundles` (name, description, item keys and quantities); meetings gain `startTime` ("14:30").
- API: bundles through `CatalogBundlesService.create` with `items`; meetings at the plan's local time.

### US-ONB-28 · Explore invoices at every stage
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`InvoicesListRefined`, `InvoiceDetailRefined` with demo data)
**As** an evaluator, **I want** the demo's invoices to be due, late, chased and paid, **so that** the invoice cards and Activity show what they do.

Decision: D-216, D-217

**Acceptance criteria**
- **Given** any demo, **when** it's loaded, **then** every issued invoice has a due date (from its plan or the business's 30-day terms), at least one is due within 7 days and at least one is overdue.
- **Given** the demo's invoices, **when** I open one that was emailed and one that was reminded, **then** their Activity shows "Emailed to …" and "Reminder sent" on their own days.

**Implementation notes**
- Shared: plan invoices gain `emailedInDays` and `remindedInDays`; Riverstone's deposit invoice is due in 5 days.

### US-ONB-29 · Explore credit notes at every stage
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`CreditNotesListRefined`, `CreditNoteDetailRefined` with demo data)
**As** an evaluator, **I want** the demo's credit notes to show where credit goes, **so that** the cards and "Where it went" show what they do.

Decision: D-216, D-219

**Acceptance criteria**
- **Given** an industry demo, **when** it's loaded, **then** it has three credit notes, each crediting invoice lines with their tax and dated this month on their own days: one only off its invoice, one on a paid invoice whose spare credit was partly applied to the customer's overdue invoice (the rest still to use), and one whose spare credit was refunded.
- **Given** Riverstone Builders, **when** it's loaded, **then** it has one credit note off its invoice and two on the paid kitchen invoice — one whose credit is kept to use and one refunded (its customers have no other open invoice to apply credit to).
- **Given** a GST demo, **when** I open the Tax Summary or GSTR-1, **then** the credit notes' CGST/SGST (or IGST) reduce the tax owed.

**Implementation notes**
- Shared: plan credit notes gain `issuedInDays`, `applyInDays` and `refundInDays`; credit notes are seeded through `CreditNotesService` with `invoiceLineId` (issued and applied on the plan's day), refunds through `CustomerRefundsService`. A refund of a demo credit note's credit is demo money: its entry is flagged demo, and deleting the demo removes it and any applied credit with the credit note.

### US-ONB-30 · Explore bills and vendor credits at every stage
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`VendorBillsListRefined`, `VendorBillPage`, `VendorCreditsListRefined`, `VendorCreditPage`, `RecurringBillsList` with demo data)
**As** an evaluator, **I want** the demo's bills and vendor credits to be at every stage, **so that** the cards, states and Activity on Vendor bills and Vendor credits show what they do.

Decision: D-216, D-225, D-226

**Acceptance criteria**
- **Given** an industry demo, **when** it's loaded, **then** its bills cover every state: one paid, one overdue, one partly paid and due within 7 days (on a job), one void with its reason, and two drafts — so every Vendor bills card has something in it and "Record (2)" shows.
- **Given** an industry demo, **when** it's loaded, **then** it has four vendor credits, each on its own day with its Activity on those days: one raised against the overdue bill and partly applied to it (Partly used), one open and dated about 70 days ago (Unused 60+ days), one used up by a refund from the vendor (Refunds shows it), and one draft. The overdue bill shows "Apply credit" and its Credits applied.
- **Given** Riverstone Builders, **when** it's loaded, **then** one bill is partly paid and due within 7 days, it has a second draft bill, and it has two vendor credits — one partly used against the overdue bill and one draft.
- **Given** any demo, **when** it's loaded, **then** "Recurring bills" has one active monthly schedule for a vendor, with its next run date.
- **Given** "Delete all demo data", **when** it runs, **then** the demo vendor credits, their applications and refunds, and the demo recurring bill go with the rest, and the bills a demo schedule created count as demo too.

**Implementation notes**
- Data: `vendor_credits.is_demo`, `vendor_refunds.is_demo` and `recurring_bills.is_demo` (`boolean default false`, migration `0115`), set by the demo for what it loads — a credit or schedule a person records for a demo vendor stays theirs and keeps that vendor (D-191 (5)); a refund takes its credit's flag; the ledger treats a demo credit's entries, and its refunds', as demo; a demo schedule is for a demo vendor, so its runs create demo bills.
- Shared: plan bills gain partial `payments[].amount`; plans gain `vendorCredits` (`billKey?`, `dateInDays`, `outcome: draft | open`, `applyInDays?`, `applyAmount?`, `refundInDays?`) and `recurringBills`. Credits are seeded through `VendorCreditsService` (record, apply, refund) and the schedule through `RecurringBillsService`, with their audit entries on the plan's days.

### US-ONB-31 · Explore expenses with their receipts
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`ExpensesListRefined`, `ExpensePage`, `ExpenseRejectedResubmit` with demo data)
**As** an evaluator, **I want** the demo's expenses to come with their receipts and read on their own days, **so that** an expense's page shows the receipt beside what was claimed, and its Activity, the way it will for real ones.

Decision: D-216, D-227

**Acceptance criteria**
- **Given** an industry demo, **when** it's loaded, **then** each of its five expenses (approved, waiting and rejected) has a receipt: a till-roll PDF from a shop that fits what it was for (a café for a lunch, a fuel station for fuel, a hire company for hire), in the business's town, with the date, what was bought, the tax inside the amount and the total, in the demo's currency and formats.
- **Given** Riverstone Builders, **when** it's loaded, **then** four of its expenses have a receipt and "Fuel — no receipt attached" still has none.
- **Given** a demo expense, **when** I open its page, **then** the receipt previews beside the details and opens full size; it's served only through the expense's own checks, like any upload.
- **Given** a demo expense, **when** I look at its Activity, **then** it was submitted on its date and approved or rejected the day after (never later than today), not all at the moment the demo loaded.
- **Given** "Delete all demo data", **when** it runs, **then** the demo's receipts go with its expenses.
- **Given** no file storage is set up, **when** the demo loads, **then** the expenses load without receipts and nothing fails.

**Implementation notes**
- Shared: plan expenses gain `receipt?: { merchant, place }`; industry plans pick the merchant from the category and description (`receiptMerchant`) and the place from the country's business town.
- API: the seeder prints each receipt with `@react-pdf` (`demo-receipt.tsx`, 80 mm wide, light) and stores it through `FilesService.upload` before creating the expense with `receiptFileId`; the created, approved and rejected audit entries and `approvedAt` / `rejectedAt` are set to the plan's days. Deleting the demo removes each deleted demo expense's receipt once nothing else points at it (`FilesService.deleteStored`).

### US-ONB-32 · Explore expense categories that guide
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`ExpenseCategoriesRefined`, `ExpenseFormCategoryHint` with demo data)
**As** an evaluator, **I want** the demo's categories to say what they're for and carry their usual tax, **so that** the Categories table and the expense form show what they do.

Decision: D-129, D-216, D-228

**Acceptance criteria**
- **Given** an industry template, **when** it seeds its categories (US-ONB-13), **then** each comes with its "What it's for" line ("Diesel, petrol, tolls and parking for site vehicles"); a category the business already had keeps its own line.
- **Given** an industry demo loaded into a business without records of its own, in a country whose demo expenses carry a single tax rate (the VAT and GST countries other than India), **when** it's loaded, **then** the template's goods categories default to that rate. India's GST splits by state and Riverstone's expenses carry no tax, so their categories keep no default. A business with records of its own keeps its categories as they are.
- **Given** any demo, **when** Expenses › Categories opens, **then** the table shows counts and this month's approved amounts from the demo's expenses.
- **Given** any demo, **when** it's loaded, **then** it adds one category no expense uses, archived ("Client entertainment"), so the Archived filter shows something.
- **Given** "Delete all demo data", **when** it runs, **then** the category the demo added goes, and the defaults it set are cleared; the template's categories stay, as before.

**Implementation notes**
- Shared: template categories gain `description`; plans gain `categoryTaxDefault` (the country's expense rate, where there is one) and `archivedCategory`; template categories gain `goods`.
- API: the seeder sets the defaults and adds the archived category through `ExpenseCategoriesService`, recording what it did in the demo setting (`createdCategoryIds`, `defaultedCategoryIds`) so deleting the demo undoes exactly that.

### US-ONB-33 · Explore vendor payments and payables you can pay from
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`VendorPaymentsListRefined`, `VendorPaymentPage`, `PayablesByVendor`, `PayablesByBill`, `PayablesDueThisWeek` with demo data)
**As** an evaluator, **I want** the demo's bills to owe at every age and its payments to look like real ones, **so that** Payables and Vendor payments show what they do.

Decision: D-216, D-229, D-230

**Acceptance criteria**
- **Given** an industry demo, **when** it's loaded, **then** Payables has open bills in every age but one: Current and due within 7 days (the part-paid bill), 1–30 days (the overdue bill with credit applied), 31–60 days (on a job) and 90+ days. The 90+ bill is from the vendor who has the part-paid bill, so that vendor has two open bills to expand and to pay together with "Pay (2)"; 61–90 days stays empty, so pressing it says "Nothing 61–90 days late.".
- **Given** an industry demo, **when** it's loaded, **then** one vendor payment pays two bills from the same vendor in full in one go, about five weeks ago — its row's "Bills paid" names both and its page lists both under "Paid to".
- **Given** an industry demo, **when** it's loaded, **then** its payments read like real ones: by bank transfer with a reference, by cheque with the cheque number, and in cash to the sole trader; spread over the last four months, the newest a few days ago.
- **Given** the payment that pays two bills, **when** its page opens, **then** its Activity reads "Remittance advice emailed to <the vendor's address>" on the day after it was recorded. Nothing is sent.
- **Given** Riverstone Builders, **when** it's loaded, **then** Apex Timber (which has the part-paid bill) also has a bill 90+ days late, Granite State has a second bill 31–60 days late, and its payment has a method and a reference.
- **Given** "Delete all demo data", **when** it runs, **then** the new bills and payments go with the rest, as before.

**Implementation notes**
- Shared: `BILL_TIMELINE` gains `bill8` (supplier, 90+ days, open), `bill9` (services, 31–60 days, open, on job b) and `bill10`/`bill11` (supplier_far, paid together); each industry pack gains their refs and lines. Plan bill payments gain `method` and `reference`; plans gain `vendorPayments` — one payment across several plan bills (`bills`, `inDays`, `method`, `reference`, `remittanceInDays?`).
- API: the seeder records the shared payment through `VendorPaymentsService` once its bills are recorded, and writes its `remittance_sent` audit entry (the vendor's address) on its day — no email is queued, as with the demo's emailed invoices.

### US-ONB-34 · Explore banking with accounts, transfers and reconciliations
**Feature:** F-ONB-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** — (`BankingAccountsRefined`, `AccountRegisterRefined`, `ReconcileRefined`, `ReconciliationReport` with demo data)
**As** an evaluator, **I want** the demo's banking to have a card, transfers, money in and out, an imported statement and reconciliations, **so that** Banking shows what it does.

Decision: D-216, D-231

**Acceptance criteria**
- **Given** any demo, **when** it's loaded, **then** Banking has a credit card account ("Business card", ••4410) with spending on it (a software subscription as money out) and a payoff from the bank account as a transfer, and a transfer from the bank account to cash ("Petty cash top-up").
- **Given** any demo, **when** it's loaded, **then** the bank account has money in (interest) and money out (bank charges) entries on their days.
- **Given** any demo, **when** it's loaded, **then** the bank account has a statement imported for last month and this month, with a balance column: last month is reconciled (finished by the owner on the 3rd), and this month is in progress — some lines matched, some with a suggested match, and one bank charge line not yet in Spine to Create or exclude.
- **Given** "Delete all demo data", **when** it runs, **then** the card account, the transfers, the money in and out, the statement and both reconciliations go with the rest.

**Implementation notes**
- Data: `is_demo` on `money_accounts`, `bank_transactions`, `bank_transfers`, `bank_statement_imports` and `bank_reconciliations` (migration), set by the demo; the ledger treats their entries as demo.
- API: the seeder adds the card through `MoneyAccountsService`, records the entries through `BankTransactionsService` and `BankTransfersService`, imports the statement through `StatementImportsService` (lines made from the demo's own bank entries, plus a bank charge) and reconciles last month through `ReconciliationsService` — each on its day.
