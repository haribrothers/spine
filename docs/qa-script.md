# Manual QA Script

Covers every user-facing feature built so far, grouped by area in
roughly the order you'd hit them in real use. This is the living,
comprehensive script — **update it whenever a feature is completed and
committed** (see CLAUDE.md's own pointer to this file). Each section
should stay runnable on its own against a fresh org with demo data
loaded, unless it says otherwise.

For a one-off deep dive on a single recent batch of work, a narrower
scratch script is fine — but fold anything durable back into this file
before considering that work's QA "done."

---

## Setup (do this once per test pass)

1. Start dev infra: `docker compose -f docker-compose.dev.yml up -d`
   (Postgres, MailDev, MinIO).
2. Start the app: `pnpm dev` — web on http://localhost:3000, API on
   http://localhost:4000.
3. MailDev inbox (every email the app sends lands here in dev):
   http://localhost:1080
4. MinIO console (uploaded files/logos): http://localhost:9001
   (credentials in `.env`).
5. For a genuinely fresh org, run `pnpm db:reset` (in `apps/api`) — it
   truncates every app table (a hardcoded list kept in sync with the
   schema; see `apps/api/src/db/reset.ts`) but does **not** seed demo
   data itself. You still sign up fresh and opt into **Load demo data**
   from onboarding (§1.7) — this is intentional, matching real
   first-run behaviour.

---

## 1. Signup, onboarding, and org basics

1. Go to http://localhost:3000/signup and create an account. This first
   signup on a fresh instance should become the **Primary Owner**
   automatically — no separate "create org" step.
2. Confirm you land in the onboarding wizard. Step through: business
   profile → industry template → currency/locale/financial year → tax
   rates → numbering prefixes → chart-of-accounts confirmation → team
   invite. At step 1, confirm **"Load demo data"** is offered as an
   alternative to filling the wizard by hand.
3. Skip the wizard partway through (there should be a skip option) and
   confirm the app is still fully usable — nothing should be gated
   behind finishing onboarding.
4. From the user menu, open **Profile & Preferences** — confirm it's a
   separate surface from org Settings (name/email/password/avatar here,
   not org config).
5. From the sidebar/user menu, open **Settings** (a dialog, not a route)
   — confirm business profile, tax, numbering, and branding are all
   editable here even after onboarding is done.
6. In Settings, upload a business logo. Confirm it persists (reload the
   page, logo still shows) and later appears on a quote/invoice PDF
   (see §3/§4 below).
7. In Settings → Data (or the dashboard checklist), click **Load demo
   data**. Confirm it seeds, without error:
   - Contacts, catalogue items, leads, quotes, invoices, payments, and
     jobs (3, at different stages — see §5 below).
   - A business logo (a real uploaded file, not a URL string — confirm
     it shows in Settings and on quote/invoice PDFs, and that the file
     exists in the MinIO console).
   - A second tax rate ("State Surcharge", compound) and a tax group
     combining it with the seeded "Sales Tax" rate (§10).
   - A partial credit note against one of the seeded invoices (§7).
   - 4 meetings on the calendar, 3 linked to a seeded contact and one
     internal with no contact (§6).
   - On the seeded jobs: a kickoff note, a real uploaded photo (visible
     in the job's Photos tab and attached to a milestone completion),
     and — on the "active" job — a sent-but-not-yet-accepted variation
     order (confirm it shows as pending, not applied to the job total).
   - Two demo team members: **Sarah Mendes** (Staff, joined the default
     Team) and **Marcus Webb** (Field, no Team — Field is fixed and
     never Team-assignable). Both are real login accounts
     (`sarah.mendes.demo@example.com` / `marcus.webb.demo@example.com`,
     password `DemoPassword123!`) — confirm you can log in as either
     and see role-appropriate access (Field sees no financial reports).
8. Confirm the **dashboard setup checklist** reflects real completion
   state (e.g. "add a contact" flips to done once you have contacts from
   the demo seed, not just because you dismissed it).
9. In Settings → Data, click **Clear demo data**. Confirm every item
   above is removed — including the tax group/rate, credit note,
   meetings, job photos/notes/variation order — and that Sarah's and
   Marcus's **login accounts still work** (they lose access to this org
   only; their `user`/`account` rows are never deleted, only their
   membership). Re-running **Load demo data** afterward should succeed
   cleanly (idempotent — no "already exists" errors), including for
   Sarah/Marcus (their accounts are reused, not recreated).

---

## 2. Contacts & CRM (FEAT-01)

1. Go to **Contacts**. Confirm the list shows stat cards and supports at
   least list view; try switching views if multiple are offered.
2. Open a contact's detail page. Confirm tabs/sections for: contact
   persons, addresses, leads, activities, and a **Timeline** tab merging
   quote lifecycle events + logged activities in chronological order.
3. Create a new contact, add a second contact person and a second
   address to it, save, reload — confirm both persist.
4. Upload a contact photo — confirm the crop-and-resize step appears
   before upload completes.
5. Log an activity (call/meeting/note/task) against the contact with a
   due date in the past — confirm it shows as **overdue** and appears in
   the dashboard's overdue-activities list.
6. Archive a contact (not hard delete) — confirm it disappears from the
   default list but the underlying record still exists (e.g. still
   referenced correctly from an old quote).
7. Go to **Pipeline** — confirm a kanban board grouped by lead stage
   (new/qualified/proposal/won/lost). Drag a lead card to a different
   column, confirm the stage persists on reload.
8. Open the lead dialog — confirm **Source** is a creatable combobox
   (type a new value, it should be usable), and currency defaults to the
   org's configured currency.
9. Go to **Contacts** and use **Import from CSV** — upload a small CSV
   with a few rows, confirm contacts are created and mapped correctly.
10. Open a contact's **History** tab (audit log) — confirm edits you've
    made show up with before/after values.

---

## 3. Catalogue (FEAT-02)

1. Go to **Catalogue**. Create a new item with a name, unit, default
   price, tax rate, and an **income account** selected.
2. Edit an existing item's price — confirm this does NOT retroactively
   change any already-issued quote/invoice that used it (documents
   snapshot their data).
3. Archive an item, confirm the delete-confirmation dialog suggests
   Archive over Delete when the item might be referenced elsewhere.
4. Delete an item that's referenced by an existing quote line — confirm
   the delete succeeds (catalogue provenance is `set null`, not blocked)
   and the quote line's own snapshotted name/price is untouched.

---

## 4. Quotes (FEAT-03)

1. Go to **Quotes** → **New Quote**. Pick a contact, add several lines
   (mix item/heading/text types), apply a discount on one line, save as
   draft.
2. Confirm the total computed matches your expectation (discount before
   tax, tax computed per line).
3. Click **Preview PDF** on the draft — confirm a live-rendered PDF
   opens showing your business logo/name (from §1.6) and the lines.
4. Click **Send Quote**. Confirm status flips to "sent," a real gapless
   number is allocated (`QUO-000X`), and the quote becomes read-only
   (no more editing).
5. Check MailDev — confirm the customer received an email with the quote
   PDF attached and/or a link to the public quote page.
6. Open the **public quote link** (either from the email or the quote's
   own detail page) in an incognito/private window — confirm it renders
   without requiring login, and shows Accept/Reject actions.
7. Accept the quote from the public page. Confirm:
   - The quote's status flips to "accepted" in the authenticated app.
   - An owner notification (email + in-app bell) fires for "quote
     accepted."
8. Revise a **sent** quote — confirm it creates a new version
   (`parent_quote_id` set) and the original is marked "superseded,"
   rather than mutating the sent one.
9. On a quote past its `validUntil` date, confirm it's flagged
   "Expired" in the UI.
10. Open the **email queue** dialog from the quotes page — confirm it
    shows pending/sent/failed email jobs.
11. On an **accepted** quote, click **Convert to invoice**. Confirm you
    land on a new **draft** invoice whose lines, quantities, prices, and
    total exactly match the quote. Confirm the invoice is NOT
    auto-issued — you get to review first.
12. On the same **accepted** quote, click **Convert to job** (next to
    Convert to invoice). Confirm you land on the new job's detail page,
    with the contract value matching the quote's total exactly (S-04.1,
    completes S-03.10 — see §5 below for the rest of the Jobs flow).
13. **Repeat-conversion safeguard (user-reported)**: in Settings →
    "Repeat quote conversion", confirm the default is **Warn**. On the
    same quote from step 11/12 (which already has a job AND an invoice),
    click **Convert to invoice** again. Confirm a dialog appears naming
    exactly what already exists ("1 job... and 1 invoice...") rather than
    silently creating a duplicate. Click **Convert to invoice anyway** —
    confirm it proceeds and a second, separate draft invoice is created.
    Switch the setting to **Block**, attempt another conversion on the
    same quote — confirm it's rejected outright with no dialog offering
    an override. Switch to **Off** — confirm conversions on an
    already-converted quote now proceed with no warning at all, matching
    this app's original (pre-safeguard) behaviour.

---

## 5. Jobs (FEAT-04, Phase 3 · Jobs & Construction Billing)

Best run against the demo data's 3 seeded jobs (§1.7) — they cover three
different points in this lifecycle already, so you can spot-check each
stage without walking a job through by hand. To exercise every action for
real, also walk ONE job manually through the full sequence below.

1. Go to **Jobs** (its own top-level sidebar section, between Sales and
   Billing). Confirm the list shows stat cards (total/active/on
   hold/completed), a status filter, a contact filter, and the 3 demo
   jobs if demo data is loaded.
2. Open a job's detail page. Confirm the header shows contact, site
   address, status, contract value, and — only when nonzero, or the org's
   industry template is Construction (§1.2) — retention %.
3. Click **Edit**. Confirm retention % lives behind an **Advanced**
   disclosure, not a top-level field, and that it's still fully editable
   regardless of the org's industry template (Jobs itself is never gated
   by template — only whether this field starts expanded).
4. On the **Milestones** tab, click **Define milestones** (or **Edit
   milestones** if some exist). Add 2-3 milestones as percentages of the
   contract value that do NOT sum to 100%, try to save — confirm it's
   rejected with a clear error naming the current total (S-04.3). Fix the
   percentages to total exactly 100% and save successfully.
5. On a **pending** milestone, click **Mark complete**. Attach a photo
   (upload via the file picker) and a completion note, submit. Confirm
   the milestone's status flips to **Completed** (S-04.4) — this action
   should also be reachable/usable by a Field-role user (§13), unlike
   the rest of this page's mutating actions.
6. On the now-**completed** milestone, click **Raise invoice**. Confirm
   you land on a new invoice whose type is **progress**, whose total
   matches the milestone's resolved amount, and — if the job has a
   nonzero retention % — whose **Retention** shown in the totals block
   is the correct percentage of that amount (S-04.5/S-04.6). Issue it.
7. Open the issued progress invoice from step 6. Confirm **Balance due**
   equals `total - retention`, NOT the full total — the retained portion
   is deliberately excluded from what's collectible via a normal payment
   (§7 Invoices, §8 Payments, §9 Receivables should all reflect this same
   net-of-retention balance; spot-check at least one of them).
8. Back on the job, go to the **Costing** tab. Confirm **Revenue
   recognised** matches the sum of every issued progress invoice's total
   for this job, and **Cost** is exactly 0 (Purchases/Expenses don't
   exist until Phase 4 — this is expected, not a bug, per that tab's own
   explanatory note).
9. Once every milestone on a job is completed and invoiced, click
   **Release retention** on the job header. Confirm:
   - A new invoice is created and issued with type **retention_release**,
     for exactly the sum of retention held back across that job's
     progress invoices.
   - Trying to release retention again on the same job (with nothing
     newly held back) is rejected with a clear "no retention outstanding"
     error.
10. On the **Variation orders** tab, click **Raise variation order**.
    Enter a description and amount, submit — confirm it creates a
    **draft quote** linked to the job (check the quote appears under
    **Quotes** too, fully editable/sendable like any other quote).
11. Send that variation quote and accept it via the public link (same
    steps as §4.4-4.7). Back on the job's Variation orders tab, confirm
    an **Apply to job** button now appears next to it — click it, and
    confirm the job's **contract value** on the header increases by
    exactly the variation's total, and any percent-type milestones'
    resolved amounts recompute against the new total.
12. On the **Photos** tab, upload a general site photo (not tied to a
    milestone) — confirm it appears in the grid separately from any
    milestone-completion photos from step 5.
13. On the **Notes** tab, add a free-text note — confirm it appears with
    a timestamp, newest first.

---

## 6. Meetings (S-01.9)

1. Go to **Meetings**. Confirm an Outlook-style calendar (day/week/month
   views) renders.
2. Create a meeting linked to a contact. Confirm it shows on the
   calendar and, if you check that contact's Timeline (§2.2), the
   meeting appears there too (once wired) or at least on the contact's
   own meetings list.
3. Create a recurring meeting, then edit a single later occurrence's
   time — confirm this does NOT move the whole series' start date (this
   was a real bug fixed earlier).
4. Delete a meeting from the calendar. Confirm a confirmation dialog
   appears before it's actually removed (user-reported gap — deletion
   used to happen immediately on click, no confirmation at all).

---

## 7. Invoices (FEAT-05)

1. Go to **Invoices** → **New invoice**. Build a multi-line invoice for
   a contact, save as draft.
2. Click **Issue Invoice**. Confirm:
   - A real gapless number is allocated (`INV-000X`).
   - The invoice becomes immutable (Edit/Delete disappear).
   - If you check the posted journal entry (ask an engineer, or query
     directly), revenue should post to each line's own catalogue item's
     income account — not one blended line — when income accounts are
     configured (see §3.1). Lines with no catalogue item, or whose
     catalogue item has no income account set, should fall back to the
     default "Sales — Services" account.
3. Click **Preview/Download PDF** — confirm it renders with your
   business branding, line items, and totals.
4. Click **Email invoice** — confirm a "sending…" state appears, then
   flips to a "sent" confirmation once delivered, and MailDev shows the
   email with the PDF attached.
5. Try to edit or delete an **issued** invoice — confirm both are
   blocked.
6. Click **Void** on an issued invoice, provide a reason. Confirm:
   - Status flips to "void," reason is shown.
   - A reversing journal entry is posted (net ledger effect of the
     original + reversal is zero — ask an engineer to confirm via SQL
     if you want to be thorough).
   - A second void attempt on the same invoice is blocked.
7. On an **overdue** invoice (issued, due date passed, balance > 0):
   - From the invoice detail page, click **Send reminder**. Confirm a
     reminder-specific email lands in MailDev (subject like "Reminder:
     INV-000X is now N days overdue," not the plain "sent you an
     invoice" copy), with the PDF attached.
   - From the **Invoices list**, open the same invoice's row **⋯** menu
     and confirm **Send reminder** is offered there too, and works.
   - Confirm **Send reminder** does NOT appear on a non-overdue invoice.
8. On an issued invoice with a balance owing, click **Issue credit
   note**. Enter a description and an amount less than the remaining
   balance, submit. Confirm:
   - A `CRN-000X` number is allocated.
   - A new **Credit notes** section appears on the invoice showing it.
   - The invoice's totals block gains a **Credited** line, and
     **Balance due** drops by that amount.
   - Trying to issue a second credit note larger than the now-reduced
     remaining balance is rejected with a clear error.
   - The invoice PDF now shows the "Credited" line too.
9. **Advance/deposit invoice (S-05.4)**: create a new invoice, set
   **Type** to **Advance**, add a line for the deposit amount, save as
   draft, then **Issue**. Confirm:
   - A real gapless number is allocated, same as any other invoice.
   - A "Deposit" badge appears next to the status badge, on both this
     invoice's detail page and its row in the Invoices list.
   - **Download PDF** shows "DEPOSIT INVOICE" as the title (not
     "INVOICE").
   - **Record payment** and **Issue credit note** do NOT appear on this
     invoice's detail page (an advance invoice never posts to Accounts
     Receivable, so there's no balance to record a payment or credit
     note against).
   - Ask an engineer to confirm no journal entry was posted for this
     invoice (or check yourself if you have DB access) — issuing an
     advance invoice should have zero ledger effect.
   - Go to **Payments** → **Record payment** for the same contact and
     confirm this advance invoice does NOT appear in the allocation
     picker (it's filtered out, since there's nothing to allocate
     against).
   - Now record the deposit the *correct* way: **Record payment** for
     that contact, same amount, leave it **unallocated**. Confirm the
     payment posts (MailDev shows a confirmation email), and if you can
     check the ledger, confirm it's a debit Bank / credit Customer
     Advances posting (§7.2's "Advance received" row).
   - Later, on a real (non-advance) invoice for the same contact, use
     **Apply credit** on that payment (§8 below) to offset it against
     the real invoice — confirm this works normally.
10. **Regression check (S-04.6 retention, added in Phase 3)**: open one
    of a job's issued progress invoices (§5 above). Confirm **Balance
    due** in the totals block equals `total - retention`, not the full
    total — a held-back retention amount was never part of Accounts
    Receivable (§7.2), so it must never look collectible or overdue here.
    A non-job invoice (`retentionAmount = 0`) should be completely
    unaffected — its balance due should still just be
    `total - paid - credited`, exactly as before Phase 3.

---

## 8. Payments (FEAT-06)

1. From an issued invoice with a balance, click **Record payment**.
   Confirm the allocation table pre-fills a suggested oldest-first split
   across the contact's outstanding invoices (S-06.3), and you can edit
   amounts or add/remove invoices before submitting.
2. Submit a payment that's only **partially** allocated (leave some
   unallocated). Confirm:
   - The invoice's balance due drops by the allocated portion.
   - MailDev shows a payment-confirmation email to the customer AND a
     separate owner notification (email + in-app bell) for "payment
     received."
3. Go to the standalone **Payments** page. Confirm the payment you just
   recorded appears, with correct Allocated/Unallocated amounts shown.
4. Open that payment's detail drawer:
   - Click **Download PDF** — confirm a receipt PDF opens showing the
     payment details and an "Applied to" table if it's allocated to any
     invoice.
   - Click **Email receipt** — confirm a success toast and a
     PDF-attached email in MailDev.
   - If the payment has any unallocated amount, click **Apply credit**,
     pick a different outstanding invoice for the same contact, submit.
     Confirm the payment's Unallocated amount drops, the target
     invoice's balance drops by the same amount, and **Apply credit**
     disappears once fully allocated.
5. Try to delete a payment that has at least one allocation — confirm
   it's blocked. Record a fresh fully-unallocated payment and delete
   it — confirm this succeeds and reverses its journal entry.
6. Record a payment with **no invoice at all** (pure unallocated
   credit) — confirm this is allowed and shows correctly as 100%
   unallocated.
7. **Regression check (S-04.6 retention, added in Phase 3)**: from a job
   with an issued progress invoice (§5 above), click **Record payment**
   and confirm the suggested allocation offers at most `total -
   retention` for that invoice — never the full total, and never more
   than the DB's own allocation-limit trigger would accept.

---

## 9. Receivables / AR aging (S-06.7 / S-09.5)

1. Go to **Receivables**.
2. Confirm five stat cards: Current, 1–30, 31–60, 61–90, 90+ days, plus
   a Total outstanding figure.
3. Confirm the table below lists every outstanding **issued** invoice,
   oldest-overdue first, each tagged with the correct aging bucket.
4. Cross-check: pick one row, open that invoice directly, confirm its
   own **Balance due** matches exactly what Receivables showed.
5. Confirm invoices that are **draft**, **void**, or **fully paid/
   credited** do NOT appear here.
6. After issuing a credit note against an invoice (§7.8) or applying
   credit to it (§8.4), reload Receivables and confirm the balance there
   reflects the change with no double-counting.
7. **Regression check (S-04.6 retention, added in Phase 3)**: confirm a
   job's issued progress invoice with retention still outstanding never
   inflates Receivables' totals by its retained portion — its row here
   (if it appears at all, i.e. `total - retention - paid - credited >
   0`) should show the SAME `total - retention` balance as its own
   detail page, per the PRD's own acceptance highlight that retention
   posting to a separate account keeps aging reports undistorted.

---

## 10. Tax (FEAT-08, Phase 4 · Money Out & Books)

1. Open **Settings → Tax**. Confirm two subsections: **Tax rates** and
   **Tax groups**, plus a **Prices include tax by default** toggle.
2. Add a tax rate (e.g. "GST" at 15%, not compound). Confirm it appears
   in the list immediately, no page reload needed.
3. Add a second rate (e.g. "State Tax" at 6.5%, **compound** checked).
4. Create a tax group combining both rates (e.g. "GST + State"). Confirm
   the group row shows both rates' names and percentages.
5. Archive the first rate — confirm it disappears from the default
   (non-archived) rate list, and confirm the tax group that references
   it is unaffected (archiving a rate doesn't remove it from an existing
   group). Restore it.
6. Attempt to **delete** a rate that's used in a group — confirm this is
   rejected ("used in a tax group and cannot be deleted — archive it
   instead"), matching Catalogue's own archive-over-delete convention.
7. Toggle **Prices include tax by default** on, confirm it persists
   across a reload of the Settings dialog.
8. Go to **Catalogue**, create or edit an item. Confirm the "Default
   tax" field is now a picker offering "No tax," every active rate, and
   every active group — not a raw percentage input.
9. Pick the tax group from step 4 as the item's default. Save, reopen
   the item — confirm the same group is still selected.
10. Go to **Quotes → New Quote**, add a line, prefill it from the
    catalogue item you just set up. Confirm the line's **Tax** field
    auto-selects the same group, and the **Price includes tax** checkbox
    reflects the org default from step 7.
11. On that line, confirm the computed tax matches manual math for a
    compound group: e.g. on a $100.00 line with GST 15% (non-compound)
    + State Tax 6.5% (compound on top of GST), tax should be
    `$15.00 + 6.5% × $115.00 = $15.00 + $7.48 = $22.48`, not
    `$15.00 + $6.50 = $21.50` (the wrong, non-compound answer).
12. Toggle **Price includes tax** on for that same line, keeping the
    same $100.00 unit price — confirm the tax amount changes (now backed
    out of $100 as inclusive, rather than added on top) and the line
    total stays $100.00 while the pre-tax subtotal drops.
13. Save the quote, then **Send** it and (once accepted) **Convert to
    invoice** (§4.11) — confirm the invoice line carries over the exact
    same tax rate/group selection and computed amounts, not a
    re-resolved or reset value.
14. Issue that invoice. Scroll to the bottom of **Settings → Tax** — a
    **Tax summary** section with a From/To date range and a Refresh
    button. Set the range to cover today, click Refresh. Confirm three
    figures (Collected, Paid, Net payable) and a **Collected by rate**
    breakdown listing at least the rate/group you used in step 10-12,
    with an amount matching the invoice's own `taxAmount`.
15. As Staff (second browser/incognito, per §13's setup), open **Settings
    → Tax** and try to load the Tax summary section — confirm a real
    "Owner-only report" message appears rather than a silent empty state
    or a raw crash (the endpoint's `@OrgRoles(["owner"])` check is real;
    this is just confirming the web UI surfaces that 403 legibly).
16. **Unattributed history check**: if your org has any tax-bearing
    invoice from BEFORE this QA pass that's since been removed as a
    draft-only deletion is the only way an invoice document disappears
    (an issued invoice's ledger entry is permanent, per CLAUDE.md) — or
    more realistically, after running **Settings → Demo data → Clear
    demo data** on an org that previously had demo invoices with tax —
    confirm the breakdown includes a trailing **"Other / from removed
    invoices"** row rather than the rate breakdown silently under-totaling
    the ledger's own Collected figure. The breakdown's rows should always
    sum exactly to Collected.
17. **Regression check (Catalogue, §3)**: an item created **before**
    this feature existed (i.e. with only a flat
    `defaultTaxRatePercentage` and no `defaultTaxRateId`) should still
    prefill a quote/invoice line correctly — confirm via an item from
    demo data seeded before your own manual rate/group creation, or by
    checking that the "No tax"/flat-percentage fallback still computes a
    sane total.
18. **Regression check (Quotes §4 / Invoices §7 totals)**: confirm every
    existing total-computation check in those two sections (discount
    before tax, PDF totals, convert-to-invoice line-for-line match)
    still holds now that tax is resolved via a named rate/group instead
    of a raw percentage — nothing about how totals are *displayed*
    should have changed, only how a line's tax is *selected*.

---

## 11. Purchases & Expenses (FEAT-07, Phase 4 · Money Out & Books)

Best run against the demo data's seeded vendor bills/expenses (§1.7) — they
cover every lifecycle outcome already, so you can spot-check each rather
than building every case from scratch.

### 11.1 Expense categories

1. Open **Settings → Purchases**. Confirm a list of expense categories
   (demo data seeds "Fuel & Vehicle", "Site Meals", "Tools & Small
   Equipment" — "Fuel & Vehicle" has a default posting account set, the
   other two don't).
2. Add a new category, optionally assigning a default account. Confirm it
   appears immediately.
3. Archive a category, confirm it disappears from the picker an expense
   form offers. Restore it.
4. Attempt to delete a category that's used by an existing expense —
   confirm this is rejected ("used by an expense and cannot be deleted —
   archive it instead").

### 11.2 Submit and approve an expense (S-07.2, S-07.4)

1. Go to **Purchases → Expenses → New expense**. Pick a category, enter an
   amount, optionally tag a job, set **Paid by** (Company or Employee),
   optionally attach a receipt photo, save.
2. Confirm the expense appears with status **Submitted** and no number
   yet — an unapproved expense has neither a number nor a ledger posting
   (the PRD's own acceptance highlight: "an unapproved expense does not
   post to the ledger. Approval is the posting trigger").
3. Open the expense, click **Approve**. Confirm: status flips to
   **Approved**, a real gapless number is allocated (`EXP-000X`), and the
   expense becomes read-only.
4. Confirm the approved amount is reflected in the ledger — the expense's
   own category account (or the default "Other Expenses" account if the
   category has none) is debited, the org's default bank account is
   credited, for the expense's full amount (Settings → Chart of accounts,
   or cross-check against Purchases → Payables/reports if a P&L exists by
   the time you're testing).
5. Submit a second expense, click **Reject**. Confirm a comment is
   **required** (the confirm button stays disabled until you type one) —
   confirm the rejected expense never gets a number and never posts to
   the ledger.
6. **Regression check**: an approved or rejected expense should be
   read-only — no Edit/Delete action should be offered on it, only on a
   still-**Submitted** one.

### 11.3 Job tagging and billable expenses (S-07.5, S-07.6)

1. Submit and approve an expense tagged to one of the demo jobs. Open that
   job's detail page → Costing tab — confirm the expense's amount now
   shows up on the **cost** side of that job's profitability (this was
   previously always $0 before Purchases existed — see §5's own "Known
   gaps" note, now resolved).
2. Submit an expense with **Billable** checked, approve it. Confirm it's
   flagged billable on its detail page. **Known gap**: there is currently
   no web UI action to actually pull it into a customer invoice line —
   `POST /expenses/:id/mark-billed` (S-07.6) is a real, working,
   Owner/Staff-only endpoint, but nothing in the invoice builder or the
   expense detail drawer calls it yet. Verify it directly via that
   endpoint if you need to confirm the one-shot-only behaviour (a second
   call against the same expense is rejected); don't file "no way to
   bill a customer for an expense" as a bug — it's this gap.

### 11.4 Vendor bills (S-07.1)

1. Go to **Purchases → Vendor Bills → New vendor bill**. Pick a vendor
   contact (only vendor/both-type contacts should be selectable — a
   customer-only contact should NOT appear in this picker), enter the
   vendor's own bill number, add lines with quantity/price/an expense
   account/tax, save as draft.
2. Confirm the computed total matches your expectation (tax computed per
   line, same engine as quotes/invoices — see §10's own tax regression
   checks).
3. Click **Record**. Confirm: status flips to **Recorded**, and the
   ledger shows a debit to each line's own Expense/COGS account plus
   Input Tax Receivable (if any tax), credit Accounts Payable, for the
   bill's total.
4. Confirm a recorded bill is immutable — no Edit action offered, only
   Void.
5. Void a recorded bill with a reason. Confirm a reversing entry posts
   and the bill's status flips to **Void**.
6. **Job tagging (S-07.5)**: create and record a vendor bill tagged to a
   job. Confirm its amount appears on that job's Costing tab, same as
   §11.3's expense check above.

### 11.5 Payables (S-07.7)

1. Go to **Purchases → Payables**. Confirm stat cards for Current/0-30/
   31-60/61-90/90+ days overdue, plus a Total outstanding figure.
2. Confirm the table lists every outstanding **recorded** vendor bill,
   oldest-overdue first, tagged with the correct aging bucket.
3. Confirm bills that are **draft**, **void**, or **fully paid** do NOT
   appear here.
4. Cross-check: pick one row, open that vendor bill directly, confirm its
   own **Balance due** matches exactly what Payables showed.

### 11.6 Vendor payments (S-07.8)

1. Go to **Purchases → Vendor Payments → New vendor payment**. Pick a
   vendor, enter an amount, allocate it across one or more of their
   outstanding recorded bills.
2. Confirm allocations must sum to **exactly** the payment amount before
   you can save — unlike customer payments, there's no "hold the
   remainder as credit" option here (no PRD story asks for a vendor-credit
   concept). The dialog should show a running "Remaining to allocate"
   figure that must hit exactly $0.00, not just ≤ the payment amount.
3. Save. Confirm: a real gapless number is allocated (`VPY-000X`), the
   ledger shows a debit to Accounts Payable and a credit to the org's
   bank account for the full amount, and each allocated bill's own
   **Balance due** drops by its allocated amount.
4. Fully pay off a recorded bill via one or more vendor payments. Confirm
   it now shows a $0 balance and disappears from Payables (§11.5).
5. Attempt to allocate more than a bill's remaining balance — confirm
   this is rejected with a clear error naming the bill and its actual
   remaining balance (enforced both client-side and server-side; the
   server enforcement is backed by a real DB constraint trigger, same
   pattern as customer payment allocations).

### 11.7 Field access (§2.1 permission model)

1. As a Field user (second browser/incognito, per §13's setup), confirm
   you CAN reach **Expenses** and submit a new one — S-07.2's own wording
   is "As a field user, I want to photograph a receipt and submit an
   expense from site."
2. Confirm a Field user CANNOT see or reach Approve/Reject on any
   expense, and CANNOT reach Vendor Bills, Payables, or Vendor Payments
   at all — those are Owner/Staff-only per §2.1's own permission table.

---

## 12. Notifications (S-10.11 / S-10.12)

1. Trigger a notification-worthy event (e.g. a quote gets viewed on its
   public link, or a payment is recorded).
2. Click the notification bell — confirm a right-side panel opens
   listing the event, and it's marked read once opened.
3. If your browser prompts for notification permission, accept it, then
   trigger another event — confirm a native OS/browser push notification
   appears (this only works over a real trigger, not a manual test
   button, so pick a real action like recording a payment).

---

## 13. Users, Teams & Permissions (§2.1 permission model)

This section needs a second browser (or incognito window) to act as an
invited user alongside your Owner session.

1. As Owner, go to the **Team** section (top-level sidebar, Owner-only —
   confirm a Staff/Field user does NOT see this nav item at all once you
   test with one below).
2. Create a new **Team** (e.g. "Sales") and configure its privilege
   matrix — toggle a few capabilities on/off (e.g. "Create invoices,
   record payments").
3. Invite a new user as **Staff**. Confirm:
   - The invite form does NOT allow selecting "Owner" as a role.
   - MailDev shows a real invitation email with a working link.
4. Open the invite link in an incognito window. Confirm:
   - If not logged in, it routes to signup with the invited email
     pre-filled and **locked** (not editable).
   - After completing signup, the invite is accepted and the new user
     lands in the app as a Staff member.
5. As Owner, assign the new Staff user to the Team you created in step
   2. Confirm their access now reflects that Team's privilege matrix —
   e.g. if you left "Create invoices" off, they should be blocked from
   issuing an invoice (both the button should be hidden/disabled AND, if
   you have API access, a direct API call should 403 — never trust
   client-side hiding alone).
6. Test capability enforcement end-to-end: toggle a capability ON for
   their Team, confirm they can now do that action; toggle it OFF,
   confirm they immediately can't (may need a session refresh).
7. As Owner, promote the Staff user to **Owner**. Confirm they now have
   unrestricted access, including the Team-management pages themselves.
8. Confirm the **Primary Owner** (your original signup account) cannot
   be demoted or removed by anyone, including other Owners — the option
   should not be offered, or should be server-rejected if forced.
9. Let an invitation sit unused past its expiry (or manually test one
   already expired if available) — confirm the Team's pending-invites
   list shows it with a distinct "expired" visual state and a resend
   option.
10. Log in as a **Field**-role user if one exists in your test data (or
    create one via a different invite path if the product supports it).
    Confirm Field never sees financial reports/data — no Receivables,
    no invoice amounts beyond what's explicitly allowed, per §S-11.8.
11. Still as that **Field** user, open a job (§5 above) with a pending
    milestone. Confirm **Mark complete** and adding a job photo/note are
    all usable (Field is fixed-granted `jobs.update_milestones` — see
    §2.1) — but confirm they do NOT see **Edit job**, **Define
    milestones**, **Raise invoice**, **Release retention**, or **Raise
    variation order** (all gated on `invoices.manage`/`quotes.manage`,
    which Field never has).

---

## 14. Design system spot-check

Not a full audit — just confirm nothing obviously broke:

1. Open http://localhost:3000 (or wherever `apps/design-system` runs)
   and browse a few component pages (Button, Table, Dialog, Calendar).
   Confirm they render and match what you see in the actual app.
2. Toggle dark/light mode from the floating theme toggle in the main
   app — confirm it persists across a reload and that a few screens
   (dashboard, an invoice detail page, a dialog) look correct in both
   modes.

---

## Known gaps — don't file these as bugs

- No P&L / Balance Sheet report exists yet (Owner-only, later phase) —
  the only way to verify the per-catalog-item revenue posting split
  (§7.2) today is by inspecting the ledger directly, not through a UI
  report.
- No client-side fine-grained capability check exists in the web app —
  every gated page (Quotes, Teams, Jobs) approximates server-side
  `@RequireCapability` enforcement by checking coarse role (owner/staff/
  field) client-side. A Staff user whose Team doesn't actually grant a
  capability will still see the button and get a real 403 from the
  server on click — that's correct, expected behavior, not a bug to
  file.
- Job cost/revenue/margin (§5.8) now shows real **Cost** figures once at
  least one recorded vendor bill or approved expense is tagged to that
  job (§11.3/§11.4) — Phase 4 Stage 2 (Purchases & Expenses) closed this
  gap. A job with no tagged bills/expenses still correctly shows Cost: 0
  — that's a real zero, not a missing feature.
- The tax collected/paid report (§10.14, `GET /org/tax/summary`) has a
  web surface (a "Tax summary" section at the bottom of Settings →
  Tax), but it's a plain figures-and-list display, not a real Reports
  page — no CSV export, no drill-down into which invoices make up a
  rate's total. That's expected to land with Stage 3 (Reports/FEAT-09),
  not a bug. Tax **paid** on that report now has a real source (Input
  Tax Receivable postings from recorded vendor bills, §11.4) but will
  still read 0 for any org with no recorded vendor bills yet — expected,
  not a bug.
- The job **variation order** line editor (`variation-order-line-editor.tsx`)
  still uses the pre-FEAT-08 flat tax-percentage input, not the new
  named rate/group picker §10 exercises for Quotes/Invoices/Catalogue —
  it still computes correctly, just without a tax picker UI. Not yet
  retrofitted.
- A variation order's acceptance does NOT automatically fold its value
  into the job's contract value — applying it (§5.11) is a deliberate,
  separate manual step. There's no proactive nudge when a variation
  quote gets accepted; you have to check the job's Variation orders tab.
- Mobile (`apps/mobile`) doesn't exist yet — S-07.2/S-07.3's mobile-native
  receipt capture and offline expense-submission queueing are Phase 5
  scope; the web-based expense submission built in §11 covers S-07.2's
  web half only, per that story's own "web submission this stage" split.
- S-07.6 (mark a billable expense and pull it into a customer invoice)
  has a real, working API (`POST /expenses/:id/mark-billed`) but no web
  UI action yet — see §11.3 step 2. Not a bug, a follow-up.
- No standalone `/credit-notes` list page — credit notes are only
  reachable from the invoice they correct.
- Multi-org (one Owner account across several orgs) is explicitly out of
  scope for v1 — don't test for it.
