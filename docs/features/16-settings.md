# 16 · Settings & administration

Organisation configuration in one Owner-only Settings dialog (business profile, branding, template, currency, financial year, tax, numbering, chart of accounts, purchases, pipeline stages, quote conversion, meeting defaults, demo data), record history on every document, and an organisation-wide audit log. Personal preferences live on Profile & Preferences (02), people and access under Team (15).

**Screens:** `SettingsBusiness` (P1), `SettingsSearch` (P3), `SettingsTemplate` (P2), `SettingsCurrency` (P2), `SettingsFiscalYear` (P2), `SettingsNumbering` (P2), `SettingsDemoData` (P2), `DeleteDemoDataConfirm` (P2), `HistoryDialog` (P2), `ContactHistory` (P2), `UserMenu` (P1), `SettingsBranding` (P3), `OrgAuditLog` (P3), `SettingsAccounts` (P2), `QuotePdf` (P1), `SettingsDataExport` (P2), `SettingsPaymentInstructions` (P2), `SettingsDocumentLayout` (P1), `SettingsEmailTemplates` (P1), `SettingsModules` (P1), `ModuleOffConfirm` (P1), `BrandSidebar` (P2), `BrandSidebarDark` (P2), `BrandSignIn` (P2), `BrandBrowserIcons` (P2), `BrandPublicQuoteFooter` (P3)
**Depends on:** 01 Onboarding (same step components), 15 Team (Owner-only rule), every module (audit entries).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-SET-01 | Settings dialog | P1 | 0 | `UserMenu`, `SettingsBusiness`, `SettingsSearch` |
| F-SET-02 | Change setup choices later | P1 | 0 | `SettingsBusiness`, `SettingsTemplate`, `SettingsCurrency`, `SettingsFiscalYear`, `SettingsNumbering` |
| F-SET-03 | Record history | P2 | 0 | `HistoryDialog`, `ContactHistory` |
| F-SET-04 | Demo data housekeeping | P2 | 10 | `SettingsDemoData`, `DeleteDemoDataConfirm` |
| F-SET-05 | Branding and theme presets | P3 | 7 | `SettingsBranding`, `QuotePdf` |
| F-SET-06 | Organisation audit log | P3 | 7 | `OrgAuditLog` |
| F-SET-07 | Settings consistency fixes | P2 | 6 | `ContactHistory`, `SettingsTemplate`, `SettingsAccounts` |
| F-SET-08 | Data export | P2 | 7 | `SettingsDataExport` |
| F-SET-09 | Document layout options and fonts | P1 | 9 | `SettingsDocumentLayout`, `InvoicePdfGst` |
| F-SET-10 | Email templates | P1 | 9 | `SettingsEmailTemplates` |
| F-SET-11 | Modules | P1 | 9 | `SettingsModules`, `ModuleOffConfirm` |
| F-SET-12 | The Spine brand on the web | P2 | Refinements | `BrandSidebar`, `BrandSidebarDark`, `BrandSignIn`, `BrandBrowserIcons`, `BrandPublicQuoteFooter` |

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
**Feature:** F-SET-04 · **Priority:** P2 · **Phase:** 11 · **Screens:** `SettingsDemoData`, `DeleteDemoDataConfirm`
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

### US-SET-17 · Choose paper size and columns for each document
**Feature:** F-SET-09 · **Priority:** P1 · **Phase:** 9 · **Screens:** `SettingsDocumentLayout`
**As** an owner, **I want** to choose what my quotes and invoices show, **so that** they suit my customers.

Decision: D-152

**Acceptance criteria**
- **Given** Settings › Documents, **when** it opens, **then** a tab per document type ("Quotes", "Invoices", "Credit notes", "Receipts", "Statements") shows options beside a live preview with sample data.
- **Given** the options, **when** I change them, **then** I can set "Paper size" (A4, Letter) and show or hide "Quantity and unit", "Discount", "HSN/SAC" (when GST is on), "Tax per line" and "Tax summary table"; the preview updates as I change.
- **Given** I save, **when** a new document is issued, **then** its PDF uses the options; issued PDFs never change.
- **Given** a document with a discount on a line while "Discount" is hidden, **when** it renders, **then** the line shows its discounted price and the discount column is still hidden ("Hidden columns don't change any amounts.").

**Implementation notes**
- API: `GET/PUT /org/settings/document_layout` (roles: owner), validated by `documentLayoutSchema`; `GET /org/settings/document_layout/preview?type=` returns a sample PDF.

### US-SET-18 · Set each document's title, terms and notes
**Feature:** F-SET-09 · **Priority:** P1 · **Phase:** 9 · **Screens:** `SettingsDocumentLayout`
**As** an owner, **I want** default terms and notes on each document type, **so that** I don't paste them every time.

**Acceptance criteria**
- **Given** a document tab, **when** I edit "Title" (e.g. "Quotation", "Tax Invoice", "Estimate"), "Default terms" and "Default notes", **then** new drafts start with them and I can change them on each document.
- **Given** a GST invoice, **when** the title would conflict with GST rules (US-TAX-15), **then** the GST title wins and the field shows "Set by your GST settings".
- **Given** terms over 2,000 characters, **when** I save, **then** I see "Keep terms under 2,000 characters.".

**Implementation notes**
- Same setting key; the document builders read defaults when a draft is created.

### US-SET-19 · Add a signature and the amount in words
**Feature:** F-SET-09 · **Priority:** P2 · **Phase:** 9 · **Screens:** `SettingsDocumentLayout`
**As** an owner, **I want** my signature and the total in words on documents, **so that** they look like what customers expect.

**Acceptance criteria**
- **Given** "Signature", **when** I upload a PNG or JPEG, **then** it shows above "Authorised signatory — <business name>" on the chosen document types.
- **Given** "Amount in words" is on, **when** an invoice renders, **then** the total appears in words in the organisation's currency (e.g. "Rupees Twelve Thousand Five Hundred and Fifty Paise Only" for INR, using lakh and crore; "Twelve thousand five hundred dollars and fifty cents" for others).
- **Given** I remove the signature, **when** I save, **then** new PDFs have no signature; issued ones keep theirs.

**Implementation notes**
- Data: `settings.document_layout.signatureFileId` (→ files, served via the owning setting, D-117). `amountInWords` helper in `@spine/shared` with tests for Indian and international grouping.

### US-SET-20 · Show every character on PDFs
**Feature:** F-SET-09 · **Priority:** P1 · **Phase:** 9 · **Screens:** `InvoicePdfGst`
**As** an owner in India, **I want** ₹ and Hindi names to print correctly, **so that** my documents look right.

Decision: D-151

**Acceptance criteria**
- **Given** an INR organisation, **when** any PDF renders, **then** money shows "₹" (not "INR" or a blank box).
- **Given** a customer name in Devanagari, **when** an invoice renders, **then** it prints correctly.
- **Given** a name in a script the fonts don't cover, **when** it renders, **then** it still prints in the fallback font and the PDF snapshot test documents which scripts are covered.

**Implementation notes**
- Fonts in `apps/api/assets/fonts/` (Noto Sans regular/bold, Noto Sans Devanagari regular/bold), registered once in `document-branding.tsx`; PDF snapshot tests updated.

### US-SET-21 · Edit the text of each customer email
**Feature:** F-SET-10 · **Priority:** P1 · **Phase:** 9 · **Screens:** `SettingsEmailTemplates`
**As** an owner, **I want** my own words in the emails customers get, **so that** they sound like my business.

Decision: D-153

**Acceptance criteria**
- **Given** Settings › Emails, **when** it opens, **then** it lists "Quote", "Invoice", "Payment reminder", "Receipt", "Credit note" and "Statement", each with its subject and the first line of its body.
- **Given** I open one, **when** I edit "Subject" and "Message", **then** a placeholder menu inserts `{customer_name}`, `{document_number}`, `{amount}`, `{balance_due}`, `{due_date}`, `{business_name}` and, where the email has one, `{link}`.
- **Given** an unknown placeholder like `{invoice_no}`, **when** I save, **then** I see "{invoice_no} isn't a placeholder Spine knows. Use one from the list.".
- **Given** a saved template, **when** that email is next sent, **then** it uses my text inside the branded layout; emails already sent are unchanged.
- **Given** the "Send" dialogs, **when** they open, **then** the subject and message start from the template and can still be changed for one email.

**Implementation notes**
- API: `GET/PUT /org/settings/email_templates` (roles: owner), `emailTemplatesSchema`; `email-templates.ts` renders saved text through the placeholder engine with HTML escaping.

### US-SET-22 · Preview an email and reset it to the default
**Feature:** F-SET-10 · **Priority:** P2 · **Phase:** 9 · **Screens:** `SettingsEmailTemplates`
**As** an owner, **I want** to see the email before customers do, **so that** I catch mistakes.

**Acceptance criteria**
- **Given** a template, **when** I press "Preview", **then** it renders in the branded layout with a recent real document (or sample data when none), in light mode.
- **Given** "Send me a test", **when** I press it, **then** the preview is emailed to me only.
- **Given** "Reset to default", **when** I confirm, **then** Spine's original text comes back.

**Implementation notes**
- API: `POST /org/settings/email_templates/:type/preview`, `/:type/test` (roles: owner).

### US-SET-23 · Switch optional modules on or off
**Feature:** F-SET-11 · **Priority:** P1 · **Phase:** 9 · **Screens:** `SettingsModules`, `ModuleOffConfirm`
**As** an owner, **I want** to turn off what my business doesn't use, **so that** everyone sees a simpler Spine.

Decision: D-154

**Acceptance criteria**
- **Given** Settings › Modules, **when** it opens, **then** it lists "Leads & meetings", "Jobs & field", "Approvals" and "Recurring documents", each with a switch, a one-line description and what it includes; a note says "Contacts, quotes, invoices, payments, purchases, banking, tax and reports are always on."; an "AI assistant" row shows its state and links to Settings › AI, where it's switched on and set up (US-AI-01).
- **Given** I switch one off, **when** the confirmation opens, **then** it says what disappears and "Nothing is deleted. Switch it back on any time and everything is where you left it." with "Switch off".
- **Given** "Jobs & field" while active Field users exist, **when** I try to switch it off, **then** I see "<n> people use the field app. Change their role or deactivate them first." and the switch stays on.
- **Given** "Approvals" off, **when** someone submits an expense, **then** it's approved and posted at once, and discount approval on quotes is skipped.
- **Given** a Staff user, **when** they call the route, **then** the API returns 403.

**Implementation notes**
- API: `GET /org/modules` (any member — the UI needs it), `PUT /org/modules` (roles: owner). Data: `settings` key `modules` `{ leadsMeetings, jobsField, approvals, recurring }` (all true by default). Audited.

### US-SET-24 · Hide everything a switched-off module owns
**Feature:** F-SET-11 · **Priority:** P1 · **Phase:** 9 · **Screens:** `SettingsModules`
**As** a member, **I want** no traces of switched-off modules, **so that** I'm not confused by things we don't use.

**Acceptance criteria**
- **Given** a module off, **when** anyone uses Spine, **then** its sidebar items, dashboard widgets and attention rows, search groups, notification types, digest sections, settings panes and privilege groups are gone.
- **Given** a direct link to a page in a switched-off module, **when** it opens, **then** it shows "<Module> is switched off. An owner can switch it on in Settings › Modules.".
- **Given** an API call to a switched-off module, **when** it arrives, **then** it returns 403 `{ error: "MODULE_OFF" }` — including from the mobile app.
- **Given** Recurring documents off, **when** the scheduled runs happen, **then** no recurring invoices or bills are created.
- **Given** the shared capability list, **when** a module is off, **then** its capabilities stay granted in Teams but aren't shown or enforced as usable; the same module map drives the API guard and the UI (tested together).

**Implementation notes**
- `packages/shared/src/modules.ts` maps each module to its routes, capabilities, nav items, widgets, search types and notification types; a `ModuleGuard` in the API and a `useModule` hook in the web app read it.

### US-SET-25 · Switch a module back on with nothing lost
**Feature:** F-SET-11 · **Priority:** P1 · **Phase:** 9 · **Screens:** `SettingsModules`
**As** an owner, **I want** to turn a module back on safely, **so that** I can try it again later.

**Acceptance criteria**
- **Given** a module that was off, **when** I switch it on, **then** its records, Team grants, settings and pages are back as they were.
- **Given** Recurring documents switched back on, **when** it resumes, **then** schedules continue from the next future date and missed dates aren't created ("Recurring documents were off from <date> to <date>; missed dates were skipped.").
- **Given** Approvals switched back on, **when** expenses are submitted again, **then** they wait for approval; ones approved while it was off stay approved.

**Implementation notes**
- On switching on, `next_run_on` of active schedules is moved to the next future occurrence.

### US-SET-26 · See the Spine logo across the web app
**Feature:** F-SET-12 · **Priority:** P2 · **Phase:** Refinements (before Phase 10) · **Screens:** `BrandSidebar`, `BrandSidebarDark`, `BrandSignIn`, `BrandBrowserIcons`, `BrandPublicQuoteFooter`
**As** anyone using Spine in a browser, **I want** the Spine logo and icon wherever the app shows itself, **so that** I recognise it in my tabs, bookmarks and home screen, the same as on my phone.

Decisions: [D-203](../prd/12-decisions.md), [D-206](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** a signed-in page, **when** the sidebar is expanded, **then** its header shows the horizontal logo (the mark beside SPiNE); **when** it's collapsed, **then** the gradient mark alone (28 px) replaces the "S".
- **Given** login, sign-up, onboarding, accept invite, forgot password, reset password and invite-only, **when** they open, **then** they show the horizontal logo where the old one was.
- **Given** dark mode, **when** a page with the logo renders, **then** the wordmark is light text from the first frame, with no swap after the page loads.
- **Given** a business has picked another theme (US-SET-09), **when** the logo renders, **then** the wordmark stays Spine blue (`#2954E5`); the theme changes only the app's accent colour.
- **Given** a browser tab or bookmark, **when** Spine is open, **then** its icon is the app-icon tile (the white-edged mark on the teal-to-blue square): an SVG for current browsers, and `favicon.ico` at 16, 32 and 48 px for the rest.
- **Given** "Add to Home Screen", **when** it's used on an iPhone or iPad, **then** the icon is the 180 px iOS app-icon art; **when** it's used in Chrome on Android, **then** the web manifest's 192 and 512 px icons and a maskable icon are used. The browser's bar takes the page colour (`#F7F6F3` light, `#121110` dark), and Spine stays a normal website (no install prompt).
- **Given** a browser push notification, **when** it shows, **then** it carries the square app icon, and on Android a one-colour badge.
- **Given** the public quote page, **when** a customer opens it, **then** "Sent with Spine" has the 20 px mark before it.
- **Given** a screen reader, **when** it reaches the logo, **then** it hears "Spine" once; where the word Spine is already next to it (the quote footer), the logo is skipped.
- **Given** emails and PDFs, **when** they're sent, **then** they keep the business's own logo and name, unchanged.
- **Given** the web design system, **when** this story is done, **then** `SpineLogo` has a doc page and an accessibility test, Color shows the brand swatches, and the old logo PNGs are gone from `apps/web` and `apps/design-system`.

**Implementation notes**
- `SpineLogo` in `@spine/ui`: inline SVG from the `docs/logos` paths (the same as `@spine/ui-native`'s), mark, horizontal or vertical, clamped to the brand minimums (20 px mark, 96 px wide lockup), read as "Spine" unless `decorative`.
- Brand tokens in `packages/config`: `--color-brand-teal`, `--color-brand-sky`, `--color-brand-deep` and `--color-brand-wordmark` (light `#2954E5`, dark `#F3F2EE`), outside the `[data-brand]` theme rules so no theme changes them; for the logo and icons only (US-MOB-27).
- Icons through Next.js's file conventions: `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, and `app/manifest.ts` (`display: "browser"`). `public/sw.js` uses `/icons/notification-192.png` and `/icons/badge-96.png`. `themeColor` in the root layout's viewport, per colour scheme.

