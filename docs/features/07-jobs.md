# 07 · Jobs & milestones

A job is the work behind an accepted quote: its contract value, billing milestones (percentages or fixed amounts that must add up), retention held on each progress invoice and released at the end, variation orders that change the scope, site photos and notes, the crew assigned to it, and live costing from the ledger.

**Screens:** `JobsList` (P1), `JobsEmpty` (P1), `JobFromQuote` (P1), `JobEditDialog` (P1), `JobMilestones` (P1), `MilestonesEditor` (P1), `CompleteMilestoneDialog` (P1), `ReleaseRetentionConfirm` (P2), `JobVariations` (P2), `RaiseVariationDialog` (P2), `JobPhotos` (P2), `JobNotes` (P2), `JobCosting` (P1), `JobCrew` (P2), `InvoiceDetailProgress` (P1), `MobJobsList` (P1), `InvoiceDetailRetention` (P1)
**Depends on:** 06 Quotes (conversion, variation quotes), 08 Invoicing (progress and retention invoices), 10 Purchases (costs), 17 Mobile.

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-JOB-01 | Jobs list and job details | P1 | 3 | `JobsList`, `JobsEmpty`, `JobFromQuote`, `JobEditDialog` |
| F-JOB-02 | Billing milestones | P1 | 3 | `JobMilestones`, `MilestonesEditor`, `CompleteMilestoneDialog` |
| F-JOB-03 | Retention | P1 | 3 | `JobMilestones`, `InvoiceDetailProgress`, `ReleaseRetentionConfirm` |
| F-JOB-04 | Variation orders | P2 | 3 | `JobVariations`, `RaiseVariationDialog` |
| F-JOB-05 | Site photos and notes (web) | P2 | 3 | `JobPhotos`, `JobNotes` |
| F-JOB-06 | Job costing | P1 | 4 | `JobCosting` |
| F-JOB-07 | Crew assignment | P2 | 5 | `JobCrew`, `MobJobsList` |
| F-JOB-08 | Own/others job and milestone rights | P1 | 4 | `JobMilestones`, `JobEditDialog` |

## User stories

### US-JOB-01 · See all jobs and their status
**Feature:** F-JOB-01 · **Priority:** P1 · **Phase:** 3 · **Screens:** `JobsList`, `JobsEmpty`
**As** an owner, **I want** a list of jobs with their status, contract value and retention, **so that** I see what's running.

**Acceptance criteria**
- **Given** jobs exist, **when** I open Jobs, **then** I see "Total jobs", "Active", "On hold" and "Completed" counters and a table of name, contact, status, contract value and retention %.
- **Given** I filter by status or contact, **when** it applies, **then** only matching jobs show; with none I see "No jobs match these filters".
- **Given** no jobs exist, **when** I open Jobs, **then** I see "No jobs yet", "Jobs are created from an accepted quote — open a quote and use Convert to job, or send one first." and "Go to quotes".
- **Given** I click a job, **when** it opens, **then** I see its header (name, status, contact, site address), Contract value, Retention, Start date, End date and source quote with "View quote".

**Implementation notes**
- API: `GET /jobs?status=&contactId=`, `GET /jobs/:id`.
- Data: `jobs` (`job_status`: `active`, `on_hold`, `completed`, `cancelled`).
- UI: `jobs-explorer.tsx`, `job-detail.tsx`.

### US-JOB-02 · Edit a job's details
**Feature:** F-JOB-01 · **Priority:** P1 · **Phase:** 3 · **Screens:** `JobEditDialog`, `JobFromQuote`
**As** office staff, **I want** to edit a job's name, site address, dates, status and retention %, **so that** it matches the real work.

Legacy: S-04.1

**Acceptance criteria**
- **Given** a job, **when** I press "Edit job", **then** a dialog shows "Job name", "Site address", "Status", "Start date", "End date", "Notes" and "Retention %".
- **Given** I change the status to "Completed", **when** I save, **then** the job shows Completed and a `job_completed` notification goes to the office.
- **Given** a job created from a quote, **when** I edit it, **then** the contract value can't be typed over; it changes only by applying variation orders.
- **Given** end date before start date, **when** I save, **then** an error shows and nothing saves.

**Implementation notes**
- API: `PUT /jobs/:id` (`jobs.edit_own`/`edit_others`).
- Data: `jobs.contract_value_amount` is a snapshot of the quote total.

### US-JOB-03 · Define billing milestones as percentages or fixed amounts
**Feature:** F-JOB-02 · **Priority:** P1 · **Phase:** 3 · **Screens:** `JobMilestones`, `MilestonesEditor`
**As** an owner, **I want** to split a job into billing milestones, **so that** I can bill in stages.

Legacy: S-04.2

**Acceptance criteria**
- **Given** a job with no milestones, **when** I open "Milestones", **then** I see "Billing milestones" with "Define milestones".
- **Given** the editor, **when** I add rows, **then** each has "Name" (placeholder "e.g. Foundation complete"), "Type" ("% of contract" or "Fixed amount"), the percent or amount, and "Due date".
- **Given** valid rows, **when** I press "Save milestones", **then** each milestone shows its name, resolved amount, due date and "Pending" status.
- **Given** a milestone with no name, **when** I save, **then** I see "Every milestone needs a name.".
- **Given** zero rows, **when** I save, **then** I see "Add at least one milestone.".

**Implementation notes**
- API: `GET/PUT /jobs/:id/milestones` (whole set replaced).
- Data: `milestones` (`amount_type`, `amount`, `resolved_amount`, `sequence`, `due_date`).
- UI: `milestones-section.tsx`. Collapsed by default unless the Construction template is chosen (US-ONB-04); always expandable.

### US-JOB-04 · Stop me if milestone percentages don't add up
**Feature:** F-JOB-02 · **Priority:** P1 · **Phase:** 3 · **Screens:** `MilestonesEditor`
**As** an owner, **I want** to be stopped when percentage milestones don't total 100%, **so that** I don't under-bill.

Legacy: S-04.3

**Acceptance criteria**
- **Given** percentage milestones totalling 80%, **when** I press "Save milestones", **then** I see "Milestone percentages must total 100% (currently 80%)" and nothing saves.
- **Given** the editor, **when** I change percentages, **then** a running total shows ("Percent total: 100%" when correct).
- **Given** a direct API call with percentages ≠ 100, **when** it's sent, **then** it returns 400 before any write.

**Implementation notes**
- Edge: fixed-amount milestones aren't part of the 100% check; mixing types is allowed.

### US-JOB-05 · Mark a milestone complete with photos and notes
**Feature:** F-JOB-02 · **Priority:** P1 · **Phase:** 3 · **Screens:** `CompleteMilestoneDialog`
**As** office staff or field crew, **I want** to mark a milestone done with evidence, **so that** the office can raise the invoice.

Legacy: S-04.4 (web)

**Acceptance criteria**
- **Given** a pending milestone, **when** I press "Mark complete", **then** a dialog "Mark "<milestone>" complete" says "Add completion photos and notes so office staff can raise the invoice." with "Completion notes" and "Photos", both optional.
- **Given** I add photos and notes and confirm, **when** it succeeds, **then** the milestone shows "Completed" with who and when, and the photos appear on the Photos tab tagged "Milestone completion".
- **Given** a photo upload fails, **when** the error returns, **then** I see "Could not upload one or more photos." and can retry without losing my notes.
- **Given** it's completed, **when** it saves, **then** Owners and office staff get a `milestone_completed` notification.

**Implementation notes**
- API: `POST /jobs/:id/milestones/:milestoneId/complete` (owner, staff, field).
- Data: `milestones.completed_by_user_id`, `completed_at`, `completion_notes`; `job_photos.milestone_id`.

### US-JOB-06 · Raise a progress invoice from a completed milestone
**Feature:** F-JOB-02 · **Priority:** P1 · **Phase:** 3 · **Screens:** `JobMilestones`, `InvoiceDetailProgress`
**As** office staff, **I want** to invoice a completed milestone in one click, **so that** billing follows the work.

Legacy: S-04.5, S-05.1 (milestone path)

**Acceptance criteria**
- **Given** a completed milestone, **when** I press "Raise invoice", **then** a draft progress invoice is created for its amount, linked to the job and milestone, and the milestone shows "Invoiced" with "View invoice".
- **Given** a pending milestone, **when** I view it, **then** "Raise invoice" isn't offered.
- **Given** an invoiced milestone, **when** I view it, **then** it can't be invoiced again.
- **Given** creation fails, **when** the error returns, **then** I see "Could not raise an invoice for this milestone.".

**Implementation notes**
- API: `POST /jobs/:id/milestones/:milestoneId/invoice` (`milestones.invoice`).
- Data: `invoices.type = progress`, `invoices.milestone_id`; `milestones.invoiced_invoice_id`.

### US-JOB-07 · Hold retention on each progress invoice automatically
**Feature:** F-JOB-03 · **Priority:** P1 · **Phase:** 3 · **Screens:** `JobMilestones`, `InvoiceDetailProgress`
**As** an owner, **I want** the job's retention % held on every progress invoice, **so that** I don't calculate it by hand.

Legacy: S-04.6

**Acceptance criteria**
- **Given** a job with 5% retention, **when** a progress invoice for 10,000.00 is issued, **then** the invoice stores retention 500.00 and the Invoices list shows its balance due as 9,500.00.
- **Given** that invoice issued, **when** I open the Balance Sheet, **then** 500.00 sits in Retention Receivable, not Accounts Receivable.
- **Given** the AR aging report, **when** it renders, **then** held retention isn't included in AR buckets.

**Implementation notes**
- Posting P2 (06-ledger-posting-rules); `invoices.retention_amount`.
- Showing the retention and net rows on the invoice detail page is US-JOB-21 (Phase 6).

### US-JOB-08 · Release retention as a final invoice
**Feature:** F-JOB-03 · **Priority:** P2 · **Phase:** 3 · **Screens:** `ReleaseRetentionConfirm`
**As** an owner, **I want** to release held retention when the defect period ends, **so that** I actually collect it.

Legacy: S-04.7

**Acceptance criteria**
- **Given** a job with retention held, **when** I press "Release retention", **then** "Release retention?" explains a retention-release invoice will be created for the held amount, with "Cancel" and "Release retention".
- **Given** I confirm, **when** it succeeds, **then** I see "Retention released" / "A retention-release invoice has been created for this job." and the invoice moves the amount from Retention Receivable to AR.
- **Given** no retention is held, **when** I confirm "Release retention", **then** nothing is created and I see "Could not release retention for this job." (the dialog warns "If nothing is currently held back, this will be rejected.").
- **Given** it fails, **when** the error returns, **then** I see "Could not release retention for this job.".

**Implementation notes**
- API: `POST /jobs/:id/release-retention` (`jobs.release_retention`); posting P10.
- UI: confirm button is primary, not danger (D-058).

### US-JOB-09 · Raise a variation order for a scope change
**Feature:** F-JOB-04 · **Priority:** P2 · **Phase:** 3 · **Screens:** `JobVariations`, `RaiseVariationDialog`
**As** office staff, **I want** to quote a change to the job as a linked variation, **so that** extra work is tracked and billed.

Legacy: S-04.9

**Acceptance criteria**
- **Given** a job's "Variation orders" tab, **when** I press "Raise variation order", **then** "Raise a variation order" opens with the quote line editor (items, headings, text, quantity, unit price, discount, tax, "Price includes tax").
- **Given** valid lines, **when** I press "Raise variation order" in the dialog, **then** a draft variation quote linked to the job is listed.
- **Given** a line with no name, **when** I create it, **then** I see "Every line needs a name.".
- **Given** the variation quote, **when** I open it, **then** I can send it to the customer like any quote.

**Implementation notes**
- API: `POST /jobs/:id/variation-orders` (`variation_orders.edit_own`); delegates to `QuotesService.create`.
- Data: `job_variation_orders` (`quote_id`, `job_id`).

### US-JOB-10 · Apply an accepted variation order to the job
**Feature:** F-JOB-04 · **Priority:** P2 · **Phase:** 3 · **Screens:** `JobVariations`
**As** office staff, **I want** to add an accepted variation's total to the contract, **so that** milestones and costing use the new value.

**Acceptance criteria**
- **Given** the customer accepted a variation quote, **when** it's recorded, **then** the office gets a `variation_order_accepted` notification.
- **Given** an accepted variation, **when** I press "Apply to job", **then** the job's contract value increases by its total and the variation shows "Applied".
- **Given** an applied variation, **when** I view it, **then** it can't be applied again.
- **Given** a variation not yet accepted, **when** I view it, **then** "Apply to job" isn't offered.

**Implementation notes**
- API: `POST /jobs/:id/variation-orders/:variationOrderId/apply` (`variation_orders.apply`).

### US-JOB-11 · Upload site photos to a job
**Feature:** F-JOB-05 · **Priority:** P2 · **Phase:** 3 · **Screens:** `JobPhotos`
**As** office staff or field crew, **I want** to attach site photos to a job, **so that** there's a record of progress and condition.

Legacy: S-04.10 (web)

**Acceptance criteria**
- **Given** the "Photos" tab, **when** I press "Add photo" and choose images up to 10 MB each, **then** they upload and appear in a grid with caption, uploader and time.
- **Given** a photo, **when** I click it, **then** it opens full size with its caption and source ("Site photo" or "Milestone completion").
- **Given** no photos, **when** I open the tab, **then** I see "No photos yet.".
- **Given** a file over 10 MB, **when** I upload it, **then** it's refused with a size message.

**Implementation notes**
- API: `POST /files`, `POST /jobs/:id/photos` (`job_photos.edit_own`; Field always for own).
- Data: `job_photos`, `files` (proxied, never public).

### US-JOB-12 · Add notes to a job
**Feature:** F-JOB-05 · **Priority:** P2 · **Phase:** 3 · **Screens:** `JobNotes`
**As** office staff or field crew, **I want** to leave notes on a job, **so that** the team shares what's happening on site.

**Acceptance criteria**
- **Given** the "Notes" tab, **when** I type in "Add a note about this job…" and press "Add", **then** the note appears at the top with my name and time.
- **Given** no notes, **when** I open the tab, **then** I see "No notes yet.".
- **Given** saving fails, **when** the error returns, **then** I see "Could not add this note." and my text stays.

**Implementation notes**
- API: `POST /jobs/:id/notes` (`job_notes.edit_own`; Field always for own).

### US-JOB-13 · See a job's cost, revenue and margin as it runs
**Feature:** F-JOB-06 · **Priority:** P1 · **Phase:** 4 · **Screens:** `JobCosting`
**As** an owner, **I want** live cost, revenue and margin for a job, **so that** I know it's going wrong before it's finished.

Legacy: S-04.8

**Acceptance criteria**
- **Given** the "Costing" tab, **when** it loads, **then** I see "Job costing" with "Contract value", "Revenue recognised", "Cost", "Margin" and "Margin %".
- **Given** an issued progress invoice tagged to the job, **when** I reload, **then** "Revenue recognised" includes it.
- **Given** a job with no costs yet, **when** I view it, **then** cost is 0.00 and the note explains costs come from vendor bills and expenses tagged to the job.

**Implementation notes**
- API: `GET /jobs/:id/costing` (from `journal_lines.job_id`, D-011). Gating the tab and route by `reports.view_job_profitability` is US-JOB-19 (Phase 5).

### US-JOB-14 · Count tagged bills and expenses as job cost
**Feature:** F-JOB-06 · **Priority:** P1 · **Phase:** 4 · **Screens:** `JobCosting`
**As** an owner, **I want** vendor bills and approved expenses tagged to a job to count as its cost, **so that** margin is real.

**Acceptance criteria**
- **Given** a vendor bill tagged to the job is recorded, **when** I reload Costing, **then** cost increases by its net amount.
- **Given** an expense tagged to the job is approved, **when** I reload, **then** cost includes it; a submitted or rejected expense doesn't count.
- **Given** a tagged bill is voided, **when** I reload, **then** its cost is removed.

**Implementation notes**
- Postings P11, P12, P15 carry `job_id`.

### US-JOB-15 · Assign crew to a job
**Feature:** F-JOB-07 · **Priority:** P2 · **Phase:** 5 · **Screens:** `JobCrew`
**As** office staff, **I want** to choose who works on a job, **so that** their phones show it.

**Acceptance criteria**
- **Given** the "Crew" tab, **when** I pick a member in "Add a user…" and press "Assign", **then** they're listed on the crew.
- **Given** a crew member, **when** I remove them, **then** they're removed and the job leaves their mobile list on next refresh.
- **Given** no crew, **when** I open the tab, **then** I see "No one is assigned to this job yet.".
- **Given** I lack `jobs.assign`, **when** I open the tab, **then** I can see the crew but not change it.

**Implementation notes**
- API: `GET/POST /jobs/:id/assignees`, `DELETE /jobs/:id/assignees/:userId` (`jobs.assign`).
- Data: `job_assignments`.

### US-JOB-16 · Show field crew only their assigned jobs
**Feature:** F-JOB-07 · **Priority:** P1 · **Phase:** 5 · **Screens:** `JobCrew`, `MobJobsList`
**As** an owner, **I want** each field user's phone to list only jobs they're assigned to, **so that** their app stays focused.

**Acceptance criteria**
- **Given** Marcus is assigned to two jobs, **when** his app loads jobs, **then** exactly those two are listed.
- **Given** Marcus is removed from a job, **when** his app refreshes, **then** it's gone from his list and its cached copy is cleared.
- **Given** an Owner or Staff user who is on no crew, **when** their app requests the mobile job feed, **then** it returns an empty list and the app shows "No jobs assigned to you yet".

**Implementation notes**
- API: `GET /jobs?assignedToMe=true` (built). The app screens aren't built yet; the server-forced Field filter is US-JOB-19.

### US-JOB-17 · Let a Team edit only its own jobs
**Feature:** F-JOB-08 · **Priority:** P1 · **Phase:** 4 · **Screens:** `JobEditDialog`, `JobMilestones`
**As** an owner, **I want** own/others rights for jobs and milestones, **so that** crews and office staff can't overwrite each other's billing setup.

Legacy: S-04.11

**Acceptance criteria**
- **Given** a member with `jobs.edit_own` only, **when** they open a job someone else created, **then** "Edit job" is hidden and `PUT /jobs/:id` returns 403.
- **Given** a member with `jobs.edit_own`, **when** they open a job they created, **then** "Edit job" is shown and saving succeeds.
- **Given** a member with `jobs.edit_others`, **when** they edit a colleague's job, **then** the save succeeds.

**Implementation notes**
- Ownership: `jobs.created_by_user_id`. Milestone-set ownership moves to the job's creator in US-JOB-20 ([D-079](../prd/12-decisions.md)); today it is whoever last replaced the set.

### US-JOB-18 · Let field crew complete any milestone
**Feature:** F-JOB-08 · **Priority:** P1 · **Phase:** 4 · **Screens:** `JobMilestones`
**As** an owner, **I want** field users always able to mark milestones complete, **so that** billing isn't blocked by who defined the milestones.

**Acceptance criteria**
- **Given** a field user, **when** they complete a milestone defined by anyone, **then** it succeeds.
- **Given** a field user, **when** they try to edit or redefine milestones, **then** it's refused.
- **Given** the effective capabilities of a field user, **when** the web UI renders a job, **then** "Mark complete" is shown and "Edit milestones" isn't.

**Implementation notes**
- `FIELD_ALWAYS_CAPABILITIES` includes `milestones.edit_own` and `milestones.edit_others` for completion (D-019).

### US-JOB-19 · Keep money and unassigned jobs away from field crew
**Feature:** F-JOB-07 · **Priority:** P1 · **Phase:** 5 · **Screens:** `JobCosting`, `MobJobsList`, `MobJobDetail`
**As** an owner, **I want** the server to give Field users only their assigned jobs and no money, **so that** a phone can never leak contract values or other crews' work.

Decision: D-072 · Review findings: Stage 5 #3, #13, #65

**Acceptance criteria**
- **Given** a Field user, **when** they call `GET /jobs` with or without `assignedToMe`, **then** only jobs they're assigned to are returned.
- **Given** a Field user, **when** they call `GET /jobs/:id` (or its milestones, photos or notes) for a job they aren't assigned to, **then** the API returns 404.
- **Given** a Field user, **when** any job or milestone response is returned, **then** it has no `contractValue`, `retentionPct`, milestone `amount` or `resolvedAmount` fields.
- **Given** a member without `reports.view_job_profitability` (every Field user, and Staff without the grant), **when** they call `GET /jobs/:id/costing`, **then** the API returns 403.
- **Given** the same member on the web, **when** they open a job, **then** the "Costing" tab isn't shown.
- **Given** a Field user, **when** they call `GET /jobs/milestones/due`, **then** only milestones on their assigned jobs are returned, without amounts.

**Implementation notes**
- API: `JobsService.list/get` take the caller's role; Field forces `assignedToUserId`. `@RequireCapability("reports.view_job_profitability")` on `GET /jobs/:id/costing` (Field never passes).
- Data: `job_assignments`.
- Edge: Owners and Staff are unaffected except for the costing capability.

### US-JOB-20 · Own a job's milestones through the job
**Feature:** F-JOB-08 · **Priority:** P1 · **Phase:** 6 · **Screens:** `JobMilestones`, `MilestonesEditor`
**As** an owner, **I want** a job's milestones to belong to whoever created the job, **so that** staff can set up billing on their own jobs and "own" never changes hands.

Decision: D-079 · Review finding: Stage 5 #24

**Acceptance criteria**
- **Given** a member with `milestones.edit_own` only, **when** they press "Define milestones" or "Edit milestones" on a job they created, **then** the editor opens and saving succeeds.
- **Given** the same member on a job a colleague created, **when** they open "Milestones", **then** "Define milestones" / "Edit milestones" are hidden and `PUT /jobs/:id/milestones` returns 403.
- **Given** a member with `milestones.edit_others`, **when** they edit milestones on a colleague's job, **then** saving succeeds.
- **Given** a colleague replaces the milestone set, **when** ownership is checked later, **then** it is still the job's creator.
- **Given** a job with a null creator (pre-migration row), **when** a member with only `milestones.edit_own` tries to edit milestones, **then** it's refused.

**Implementation notes**
- API: `MilestonesService.setAll` checks ownership against `jobs.created_by_user_id`, not the set's last author.
- Field completion of milestones is unchanged (`FIELD_ALWAYS_CAPABILITIES`, US-JOB-18).

### US-JOB-21 · Show retention on a progress invoice
**Feature:** F-JOB-03 · **Priority:** P1 · **Phase:** 6 · **Screens:** `InvoiceDetailRetention`
**As** an owner, **I want** a progress invoice to show what was held back, **so that** the customer and I can see why the amount due is lower.

Review finding: Stage 5 #14

**Acceptance criteria**
- **Given** an issued progress invoice with retention, **when** I open it, **then** the totals show "Subtotal", "Tax", "Total", "Retention held (<pct>%)" as a negative amount and "Amount due".
- **Given** the same invoice, **when** I view its header, **then** it shows "Job" with "<job number> · <job name>" and "Milestone" with "<milestone name> (<pct>%)", each linking to the job.
- **Given** the invoice PDF and email, **when** they render, **then** they show the same retention and amount-due rows.
- **Given** a progress invoice with 0% retention, **when** I open it, **then** no retention row is shown.
- **Given** retention is held, **when** the totals render, **then** a note reads "Retention is held in Retention Receivable until you release it from the job. Held on this job so far: <amount>.".

**Implementation notes**
- Data: `invoices.retention_amount`, `invoices.job_id`, `invoices.milestone_id`.
- UI: invoice detail totals block and `InvoicePdf`.

### US-JOB-22 · Number every job
**Feature:** F-JOB-01 · **Priority:** P3 · **Phase:** 6 · **Screens:** `JobsList`, `JobFromQuote`, `MobJobDetail`
**As** office staff, **I want** each job to have a short number, **so that** the crew and office can refer to it unambiguously.

Review finding: Stage 5 #55

**Acceptance criteria**
- **Given** a job is created (from a quote or directly), **when** it saves, **then** it gets the next number from the Job sequence (default prefix "JOB", padding 3, e.g. "JOB-007").
- **Given** Settings › Numbering, **when** I change the Job prefix or starting number, **then** the next new job uses it.
- **Given** the jobs list, job detail and the phone's job screen, **when** they render, **then** the number shows next to the customer.
- **Given** existing jobs created before this story, **when** the migration runs, **then** they're numbered in creation order.

**Implementation notes**
- Data: new `jobs.number` (text, unique per org); allocated in the creating transaction under the `number_sequences` row lock (D-007).
- Jobs aren't financial documents, but the number is still permanent once given.

### US-JOB-23 · Name new jobs after their quote
**Feature:** F-JOB-01 · **Priority:** P2 · **Phase:** 6 · **Screens:** `JobFromQuote`, `JobsList`
**As** office staff, **I want** a job created from a quote to take the quote's title, **so that** lists don't fill up with "Job for QUO-0002".

Decision: D-090

**Acceptance criteria**
- **Given** an accepted quote titled "Additional electrical outlets", **when** I convert it to a job, **then** the job is named "Additional electrical outlets".
- **Given** a quote with no title, **when** it's converted, **then** the job is named after its first line's item (e.g. "Project management") followed by " — <customer>".
- **Given** the same quote is converted twice (D-026), **when** the second job is created, **then** its name ends " (2)".
- **Given** existing jobs named "Job for QUO-…", **when** the migration runs, **then** they're renamed by the same rules and the change is recorded in each job's history.

**Implementation notes**
- API: `JobsService.createFromQuote` naming; one-off backfill migration.
