# 16 · Settings & administration

Organisation configuration in one Owner-only Settings dialog (business profile, branding, template, currency, financial year, tax, numbering, chart of accounts, purchases, pipeline stages, quote conversion, meeting defaults, demo data), record history on every document, and an organisation-wide audit log. Personal preferences live on Profile & Preferences (02), people and access under Team (15).

**Screens:** `SettingsBusiness` (P1), `SettingsSearch` (P3), `SettingsTemplate` (P2), `SettingsCurrency` (P2), `SettingsFiscalYear` (P2), `SettingsNumbering` (P2), `SettingsDemoData` (P2), `DeleteDemoDataConfirm` (P2), `HistoryDialog` (P2), `ContactHistory` (P2), `UserMenu` (P1), `SettingsBranding` (P3), `OrgAuditLog` (P3), `SettingsAccounts` (P2), `QuotePdf` (P1), `SettingsDataExport` (P2), `SettingsPaymentInstructions` (P2)
**Depends on:** 01 Onboarding (same step components), 15 Team (Owner-only rule), every module (audit entries).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-SET-01 | Settings dialog | P1 | 0 | `UserMenu`, `SettingsBusiness`, `SettingsSearch` |
| F-SET-02 | Change setup choices later | P1 | 0 | `SettingsBusiness`, `SettingsTemplate`, `SettingsCurrency`, `SettingsFiscalYear`, `SettingsNumbering` |
| F-SET-03 | Record history | P2 | 0 | `HistoryDialog`, `ContactHistory` |
| F-SET-04 | Demo data housekeeping | P2 | 8 | `SettingsDemoData`, `DeleteDemoDataConfirm` |
| F-SET-05 | Branding and theme presets | P3 | 7 | `SettingsBranding`, `QuotePdf` |
| F-SET-06 | Organisation audit log | P3 | 7 | `OrgAuditLog` |
| F-SET-07 | Settings consistency fixes | P2 | 6 | `ContactHistory`, `SettingsTemplate`, `SettingsAccounts` |
| F-SET-08 | Data export | P2 | 7 | `SettingsDataExport` |

## User stories

### US-SET-01 · Open organisation Settings as an owner
**Feature:** F-SET-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `UserMenu`, `SettingsBusiness`
**As** an owner, **I want** all organisation settings in one place, **so that** I can configure the business without hunting.

Legacy: S-10.1

**Acceptance criteria**
- **Given** I'm an Owner, **when** I choose "Settings" in the user menu, **then** a dialog opens with a section list on the left (Business profile, Industry template, Currency & locale, Financial year, Tax, Numbering, Chart of accounts, Purchases, Repeat quote conversion, Upcoming meetings, Meeting reminders, Browser notifications, Demo data) and the first section open.
- **Given** I pick a section, **when** it opens, **then** its pane replaces the right side and the section is highlighted.
- **Given** a Staff or Field user, **when** they open the user menu, **then** "Settings" isn't listed and the settings write routes return 403.
- **Given** I press Escape or the close button, **when** the dialog closes, **then** focus returns to the user menu button.

**Implementation notes**
- API: `GET /org/settings`, `GET/PUT /org/settings/:key` (PUT Owner).
- UI: `components/settings-dialog.tsx`. Expense categories move out of Settings to Expenses › Categories in Phase 6 (US-PUR-19, [D-078](../prd/12-decisions.md)); "Browser notifications" moves to Profile with US-NTF-12.

### US-SET-02 · Search settings
**Feature:** F-SET-01 · **Priority:** P3 · **Phase:** 0 · **Screens:** `SettingsSearch`
**As** an owner, **I want** to type to find a setting, **so that** I get there fast.

**Acceptance criteria**
- **Given** the Settings dialog, **when** I type "meet" into "Search settings", **then** the section list shows only "Upcoming meetings" and "Meeting reminders".
- **Given** a search with no match, **when** it filters, **then** I see "No matching settings.".
- **Given** I clear the search, **when** it empties, **then** every section is listed again.

**Implementation notes**
- Client-side filter over section labels.

### US-SET-03 · Change my business details later
**Feature:** F-SET-02 · **Priority:** P1 · **Phase:** 0 · **Screens:** `SettingsBusiness`
**As** an owner, **I want** to edit my business name, logo, address and industry after setup, **so that** documents stay current.

Legacy: S-10.1, S-10.4

**Acceptance criteria**
- **Given** Settings › Business profile, **when** it opens, **then** it shows "Business name", "Logo", "Address" and "Industry" filled with current values and a "Save" button.
- **Given** I upload a new logo and press "Save", **when** it saves, **then** new PDFs and the public quote page show the new logo; issued documents' PDFs keep the logo they were issued with.
- **Given** an empty business name, **when** I save, **then** it's refused with a field error.

**Implementation notes**
- API: `PUT /org/settings/business_profile`, `POST /files`.

### US-SET-04 · Change template, currency and financial year later
**Feature:** F-SET-02 · **Priority:** P2 · **Phase:** 0 · **Screens:** `SettingsTemplate`, `SettingsCurrency`, `SettingsFiscalYear`
**As** an owner, **I want** to revisit my template, currency, locale and year start, **so that** an early choice isn't permanent.

Legacy: S-12.10

**Acceptance criteria**
- **Given** Settings › Industry template, **when** I choose another template and save, **then** new jobs follow its defaults and existing jobs are unchanged.
- **Given** Settings › Currency & locale, **when** documents already exist, **then** changing the currency warns that existing documents keep theirs.
- **Given** Settings › Financial year, **when** I change the start month and save, **then** report defaults follow it from the next year boundary; document numbers are unaffected ([D-077](../prd/12-decisions.md)).

**Implementation notes**
- API: `PUT /org/settings/industry_template`, `/currency`, `/fiscal_year`.

### US-SET-05 · Continue my existing document numbers
**Feature:** F-SET-02 · **Priority:** P2 · **Phase:** 0 · **Screens:** `SettingsNumbering`
**As** an owner, **I want** to set prefixes and starting numbers, **so that** I can carry on my old invoice series.

Legacy: S-10.5

**Acceptance criteria**
- **Given** Settings › Numbering ("Prefix and starting number for each document type."), **when** it opens, **then** each document type has "Prefix", "Padding" and "Starting number".
- **Given** I set invoice prefix "INV" and starting number 1042, **when** the next invoice is issued, **then** it's "INV-1042" with the chosen padding.
- **Given** a starting number at or below the last issued number, **when** I save, **then** it's refused naming the last issued number.

**Implementation notes**
- API: `GET /org/numbering`, `PUT /org/numbering/:documentType` (Owner).

### US-SET-06 · See who changed a record and when
**Feature:** F-SET-03 · **Priority:** P2 · **Phase:** 0 · **Screens:** `HistoryDialog`, `ContactHistory`
**As** an owner, **I want** each record's change history, **so that** I can investigate discrepancies.

Legacy: S-10.6

**Acceptance criteria**
- **Given** an invoice, quote, payment, credit note, contact, catalogue item, job, milestone, photo, note, expense, expense category, vendor bill or vendor payment, **when** I press "History", **then** a dialog lists entries newest first like "Jane Doe updated this invoice: notes empty → Rush order" with the time.
- **Given** a record with no changes yet, **when** I open History, **then** I see "No history yet.".
- **Given** an entry by a deactivated or deleted user, **when** it's shown, **then** it still names them (or "Someone" if unknown).

**Implementation notes**
- API: `GET /<resource>/:id/history`.
- UI: `components/history-section.tsx` (`Dialog`).

### US-SET-07 · Record every change to money documents
**Feature:** F-SET-03 · **Priority:** P1 · **Phase:** 0 · **Screens:** `HistoryDialog`
**As** an owner, **I want** every create, update, issue, void and delete on financial documents logged, **so that** the trail is complete.

**Acceptance criteria**
- **Given** an invoice is created, edited, issued and voided, **when** I open its History, **then** four entries appear with the actor and, for the edit, a field-by-field diff.
- **Given** a payment is deleted, **when** I search the audit trail, **then** the deletion is recorded with the actor.
- **Given** audit entries, **when** anyone tries to change one, **then** there is no route to do so.

**Implementation notes**
- `AuditLogService.record` inside the same transaction as the change.
- Data: `audit_log`.

### US-SET-08 · Remove demo data and keep my real data
**Feature:** F-SET-04 · **Priority:** P2 · **Phase:** 8 · **Screens:** `SettingsDemoData`, `DeleteDemoDataConfirm`
**As** an owner who evaluated with demo data, **I want** to delete it in one step, **so that** I can start real work in the same install.

Legacy: S-12.8

**Acceptance criteria**
- **Given** demo data is loaded, **when** I open Settings › Demo data, **then** I see "Demo data is loaded" and "Removing it only deletes demo records — your real data is never touched." with "Delete all demo data".
- **Given** I press it, **when** "Delete all demo data?" appears, **then** it explains what will be removed and offers "Cancel" and "Delete demo data".
- **Given** I confirm, **when** it finishes, **then** every row marked as demo is gone, demo users lose access, and records I created remain.
- **Given** no demo data, **when** I open the pane, **then** I see "No demo data is currently loaded.".

**Implementation notes**
- API: `GET /demo-data/status`, `DELETE /demo-data`.

### US-SET-09 · Pick a theme for the whole organisation
**Feature:** F-SET-05 · **Priority:** P3 · **Phase:** 7 · **Screens:** `SettingsBranding`
**As** an owner, **I want** to choose a built-in theme, **so that** Spine matches my company without custom CSS.

Legacy: S-00.4, S-00.5 · Gaps: G3 · Decision: D-063

**Acceptance criteria**
- **Given** Settings › Branding, **when** it opens, **then** "App theme" offers "Spine Blue" (Default), "Harbour Teal", "Plum" and "Graphite" as cards with a colour swatch.
- **Given** I pick "Harbour Teal" and press "Save", **when** any member reloads, **then** primary buttons, links, active navigation and focus rings use teal in light and dark mode.
- **Given** any preset, **when** it applies, **then** paid, due-soon, overdue and draft status colours are unchanged.
- **Given** "Reset to Spine defaults", **when** I press it and save, **then** Spine Blue returns.
- **Given** the note "Each person still chooses light or dark mode in their own Profile & Preferences.", **when** a member changes their theme, **then** it applies on top of the preset.

**Implementation notes**
- API: `GET/PUT /org/settings/branding`.
- UI: presets override `--color-primary*` only (tokens.json); every preset passes 4.5:1 with white text.

### US-SET-10 · Put my brand colour and footer on documents
**Feature:** F-SET-05 · **Priority:** P3 · **Phase:** 7 · **Screens:** `SettingsBranding`, `QuotePdf`
**As** an owner, **I want** my colour and footer on quotes, invoices, receipts and emails, **so that** they look professional.

Legacy: S-10.4 · Gap: G4

**Acceptance criteria**
- **Given** "Document colour", **when** I enter a hex value, **then** a swatch and a contrast check show ("✓ Readable on white (6.0:1, passes AA)").
- **Given** a colour below 4.5:1 on white, **when** I enter it, **then** I see a warning and can't save it.
- **Given** "Document footer", **when** I save text, **then** the preview and every new PDF and email show it.
- **Given** issued documents, **when** branding changes, **then** their existing PDFs are unchanged.

**Implementation notes**
- Data: `settings.branding.documentColor`, `documentFooter`; PDFs snapshot at issue.

### US-SET-11 · See every change across the organisation
**Feature:** F-SET-06 · **Priority:** P3 · **Phase:** 7 · **Screens:** `OrgAuditLog`
**As** an owner, **I want** one page listing every audit entry, **so that** I can investigate without opening each record.

Gap: G6 · Decision: D-064

**Acceptance criteria**
- **Given** Team › "Audit log", **when** it opens, **then** I see "Every change to records in <Business>, newest first. Only owners can see this page." and a table of When, Who, Action, Record and Details.
- **Given** filters "From", "To", "Person", "Record type" and "Action", **when** I set them, **then** the table shows only matching entries.
- **Given** a record link, **when** I click it, **then** I open that record.
- **Given** more than 50 entries, **when** I scroll to the end, **then** "1–50 of <total> entries" with "Previous" and "Next" pages through them.
- **Given** a Staff user, **when** they open `/team/audit-log`, **then** they see the no-access page.
- **Given** an Owner promotes, demotes, deactivates or reactivates a member, or transfers primary ownership, **when** it saves, **then** the audit log shows it with record type "User", the member's name and the old and new role or state.

**Implementation notes**
- API: `GET /org/audit-log?from=&to=&userId=&entityType=&action=&cursor=` (contract addition).
- Data: `audit_log.entity_id` becomes `text` so Better Auth member/user ids can be stored (04 "Columns added").

### US-SET-12 · Export the audit log
**Feature:** F-SET-06 · **Priority:** P3 · **Phase:** 7 · **Screens:** `OrgAuditLog`
**As** an owner, **I want** the audit log as CSV, **so that** an accountant or auditor can review it.

**Acceptance criteria**
- **Given** the audit log with filters set, **when** I press "Export CSV", **then** a CSV of the filtered entries downloads.
- **Given** the CSV, **when** it opens, **then** each row has timestamp (ISO 8601), actor name and email, action, record type, record id and a JSON diff.
- **Given** more than 10,000 entries, **when** I export, **then** the download streams without timing out.

**Implementation notes**
- API: `GET /org/audit-log.csv`.

### US-SET-13 · Open contact history the same way as everywhere else
**Feature:** F-SET-07 · **Priority:** P2 · **Phase:** 6 · **Screens:** `ContactHistory`
**As** a member, **I want** history to open the same way on contacts as on every other record, **so that** the app is predictable.

Finding: C6 · Decision: D-061

**Acceptance criteria**
- **Given** a contact, **when** I open it, **then** there is no "History" tab; a "History" button opens the history dialog like on invoices.
- **Given** the dialog, **when** it lists entries, **then** each reads as a sentence ("Sarah Mendes changed the phone from +1-555-0107 to +1-555-0177") rather than raw field names.
- **Given** an entry with many fields, **when** it's shown, **then** at most three changes are listed with "and N more".

**Implementation notes**
- UI: remove the tab in `contact-detail.tsx`; reuse `history-section.tsx`; human-readable diff formatter shared by all modules.

### US-SET-14 · Show "Save" on setup steps reused in Settings
**Feature:** F-SET-07 · **Priority:** P2 · **Phase:** 6 · **Screens:** `SettingsTemplate`, `SettingsAccounts`
**As** an owner, **I want** Settings panes to say "Save", **so that** I'm not confused by wizard wording.

Findings: C14, C21

**Acceptance criteria**
- **Given** Settings › Industry template, **when** it renders, **then** its button reads "Save", not "Continue".
- **Given** Settings › Chart of accounts, **when** it renders, **then** its button reads "Save", not "Continue".
- **Given** any onboarding step reused in Settings, **when** an automated test renders it inside Settings, **then** the test fails if any button reads "Continue".

**Implementation notes**
- Pass `saveLabel="Save"` from every Settings pane that reuses a wizard step.

### US-SET-15 · Export all my data
**Feature:** F-SET-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `SettingsDataExport`
**As** an owner, **I want** to download everything in my Spine, **so that** I keep my own copy and can leave if I ever need to.

Decision: D-094

**Acceptance criteria**
- **Given** Settings › "Data export", **when** it opens, **then** it offers "Records as CSV" (on by default), "Records as JSON" and "Files", with "Prepare export".
- **Given** I press "Prepare export", **when** it starts, **then** the button shows "Preparing…" and the page says "Large exports are prepared in the background. We'll email you when the file is ready.".
- **Given** the export finishes, **when** I return, **then** "Last export" shows the date, who ran it, the size and "Download again" with "(link expires in 7 days)".
- **Given** the ZIP, **when** I open it, **then** it has one CSV (or JSON) per table with a header row, a `files/` folder when chosen, and a `README.txt` describing each file.
- **Given** a Staff or Field user, **when** they call `POST /org/exports`, **then** it returns 403.

**Implementation notes**
- API: `POST /org/exports { formats, includeFiles }`, `GET /org/exports` (latest), `GET /org/exports/:id/download` (contract additions, Owner).
- Queue: `data-export` (pg-boss); Data: `data_exports` (04 "Columns added").
- Edge: secrets (password hashes, sessions, tokens, VAPID keys) are never exported.

### US-SET-16 · Keep data exports private
**Feature:** F-SET-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `SettingsDataExport`
**As** an owner, **I want** export downloads protected and short-lived, **so that** a full copy of my business can't leak.

**Acceptance criteria**
- **Given** a prepared export, **when** anyone without an Owner session opens its download link, **then** it returns 404.
- **Given** 7 days pass, **when** the link is used, **then** it returns 404 and the file has been deleted from storage.
- **Given** an export is prepared or downloaded, **when** I open the audit log, **then** both actions are listed with the person.
- **Given** an export is ready, **when** the email is sent, **then** it links to Settings › Data export, never to the file itself.

**Implementation notes**
- Files: stored privately; download authorised per request (07-security "Files").
