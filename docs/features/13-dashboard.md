# 13 · Dashboard

One dashboard that adapts to who's looking: a pinned row of key figures, charts for owners and permitted staff, "my day" widgets for everyone, an organisation-wide activity feed, and per-user layout that follows the person across devices. Every widget is gated server-side by the same right as its full report, so the dashboard adds no new access.

**Screens:** `DashboardOwner` (P1), `DashboardStaff` (P1), `DashboardField` (P2), `DashboardEditLayout` (P3), `SettingsUpcomingMeetings` (P2), `DashboardOwnerRedesign` (P1), `DashboardStaffRedesign` (P1), `DashboardFieldRedesign` (P2), `DashboardCaughtUp` (P1), `DashboardOwnerConstruction` (P1), `DashboardOwnerBooks` (P1)
**Depends on:** 12 Reports, 03 Contacts (activities, leads), 04 Meetings, 07 Jobs, 08 Invoicing, 15 Team (capabilities).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-DASH-01 | Key figures and role-adaptive layout | P1 | 4 | `DashboardOwner`, `DashboardStaff`, `DashboardField` |
| F-DASH-02 | Financial charts | P1 | 4 | `DashboardOwner`, `DashboardStaff` |
| F-DASH-03 | My day widgets | P1 | 4 | `DashboardOwner`, `DashboardStaff`, `DashboardField`, `SettingsUpcomingMeetings` |
| F-DASH-04 | Recent activity feed | P2 | 4 | `DashboardOwner`, `DashboardField` |
| F-DASH-05 | Personal layout | P3 | 4 | `DashboardEditLayout` |
| F-DASH-06 | Attention list and today (redesign A) | P1 | 7 | `DashboardOwnerRedesign`, `DashboardCaughtUp`, `DashboardStaffRedesign`, `DashboardFieldRedesign` |
| F-DASH-07 | Key figures, money chart and activity (redesign A) | P1 | 7 | `DashboardOwnerRedesign`, `DashboardStaffRedesign`, `DashboardOwnerConstruction` |
| F-DASH-08 | Staff and field layouts (redesign A) | P1 | 7 | `DashboardStaffRedesign`, `DashboardFieldRedesign` |
| F-DASH-09 | Books cards: payables, top expenses, account balances, ready to bill, tax, cash basis | P1 | 8 | `DashboardOwnerBooks` |

## User stories

### US-DASH-01 · See cash, receivables, overdue and revenue at a glance
**Feature:** F-DASH-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `DashboardOwner`
**As** an owner, **I want** four key figures at the top of my dashboard, **so that** one screen tells me how things stand.

Legacy: S-09.10

**Acceptance criteria**
- **Given** I open the dashboard, **when** it loads, **then** the top row shows "Cash position", "Receivables", "Overdue invoices" and "Revenue this month".
- **Given** a payment is recorded, **when** I reload, **then** Cash position and Receivables reflect it.
- **Given** "Edit layout", **when** I rearrange widgets, **then** this row stays fixed at the top and can't be moved or hidden.
- **Given** a Staff member without `reports.view_dashboard_summary`, **when** they open the dashboard, **then** the row is absent (not greyed out).

**Implementation notes**
- API: `GET /reports/dashboard-summary` (`reports.view_dashboard_summary`).
- UI: `dashboard-summary.tsx` rendered outside the reorderable list.
- Superseded in Phase 7 by US-DASH-14 (dashboard redesign, [D-087](../prd/12-decisions.md)); this story stays as the record of what's built.

### US-DASH-02 · Get a dashboard that fits my role
**Feature:** F-DASH-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `DashboardStaff`, `DashboardField`
**As** any member, **I want** the dashboard to show only what my role can use, **so that** I'm not shown locked or empty panels.

Legacy: S-09.12

**Acceptance criteria**
- **Given** a Field user, **when** they open the dashboard on the web, **then** they see "My overdue follow-ups", "Upcoming meetings", "Job milestones due" and "Recent activity" with financial events excluded — no figures or charts.
- **Given** a Staff user, **when** they open it, **then** they see the widgets their Team grants plus the no-capability widgets.
- **Given** any widget a role can't see, **when** the dashboard renders, **then** it's left out entirely, never shown disabled.
- **Given** a widget's data request, **when** the user lacks the right, **then** the API returns 403 even if called directly.

**Implementation notes**
- UI: `dashboard-shell.tsx`, `widget-registry.tsx` (`DASHBOARD_WIDGETS` in `@spine/shared`).

### US-DASH-03 · See the revenue trend and pipeline by stage
**Feature:** F-DASH-02 · **Priority:** P1 · **Phase:** 4 · **Screens:** `DashboardOwner`
**As** an owner, **I want** a revenue trend with a selectable range and a pipeline-by-stage chart, **so that** I see direction, not just a snapshot.

Legacy: S-09.11

**Acceptance criteria**
- **Given** "Revenue trend", **when** I choose "3M", "6M" or "12M", **then** the bars show monthly revenue for that many months.
- **Given** no revenue in range, **when** it renders, **then** I see "No revenue posted in this range yet.".
- **Given** "Pipeline by stage", **when** it renders, **then** each stage shows its lead count and value with "View board".
- **Given** a Staff user, **when** they open the dashboard, **then** "Revenue trend" is absent (Owner-only) and "Pipeline by stage" is shown (no capability needed).

**Implementation notes**
- API: `GET /reports/revenue-trend?months=` (roles: owner), `GET /leads/summary-by-stage`.
- UI: `TrendBarChart`, horizontal bar chart from `@spine/ui`.
- Superseded in Phase 7 by US-DASH-15 (money in and out) and US-DASH-12 (dashboard redesign, [D-087](../prd/12-decisions.md)); this story stays as the record of what's built.

### US-DASH-04 · See my overdue follow-ups
**Feature:** F-DASH-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `DashboardOwner`, `DashboardStaff`, `DashboardField`
**As** any member, **I want** my overdue follow-ups on my dashboard, **so that** I act on them.

Legacy: S-01.7

**Acceptance criteria**
- **Given** activities assigned to me with past follow-up dates and not done, **when** I open the dashboard, **then** "My overdue follow-ups" lists them oldest first with type, contact and how overdue.
- **Given** I click one, **when** it opens, **then** I'm on the contact's Activities tab.
- **Given** none, **when** it renders, **then** I see "Nothing overdue.".
- **Given** colleagues' overdue activities, **when** I view the widget, **then** they're not included.

**Implementation notes**
- API: `GET /activities/overdue` (scoped to the requesting user).
- Superseded in Phase 7 by US-DASH-16 (dashboard redesign, [D-087](../prd/12-decisions.md)); this story stays as the record of what's built.

### US-DASH-05 · See upcoming meetings
**Feature:** F-DASH-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `DashboardOwner`, `SettingsUpcomingMeetings`
**As** any member, **I want** my upcoming meetings for the next week, **so that** my day starts on the dashboard.

Legacy: S-09.12, S-10.19

**Acceptance criteria**
- **Given** meetings in the next 7 days I can see, **when** I open the dashboard, **then** "Upcoming meetings" lists them by time with "View calendar".
- **Given** Settings › Upcoming meetings, **when** an Owner chooses "Only my meetings" ("Each person's dashboard shows only the meetings they organize.") or "Every org meeting", **then** every Staff dashboard follows that choice.
- **Given** a Field user, **when** they see the widget, **then** it shows only their own meetings whatever the setting ("Field users always see only their own meetings, regardless of this setting.").
- **Given** nothing upcoming, **when** it renders, **then** I see "Nothing in the next 7 days.".

**Implementation notes**
- API: `GET /meetings/upcoming`; setting `settings.dashboard_meetings_scope`.
- Superseded in Phase 7 by US-DASH-16 (dashboard redesign, [D-087](../prd/12-decisions.md)); this story stays as the record of what's built.

### US-DASH-06 · See invoices and milestones coming due
**Feature:** F-DASH-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `DashboardOwner`, `DashboardField`
**As** any member, **I want** invoices due this week and milestones due soon, **so that** I see what needs doing.

**Acceptance criteria**
- **Given** issued invoices due in the next 7 days, **when** I open the dashboard, **then** "Invoices due this week" lists them with "Due today", "Due tomorrow" or the date and "View all".
- **Given** pending milestones with due dates soon, **when** it renders, **then** "Job milestones due" lists them with the job and a chip like "Due in 6d".
- **Given** none, **when** they render, **then** I see "Nothing due this week." and "Nothing due soon.".
- **Given** a Field user, **when** they view the dashboard, **then** "Invoices due this week" is absent.

**Implementation notes**
- API: `GET /reports/invoices-due-this-week` (owner, staff), `GET /jobs/milestones/due` (owner, staff, field). Gating invoices-due by `reports.view_receivables` (D-025) is US-OPS-20; scoping milestones for Field is US-JOB-19.
- Superseded in Phase 7 by US-DASH-12 and US-DASH-16 (dashboard redesign, [D-087](../prd/12-decisions.md)); this story stays as the record of what's built.

### US-DASH-07 · See receivables aging and job winners and losers
**Feature:** F-DASH-02 · **Priority:** P1 · **Phase:** 4 · **Screens:** `DashboardOwner`, `DashboardStaff`
**As** an owner, **I want** an aging chart and a ranked job list on the dashboard, **so that** cash risk and job performance are visible daily.

**Acceptance criteria**
- **Given** open invoices, **when** "Receivables aging" renders, **then** a donut shows Current and each overdue bucket with amounts and "View all".
- **Given** jobs with costing, **when** "Job profitability" renders, **then** it shows "Top performers" and "Needs attention" with margin bars.
- **Given** a Staff user without `reports.view_receivables` or `reports.view_job_profitability`, **when** they open the dashboard, **then** the matching widget is absent.
- **Given** nothing outstanding, **when** the donut renders, **then** I see "Nothing outstanding.".

**Implementation notes**
- API: `GET /reports/receivables`, `GET /reports/job-profitability`.
- UI: `DonutChart`; values have text labels (not colour alone).

### US-DASH-08 · See what happened recently across the business
**Feature:** F-DASH-04 · **Priority:** P2 · **Phase:** 4 · **Screens:** `DashboardOwner`
**As** any member, **I want** a recent-activity feed covering quotes, payments, expenses, jobs and milestones, **so that** I see what happened without opening each module.

Legacy: S-09.14

**Acceptance criteria**
- **Given** recent events, **when** I open the dashboard, **then** "Recent activity" lists them newest first ("Quote QUO-0002 was accepted", "Payment of 5000.00 USD received from Maple Ridge Developments") with relative times ("Just now", "31m ago").
- **Given** I click an entry, **when** it opens, **then** I'm on its source document.
- **Given** no events, **when** it renders, **then** I see "Nothing yet.".

**Implementation notes**
- API: `GET /dashboard/activity-feed`.

### US-DASH-09 · Keep financial events out of the field feed
**Feature:** F-DASH-04 · **Priority:** P2 · **Phase:** 4 · **Screens:** `DashboardField`
**As** an owner, **I want** the activity feed filtered by role, **so that** field users don't see money events.

**Acceptance criteria**
- **Given** a Field user, **when** their feed loads, **then** payment, invoice and quote-value events are excluded and job and milestone events remain.
- **Given** a Staff user without receivables rights, **when** their feed loads, **then** payment events are excluded.
- **Given** an Owner, **when** their feed loads, **then** every event type is included.

**Implementation notes**
- Filtering happens in the API, not the client.

### US-DASH-10 · Reorder and hide my widgets
**Feature:** F-DASH-05 · **Priority:** P3 · **Phase:** 4 · **Screens:** `DashboardEditLayout`
**As** any member, **I want** to rearrange or hide dashboard widgets, **so that** my dashboard shows what I check first.

Legacy: S-09.13

**Acceptance criteria**
- **Given** I press "Edit layout", **when** edit mode opens, **then** each widget card can be dragged to a new position and has a hide toggle, and the button reads "Done".
- **Given** a keyboard user in edit mode, **when** they focus a card, **then** they can move it with keys.
- **Given** I hide a widget and press "Done", **when** the dashboard renders, **then** it's gone; showing it again puts it back where it was.
- **Given** edit mode, **when** I look at the key-figures row, **then** it isn't draggable.

**Implementation notes**
- API: `PUT /users/me/dashboard-layout`.
- UI: `ReorderableList` over the real widget cards.

### US-DASH-11 · Keep my layout on every device
**Feature:** F-DASH-05 · **Priority:** P3 · **Phase:** 4 · **Screens:** `DashboardEditLayout`
**As** any member, **I want** my layout saved to my account, **so that** it follows me to another browser.

**Acceptance criteria**
- **Given** I changed my layout, **when** I sign in on another device, **then** the same order and hidden widgets apply.
- **Given** my saved layout names a widget that no longer exists, **when** the dashboard loads, **then** it's skipped without an error.
- **Given** I gain access to a new widget, **when** the dashboard loads, **then** it appears at the end of my layout.

**Implementation notes**
- API: `GET/PUT /users/me/dashboard-layout`. Must accept `Idempotency-Key` (US-OPS-08).

### US-DASH-12 · See what needs my attention first
**Feature:** F-DASH-06 · **Priority:** P1 · **Phase:** 7 · **Screens:** `DashboardOwnerRedesign`, `DashboardCaughtUp`
**As** an owner, **I want** the dashboard to open with the things waiting on me, **so that** I know what to do next without reading every report.

Decision: D-087, D-088

**Acceptance criteria**
- **Given** I open the dashboard, **when** it loads, **then** the header reads "Good morning|afternoon|evening, <first name>" and "<weekday> <day> <month> · <business> · <n> things need you today".
- **Given** open items exist, **when** "Needs your attention" renders, **then** it lists one row per kind, in this order: overdue invoices, expenses waiting for approval, quotes needing discount approval, completed milestones not yet invoiced, quotes expiring within 7 days, vendor bills due within 3 days.
- **Given** a row, **when** it renders, **then** it shows a title with the count (e.g. "1 invoice is overdue"), a detail line naming the first record, its amount and its age, and an action button.
- **Given** the list, **when** a count chip renders next to the heading, **then** it equals the number of rows.
- **Given** an item is resolved anywhere in the app, **when** I return to the dashboard, **then** its row is gone without a manual dismiss ("Cleared items disappear automatically").
- **Given** nothing is open, **when** the dashboard loads, **then** the card shows "You're all caught up" and "Overdue invoices, approvals, expiring quotes and bills due will show up here when they need you.".
- **Given** a kind I have no capability for (e.g. approving expenses without `expenses.approve`), **when** the list is built, **then** that kind is left out.

**Implementation notes**
- API: `GET /dashboard/attention` (contract addition) returns `{ kind, count, first: { id, label, amount?, dueAt? } }[]`, filtered server-side by capability.
- UI: replaces the KPI-first layout of US-DASH-01; the setup checklist (US-ONB-12) sits in the same row for Owners until dismissed.
- Edge: quotes expiring = `sent` with `validUntil` within 7 days; bills due = `recorded` with balance and `dueDate` within 3 days.
- US-JOB-25 adds a seventh kind, jobs over budget (`job_over_budget`, `reports.view_job_profitability`), after vendor bills due.

### US-DASH-13 · Act on an attention item in one click
**Feature:** F-DASH-06 · **Priority:** P1 · **Phase:** 7 · **Screens:** `DashboardOwnerRedesign`
**As** an owner, **I want** each attention row to have its action right there, **so that** I clear it without hunting for the page.

Decision: D-088

**Acceptance criteria**
- **Given** "1 invoice is overdue", **when** I press "Send reminder", **then** the reminder email for that invoice is sent and a toast reads "Reminder sent for INV-<number>".
- **Given** several overdue invoices, **when** I press "Send reminder", **then** the Invoices list opens filtered to overdue with those invoices selected (US-INV-23).
- **Given** "Review", "Approve", "Raise invoice", "Follow up" or "Pay bill", **when** I press it, **then** the matching record opens (expenses filtered to submitted, the quote, the completed milestone's job, the expiring quote, the bill's payment dialog).
- **Given** I lack the capability for the action (e.g. `invoices.send_reminder`), **when** the row renders, **then** the button is replaced by "Open".

**Implementation notes**
- UI: actions route to existing screens; no new mutation endpoints except reusing `POST /invoices/:id/send-reminder`.

### US-DASH-14 · See key figures with a trend and a comparison
**Feature:** F-DASH-07 · **Priority:** P1 · **Phase:** 7 · **Screens:** `DashboardOwnerRedesign`, `DashboardStaffRedesign`
**As** an owner, **I want** each key figure to show how it's moving, **so that** a number on its own isn't meaningless.

Decision: D-089

**Acceptance criteria**
- **Given** the Owner dashboard, **when** the KPI row renders, **then** it shows "Cash position", "Profit this month", "Receivables" and "Overdue", each with the amount, a line of the last 8 weeks, and "▲/▼ <n>% vs last month".
- **Given** a change, **when** it renders, **then** it's green when it's good for the business (cash and profit up, receivables and overdue down) and red otherwise, always with the arrow and sign (colour is never the only signal).
- **Given** "Receivables", **when** it renders, **then** a second line reads "Current <amount> · overdue <amount>"; "Overdue" shows "<n> invoice(s)".
- **Given** I click a KPI card, **when** it opens, **then** I land on its report (Balance Sheet cash account drill-down, P&L, Receivables, Receivables filtered to overdue).
- **Given** last month had no data, **when** the comparison renders, **then** it reads "No data last month" instead of a percentage.
- **Given** a figure I can't view (e.g. Staff without `reports.view_dashboard_summary`), **when** the row renders, **then** that card is replaced by one I can view (see US-DASH-17), never shown locked.

**Implementation notes**
- API: `GET /dashboard/kpis` (contract addition) → `{ key, value, previous, series[] }` per KPI the caller may see.
- UI: amounts use the shared money formatter (US-OPS-24); KPI row stays pinned (D-025).

### US-DASH-15 · See money in and out by month
**Feature:** F-DASH-07 · **Priority:** P1 · **Phase:** 7 · **Screens:** `DashboardOwnerRedesign`
**As** an owner, **I want** money received and money spent side by side, **so that** I see whether the business is cash positive.

**Acceptance criteria**
- **Given** "Money in and out", **when** it loads, **then** it shows a bar pair per month (money in, money out) for the selected range with "3M", "6M" and "12M" (default 12M).
- **Given** the chart, **when** it renders, **then** totals above it read "In · <range>", "Out · <range>" and "Net" with the net in green when positive and red when negative.
- **Given** the legend, **when** it renders, **then** it reads "Money in (payments received)" and "Money out (bills, expenses)".
- **Given** I hover or focus a month, **when** the tooltip opens, **then** it shows that month's in, out and net amounts.
- **Given** no payments or bills yet, **when** the card renders, **then** it shows "Money in and out appears after your first payment or bill." (`DashboardCaughtUp`).

**Implementation notes**
- API: `GET /reports/money-in-out?months=3|6|12` (contract addition, `reports.view_dashboard_summary`), from `journal_lines` on bank/cash accounts — never from documents (D-011).
- Replaces the revenue-trend chart of US-DASH-03 on the dashboard; Reports keep their own charts.

### US-DASH-16 · See today's schedule beside my tasks
**Feature:** F-DASH-06 · **Priority:** P1 · **Phase:** 7 · **Screens:** `DashboardOwnerRedesign`, `DashboardStaffRedesign`, `DashboardFieldRedesign`
**As** any member, **I want** today's meetings, milestones and follow-ups in one column, **so that** I can plan my day from the dashboard.

**Acceptance criteria**
- **Given** "Today", **when** it renders, **then** it lists my meetings today, milestones due within 7 days on jobs I can see, follow-ups assigned to me that are due today or overdue, and my next meeting after today, in time order.
- **Given** each entry, **when** it renders, **then** it shows a time or "Due <day>", the title, and a line naming the kind and record ("Meeting · office", "Milestone · Marina office fit-out").
- **Given** "Open calendar", **when** I press it, **then** the meetings calendar opens on today.
- **Given** nothing today, **when** it renders, **then** it reads "Nothing scheduled today.".

**Implementation notes**
- API: existing `GET /meetings/upcoming`, `GET /jobs/milestones/due`, `GET /activities/overdue?includeToday=true` (contract addition); merged client-side.
- Replaces the separate follow-ups, meetings and milestones cards of US-DASH-04/05/06.

### US-DASH-17 · Get a staff dashboard of only what I can act on
**Feature:** F-DASH-08 · **Priority:** P1 · **Phase:** 7 · **Screens:** `DashboardStaffRedesign`
**As** office staff, **I want** my dashboard built from my own work and my Team's rights, **so that** it's useful without showing me the owner's view.

**Acceptance criteria**
- **Given** a Staff user, **when** "Needs your attention" renders, **then** it shows "Only things you can act on" and includes only kinds their capabilities allow, plus "<n> follow-ups are overdue" and "Your quote <number> expires <day>" for their own records.
- **Given** a Staff user without `reports.view_dashboard_summary`, **when** the KPI row renders, **then** it shows "Receivables", "Overdue", "Open pipeline" and "Quotes won this month" for the grants they hold.
- **Given** a Staff user, **when** an expense they submitted is waiting, **then** it never appears in their own attention list (D-085).
- **Given** a Staff user, **when** the sidebar renders, **then** the Team section is absent (US-TEAM-18).

**Implementation notes**
- API: same endpoints as the Owner view; the server filters by capability and ownership.

### US-DASH-18 · Get a field dashboard of my day
**Feature:** F-DASH-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `DashboardFieldRedesign`
**As** a field user on the web, **I want** my jobs, my expenses and what needs me, **so that** the web app is as useful as the phone app.

**Acceptance criteria**
- **Given** a Field user, **when** the dashboard loads, **then** the header reads "<n> jobs on your list · <n> things need you".
- **Given** "Needs your attention", **when** it renders, **then** it lists milestones due within 7 days on my assigned jobs ("Mark complete") and my rejected expenses with the reviewer's reason ("Fix and resubmit").
- **Given** "My jobs", **when** it renders, **then** each assigned job shows its name and number, customer, site address, next milestone and "Directions".
- **Given** "My expenses", **when** it renders, **then** my last 5 expenses show category, date, amount and a status chip ("Approved", "Rejected", "Submitted").
- **Given** any part of the page, **when** it renders, **then** no contract value, invoice, payment or report figure appears (D-048, D-072).
- **Given** "Recent activity on my jobs", **when** it renders, **then** it lists non-financial events on my assigned jobs only.

**Implementation notes**
- API: `GET /jobs?assignedToMe=true`, `GET /expenses?mine=true`, `GET /dashboard/attention`, activity feed filtered to assigned jobs.

### US-DASH-19 · Read who did what in the activity feed
**Feature:** F-DASH-07 · **Priority:** P2 · **Phase:** 7 · **Screens:** `DashboardOwnerRedesign`
**As** an owner, **I want** the activity feed to name people and group repeats, **so that** I can scan it in seconds.

**Acceptance criteria**
- **Given** an event, **when** it renders, **then** it starts with the actor's avatar and name in bold ("Alex Morgan recorded a payment of $5,000.00 from Maple Ridge Developments"), or the customer's name for customer actions.
- **Given** the same customer views the same quote several times within 24 hours, **when** the feed renders, **then** it's one row ending "· <n> times" with the latest time.
- **Given** an amount, **when** it renders, **then** it uses the shared money format and is bold.
- **Given** "View all", **when** I press it, **then** the organisation audit log opens (Owners) or the full feed (others).
- **Given** a Field user, **when** the feed renders, **then** financial events are excluded (US-DASH-09).

**Implementation notes**
- API: `GET /dashboard/activity` gains `actor` and `groupCount` (contract addition).

### US-DASH-20 · See retention held and job billing on the dashboard
**Feature:** F-DASH-07 · **Priority:** P1 · **Phase:** 7 · **Screens:** `DashboardOwnerConstruction`
**As** the owner of a construction business, **I want** retention held and how far each job is billed on my dashboard, **so that** money waiting on me is never forgotten.

**Acceptance criteria**
- **Given** an Owner, or Staff with `reports.view_receivables`, **when** the "Retention held" card renders, **then** it shows the total held (the balance of 1150 Retention Receivable), "on <n> jobs", and the three jobs holding the most, each with its amount and "Release" linking to the job.
- **Given** nothing is held, **when** the card renders, **then** it reads "No retention held." and stays out of the way (single line).
- **Given** a member with `reports.view_job_profitability`, **when** the "Jobs in progress" card renders, **then** each active job shows its name, a bar of billed % against contract value, "Budget used" with its state (US-JOB-25), and the list links to Job Profitability.
- **Given** the organisation's template is Construction, **when** a member's dashboard has no saved layout, **then** both cards are shown below "Money in and out"; with any other template they start hidden and can be shown from "Edit layout" (US-DASH-10).
- **Given** a member without the card's capability, **when** the dashboard renders, **then** the card is absent, never shown locked.

**Implementation notes**
- API: `GET /dashboard/retention` → `{ total, jobCount, jobs: [{ id, number, name, held }] }` (`reports.view_receivables`), from `journal_lines` on 1150 grouped by `job_id`; the jobs card reuses `GET /jobs?include=costing&status=active` (`reports.view_job_profitability`).
- The budget attention row (`job_over_budget`) is part of US-JOB-25.


### US-DASH-21 · See what I owe vendors on the dashboard
**Feature:** F-DASH-09 · **Priority:** P2 · **Phase:** 8 · **Screens:** `DashboardOwnerBooks`
**As** an owner, **I want** payables beside receivables, **so that** I see both sides of cash at once.

Decision: D-160

**Acceptance criteria**
- **Given** the dashboard, **when** the "Payables" card renders, **then** it shows "Total payables", split "Current <amount> · Overdue <amount>", with a bar of current vs overdue.
- **Given** I click "Overdue", **when** it opens, **then** Payables opens filtered to overdue.
- **Given** a member without `reports.view_payables`, **when** the dashboard loads, **then** the card isn't there.

**Implementation notes**
- API: `GET /dashboard/kpis` gains key `payables` (`reports.view_payables`).

### US-DASH-22 · See where money goes
**Feature:** F-DASH-09 · **Priority:** P2 · **Phase:** 8 · **Screens:** `DashboardOwnerBooks`
**As** an owner, **I want** my top expense categories this year, **so that** I spot what's growing.

**Acceptance criteria**
- **Given** the "Top expenses" card, **when** it renders, **then** it shows the five largest expense accounts for the chosen period ("This month", "This quarter", "This financial year") as labelled bars with amount and %, and "Other".
- **Given** a bar, **when** I click it, **then** the account drill-down opens for that period.
- **Given** no expenses, **when** it renders, **then** it reads "No expenses in this period.".

**Implementation notes**
- API: `GET /dashboard/top-expenses?period=` (`reports.view_financial_statements`); bars use chart tokens with text labels (no colour-only meaning).

### US-DASH-23 · See each bank, cash and card balance
**Feature:** F-DASH-09 · **Priority:** P1 · **Phase:** 8 · **Screens:** `DashboardOwnerBooks`
**As** an owner, **I want** every account's balance on the dashboard, **so that** I know where my cash is without opening Banking.

**Acceptance criteria**
- **Given** the "Accounts" card, **when** it renders, **then** each active money account shows its name, type icon, balance and "Reconciled to <date>" or "Not reconciled".
- **Given** a card account, **when** it renders, **then** its balance shows as owed.
- **Given** I click an account, **when** it opens, **then** its register opens.
- **Given** a member without `banking.view`, **when** the dashboard loads, **then** the card isn't there.

**Implementation notes**
- API: `GET /money-accounts` with balances (`banking.view`).

### US-DASH-24 · See work not yet billed
**Feature:** F-DASH-09 · **Priority:** P1 · **Phase:** 8 · **Screens:** `DashboardOwnerBooks`
**As** an owner, **I want** to see what I could invoice today, **so that** I don't leave money unbilled.

**Acceptance criteria**
- **Given** the "Ready to bill" card, **when** it renders, **then** it shows "Completed milestones not invoiced <n> · <amount>" and "Approved billable expenses not billed <n> · <amount>", each linking to the filtered list.
- **Given** nothing to bill, **when** it renders, **then** it reads "Nothing waiting to be billed.".
- **Given** Jobs & field is switched off (US-SET-23), **when** it renders, **then** only billable expenses show.

**Implementation notes**
- API: `GET /dashboard/unbilled` (`reports.view_receivables`).

### US-DASH-25 · See tax owed this period
**Feature:** F-DASH-09 · **Priority:** P2 · **Phase:** 8 · **Screens:** `DashboardOwnerBooks`
**As** an owner, **I want** the tax I'll owe for the current period, **so that** the payment doesn't surprise me.

**Acceptance criteria**
- **Given** the "Tax this period" card, **when** it renders, **then** it shows "Collected", "Input tax" and "Net payable" for the current month or quarter (Settings › Tax › "Return period"), and "Paid <amount>" when a tax payment is recorded.
- **Given** I click it, **when** it opens, **then** the Tax Summary opens for that period.

**Implementation notes**
- API: `GET /dashboard/tax-period` (`reports.view_financial_statements`); `settings.tax_profile.returnPeriod` (`monthly`/`quarterly`, default monthly).

### US-DASH-26 · Switch dashboard profit between accrual and cash
**Feature:** F-DASH-09 · **Priority:** P2 · **Phase:** 8 · **Screens:** `DashboardOwnerBooks`
**As** an owner, **I want** profit on the dashboard on a cash basis when I prefer, **so that** it matches my bank.

Decision: D-138

**Acceptance criteria**
- **Given** the "Profit this month" KPI and the money chart, **when** I switch "Accrual / Cash", **then** both recompute on that basis and the KPI says "cash basis" under the figure.
- **Given** I choose a basis, **when** I come back on any device, **then** my choice is kept.

**Implementation notes**
- API: `GET /dashboard/kpis?basis=cash`; basis stored with the member's dashboard layout (US-DASH-11).
