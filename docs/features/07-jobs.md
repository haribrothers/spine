# 07 · Jobs & milestones

A job is the work behind an accepted quote: its contract value, billing milestones (percentages or fixed amounts that must add up), retention held on each progress invoice and released at the end, variation orders that change the scope, site photos and notes, the crew assigned to it, and live costing from the ledger — against a cost budget, split by cost category, with how much of the contract has been billed.

**Screens:** `JobsList` (P1), `JobsEmpty` (P1), `JobFromQuote` (P1), `JobEditDialog` (P1), `JobMilestones` (P1), `MilestonesEditor` (P1), `CompleteMilestoneDialog` (P1), `ReleaseRetentionConfirm` (P2), `JobVariations` (P2), `RaiseVariationDialog` (P2), `JobPhotos` (P2), `JobNotes` (P2), `JobCosting` (P1), `JobCrew` (P2), `InvoiceDetailProgress` (P1), `MobJobsList` (P1), `InvoiceDetailRetention` (P1), `JobEditDialogBudget` (P1), `JobCostingBudget` (P1), `JobsListBilling` (P1), `InvoiceDetailProgressClaim` (P2), `JobsListRefined` (P2), `JobsListRefinedDark` (P2), `JobNewDrawer` (P2), `JobDetailRefined` (P2), `JobDetailCompleted` (P2), `JobPhotosViewer` (P2)
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
| F-JOB-09 | Cost budget and billing progress | P1 | 7 | `JobEditDialogBudget`, `JobCostingBudget`, `JobsListBilling`, `InvoiceDetailProgressClaim` |
| F-JOB-10 | Jobs you can run from one place: start a job from the list, cards that filter, progress in each row, a job page that says what's next, photos you can browse, and what happened | P2 | Refinements | `JobsListRefined`, `JobsListRefinedDark`, `JobNewDrawer`, `JobDetailRefined`, `JobDetailCompleted`, `JobPhotosGrouped`, `JobPhotosViewer` |

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
- API: `GET /jobs/:id/costing` (from `journal_lines.job_id`, D-011). Gating the tab and route by `reports.view_job_profitability` is US-JOB-19 (Phase 6, D-114).

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
- API: `GET /jobs?assignedToMe=true` (built); the server-forced Field filter is US-JOB-19. The field app's Jobs tab and Today read it; on each refresh the phone drops the cached copy (detail, milestones, photos, quotes) of any job that left the list.

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
**Feature:** F-JOB-07 · **Priority:** P1 · **Phase:** 6 · **Screens:** `JobCosting`, `MobJobsList`, `MobJobDetail`
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
- Quotes have no title field, so the "no title" rule applies to every quote for now ([D-122](../prd/12-decisions.md)).
- API: `JobsService.createFromQuote` naming; one-off backfill migration.

### US-JOB-24 · Set a cost budget for a job
**Feature:** F-JOB-09 · **Priority:** P1 · **Phase:** 7 · **Screens:** `JobEditDialogBudget`
**As** an owner, **I want** to record what a job should cost, **so that** I can see spending against a target, not just against revenue.

Decision: D-125

**Acceptance criteria**
- **Given** a job, **when** I press "Edit job", **then** the dialog shows "Cost budget" (helper "What you expect this job to cost. Leave blank if you don't budget it.") after "Retention %".
- **Given** I enter 32,000.00 and save, **when** the job reloads, **then** the budget is 32,000.00 and the job's history records the change from "—" to 32,000.00 with who and when.
- **Given** a negative amount, **when** I save, **then** I see "Enter a budget of zero or more." and nothing saves.
- **Given** I clear the field and save, **when** the job reloads, **then** it has no budget and the Costing tab shows "No budget set" (US-JOB-25).
- **Given** a Field user, **when** any job response is returned, **then** it has no `costBudgetAmount` field (US-JOB-19).
- **Given** an accepted variation order is applied (US-JOB-10), **when** the contract value rises, **then** the budget is unchanged until someone edits it.

**Implementation notes**
- API: `PUT /jobs/:id` accepts `costBudgetAmount` (minor units, nullable, ≥ 0); `GET /jobs/:id` returns it to Owners and Staff (`jobs.edit_own`/`edit_others` to change it).
- Data: `jobs.cost_budget_amount bigint` (nullable).
- The budget is a target, not a ledger figure: nothing posts when it changes.

### US-JOB-25 · See budget spent and get warned before going over
**Feature:** F-JOB-09 · **Priority:** P1 · **Phase:** 7 · **Screens:** `JobCostingBudget`, `JobsListBilling`, `DashboardOwnerConstruction`
**As** an owner, **I want** each job to show how much of its budget is used, **so that** I act before a job loses money.

Decision: D-125

**Acceptance criteria**
- **Given** a job with a 32,000.00 budget and 24,800.00 of cost, **when** I open "Costing", **then** a "Budget" card shows "Cost budget 32,000.00", "Spent 24,800.00", "Remaining 7,200.00" and a bar labelled "78% of budget used".
- **Given** cost reaches 80% of the budget, **when** the card renders, **then** the bar shows the warning colour and the label "Nearing budget — 85% used" with a warning icon.
- **Given** cost passes the budget, **when** the card renders, **then** it reads "Over budget by 1,450.00" with the danger colour and icon, "Remaining" shows "−1,450.00", and the bar is full.
- **Given** a job with no budget, **when** the card renders, **then** it reads "No budget set" with "Set a budget" opening the edit dialog (hidden without `jobs.edit_*` on this job).
- **Given** the Jobs list and a member with `reports.view_job_profitability`, **when** it renders, **then** a "Budget used" column (one of the list's Columns since D-215) shows each job's percentage with the same three states in text ("78%", "Nearing · 85%", "Over · 104%"), and "—" for jobs without a budget.
- **Given** jobs over budget and a member with `reports.view_job_profitability`, **when** "Needs your attention" renders (US-DASH-12), **then** a row reads "<n> job(s) over budget" naming the first job and how much it is over, with "Review" opening its Costing tab; the row comes after vendor bills due.

**Implementation notes**
- API: `GET /jobs/:id/costing` gains `budget: { amount, spent, remaining, usedPct, state: "none"|"ok"|"near"|"over" }`; `GET /jobs?include=costing` adds `budgetUsedPct` and `budgetState` per job only for callers with `reports.view_job_profitability`; `/dashboard/attention` gains kind `job_over_budget` (same capability).
- "Spent" is the job's cost from `journal_lines.job_id` (D-011), the same figure as "Cost" (US-JOB-13).
- Thresholds: near at ≥ 80%, over at > 100%. Colour is never the only signal (icon and text).

### US-JOB-26 · See a job's cost by category
**Feature:** F-JOB-09 · **Priority:** P1 · **Phase:** 7 · **Screens:** `JobCostingBudget`
**As** an owner, **I want** a job's cost split into materials, labour, subcontractors, plant and the rest, **so that** I can see which kind of cost is running away.

**Acceptance criteria**
- **Given** a job with recorded bills and approved expenses, **when** I open "Costing", **then** a "Cost by category" card lists each expense account that carries cost for the job with its amount and share ("Cost of Materials · 11,200.00 · 45%"), largest first, with a donut beside it.
- **Given** the rows, **when** they're totalled, **then** the sum equals "Cost" exactly.
- **Given** a member with `ledger.view`, **when** they click a row, **then** the account drill-down opens filtered to this job (US-RPT-03); without it the rows aren't links.
- **Given** a job with no cost, **when** the card renders, **then** it reads "No costs yet — bills and approved expenses tagged to this job show up here.".
- **Given** more than six accounts, **when** the donut renders, **then** it shows the five largest and "Other", while the list shows every account.

**Implementation notes**
- API: `GET /jobs/:id/costing` gains `byCategory: [{ accountId, code, name, amount, sharePct }]`, grouped from `journal_lines` with this `job_id` on expense accounts (D-011). Never from documents.
- A category is the expense account a bill line or expense category posts to; the Construction template's defaults (US-ONB-13) make these read as materials, subcontractors, labour, plant hire, fuel and freight, and site overheads.
- UI: `DonutChart`; amounts and shares are written beside each slice (colour isn't the only signal).

### US-JOB-27 · See how much of the contract has been billed
**Feature:** F-JOB-09 · **Priority:** P1 · **Phase:** 7 · **Screens:** `JobCostingBudget`, `JobsListBilling`
**As** an owner, **I want** to see billed to date against the contract value, **so that** I know how much is left to claim.

Decision: D-127

**Acceptance criteria**
- **Given** a job with a 48,500.00 contract and issued progress invoices totalling 19,400.00, **when** I open "Costing", **then** a "Billing" card shows "Contract value 48,500.00", "Billed to date 19,400.00 (40%)" and "Left to bill 29,100.00" with a bar.
- **Given** a credit note against one of those invoices, **when** I reload, **then** "Billed to date" drops by the credit note's total.
- **Given** an advance invoice or a retention-release invoice on the job, **when** billed to date is worked out, **then** neither counts (the deposit is counted once it's offset on a progress invoice).
- **Given** the Jobs list and a member with `reports.view_job_profitability`, **when** it renders, **then** each job's billed percentage shows ("40%"; in the Progress column beside complete % since US-JOB-33).
- **Given** billed to date exceeds the contract value, **when** the card renders, **then** "Left to bill" reads "Billed over contract by <amount>" so a missing variation order is noticed.

**Implementation notes**
- API: `GET /jobs/:id/costing` gains `billing: { contractValue, billedToDate, billedPct, leftToBill }`; `GET /jobs?include=costing` adds `billedPct`.
- Billed to date is gross (tax included, before retention), read from `journal_lines` with this `job_id` on 1100 AR and 1150 Retention Receivable for `invoice` and `credit_note` entries, excluding retention-release entries (D-127). The contract value is the quote total, which also includes tax.

### US-JOB-28 · Record how complete a job is and compare it with billing
**Feature:** F-JOB-09 · **Priority:** P2 · **Phase:** 7 · **Screens:** `JobEditDialogBudget`, `JobCostingBudget`
**As** an owner, **I want** to set a job's percent complete and see it beside billed %, **so that** I spot over-billing or work I haven't claimed yet.

Decision: D-127

**Acceptance criteria**
- **Given** "Edit job", **when** it opens, **then** it shows "Percent complete" (0–100, helper "Your estimate of how much of the work is done.").
- **Given** 120 or a negative number, **when** I save, **then** I see "Enter a percentage from 0 to 100." and nothing saves.
- **Given** a job 55% complete and 40% billed, **when** I open "Costing", **then** the Billing card shows "Work complete 55%" and "Billing is 15 points behind the work — check for a milestone to invoice."
- **Given** a job 30% complete and 40% billed, **when** the card renders, **then** it reads "Billing is 10 points ahead of the work."
- **Given** the gap is under 10 points or percent complete is blank, **when** the card renders, **then** no comparison line is shown.
- **Given** a Field user, **when** a job response is returned, **then** `percentComplete` is included (it isn't money) but the billing comparison isn't.

**Implementation notes**
- API: `PUT /jobs/:id` accepts `percentComplete` (0–100, nullable); `GET /jobs/:id/costing` `billing` gains `percentComplete` and `gapPts` (billed % − complete %).
- Data: `jobs.percent_complete numeric(5,2)` (nullable).
- Edge: setting a job to "Completed" doesn't change percent complete; the owner sets it.

### US-JOB-29 · Number each progress claim on a job
**Feature:** F-JOB-02 · **Priority:** P2 · **Phase:** 7 · **Screens:** `InvoiceDetailProgressClaim`
**As** office staff, **I want** each progress invoice to say which claim it is on the job, **so that** the customer and I can refer to "claim 3" the way the trade does.

Decision: D-128

**Acceptance criteria**
- **Given** a job whose first two progress invoices are issued, **when** a third is issued, **then** it shows "Progress claim 3" in its header beside the job and milestone.
- **Given** a draft progress invoice, **when** I view it, **then** no claim number is shown ("Claim number is given when the invoice is issued.").
- **Given** claim 2 is voided, **when** the next progress invoice on that job is issued, **then** it is claim 3 and claim 2 keeps its number, shown as "Progress claim 2 (void)".
- **Given** the invoice PDF and email, **when** they render, **then** they show "Progress claim 3 · <job number>" under the invoice number.
- **Given** an advance, standard or retention-release invoice, **when** it's issued, **then** it gets no claim number.

**Implementation notes**
- Data: `invoices.progress_claim_no integer` (nullable); unique (`job_id`, `progress_claim_no`); allocated in the issuing transaction as max + 1 for the job under the job row's lock.
- The invoice keeps its gapless organisation-wide number (D-007); the claim number is a per-job label, not a document number.
- API: invoice responses gain `progressClaimNo`; the issued PDF stored at issue includes it (US-INV-17).

### US-JOB-30 · Start a job from the jobs list
**Feature:** F-JOB-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `JobNewDrawer`
**As** an owner, **I want** to start a job without a quote, **so that** work agreed on the phone or a site visit is tracked from day one.

Decision: D-215

**Acceptance criteria**
- **Given** Jobs, **when** I have `jobs.edit_own`, **then** the toolbar and the empty state have "New job"; without the right, neither shows.
- **Given** "New job", **when** the drawer opens, **then** it asks for Contact (required), Job name (required), Site address (filled from the contact's site address, else its billing address, and changeable), Currency (the business's), Contract value, Retention %, Start and End dates and Notes; an end date before the start says "End the job on or after its start date.".
- **Given** the drawer, **when** I choose "Start from an accepted quote" and pick one, **then** the quote is converted as from the quote's page (its contact and contract value, named after its first item, and linked to it), with the repeat-conversion warning when it applies (US-QUO-16); quotes that already have a job aren't offered.
- **Given** I save, **when** the job is created, **then** its page opens on Milestones with "Set up how this job is billed" and "Add milestones"; a toast says "Job JOB-007 created".

**Implementation notes**
- API: `POST /jobs` and `POST /jobs/from-quote/:quoteId` (built). UI: `new-job-drawer.tsx`; accepted quotes from `GET /quotes?status=accepted` without a job yet.

### US-JOB-31 · See active, ready-to-bill, over-budget jobs and retention at a glance
**Feature:** F-JOB-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `JobsListRefined`, `JobsListRefinedDark`
**As** an owner, **I want** the cards to say what needs doing, **so that** I bill on time and catch jobs going over.

Decision: D-215

**Acceptance criteria**
- **Given** Jobs, **when** it shows, **then** the cards read "Active" (with their contract value), "Ready to bill" (jobs with a completed milestone not yet invoiced, with that amount), "Over or near budget" (only with `reports.view_job_profitability`) and "Retention held" (the total held on 1150 Retention Receivable for the jobs, with "Across N jobs").
- **Given** "Active", "Ready to bill" or "Over or near budget", **when** I press it, **then** the table shows just those jobs, the card shows pressed and the address keeps it; pressing again clears it. With a keyboard or screen reader each is a button ("Show jobs ready to bill, 2").
- **Given** a Field user, **when** Jobs shows, **then** no money cards show (US-JOB-19).

**Implementation notes**
- API: `GET /jobs?include=billing` (Owner and Staff) adds `readyToBillCount`, `readyToBillAmount` (completed, not invoiced milestones) and `retentionHeld` (the job's 1150 journal lines). UI: `jobs-list-state.ts`.

### US-JOB-32 · Search, filter and come back to the same jobs list
**Feature:** F-JOB-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `JobsListRefined`
**As** office staff, **I want** the jobs list to keep my search and filters and refresh on request, **so that** it works like the rest of the app.

Decision: D-210, D-215

**Acceptance criteria**
- **Given** the toolbar, **when** it shows, **then** it has Status, Contact (only contacts with a job), "Updated … ago", Refresh and "New job", with search (number, name, contact, site address) on its own row beside Columns.
- **Given** a search, filter, card, sort or page, **when** I set it, **then** the address keeps it (`/jobs?status=active&card=ready`); "Clear filters" clears them; Refresh, and coming back after 30 seconds, reload in place.

**Implementation notes**
- UI: the list-state pattern (`quotes-list-state.ts`), `replaceQuery`.

### US-JOB-33 · Read a job's next milestone and progress in the list
**Feature:** F-JOB-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `JobsListRefined`
**As** office staff, **I want** each row to say what's next and how far along it is, **so that** I don't open every job.

Decision: D-215

**Acceptance criteria**
- **Given** the table, **when** a row shows, **then** it reads Job (the name, with the number and site address under it), Contact, Status, Next milestone (its name with "Due 14 Oct", "Due in 3 days" or "Overdue 2 days", or "All billed"), Progress (complete % and billed % as two short bars, with numbers), End date and Contract value.
- **Given** a job billed over its contract, **when** the row shows, **then** Billed reads "118%" in the overdue colour with a warning icon and "Billed over the contract" on hover.
- **Given** a Field user, **when** the table shows, **then** it has no money or billed figures (US-JOB-19).

**Implementation notes**
- API: `GET /jobs?include=next_milestone,costing,billing` (built and above). UI: `jobs-table.tsx`.

### US-JOB-34 · See a job at a glance, change its status and take the next step
**Feature:** F-JOB-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `JobDetailRefined`, `JobDetailCompleted`
**As** an owner, **I want** the job page to lead with where the job stands and what to do next, **so that** I act without hunting.

Decision: D-215

**Acceptance criteria**
- **Given** a job, **when** its page opens, **then** the page title is its number, with the name, the contact (a link), the site address (opening a map), and "Started 22 Jul · Due 30 Nov" in the business's date format; there's no separate "Back to jobs" link.
- **Given** the status, **when** I open it (with the right to edit the job), **then** I can choose Active, On hold, Completed or Cancelled; the change saves at once with a toast, and Cancelled asks first.
- **Given** the job, **when** the page shows, **then** one primary button offers the next step: "Invoice <milestone>" when a milestone is completed and not invoiced, else "Complete <next milestone>", else "Release retention" when the job is completed with retention held; Edit job, Raise variation, Add photo and View history sit beside it or under More.
- **Given** the figures, **when** they show, **then** a strip reads Contract (with "incl. variations"), Billed (amount, % and a bar), Cost against budget (with its state), Margin and % complete; Field users see only % complete.

**Implementation notes**
- API: `PUT /jobs/:id` `{ status }` (built). UI: `job-detail.tsx` header and figures.

### US-JOB-35 · Follow a job's milestones and billing at a glance
**Feature:** F-JOB-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `JobDetailRefined`
**As** office staff, **I want** the milestones shown as progress, **so that** I see what's billed and what's next.

Decision: D-215

**Acceptance criteria**
- **Given** the tabs, **when** they show, **then** each has its count: Milestones 3, Variation orders 1, Photos 6, Notes 2, Crew 2.
- **Given** Milestones, **when** it shows, **then** it starts with "Billed ₹56,16,800 of ₹68,00,000" and a bar, then each milestone in order with a step marker (invoiced, completed or pending), its amount and share, "Due 30 Oct · in 20 days" or "Overdue 3 days" (in the overdue colour), and its action (View invoice, Raise invoice, Mark complete).

**Implementation notes**
- UI: `milestones-section.tsx`; counts from the data the tabs already load.

### US-JOB-36 · Browse, upload and group site photos
**Feature:** F-JOB-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `JobPhotosGrouped`, `JobPhotosViewer`
**As** a site manager, **I want** to add several photos at once and look through them full size, **so that** the job's record is easy to keep and use.

Decision: D-215

**Acceptance criteria**
- **Given** Photos, **when** I press "Add photos" or drop files, **then** I can add several at once, each uploading with its own progress; one that fails says why and the rest still upload.
- **Given** photos, **when** they show, **then** they're grouped under "Site photos" and each milestone they were added with ("Site preparation · completed 7 Aug").
- **Given** a photo, **when** I open it, **then** it shows full size with its caption, who added it and when, with Previous and Next (also ← and →) and Close (Esc); "Download" saves the original.

**Implementation notes**
- API: `POST /jobs/:id/photos` per file (built). UI: `photos-section.tsx`, `photo-viewer.tsx`.

### US-JOB-37 · Follow what happened on a job
**Feature:** F-JOB-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `JobDetailRefined`
**As** an owner, **I want** a job's story in one place, **so that** I know what changed and who did it.

Decision: D-215

**Acceptance criteria**
- **Given** a job's page, **when** it shows, **then** an "Activity" panel lists, newest first: created (from quote <number>), status changed, milestones set, milestone completed and invoiced (with the invoice number), variation order raised and applied, photos and notes added, crew assigned or removed, and retention released, with who and when; more than eight show "Show N earlier".
- **Given** a Field user, **when** the job shows, **then** there's no Activity panel.

**Implementation notes**
- API: `GET /jobs/:id/activity` → `[{ at, type, actorName, detail, linkId }]` from the job's audit entries and those of its milestones, photos and notes, plus its invoices (roles: owner, staff).

### US-JOB-38 · Show real site photos in the demo
**Feature:** F-JOB-10 · **Priority:** P3 · **Phase:** Refinements · **Screens:** `JobPhotosViewer`
**As** someone trying Spine, **I want** the demo's job photos to look like site photos, **so that** Photos doesn't look broken.

Decision: D-215

**Acceptance criteria**
- **Given** demo data, **when** it's loaded, **then** each demo job's photos are real site photos from Unsplash (free to reuse; bundled, each under 150 KB, with each photo's source and licence recorded next to them) in place of the 1 × 1 placeholder.
- **Given** demo data is removed, **when** it's deleted, **then** its photos are deleted with it, as today.

**Implementation notes**
- API: `apps/api/assets/demo/`; `DemoSeederService` uploads them through `StorageDriver`.
