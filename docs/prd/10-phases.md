# 10 · Phases

Phases 0–4 and 6–7 are built; Phase 5 is in progress; Phases 8–10 follow ([D-098](12-decisions.md) split the original Phase 6 into fix, upgrades and 1.0; [D-133](12-decisions.md) added Books completeness and Tax, documents and setup before 1.0). Work planned after 1.0 is in [16-roadmap](16-roadmap.md). Progress per story is in [progress.md](../progress.md). Every story appears exactly once, under the phase it ships in. A story that depends on a later phase says "hidden until phase N ships".

| Phase | Name | Stories | Milestone |
|---|---|---|---|
| 0 | Foundation | 36 | Install, first Owner, onboarding, users/Teams/permissions, profile, numbering, audit, ledger core, `@spine/ui` |
| 1 | Sales spine | 53 | Quote a customer; they accept by link; the office is notified |
| 2 | Money in | 22 | Quote → invoice → partial payment with a balanced trial balance |
| 3 | Jobs & construction billing | 15 | A full contract lifecycle reconciles |
| 4 | Money out & books | 62 | A simulated quarter produces accountant-acceptable reports |
| 5 | Mobile field companion | 25 | The app works end-to-end in airplane mode and syncs without duplicates |
| 6 | Fix and harden | 47 | Everything already built is correct, secure and consistent |
| 7 | Product upgrades | 35 | An owner runs the business from the dashboard and gets paid without chasing |
| 8 | Books completeness | 55 | An accountant migrates a business in, reconciles the bank and closes a year in Spine |
| 9 | Tax, documents and setup | 26 | An Indian business issues GST invoices, uploads GSTR-1 and hands its books to a Tally accountant |
| 10 | Packaging & 1.0 | 32 | A stranger installs from the README and issues their first invoice |

Total: 408 stories.

## Phase 0 · Foundation

**Goal:** Install, first Owner, onboarding, users/Teams/permissions, profile, numbering, audit, ledger core, `@spine/ui`.

**Deliverables:** Monorepo, Docker Compose, Postgres + Drizzle migrations, Better Auth, onboarding wizard, Primary Owner + multi-Owner, Teams with a privilege matrix, Profile & Preferences, numbering sequences, audit log, ledger core with chart-of-accounts seed, shared money and tax packages, CI, the complete `@spine/ui` library with dark/light mode and a doc app.

**Done when:**
- A user installs with Docker, signs up (becoming Primary Owner) and completes or skips the wizard.
- They invite a colleague, promote them to Owner and create a Team with a custom privilege matrix.
- The ledger accepts a balanced entry and the database rejects an unbalanced one.
- Every `@spine/ui` component has a doc page, light/dark variants and a passing axe test.

**Stories:**

*Onboarding & first run*

- US-ONB-01 · Start the setup wizard after signing up (P1)
- US-ONB-02 · Skip setup at any step (P1)
- US-ONB-03 · Enter my business details (P1)
- US-ONB-05 · Set currency, locale and financial year (P1)
- US-ONB-06 · Confirm a default tax rate and document numbering (P1)
- US-ONB-07 · Review the chart of accounts (P1)
- US-ONB-08 · Invite my team as the last step (P1)
- US-ONB-11 · Change any setup answer later (P1)

*Sign-in & account*

- US-AUTH-01 · Create the first account on a new install (P1)
- US-AUTH-02 · Log in with email and password (P1)
- US-AUTH-03 · Sign out from the user menu (P1)
- US-AUTH-04 · Accept an invitation while signed in (P1)
- US-AUTH-05 · Create my account from an invitation (P1)
- US-AUTH-06 · Edit my name, email, password and avatar (P1)
- US-AUTH-07 · Choose light, dark or system theme (P1)

*Users, teams & permissions*

- US-TEAM-01 · See everyone with access in one place (P1)
- US-TEAM-02 · Invite a teammate with a role (P1)
- US-TEAM-03 · Resend or cancel a pending invite (P2)
- US-TEAM-04 · Deactivate a user without losing their history (P2)
- US-TEAM-05 · Reactivate a user (P3)
- US-TEAM-06 · Promote a staff member to Owner (P2)
- US-TEAM-07 · Demote an owner back to staff (P2)
- US-TEAM-08 · Transfer primary ownership deliberately (P2)
- US-TEAM-09 · Create and rename Teams (P1)
- US-TEAM-10 · Put staff members on Teams (P1)
- US-TEAM-11 · Choose exactly what a Team can do (P1)
- US-TEAM-12 · Delete a Team (P3)
- US-TEAM-13 · Give staff on several Teams the union of their grants (P1)
- US-TEAM-14 · Keep Field access fixed (P1)

*Settings & administration*

- US-SET-01 · Open organisation Settings as an owner (P1)
- US-SET-02 · Search settings (P3)
- US-SET-03 · Change my business details later (P1)
- US-SET-04 · Change template, currency and financial year later (P2)
- US-SET-05 · Continue my existing document numbers (P2)
- US-SET-06 · See who changed a record and when (P2)
- US-SET-07 · Record every change to money documents (P1)

## Phase 1 · Sales spine

**Goal:** Quote a customer; they accept by link; the office is notified.

**Deliverables:** Contacts, leads, activities, meetings calendar, catalogue, quotes with versioning, PDF, email, public quote link, notification centre, dashboard setup checklist.

**Done when:**
- Staff quote a customer, the customer accepts from the emailed link, and the Owner gets an email and an in-app notification.
- Meetings can be scheduled, shared privately or org-wide, and answered by invitees.

**Stories:**

*Onboarding & first run*

- US-ONB-10 · Follow a checklist to my first transaction (P1)

*Contacts & CRM*

- US-CRM-01 · Add a customer or vendor (P1)
- US-CRM-02 · Mark a contact as both customer and vendor (P1)
- US-CRM-03 · Find contacts and switch views (P1)
- US-CRM-04 · Archive or delete a contact (P2)
- US-CRM-05 · Add the people at a company (P1)
- US-CRM-06 · Add billing, shipping and site addresses (P1)
- US-CRM-07 · See everything about a contact on one timeline (P1)
- US-CRM-08 · Log a call, meeting, note or task with a follow-up date (P1)
- US-CRM-09 · Mark a follow-up done (P1)
- US-CRM-10 · Create a lead with a value and stage (P1)
- US-CRM-11 · See the pipeline by stage with totals (P1)
- US-CRM-12 · See a contact's leads (P2)
- US-CRM-13 · Delete a lead (P2)
- US-CRM-14 · Import contacts from a spreadsheet (P2)
- US-CRM-15 · Review duplicates and failed rows after an import (P2)

*Meetings & calendar*

- US-MTG-01 · Schedule a meeting on the calendar (P1)
- US-MTG-02 · Switch calendar views and jump to a date (P1)
- US-MTG-03 · Show or hide colleagues' calendars and my activities (P2)
- US-MTG-04 · Link a meeting to a contact (P1)
- US-MTG-05 · Invite specific colleagues privately (P1)
- US-MTG-06 · Make a meeting visible to the whole organisation (P1)
- US-MTG-07 · Respond to a meeting invitation (P1)
- US-MTG-08 · Check a meeting's details in a quick view (P1)
- US-MTG-09 · Change or delete one occurrence or the whole series (P2)
- US-MTG-10 · Duplicate a meeting (P3)

*Catalogue*

- US-CAT-01 · Save a service or material with a default price (P1)
- US-CAT-02 · Map an item to income and expense accounts (P1)
- US-CAT-03 · Find items and spot missing setup (P1)
- US-CAT-04 · Archive or delete an item (P2)
- US-CAT-05 · Change a line's price without changing the catalogue (P1)

*Quotes*

- US-QUO-01 · Build a multi-line quote (P1)
- US-QUO-02 · Add section headings and text lines (P1)
- US-QUO-03 · Find quotes by status and contact (P1)
- US-QUO-04 · Delete a draft quote (P2)
- US-QUO-05 · Preview and download a branded PDF (P1)
- US-QUO-06 · Email a quote with a secure link (P1)
- US-QUO-07 · See emails waiting to go out (P3)
- US-QUO-08 · Read a quote on my phone from the link (P1)
- US-QUO-09 · Accept or decline a quote with a comment (P1)
- US-QUO-10 · Get told when a customer views or answers a quote (P1)
- US-QUO-11 · Revise a sent quote into a new version (P1)
- US-QUO-12 · Require owner approval for big discounts (P2)
- US-QUO-13 · Show quotes as expired after their validity date (P1)

*Notifications*

- US-NTF-01 · See recent notifications from the bell (P1)
- US-NTF-02 · Mark notifications as read everywhere (P2)
- US-NTF-03 · Only get notifications about things I can see (P1)
- US-NTF-04 · Turn on browser notifications for this device (P2)
- US-NTF-05 · Get a push notification when the tab is closed (P2)
- US-NTF-06 · Be told when I'm invited to, removed from or uninvited from a meeting (P2)
- US-NTF-07 · Notify the right people about job and expense events (P3)
- US-NTF-08 · Get a reminder before a meeting starts (P2)
- US-NTF-09 · Set the reminder lead time for the org and for myself (P2)

## Phase 2 · Money in

**Goal:** Quote → invoice → partial payment with a balanced trial balance.

**Deliverables:** Invoices (draft → issue → void), advance invoices, credit notes, payments with multi-invoice allocation, customer credit, receipts, AR aging.

**Done when:**
- Quote → invoice → partial payment → balance, with a balanced trial balance at every step.

**Stories:**

*Quotes*

- US-QUO-14 · Turn an accepted quote into an invoice (P1)

*Invoicing & credit notes*

- US-INV-01 · Create an invoice from scratch (P1)
- US-INV-02 · Edit a draft invoice freely (P1)
- US-INV-03 · Issue an invoice to lock it and number it (P1)
- US-INV-04 · Find invoices and see which are overdue (P1)
- US-INV-05 · Delete a draft invoice (P2)
- US-INV-06 · Void an issued invoice with a reason (P1)
- US-INV-07 · Raise an advance (deposit) invoice (P1)
- US-INV-08 · Offset a deposit against a later invoice (P1)
- US-INV-09 · Issue a credit note against an invoice (P1)
- US-INV-10 · See all credit notes (P2)
- US-INV-11 · Email an invoice as a PDF (P1)
- US-INV-12 · Send a payment reminder in one click (P1)

*Payments & receivables*

- US-PAY-01 · Record a payment against an invoice (P1)
- US-PAY-02 · Split one payment across several invoices (P1)
- US-PAY-03 · Record a part-payment and see what's left (P1)
- US-PAY-04 · Find payments and open one (P1)
- US-PAY-05 · Hold a payment as customer credit (P1)
- US-PAY-06 · Delete a payment recorded by mistake (P2)
- US-PAY-07 · Give the customer a receipt (P2)
- US-PAY-08 · Tell the office when a payment arrives (P3)
- US-PAY-09 · See who owes what and for how long (P1)

## Phase 3 · Jobs & construction billing

**Goal:** A full contract lifecycle reconciles.

**Deliverables:** Jobs from quotes, milestones with validation, progress invoicing, advance offset, retention hold and release, variation orders, site photos and notes; the Construction template's effect.

**Done when:**
- Advance, three progress bills, retention held and released reconcile to the correct final position.

**Stories:**

*Onboarding & first run*

- US-ONB-04 · Pick an industry template (P1)

*Quotes*

- US-QUO-15 · Turn an accepted quote into a job (P1)
- US-QUO-16 · Warn before converting the same quote twice (P2)

*Jobs & milestones*

- US-JOB-01 · See all jobs and their status (P1)
- US-JOB-02 · Edit a job's details (P1)
- US-JOB-03 · Define billing milestones as percentages or fixed amounts (P1)
- US-JOB-04 · Stop me if milestone percentages don't add up (P1)
- US-JOB-05 · Mark a milestone complete with photos and notes (P1)
- US-JOB-06 · Raise a progress invoice from a completed milestone (P1)
- US-JOB-07 · Hold retention on each progress invoice automatically (P1)
- US-JOB-08 · Release retention as a final invoice (P2)
- US-JOB-09 · Raise a variation order for a scope change (P2)
- US-JOB-10 · Apply an accepted variation order to the job (P2)
- US-JOB-11 · Upload site photos to a job (P2)
- US-JOB-12 · Add notes to a job (P2)

## Phase 4 · Money out & books

**Goal:** A simulated quarter produces accountant-acceptable reports.

**Deliverables:** Vendor bills, expenses with approval, billable expenses, vendor payments, AP aging, tax rates and groups, P&L, Balance Sheet, job profitability, drill-down, CSV, period close, dashboard v2, own/others capability rollout across every module.

**Done when:**
- A quarter of simulated trading produces a P&L and Balance Sheet an accountant would accept.
- Every module enforces its own/others and workflow capabilities in the service layer and the web UI reflects them.

**Stories:**

*Contacts & CRM*

- US-CRM-16 · Let a Team edit only its own contacts (P1)
- US-CRM-17 · Set lead and activity rights separately from contacts (P1)
- US-CRM-18 · Control who manages a contact's people and addresses (P1)

*Meetings & calendar*

- US-MTG-11 · Let a Team manage only the meetings it organises (P1)
- US-MTG-12 · Keep meeting visibility independent of management rights (P1)

*Catalogue*

- US-CAT-07 · Let a Team edit only the items it created (P1)
- US-CAT-08 · Grant catalogue rights independently of contacts (P1)

*Quotes*

- US-QUO-17 · Let a Team edit only its own quotes (P1)
- US-QUO-18 · Grant sending and revising separately from drafting (P1)

*Jobs & milestones*

- US-JOB-13 · See a job's cost, revenue and margin as it runs (P1)
- US-JOB-14 · Count tagged bills and expenses as job cost (P1)
- US-JOB-17 · Let a Team edit only its own jobs (P1)
- US-JOB-18 · Let field crew complete any milestone (P1)

*Invoicing & credit notes*

- US-INV-13 · Let a Team edit only its own invoices and credit notes (P1)
- US-INV-14 · Grant issuing, voiding, emailing and reminders separately (P1)

*Payments & receivables*

- US-PAY-11 · Let a Team delete only payments it recorded (P1)
- US-PAY-12 · Grant applying credit and sending receipts separately (P1)

*Purchases & expenses*

- US-PUR-01 · Enter a bill from a vendor (P1)
- US-PUR-02 · Record a bill so it posts to the books (P1)
- US-PUR-03 · Find vendor bills and see what's overdue (P1)
- US-PUR-04 · Void a recorded bill with a reason (P1)
- US-PUR-05 · Pay a vendor across several bills (P1)
- US-PUR-06 · See and delete vendor payments (P2)
- US-PUR-07 · Submit an expense with a receipt (P1)
- US-PUR-08 · Approve a submitted expense (P1)
- US-PUR-09 · Reject a submitted expense with a comment (P1)
- US-PUR-10 · Edit or delete my submitted expense (P1)
- US-PUR-11 · Bill an approved expense to the customer (P2)
- US-PUR-12 · Mark an expense billed without a new invoice (P2)
- US-PUR-13 · See what we owe vendors and when (P1)
- US-PUR-15 · Manage expense categories (P2)
- US-PUR-16 · Delete an unused expense category (P3)
- US-PUR-17 · Let a Team edit only its own purchases records (P1)
- US-PUR-18 · Grant approving, rejecting, recording and voiding separately (P1)

*Tax*

- US-TAX-01 · Define my own named tax rates (P1)
- US-TAX-02 · Change or retire a tax rate safely (P1)
- US-TAX-03 · Combine rates into a group for split taxes (P1)
- US-TAX-04 · Apply a group on a line and get the right total (P1)
- US-TAX-05 · Choose whether my prices include tax (P1)
- US-TAX-06 · Override tax-inclusive pricing on one line (P1)

*Accounting & reports*

- US-RPT-01 · See profit and loss for any period (P1)
- US-RPT-02 · See what the business is worth on a date (P1)
- US-RPT-03 · Click a figure to see the entries behind it (P1)
- US-RPT-04 · Export any report to CSV (P1)
- US-RPT-05 · Compare profitability across all jobs (P1)
- US-RPT-06 · Export job profitability (P2)
- US-RPT-07 · Close a fiscal period so nobody back-dates into it (P2)
- US-RPT-08 · Reopen a closed period (P3)
- US-RPT-09 · Add my own account (P2)
- US-RPT-10 · Grant each report to Teams separately (P1)
- US-RPT-11 · Let a Team drill into the ledger (P2)

*Dashboard*

- US-DASH-01 · See cash, receivables, overdue and revenue at a glance (P1)
- US-DASH-02 · Get a dashboard that fits my role (P1)
- US-DASH-03 · See the revenue trend and pipeline by stage (P1)
- US-DASH-04 · See my overdue follow-ups (P1)
- US-DASH-05 · See upcoming meetings (P1)
- US-DASH-06 · See invoices and milestones coming due (P1)
- US-DASH-07 · See receivables aging and job winners and losers (P1)
- US-DASH-08 · See what happened recently across the business (P2)
- US-DASH-09 · Keep financial events out of the field feed (P2)
- US-DASH-10 · Reorder and hide my widgets (P3)
- US-DASH-11 · Keep my layout on every device (P3)

## Phase 5 · Mobile field companion

**Goal:** The app works end-to-end in airplane mode and syncs without duplicates.

**Deliverables:** `apps/mobile` on expo-router native tabs (iOS and Material 3 Android), sign-in to a self-hosted server, assigned jobs, offline cache, idempotent outbox, photo capture, expenses, milestone completion, on-site quote acceptance with signature, crew assignment, showcase docs.

**Done when:**
- The app is used end-to-end in airplane mode and syncs cleanly on reconnect with no duplicates (NFR-REL-06).
- Financial reports are unreachable from the phone for every role.

**Stories:**

*Quotes*

- US-QUO-19 · Store the signature from an on-site acceptance (P1)
- US-QUO-20 · Show how a quote was accepted (P1)

*Jobs & milestones*

- US-JOB-15 · Assign crew to a job (P2)
- US-JOB-16 · Show field crew only their assigned jobs (P1)

*Mobile field companion*

- US-MOB-01 · Sign in to my company's Spine on my phone (P1)
- US-MOB-02 · Stay signed in and sign out safely (P1)
- US-MOB-03 · See today's jobs with addresses and tap-to-call (P1)
- US-MOB-04 · Browse my assigned jobs (P1)
- US-MOB-05 · Open a job's details on site (P1)
- US-MOB-06 · Keep financial reports off phones (P1)
- US-MOB-07 · Keep working when there's no signal (P1)
- US-MOB-08 · See what's waiting to sync (P1)
- US-MOB-09 · Send each item exactly once and fix failures (P1)
- US-MOB-10 · Show a clear error when the server can't be reached (P2)
- US-MOB-11 · Take site photos tagged to a job, even offline (P1)
- US-MOB-12 · See my expenses and their status (P1)
- US-MOB-13 · Submit an expense with a receipt photo (P1)
- US-MOB-14 · Ask for camera access with a reason (P2)
- US-MOB-15 · Mark a milestone complete from the phone (P1)
- US-MOB-16 · Present a quote to the customer on my phone (P1)
- US-MOB-17 · Capture the customer's acceptance and signature (P1)
- US-MOB-18 · Require a connection to accept a quote (P2)
- US-MOB-19 · Run the field app on native tabs (P1)
- US-MOB-20 · Give Android users a designed Material 3 app (P1)
- US-MOB-21 · Document every native component in a showcase app (P2)

## Phase 6 · Fix and harden

**Goal:** Everything already built is correct, secure and consistent.

**Deliverables:** Fixes for QA findings C1–C27 and the Stage 5 review: Field data scope on the server, read-access gaps, idempotency on every mutation, exact decimals, deposit allocation, issued-PDF storage, retention display, milestone ownership, closed sign-up and invitation pages, password reset, branded emails, Trial Balance and Tax Summary tabs, ledger integrity check, confirmation styling, plain-language copy and consistent money formatting.

**Done when:**
- Every Stage 5 review finding is closed by a passing test or an explicit decision.
- No route lets a Field user read money or unassigned jobs (US-JOB-19, US-OPS-20).
- Every mutating route passes the idempotency introspection test (NFR-REL-07).
- The daily ledger-integrity check runs and stays green on demo data (NFR-OBS-04).

**Stories:**

*Onboarding & first run*

- US-ONB-12 · Show the setup checklist to owners only (P2)

*Sign-in & account*

- US-AUTH-08 · See that sign-up is invite-only (P2)
- US-AUTH-09 · Ask for a password reset link (P2)
- US-AUTH-10 · Choose a new password from the reset link (P2)
- US-AUTH-11 · See why an invitation can't be used (P2)
- US-AUTH-12 · Keep my unsaved work when my session expires (P2)

*Quotes*

- US-QUO-21 · Show a branded page for an expired or invalid link (P1)
- US-QUO-22 · Keep emailed links working until the quote is replaced (P1)
- US-QUO-23 · Explain a repeat conversion clearly (P2)

*Jobs & milestones*

- US-JOB-19 · Keep money and unassigned jobs away from field crew (P1)
- US-JOB-20 · Own a job's milestones through the job (P1)
- US-JOB-21 · Show retention on a progress invoice (P1)
- US-JOB-22 · Number every job (P3)
- US-JOB-23 · Name new jobs after their quote (P2)

*Invoicing & credit notes*

- US-INV-15 · Print payment instructions on invoices (P2)
- US-INV-16 · Set payment instructions in Settings (P2)
- US-INV-17 · Keep the exact PDF that was issued (P1)

*Payments & receivables*

- US-PAY-10 · Export receivables to CSV (P2)
- US-PAY-13 · Allocate a deposit payment to its advance invoice (P1)

*Purchases & expenses*

- US-PUR-14 · Export payables to CSV (P2)
- US-PUR-19 · Manage expense categories from Expenses (P2)
- US-PUR-20 · Stop staff approving their own expenses (P1)

*Tax*

- US-TAX-07 · Store rates, quantities and percentages exactly (P1)

*Accounting & reports*

- US-RPT-12 · Warn me if the books ever stop balancing (P1)
- US-RPT-13 · See a Trial Balance (P2)
- US-RPT-14 · See tax collected and paid on Reports (P1)

*Notifications*

- US-NTF-10 · Send every email in one branded layout (P2)
- US-NTF-11 · Use the branded layout for every email type (P2)
- US-NTF-12 · Turn on push from my own profile (P2)

*Users, teams & permissions*

- US-TEAM-15 · Use the business name everywhere the organisation is named (P2)
- US-TEAM-16 · Confirm before making someone an owner (P2)
- US-TEAM-17 · Protect the Primary Owner's row (P2)
- US-TEAM-18 · Show each person only the sections they can open (P1)

*Settings & administration*

- US-SET-13 · Open contact history the same way as everywhere else (P2)
- US-SET-14 · Show "Save" on setup steps reused in Settings (P2)

*Self-hosting & system states*

- US-OPS-08 · Make every mutating request safe to repeat (P1)
- US-OPS-10 · Style confirmations by what they do (P2)
- US-OPS-12 · Explain why I can't open a page (P2)
- US-OPS-20 · Close the read-access gaps found in review (P1)
- US-OPS-21 · Remove developer wording from the interface (P3)
- US-OPS-24 · Show money the same way everywhere (P1)
- US-OPS-25 · Keep text readable on coloured controls in dark mode (P1)
- US-OPS-27 · Store files on local disk by default (P1)
- US-OPS-28 · Prove stored files are intact (P1)
- US-OPS-29 · Accept only safe uploads (P1)
- US-OPS-30 · Move existing files off MinIO (P2)
- US-OPS-31 · Warn before the disk fills up (P2)

## Phase 7 · Product upgrades

**Goal:** An owner runs the business from the dashboard and gets paid without chasing.

**Deliverables:** The action-first dashboard redesign for Owner, Staff and Field (D-087), global search, automatic payment reminders, recurring invoices, customer statements, quote duplication and bundles, bulk actions, the daily digest, full data export, configurable pipeline stages, organisation themes and document branding, the organisation audit log, and construction job costing: cost budgets, cost by category, billed to date and percent complete, progress claim numbers, labour expenses by headcount × day rate, the job filter on bills and expenses, and the Construction template's cost categories (D-125–D-130).

**Done when:**
- An owner opens the dashboard and clears every attention item from it without visiting another page first.
- Reminders and recurring invoices run unattended for a simulated month with no duplicates.
- Search finds any contact, document or job by name or number in under 500 ms (NFR-PERF-06).
- On a Construction install, an owner sees a job's budget used, cost by category and billed % on its Costing tab, and a job over budget appears in "Needs your attention"; the figures match Job Profitability to the cent.

**Stories:**

*Onboarding & first run*

- US-ONB-13 · Start a construction business with site cost categories (P1)

*Contacts & CRM*

- US-CRM-19 · Rename, reorder and add pipeline stages (P2)
- US-CRM-20 · Delete a stage and move its leads (P2)

*Catalogue*

- US-CAT-06 · Add a new item while building a quote (P2)

*Quotes*

- US-QUO-24 · Duplicate a quote as a new draft (P2)
- US-QUO-25 · Save quote lines as a reusable bundle (P2)
- US-QUO-26 · Add a bundle while building a quote (P2)

*Jobs & milestones*

- US-JOB-24 · Set a cost budget for a job (P1)
- US-JOB-25 · See budget spent and get warned before going over (P1)
- US-JOB-26 · See a job's cost by category (P1)
- US-JOB-27 · See how much of the contract has been billed (P1)
- US-JOB-28 · Record how complete a job is and compare it with billing (P2)
- US-JOB-29 · Number each progress claim on a job (P2)

*Invoicing & credit notes*

- US-INV-18 · Turn on automatic payment reminders (P1)
- US-INV-19 · Send reminders on schedule without double-sending (P1)
- US-INV-20 · Set up a recurring invoice (P2)
- US-INV-21 · Create recurring invoices automatically (P2)
- US-INV-22 · Pause, edit or stop a recurring invoice (P2)
- US-INV-23 · Send reminders for several invoices at once (P2)
- US-INV-24 · Download several invoice PDFs at once (P3)

*Payments & receivables*

- US-PAY-14 · Send a customer a statement (P2)
- US-PAY-15 · Give customers a clear statement PDF (P2)

*Purchases & expenses*

- US-PUR-21 · Approve several expenses at once (P2)
- US-PUR-22 · Filter bills and expenses by job (P2)
- US-PUR-23 · Enter site labour as headcount × day rate (P1)

*Dashboard*

- US-DASH-12 · See what needs my attention first (P1)
- US-DASH-13 · Act on an attention item in one click (P1)
- US-DASH-14 · See key figures with a trend and a comparison (P1)
- US-DASH-15 · See money in and out by month (P1)
- US-DASH-16 · See today's schedule beside my tasks (P1)
- US-DASH-17 · Get a staff dashboard of only what I can act on (P1)
- US-DASH-18 · Get a field dashboard of my day (P2)
- US-DASH-19 · Read who did what in the activity feed (P2)
- US-DASH-20 · See retention held and job billing on the dashboard (P1)

*Accounting & reports*

- US-RPT-15 · Compare contract, billed and cost across jobs (P1)

*Notifications*

- US-NTF-13 · Get a daily digest by email (P2)
- US-NTF-14 · Choose when my digest arrives (P3)

*Settings & administration*

- US-SET-09 · Pick a theme for the whole organisation (P3)
- US-SET-10 · Put my brand colour and footer on documents (P3)
- US-SET-11 · See every change across the organisation (P3)
- US-SET-12 · Export the audit log (P3)
- US-SET-15 · Export all my data (P2)
- US-SET-16 · Keep data exports private (P2)

*Self-hosting & system states*

- US-OPS-22 · Search everything from anywhere (P1)
- US-OPS-23 · Use search with the keyboard and a screen reader (P2)
- US-OPS-26 · Use every new screen in dark mode (P1)
- US-OPS-32 · Lift cards off the page in light mode (P1)

## Phase 8 · Books completeness

**Goal:** An accountant migrates a business in, reconciles the bank and closes a year in Spine.

**Deliverables:** Bank, cash and card accounts with registers, transfers and other money in and out; the account picker on every payment, expense and refund; bank reconciliation from imported CSV statements; opening balances with open invoices, bills, retention and credits at a cutover date; Owner-only adjusting journals; vendor credits and vendor refunds; customer refunds and credit from credit notes; tax payments and refunds; attachments on financial records; the reports centre, general ledger, day book, cash flow, P&L comparison, sales and purchase analysis, payment and credit registers; CSV, Excel, PDF and print on every report; a cash-basis P&L; accountant access through a Team; recurring bills; catalogue import; the books cards on the dashboard (D-133–D-144, D-156–D-161).

**Done when:**
- A simulated migration — opening balances, 20 open invoices and 10 open bills at a cutover date — produces a Balance Sheet on the cutover date that matches the source trial balance to the cent, with Opening Balance Adjustments at zero.
- A month of a sample bank statement imports, matches and finishes reconciliation with a difference of zero, and every money account's balance equals the Balance Sheet.
- The trial balance balances after every new posting (P17–P27) in the ledger-integrity test, and a practising accountant has reviewed P17–P27 (Q-02).
- Every report exports to CSV, Excel and PDF with the same figures as on screen, and a member with only `reports.view_financial_statements` reads every statement but can't post or change anything.
- Cash-basis profit for a sample year equals cash received less cash paid on income and expense accounts.

**Stories:**

*Banking*

- US-BANK-01 · Add my bank, cash and card accounts (P1)
- US-BANK-02 · See every account's balance and what moved through it (P1)
- US-BANK-03 · Choose the account money went into or came out of (P1)
- US-BANK-04 · Move money between my accounts (P1)
- US-BANK-05 · Record money in or out that has no invoice or bill (P1)
- US-BANK-06 · Archive an account I no longer use (P2)
- US-BANK-07 · Import a bank statement (P1)
- US-BANK-08 · Match statement lines to what's in Spine (P1)
- US-BANK-09 · Create what's missing from a statement line (P1)
- US-BANK-10 · Finish a reconciliation when it balances (P1)
- US-BANK-11 · Review or undo a reconciliation (P2)
- US-BANK-12 · Let a Team see balances, record money and reconcile (P1)

*Catalogue*

- US-CAT-09 · Import catalogue items from a spreadsheet (P2)

*Payments & receivables*

- US-PAY-16 · Keep a credit note's extra as customer credit (P1)
- US-PAY-17 · Refund a customer (P1)
- US-PAY-18 · Let a Team refund customers (P2)

*Purchases & expenses*

- US-PUR-24 · Record a credit from a vendor (P1)
- US-PUR-25 · Apply a vendor credit to bills (P1)
- US-PUR-26 · Record a refund from a vendor (P1)
- US-PUR-27 · Void a vendor credit (P2)
- US-PUR-28 · Let a Team manage vendor credits (P1)
- US-PUR-29 · Set up a recurring bill (P2)
- US-PUR-30 · Create recurring bills automatically (P2)
- US-PUR-31 · Pause, edit or stop a recurring bill (P2)

*Tax*

- US-TAX-08 · Record paying tax and using input tax credit (P1)

*Accounting & reports*

- US-RPT-16 · Set a cutover date and enter opening account balances (P1)
- US-RPT-17 · Bring in unpaid customer invoices, retention and credit (P1)
- US-RPT-18 · Bring in unpaid vendor bills and vendor credits (P1)
- US-RPT-19 · Check and lock my opening balances (P1)
- US-RPT-20 · Post an adjusting journal (P1)
- US-RPT-21 · Reverse a journal posted by mistake (P1)
- US-RPT-22 · See every manual journal (P2)
- US-RPT-23 · Find every report in one place (P1)
- US-RPT-24 · See the general ledger (P1)
- US-RPT-25 · See the day book (P1)
- US-RPT-26 · See where cash came from and where it went (P1)
- US-RPT-27 · Compare profit and loss across periods (P1)
- US-RPT-28 · See sales by customer and by item (P1)
- US-RPT-29 · See expenses by category and purchases by vendor (P1)
- US-RPT-30 · See payments received and made in a period (P2)
- US-RPT-31 · See credit notes, vendor credits and refunds in a period (P2)
- US-RPT-32 · Export every report to CSV and Excel (P1)
- US-RPT-33 · Download any report as a PDF (P1)
- US-RPT-34 · Print any report (P2)
- US-RPT-35 · See profit and loss on a cash basis (P1)
- US-RPT-36 · Let my accountant's Team see the financial statements (P1)

*Dashboard*

- US-DASH-21 · See what I owe vendors on the dashboard (P2)
- US-DASH-22 · See where money goes (P2)
- US-DASH-23 · See each bank, cash and card balance (P1)
- US-DASH-24 · See work not yet billed (P1)
- US-DASH-25 · See tax owed this period (P2)
- US-DASH-26 · Switch dashboard profit between accrual and cash (P2)

*Self-hosting & system states*

- US-OPS-33 · Attach files to bills, invoices and other records (P1)
- US-OPS-34 · Open attachments only when I can open the record (P1)
- US-OPS-35 · Remove an attachment added by mistake (P2)

## Phase 9 · Tax, documents and setup

**Goal:** An Indian business issues GST invoices, uploads GSTR-1 and hands its books to a Tally accountant; every business gets documents, emails and modules that fit it.

**Deliverables:** Country tax presets (India, UK, Australia, New Zealand, UAE, Saudi Arabia); tax types and supply classes; for India, GST registration, contact GST details, automatic place of supply, HSN/SAC codes, GST invoice and credit note PDFs, the GSTR-1 JSON and review workbook; the Tax Summary by rate, type and class on both sides; the Tally XML export and account mapping; UPI QR codes on invoices; document layout options, a signature and the amount in words; Unicode PDF fonts; editable customer emails; optional modules; the Set up Spine page (D-145–D-155).

**Done when:**
- An India-preset organisation issues intra-state, inter-state, export and bill-of-supply invoices whose PDFs pass a GST checklist review, and the GSTR-1 JSON for the month validates in the GST offline tool with totals equal to the Tax Summary.
- The Tally export for a sample quarter imports into TallyPrime and Tally.ERP 9 without errors, and Tally's trial balance matches Spine's.
- A UPI app scanning a test invoice's QR code opens with the right payee, amount and note.
- With each module switched off, its pages, widgets, search results, notifications and API routes are gone (403 `MODULE_OFF`), and switching it back on restores everything (tested per module).
- A new owner completes every card on the Set up Spine page using only the page and its links.

**Stories:**

*Onboarding & first run*

- US-ONB-14 · Start with the modules my industry needs (P2)
- US-ONB-15 · Open a setup page that shows what's left (P1)
- US-ONB-16 · Go from each setup card to its setting and its guide (P2)

*Invoicing & credit notes*

- US-INV-25 · Set my UPI ID for payments (P1)
- US-INV-26 · Show a UPI QR code on invoices (P1)

*Tax*

- US-TAX-09 · Start with my country's tax rates (P1)
- US-TAX-10 · Give each rate a tax type (P1)
- US-TAX-11 · Mark supplies as zero-rated, exempt or outside tax (P1)
- US-TAX-12 · Record my GSTIN and state, and each customer's (P1)
- US-TAX-13 · Pick intra- or inter-state GST automatically (P1)
- US-TAX-14 · Add HSN or SAC codes to items and lines (P1)
- US-TAX-15 · Print GST details on invoices and credit notes (P1)
- US-TAX-16 · Export GSTR-1 for the GST portal (P1)
- US-TAX-17 · Check GSTR-1 figures before uploading (P1)

*Accounting & reports*

- US-RPT-37 · See tax collected and paid by rate and tax type (P1)
- US-RPT-38 · Export my books for Tally (P1)
- US-RPT-39 · Map my accounts to Tally groups (P2)

*Settings & administration*

- US-SET-17 · Choose paper size and columns for each document (P1)
- US-SET-18 · Set each document's title, terms and notes (P1)
- US-SET-19 · Add a signature and the amount in words (P2)
- US-SET-20 · Show every character on PDFs (P1)
- US-SET-21 · Edit the text of each customer email (P1)
- US-SET-22 · Preview an email and reset it to the default (P2)
- US-SET-23 · Switch optional modules on or off (P1)
- US-SET-24 · Hide everything a switched-off module owns (P1)
- US-SET-25 · Switch a module back on with nothing lost (P1)

## Phase 10 · Packaging & 1.0

**Goal:** A stranger installs from the README and issues their first invoice.

**Deliverables:** Install script, backup/restore with CI-verified restore, upgrades, health checks, logs, update notice, demo seed, system pages, phone-width web layout, reduced motion, i18n extraction, accessibility audit, security review, README, licence, the public website and docs (Astro + Starlight: home page, user guide, self-hosting, developer docs, API reference) with the guide bundled into every install for offline help, and the v1.0 release.

**Done when:**
- A stranger installs on a clean machine using only the README and issues their first invoice in under 5 minutes (NFR-MNT-01).
- Backup → restore is verified nightly in CI (NFR-REL-03).
- Every route passes axe AA and works at 390×844 (NFR-A11Y-02, NFR-COMP-02).
- The security review is written up with no open high-severity items (NFR-SEC-05).
- Every feature has a user-guide page, and the Help menu opens the bundled guide offline.

**Stories:**

*Onboarding & first run*

- US-ONB-09 · Load demo data to explore (P1)

*Settings & administration*

- US-SET-08 · Remove demo data and keep my real data (P2)

*Self-hosting & system states*

- US-OPS-01 · Install Spine with one command (P1)
- US-OPS-02 · Start with demo data from an environment flag (P2)
- US-OPS-03 · Back up everything into one file (P1)
- US-OPS-04 · Restore a backup into a clean install (P1)
- US-OPS-05 · Report health and readiness (P2)
- US-OPS-06 · Tell owners a new version is available (P3)
- US-OPS-07 · Log every request with an id (P2)
- US-OPS-09 · Respect reduced-motion settings everywhere (P2)
- US-OPS-11 · Show a helpful page for a missing page (P2)
- US-OPS-13 · Recover from an unexpected error (P2)
- US-OPS-14 · Use the web app on a phone (P1)
- US-OPS-15 · Keep wide tables usable on small screens (P2)
- US-OPS-16 · Move every user-facing string into translation files (P2)
- US-OPS-17 · Pass an accessibility audit of every screen (P1)
- US-OPS-18 · Complete a security review before 1.0 (P1)
- US-OPS-19 · Ship the README, licence and contributor guide (P1)

*Website and help*

- US-SITE-01 · Set up the docs site in the monorepo (P1)
- US-SITE-02 · Show a home page for people discovering Spine (P1)
- US-SITE-03 · Find any page with search (P2)
- US-SITE-04 · Read a task-based guide for every module (P1)
- US-SITE-05 · Ship each story with its guide page (P1)
- US-SITE-06 · Capture guide screenshots automatically (P2)
- US-SITE-07 · Install Spine from the self-hosting guide (P1)
- US-SITE-08 · Run, back up and upgrade from the self-hosting guide (P1)
- US-SITE-09 · Learn the codebase from the developer docs (P2)
- US-SITE-10 · Browse a generated API reference (P2)
- US-SITE-11 · Open help for the page I'm on (P1)
- US-SITE-12 · Read the guide without internet (P1)
- US-SITE-13 · Read docs for the version I run (P2)
- US-SITE-14 · Publish the site after each merge (P2)
