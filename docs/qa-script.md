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
   (Postgres, MailDev). Uploaded files go to `apps/api/.data/files`
   (local storage driver) — no storage container.
2. Start the app: `pnpm dev` — web on http://localhost:3000, API on
   http://localhost:4000.
3. MailDev inbox (every email the app sends lands here in dev):
   http://localhost:1080
4. Uploaded files/logos are on disk under
   `apps/api/.data/files/<org-id>/<2-char prefix>/<file-id>`.
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
   automatically — no separate "create org" step. (On an instance that
   already has an owner, sign-up is invite-only — §31; set
   `SPINE_ALLOW_OPEN_SIGNUP=true` in `.env` to create another organisation
   in dev.)
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
5a. **Owner-only gating (user-reported)**: log in as Sarah Mendes (Staff)
    or Marcus Webb (Field) — either from the demo seed, or any Staff/Field
    account. Confirm the user menu does NOT show a **Settings** item at
    all (Profile & Preferences, theme switcher, and sign-out still do).
    Previously Settings was visible and openable by every role, and every
    pane except Tax/Chart-of-accounts would let you fill in and submit a
    form the API silently rejected with a 403 on save.
6. In Settings, upload a business logo. Confirm it persists (reload the
   page, logo still shows) and later appears on a quote/invoice PDF
   (see §3/§4 below).
7. In Settings → Data (or the dashboard checklist), click **Load demo
   data**. Confirm it seeds, without error:
   - Contacts, catalogue items, leads, quotes, invoices, payments, and
     jobs (3, at different stages — see §5 below).
   - A business logo (a real uploaded file, not a URL string — confirm
     it shows in Settings and on quote/invoice PDFs, and that the file
     exists under `apps/api/.data/files`).
   - A second tax rate ("State Surcharge", compound) and a tax group
     combining it with the seeded "Sales Tax" rate (§10).
   - A partial credit note against one of the seeded invoices (§7).
   - 4 meetings on the calendar, 3 linked to a seeded contact and one
     internal with no contact (§6).
   - On the seeded jobs: a kickoff note, a real uploaded photo (visible
     in the job's Photos tab and attached to a milestone completion),
     and — on the "active" job — a sent-but-not-yet-accepted variation
     order (confirm it shows as pending, not applied to the job total).
     That same "active" job also has one vendor bill and one expense
     tagged to it, so Reports → Job Profitability (§15) shows a real
     nonzero cost for it, not just revenue.
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
10. On a contact, press the **History** button (clock icon, US-SET-13) —
    confirm edits you've made read as sentences with before/after values.

---

## 3. Catalogue (FEAT-02)

1. Go to **Catalogue**. Create a new item with a name, unit, default
   price, tax rate, and an **income account** selected.
2. Edit an existing item's price — confirm this does NOT retroactively
   change any already-issued quote/invoice that used it (documents
   snapshot their data).
2a. Re-open that same item (opens the edit drawer). Confirm a small
    **History** button appears in the drawer's footer, with no history
    content shown or fetched until clicked. Click it — confirm a popup
    dialog opens showing both the creation and the price-update
    entries, newest first.
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
   without requiring login, and shows Accept/Reject actions. Confirm an
   owner "viewed" notification (email + in-app bell) fires.
6a. **Repeat-view throttle**: reload the same public link a few more
    times within the same hour. Confirm each reload still shows up in
    the quote's own **History** section (one "viewed" entry per reload —
    the activity trail is never de-duplicated), but no additional
    "viewed" email/in-app notification fires after the first one — at
    most one per quote per hour.
7. Accept the quote from the public page. Confirm:
   - The quote's status flips to "accepted" in the authenticated app.
   - An owner notification (email + in-app bell) fires for "quote
     accepted."
7a. On a **different** sent quote, click **Reject** on the public page
    instead. Confirm the quote's status flips to "rejected" in the
    authenticated app, and an owner notification (email + in-app bell)
    fires for "quote rejected" — the same as step 7's acceptance
    notification, just worded for a rejection.
7b. On the quote's own detail page, find the small **History** button
    next to Preview/Download PDF — confirm nothing is shown or fetched
    until clicked. Click it — confirm a popup dialog shows the
    creation, send, and accept/reject entries, newest first — repeat
    "viewed" events from step 6a do NOT clutter this list (those stay
    in the public quote's own throttled-notification/`quote_events`
    trail, not this edit/status history).
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
3a. **History (click-to-view popup, new)**: next to the job's other
    action buttons, click the small **History** button — confirm a
    popup dialog opens showing "created this job," and (after step 3's
    edit) an "updated this job" entry too. Confirm it does NOT show any
    milestone/photo/note entries from later steps on this same job —
    each of those has its own separate History button (steps 5a, 12a,
    13a below).
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
5a. **Milestone History (new)**: click the small History button next to
    this milestone's row — confirm a popup shows a "completed this
    milestone" entry, but NOT the job-level "defined milestones" entry
    from step 4 (that stays on the job's own History from step 3a, not
    here — each has its own separate, non-overlapping history).
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
    - **Tax picker regression (FEAT-08)**: on an item line in the
      variation-order editor, confirm the **Tax** field is the same
      searchable rate/group `Combobox` used in Quotes/Invoices (not a raw
      percentage box) — select a tax group that includes a compound rate
      (e.g. the demo org's GST + State Tax combo), toggle **Price includes
      tax** on and off, and confirm the line total preview updates live to
      match the equivalent selection on an ordinary quote line. After
      submitting, open the linked quote under **Quotes** and confirm its
      line shows the same tax rate/group and total — proving the
      variation order's tax resolves through the same pipeline as a normal
      quote, not the old flat-percentage fallback.
11. Send that variation quote and accept it via the public link (same
    steps as §4.4-4.7). As the accepting customer, confirm you land back
    on the public page with an "accepted" state, same as any quote.
    **As the owner/staff user**, confirm the notification bell shows a
    new unread notification — you should see TWO new entries: the usual
    "[customer] accepted quote [number]" one (as for any quote), and a
    second, distinct **"[customer] accepted variation order [number] —
    apply it to the job"** one. Click the variation-order notification —
    confirm it navigates straight to the job's page with the
    **Variation orders** tab already selected (`?tab=variations` in the
    URL), not the Milestones tab. Confirm an **Apply to job** button now
    appears next to the accepted variation — click it, and confirm the
    job's **contract value** on the header increases by exactly the
    variation's total, and any percent-type milestones' resolved amounts
    recompute against the new total.
    - Regression: reject a second variation order via the public link
      instead of accepting it — confirm only the usual "rejected quote"
      notification appears, with no variation-order-specific one (nothing
      to apply when it's rejected).
    - Regression: accept an ordinary (non-variation) quote elsewhere in
      the app (§4.7) — confirm it still produces exactly one
      "accepted quote" notification, never a variation-order one.
12. On the **Photos** tab, upload a general site photo (not tied to a
    milestone) — confirm it appears in the grid separately from any
    milestone-completion photos from step 5.
12a. **Photo History (new)**: click the small History button on that
     photo's card — confirm a popup shows a single "created this photo"
     entry. Confirm the job's own History (step 3a) shows a job-level
     "added a photo" entry but not this dedicated per-photo entry.
13. On the **Notes** tab, add a free-text note — confirm it appears with
    a timestamp, newest first.
13a. **Note History (new)**: click the small History button next to
     that note — confirm a popup shows a single "created this note"
     entry, same job-level-vs-dedicated split as photos in step 12a.

---

## 6. Meetings (S-01.9 → S-01.12)

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
5. In Day or Week view, drag an event to a new time (move), then drag
   its top or bottom edge to a new time (resize). Confirm both commit
   the new time and the event doesn't lose its resized duration on a
   subsequent move (regression check — this was a real bug fixed
   earlier).
6. Tab to focus an event block in Day/Week view (don't open it).
   Press Shift+ArrowDown a few times — confirm the event's start time
   moves 15 minutes later each press without opening the editor. Press
   Shift+Alt+ArrowDown — confirm the end time moves instead. Try this
   on a single occurrence of a recurring meeting — confirm it triggers
   the same "This event / All events" confirmation a pointer resize
   would, not a silent whole-series change.

### 6.1 Private invites and visibility (S-01.10, S-01.11)

7. Create a new meeting as Staff user A. Confirm the "Visibility"/
   "Invite people" fields appear directly inside the SAME "New
   meeting" dialog, alongside title/time/location — no separate
   follow-up popup after clicking Save. Leave visibility at its
   default (private) and invite no one for this step. As Staff user B
   (same Team, no invite, no `owner` role), confirm the meeting is
   invisible on B's calendar — check both the calendar UI and a direct
   `GET /meetings/:id` call (should 404, not 403).
8. Open that meeting to EDIT it — confirm the same Visibility/Invite
   fields appear inline in the edit dialog too (not just create), and
   are pre-filled with the meeting's actual current visibility (don't
   just default back to Private) and its current invite list. Invite
   user B and save. Confirm B now sees it on their calendar, and B's
   notification bell shows a "you've been invited" notification
   (§12).
9. As the Owner, confirm you can see A's private meeting even without
   being invited or organizing it (Owner sees everything regardless of
   visibility, §2.1).
10. Switch the same meeting's visibility to "Everyone in the org" from
    its edit dialog. Confirm every role (Staff, Field) can now see it
    on their calendar without an explicit invite.
11. As Field, confirm you can create your own private meeting (if
    `meetings.edit_own` is granted to your Team) but never see another
    user's private meeting you're not invited to — Field gets the same
    visibility treatment as Staff, only Owner is special-cased.

### 6.2 Responding to an invite (S-01.12)

12. As invited user B, open the meeting's "Manage attendees" panel
    (the small people-icon button next to a meeting in the sidebar's
    "Upcoming" list, or a notification's deep link) and click Accept.
    Confirm no notification fires to the organizer for this first
    response (check A's notification bell — nothing new).
13. Change your response from Accepted to Declined. Confirm the
    organizer (A) DOES now get a "changed their response" notification
    — this is the one case that notifies, deliberately different from
    the first response.
14. As the organizer, confirm the attendee list shows each invitee's
    current status (Invited/Accepted/Declined/Tentative) — no need to
    ask them separately.

### 6.3 Meetings own/others permissions (cross-check with §13.3)

15. From Users/Teams/Permissions, turn OFF every row in the **Manage
    Meetings** group for a Team (edit_own/edit_others/delete_own/
    delete_others). Confirm a Staff member on only that Team can no
    longer create/edit/delete meetings (the "+ New meeting" flow or
    edit dialog should fail with a permission error), but CAN still
    respond to an existing invite and see `org`-visibility meetings —
    this capability group gates mutation only, never read access. See
    §13.3 for the full own-vs-others walkthrough.
16. **Create gating on the calendar itself (user-reported)**: as that
    same no-grants Staff user, click and drag on an empty slot in
    Day/Week view, and click an empty day cell in Month view. Confirm
    NOTHING happens — no draft block, no "New meeting" dialog at all.
    Previously the dialog always opened regardless of grants, and
    clicking Save threw a raw API error instead of the dialog never
    appearing.
17. Grant that Team `meetings.edit_own` only. Create a meeting as this
    user (now the organizer/"own"). Confirm they CAN edit/drag/resize
    their own meeting (Pencil icon in the popover, drag/resize both
    work), but for a colleague's meeting they don't organize: the
    popover shows an Eye icon instead of Pencil (and no Duplicate
    menu), dragging the meeting snaps back / never starts moving,
    resize handles don't appear on hover, and double-clicking it does
    nothing (does NOT open the full edit dialog). Single-clicking it
    still opens the same read-only popover with all its details
    visible.
18. Grant `meetings.edit_others` too and confirm the colleague's
    meeting becomes fully editable (Pencil icon, drag/resize/
    double-click all work) without having touched `meetings.edit_own`
    again.
19. As Owner, confirm every action above works regardless of Team
    grants — create, edit, drag, resize, and double-click all work on
    every meeting, including ones organized by someone else.
20. **Delete gating inside the full edit dialog (user-reported)**: grant
    a Staff user `meetings.edit_own` but explicitly leave
    `meetings.delete_own` OFF. Open one of their own meetings via the
    popover's Pencil icon (edit is allowed) — confirm the full edit
    dialog that opens has NO Delete button at all, even though the
    popover's own Delete button was already correctly hidden before
    this fix. Grant `meetings.delete_own` and confirm Delete now
    appears in that same dialog. Repeat for a colleague's meeting using
    `meetings.edit_others`/`meetings.delete_others` to confirm the own
    and others pairs are independent for delete too.

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
   - **Click the credit note row itself** (new) — confirm a detail
     Drawer opens showing its status badge, reason, line items, total,
     and a "View source invoice" link back to this same invoice. This
     is the first detail view credit notes have ever had (previously
     just a read-only row). Click the small **History** button in the
     drawer's footer — confirm a popup dialog opens (not an inline
     section) showing at least "created this credit note" and "issued
     this credit note," and that it's empty/not fetched at all until
     you click the button.
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
11. **History (click-to-view popup)**: on any invoice's detail page, find
    the small **History** button (clock icon, ghost style) next to
    Preview/Download PDF — confirm nothing is fetched or shown until you
    click it (no visible history block on page load). Click it — confirm
    a popup dialog opens with a reverse-chronological list starting with
    "{your name} created this invoice." Edit a draft invoice's notes,
    save, reopen the dialog — confirm a new "{your name} updated this
    invoice: notes {old} → {new}" entry appears at the top. Issue it —
    confirm an "issued this invoice" entry with no field diff (issuing
    isn't a field edit). Void it — confirm a "voided this invoice" entry
    appears too. Confirm this invoice's History never shows entries from
    a different invoice or from a credit note issued against it (they
    have their own separate History, see below).

### 7.1 Standalone Credit Notes page (new — Billing → Credit Notes)

12. Go to **Billing → Credit Notes** (a new top-level nav entry, between
    Invoices and Payments). Confirm every credit note across the org
    appears — not just the ones tied to one invoice — with stat cards
    for total count and total credited (issued only).
13. Confirm the **Status** filter offers Draft/Issued and the **contact**
    filter narrows the list the same way Invoices' own filters do.
    Confirm there is **no "New credit note" button anywhere on this
    page** — creation stays exclusively on an invoice's own detail page
    ("Issue credit note"), since a credit note always needs an
    already-issued invoice picked first.
14. Click a row's number — confirm the same detail Drawer from §7 step 8
    opens (status, reason, lines, total, a link back to the source
    invoice, and its own History button in the footer). Click the
    **Invoice** column link on a row instead — confirm it navigates to
    that invoice's detail page directly, without opening the drawer.
15. Confirm a credit note issued from the invoice-detail flow (§7 step
    8) shows up here immediately (reload if needed) with the correct
    status, and that its History popup here matches what you saw on the
    invoice's own detail page.

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
8. **History (click-to-view popup)**: in the same payment's detail
   drawer footer, click the small **History** button — confirm a popup
   dialog opens (nothing shown/fetched before clicking) showing "{your
   name} created this payment" — payments have no update route, so this
   is typically the only entry unless the payment was later deleted (in
   which case, check via a different still-open payment).

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

1. Open **Expenses › Categories** (US-PUR-19; it used to be Settings → Purchases). Confirm a list of expense categories
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
5. **History (click-to-view popup, new)**: next to a category's row
   (both a read-only row and one you can edit), click the small
   **History** button — confirm a popup shows "created this category"
   and, after step 2's edit, "updated this category."

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
7. **History (click-to-view popup, new)**: in the expense's detail
   drawer footer, click the small **History** button — confirm a popup
   shows "created this expense" and "approved"/"rejected this expense"
   entries as applicable.

### 11.3 Job tagging and billable expenses (S-07.5, S-07.6)

1. Submit and approve an expense tagged to one of the demo jobs. Open that
   job's detail page → Costing tab — confirm the expense's amount now
   shows up on the **cost** side of that job's profitability (this was
   previously always $0 before Purchases existed — see §5's own "Known
   gaps" note, now resolved).
2. Submit an expense tagged to a job, with **Billable** checked, and
   approve it. Open its detail drawer — confirm a **Bill to customer**
   button appears (Owner/Staff only), the "Billable" field reads
   "Yes". Click it, confirm the dialog, and confirm you're redirected
   to a brand-new **draft** invoice for the job's own customer, with
   one line for the expense's full amount (amount + tax — the expense's
   own tax was already paid, so this line isn't re-taxed). Reopen the
   expense's detail drawer — confirm "Billable" now reads
   "Yes — billed" and the **Bill to customer** button is gone (one-shot
   only — the underlying `POST /expenses/:id/mark-billed` rejects a
   second attempt against the same expense).
3. Submit and approve a **billable** expense with **no job** attached.
   Confirm its detail drawer shows an explanatory note instead of the
   **Bill to customer** button (an expense with no job has no
   unambiguous customer to bill — attaching a job is the fix, not a
   bug to file).

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
7. **History (click-to-view popup, new)**: on the vendor bill's detail
   page, next to its other action buttons, click the small **History**
   button — confirm a popup shows "created," "recorded," and (if
   voided) "voided this vendor bill" entries.

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
6. **History (click-to-view popup, new)**: in the vendor payment's
   detail drawer footer, click the small **History** button — confirm a
   popup shows a "created this vendor payment" entry.

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
3. Open Profile & Preferences › Notifications › Browser notifications and
   press "Turn on" (US-NTF-12). When the browser asks for permission, accept, then
   trigger another event — confirm a native OS/browser push notification
   appears (this only works over a real trigger, not a manual test
   button, so pick a real action like recording a payment).
4. **Dashboard v2 additions (S-09.14)**: approve an expense, complete a
   milestone, or mark a job completed — confirm each one ALSO shows up in
   the notification bell (not just the dashboard's Recent activity card,
   §15 step 7) — these 3 new event types go through the exact same
   `.notify()` trigger point as every other notification, so they get the
   bell/drawer, email, and (if opted in) browser push automatically, with
   no separate wiring.
5. **Meeting invite/response notifications (S-10.20)**: invite a
   specific Staff user to a meeting — confirm THEY get an "invited"
   notification (bell + email + push, same channels as every other
   type), but no one else in the org does (this is targeted at that
   one person, not fanned out to a role — a stricter check than every
   prior notification type, which all targeted a role like "owner").
   Then have that invitee change their response after their first
   reply (e.g. accepted → declined) — confirm ONLY the organizer gets
   a "response changed" notification, and confirm the invitee's FIRST
   response (before any change) did NOT notify anyone — this is a
   deliberate two-tier behavior, not a bug if the first accept is
   silent.
6. **"Starting soon" reminder (S-10.21)**: schedule a meeting a few
   minutes out (within your configured lead time, default 15 minutes
   if you haven't changed Settings → Meeting reminders or your own
   Profile & Preferences override) with yourself as an accepted
   attendee. Wait for the reminder to fire (checked every 5 minutes
   server-side, so allow up to that long) — confirm you get a
   "starting soon" notification. Set your own status to Declined on a
   different upcoming meeting and confirm you do NOT get reminded for
   that one.
7. **Reminder lead-time settings (S-10.22)**: as Owner, change the org
   default in Settings → Meeting reminders. As any user, override it
   for yourself from Profile & Preferences (or explicitly pick "Org
   default" to clear your own override) — confirm the resolution order
   is your override first, then the org default, then a hardcoded
   15-minute fallback if neither is set.

---

## 13. Users, Teams & Permissions (§2.1 permission model)

This section needs a second browser (or incognito window) to act as an
invited user alongside your Owner session.

1. As Owner, go to the **Team** section (top-level sidebar, Owner-only —
   confirm a Staff/Field user does NOT see this nav item at all once you
   test with one below).
2. Create a new **Team** (e.g. "Sales") and configure its privilege
   matrix — toggle a few capabilities on/off (e.g. "Manage Invoices →
   Issue an invoice").
3. Invite a new user as **Staff**. Confirm:
   - The invite form does NOT allow selecting "Owner" as a role.
   - MailDev shows a real invitation email with a working link.
4. Open the invite link in an incognito window. Confirm:
   - If not logged in, it routes to signup with the invited email
     pre-filled and **locked** (not editable).
   - After completing signup, the invite is accepted and the new user
     lands in the app as a Staff member.
5. As Owner, open the Team you created in step 2 and go to its
   **Members** tab. Confirm it shows only current members (empty at
   first) plus an "Add a staff member" picker/Add button — NOT a
   checkbox against every Staff user in the org. Use the picker to add
   the new Staff user; confirm they now appear in the members list with
   a remove (trash) button, and that they no longer appear in the
   picker's own dropdown once added. Confirm their access now reflects
   that Team's privilege matrix — e.g. if you left "Issue an invoice" off,
   they should be blocked from issuing an invoice (both the button should
   be hidden/disabled AND, if you have API access, a direct API call
   should 403 — never trust client-side hiding alone). Remove them via
   the trash button and confirm they disappear from the members list and
   reappear in the picker.
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
    milestone. Confirm **Mark complete** (fixed-granted regardless of who
    defined the milestone set — see §13.6) and adding a job photo/note
    are all usable (Field is fixed-granted `job_photos.edit_own`/
    `job_notes.edit_own` — see §2.1) — but confirm they do NOT see
    **Edit job**, **Define milestones**, **Raise invoice**, **Release
    retention**, or **Raise variation order** (all gated on Team-
    configurable capabilities Field never has).

### 13.1 Contacts & Catalogue — "own vs others" edit/delete split, per resource (§9 S-01.15/S-02.5)

Needs two Staff accounts in different Teams. Read is unconditional for
every Staff user regardless of Team grants — only create/edit/archive/
restore/delete are gated, independently for Contacts vs. Catalogue.

1. As Owner, go to **Team** → a team's **Privileges** tab. Confirm every
   collapsible group (here and throughout this tab — Manage Contacts,
   Manage Catalogue, Manage Quotes, Manage Jobs, Reports & Ledger, etc.)
   starts **collapsed** on page load — no group's individual rows are
   visible until you click its chevron/header to expand it. Confirm the
   old single "Manage contacts & catalogue" row is gone, replaced by two
   separate collapsible groups, each with its own header-level "grant
   all" switch:
   - **Manage Contacts**: Create/edit own contacts, Edit others'
     contacts, Archive/delete own contacts, Archive/delete others'
     contacts.
   - **Manage Catalogue**: Create/edit own catalogue, Edit others'
     catalogue, Archive/delete own catalogue, Archive/delete others'
     catalogue.
   **Manage Contacts** also includes two more rows, independent of the
   own/others four above and of each other: **Manage contact persons**
   and **Manage contact addresses** (§9 S-01.18) — each a single toggle,
   not an own/others pair, since contact persons/addresses have no
   creator of their own to split by.
   Toggling a group header's switch ON/OFF should set all four of that
   group's rows together in one action; toggling an individual row
   should update just that row (and flip the group header's switch to
   reflect whether all four are now granted).
2. Create two Teams: "Team A" with only **Manage Contacts → Create/edit
   own** granted (nothing else in either group), "Team B" with only
   **Manage Contacts → Edit others'** and **Archive/delete others'**
   granted. Assign Staff User 1 to Team A, Staff User 2 to Team B.
3. As Staff User 1 (Team A), create a new contact. Confirm it appears in
   the list immediately. Edit it — should succeed (their own record).
   Try to archive/delete it — should be blocked (no delete_own grant).
4. As Staff User 2 (Team B), open the **same contact** Staff User 1 just
   created (confirm you can see it at all — read is unconditional, no
   grant needed). Try to edit it — should succeed (`edit_others`). Try
   to archive it — should succeed (`delete_others`).
5. As Staff User 2, create a brand-new contact of their own, then try to
   edit or archive it. Both should be **blocked** — Team B has no
   `edit_own`/`delete_own` grant, only the "others" pair, and Staff User
   2 is the creator of this one.
6. **Confirm the two resources are independent, not shared**: as Staff
   User 1 (who has Contacts `edit_own` but nothing in Manage Catalogue
   at all), try to create or edit a **Catalogue item**. Should be
   **blocked** — having Contacts access grants nothing for Catalogue.
7. Grant Team A **Manage Catalogue → Create/edit own** as well, then
   repeat step 3 for a Catalogue item as Staff User 1 — should now
   succeed, independently of their Contacts grants.
8. As Staff User 1 (Contacts `edit_own` only, no `edit_others`), confirm
   the "add contact" form is still reachable and the privilege matrix
   change didn't accidentally block creation — creating a new record
   only requires `edit_own` for that resource (a new record is always
   "your own" the moment you make it).
9. As Owner, confirm you can edit/archive/delete every contact and
   catalogue item regardless of who created it — Owner bypasses this
   split entirely, same as every other capability in §2.1.
10. **Contact persons/addresses gating (user-reported)**: as Staff User 1
    with **Manage Contacts → Create/edit own** granted but neither
    **Manage contact persons** nor **Manage contact addresses**, open a
    contact they can edit. Confirm the **Add contact person** and
    **Add address** buttons, and every existing row's Edit/Remove icons,
    are all HIDDEN in both sections — previously these were shown
    unconditionally and only failed with a 403 on save. Grant **Manage
    contact persons** only — confirm the Contact persons section's
    buttons appear while Addresses stays hidden (the two are
    independent). Grant **Manage contact addresses** too — confirm both
    now work. As Owner, confirm both work regardless of Team grants.

### 13.2 Leads & Activities — same "own vs others" split, independent of Contacts/Catalogue (§9 S-01.16)

Same setup and pattern as §13.1, applied to the **Manage Leads** and
**Manage Activities** groups instead — verify these two are also
independent of each other and of Contacts/Catalogue. Both the per-contact
Leads/Activities lists (on a contact's own detail page) and the org-wide
`/leads` kanban board respect the same grants — the per-contact Leads list
in particular had no client-side gating at all until a user-reported fix
(same class of bug as Activities', fixed the same day): confirm a Staff
user without `leads.edit_own`/`leads.edit_others` sees no "Add lead"
button and no Edit pencil on any lead row inside a contact's detail page,
not just on the standalone `/leads` board.

1. As Owner, confirm the privilege matrix now has four resource groups
   total: **Manage Contacts**, **Manage Catalogue**, **Manage Leads**,
   **Manage Activities** — each collapsible, each with its own "grant
   all" switch, each listing Create/edit own, Edit others', Delete own,
   Delete others' for that resource.
2. Grant Team A only **Manage Leads → Create/edit own**. As Staff User 1
   (Team A), create a new lead — succeeds. Try to edit a lead someone
   else created — blocked. Try to create or edit an **Activity** (a
   logged call/note/task) — also blocked, since Leads access grants
   nothing for Activities.
3. Grant Team A **Manage Activities → Create/edit own** as well. Staff
   User 1 can now log a new activity (e.g. a call against a contact) and
   edit their own — but still can't edit one logged by someone else
   without **Edit others' activities**.
4. **Reassignment doesn't equal ownership**: as Owner, create a lead and
   assign it (the "pipeline owner"/rep field, not the creator) to Staff
   User 2, who has no Leads grants at all. Confirm Staff User 2 still
   **cannot** edit that lead just because it's assigned to them — only
   whoever *created* it (or someone with `edit_others`) can. Repeat with
   an Activity's "assigned to" field instead of a lead's pipeline owner.
5. Confirm "mark done" / "mark undone" on an activity someone else
   logged requires **Edit others' activities**, same as a text edit
   would — it's not a separately-gated action.
5a. **Activities' Edit pencil and done/undone checkbox web gating
    (user-reported, fixed)**: on a contact's detail page, confirm the
    small pencil "Edit activity" icon next to each logged activity is
    HIDDEN (not just disabled) for an activity the current Staff user
    didn't create and has no `edit_others` grant for — previously it
    showed unconditionally on every activity and only 403'd on save.
    Confirm the done/undone Checkbox is disabled (not hidden — it's
    still useful to see the state) under the same condition. Confirm
    **Log activity** itself is hidden without `activities.edit_own`.
    There is no delete affordance for activities anywhere in the web UI
    today (a pre-existing feature gap, not a privilege bug) — nothing to
    check there.
6. Confirm the pipeline-by-stage dashboard chart (Dashboard →
   "pipeline by stage" widget, if visible) shows for every Staff/Field
   user regardless of Leads grants — this became an unconditional read,
   same as the Leads list itself.
7. As Owner, confirm you can edit/delete every lead and activity
   regardless of who created it, same as Contacts/Catalogue.

### 13.3 Quotes — own/others split, plus separate Send/Revise capabilities (§9 S-03.13)

1. In the privilege matrix, confirm a **Manage Quotes** group with six
   rows: Create/edit own, Edit others', Delete own, Delete others',
   Send a quote, Revise a quote.
2. Grant Team A only **Create/edit own**. As Staff User 1 (Team A),
   create a draft quote — succeeds. Confirm the quote is fully visible
   to every other Staff/Field user regardless of their own Quotes
   grants (read stays unconditional).
3. Still as Staff User 1, try to click **Send** on the draft — should
   be **blocked** even though they created it: Send is a separate
   capability, not implied by edit_own.
4. Grant Team A **Send a quote** too. Staff User 1 can now send their
   own draft. Confirm a SENT quote can no longer be edited by anyone
   (Edit control disappears/errors), regardless of any grant — this was
   already true before the split and must stay true.
5. As Staff User 2 (a different Team, granted only **Edit others'**),
   open Staff User 1's still-draft quote and edit it — succeeds. Try to
   send it — blocked (no Send grant).
6. Confirm **Revise a quote** (creating a new draft version of a sent
   quote) is gated independently — a user with Edit own/others but no
   Revise grant should be blocked from the "Revise" action on a sent
   quote.
7. As Owner, confirm every action above is always available regardless
   of Team grants.

### 13.4 Meetings — own/others split, independent of read-visibility (§9 S-01.17)

Needs two Staff accounts in different Teams, as in §13.1-13.3. This is
the one resource in this pattern where "own" means **organizer**, not
literal creator — but functionally the same person in practice (whoever
creates a meeting becomes its organizer).

1. Confirm the privilege matrix now shows a **Manage Meetings** group
   (edit_own/edit_others/delete_own/delete_others) in place of the old
   single "Create/invite/manage meetings" row.
2. Grant Team A only **Create/edit own**. As Staff User 1 (Team A),
   create an `org`-visibility meeting — succeeds. As Staff User 2 (no
   meetings grants at all), confirm they can still **see** this meeting
   on the calendar (org-visibility read is completely independent of
   the Manage Meetings group — do not confuse this with S-01.10/S-01.11's
   private/org visibility system, which this change does not touch).
3. Staff User 2 tries to **edit** that same meeting — blocked (no
   edit_own — they didn't organize it — and no edit_others).
4. Grant Team B (Staff User 2) **Edit others'** — now editing Staff
   User 1's meeting succeeds.
5. Create a **private** meeting as Staff User 1, inviting only
   themselves (no other attendees). Confirm Staff User 2 — even WITH
   full Manage Meetings access — still cannot SEE this meeting at all
   in list/calendar views (403/absent, not just hidden buttons) unless
   they're invited or the meeting is switched to org-visibility. This
   is the critical regression check: the own/others split must never
   widen who can see a private meeting.
6. As Owner, confirm you can edit/delete every meeting (private or
   org, organized by anyone) regardless of Team grants — same
   blanket-access rule as everywhere else in §2.1.

### 13.5 Purchases — own/others split across Expenses, Expense Categories, Vendor Bills, Vendor Payments (§9 S-07.9)

Needs a Staff account in two Teams, plus a **Field** account for the
Expenses-specific check. This is the first resource in this pattern
where Field has real write access to their own records.

1. Confirm four new collapsible groups in the privilege matrix: **Manage
   Expenses** (Create/edit own, Edit others', Delete own, Delete others',
   Approve, Reject, Mark as billed, Bill to customer), **Manage Expense
   Categories**, **Manage Vendor Bills** (own/others pair plus Record and
   Void), **Manage Vendor Payments** (own/others pair — no separate edit
   action exists for vendor payments, only create/delete).
2. As a **Field** user with NO Team memberships at all (Field never
   appears in the privilege matrix), submit a new expense from the
   mobile/field flow — succeeds. Edit it — succeeds. Delete it —
   succeeds. All three must work purely because Field is fixed-granted
   `edit_own`/`delete_own` for their OWN expenses, regardless of Teams.
3. Still as that Field user, try to view/edit a **different** expense
   submitted by someone else. Confirm they can SEE it (read stays
   unconditional) but get blocked from editing/deleting it — Field never
   gets `edit_others`/`delete_others` under any configuration.
4. Grant Team A (a Staff user) only **Manage Expenses → Create/edit
   own**. Confirm they can submit/edit their own expense, but the
   **Approve**/**Reject** buttons on a colleague's submitted expense are
   blocked without the separate Approve/Reject grants — these were never
   folded into edit_own.
5. Grant Team A **Manage Expenses → Approve**. As that Staff user,
   approve a colleague's expense — succeeds, even without any
   edit_others grant (approving isn't editing).
6. Repeat the "create own, blocked from others', independent workflow
   action" pattern for a **Vendor Bill**: create as Staff User 1
   (Create/edit own only), confirm Staff User 2 (no grants) can view it
   but not edit it, and confirm neither can click **Record** without the
   separate `vendor_bills.record` grant.
7. Confirm **Vendor Payments** — create a payment as Staff User 1
   (Create own vendor payments granted), confirm Staff User 2 can see it
   but deleting it (while unallocated) requires `delete_own`/
   `delete_others` as appropriate.
8. As Owner, confirm every action above works regardless of Team grants,
   for all four Purchases resources.

---

### 13.6 Jobs & Milestones — own/others split, with Field always passing both branches on milestone completion (§9 S-04.11)

Needs a Staff account in two Teams, plus a **Field** account. Milestones
are the one resource in this pattern where "own" means whoever last
*defined the whole milestone set*, not who's completing it — Field always
passes both own and others when completing, since that's never been an
ownership question for Field.

1. Confirm a **Manage Jobs** collapsible group in the privilege matrix
   listing: Create/edit own jobs, Edit others' jobs, Release retention,
   Define/complete own milestone set, Define/complete others' milestone
   set, Raise invoice from milestone, Add own job notes, Add own job
   photos, Create own variation orders, Apply variation order. No delete
   rows exist for any of these — there's no delete route on this resource
   family.
2. Grant Team A (Staff User 1) only **Create/edit own jobs**. Create a
   job as User 1 — succeeds. Edit it — succeeds. As Staff User 2 (no
   grants), confirm the job is visible (read stays unconditional) but
   **Edit job**/**Release retention** buttons are hidden, and attempting
   the API call directly is rejected.
3. Grant Team B (Staff User 2) **Edit others' jobs**. Confirm User 2 can
   now edit User 1's job.
4. As Staff User 1 with **Define/complete own milestone set** granted,
   define a job's first milestone set. Since the job had no milestones
   yet (no owner), confirm this actually required the **others** grant,
   not own — a fresh job's first milestone set has no creator to "own"
   it against.
5. Still as User 1, redefine (edit) the same milestone set again — this
   time only the **own** grant is needed, since User 1 is now the set's
   owner (whoever last replaced it).
6. As Staff User 2 with only **Define/complete own milestone set**
   granted (not others'), try to redefine User 1's milestone set —
   blocked. Grant **others'** too — succeeds.
7. As a **Field** user with ZERO Team memberships, mark a pending
   milestone complete on a job whose milestone set was defined by someone
   else entirely — succeeds. This must work unconditionally; Field never
   needs a Team grant for milestone completion regardless of who defined
   the set.
8. As a Staff user with only **Define/complete own milestone set**
   granted, try to mark complete a milestone on a set they didn't define
   — blocked, unlike Field in step 7. Grant the **others'** capability
   too — succeeds.
9. Confirm **Add own job notes**/**Add own job photos** work for a
   **Field** user with zero Team grants (same fixed-access shape as
   Expenses) — the Notes/Photos tabs' add actions must be visible and
   functional purely from the Field role, no grant needed.
10. As Owner, confirm every action above works regardless of Team grants.

---

### 13.7 Invoices, Payments & Credit Notes — own/others split, the final phase (§9 S-05.11/S-06.8)

Needs a Staff account in two Teams. This replaces the single blanket
"Create invoices, record payments" capability that used to cover
everything in this section — every action below now has its own toggle.

1. Confirm three new collapsible groups in the privilege matrix: **Manage
   Invoices** (Create/edit own, Edit others', Delete own, Delete others',
   Issue, Void, Email, Send reminder), **Manage Payments** (Record own,
   Delete own, Delete others', Apply credit, Re-send receipt — no
   "edit others" action since payments have no update route), **Manage
   Credit Notes** (Create/edit own, Edit others', Delete own, Delete
   others', Issue).
2. Grant Team A (Staff User 1) only **Manage Invoices → Create/edit own**.
   Create a draft invoice as User 1 — succeeds, but they can't click
   **Issue Invoice**, **Void**, **Email invoice**, or **Send reminder** —
   all hidden until their own dedicated grant is added. As Staff User 2
   (no grants), confirm the draft is visible (read stays unconditional)
   but **Edit**/**Delete** are hidden, and a direct API call is rejected.
3. Grant Team B (Staff User 2) **Edit others' invoices**. Confirm User 2
   can now edit User 1's draft. Grant **Delete others' invoices** too and
   confirm they can now delete it.
4. Confirm the ownership check runs before the draft-only status check:
   issue an invoice (own + Issue capability), then as a user with zero
   invoice grants try to edit it — confirm you get a permission error,
   not a "only a draft can be edited" error, even though it's also true
   the invoice is no longer a draft.
5. Grant Team A **Manage Invoices → Issue**. As User 1, issue a draft
   invoice — succeeds even without Void/Email/Send reminder granted;
   confirm those three buttons stay hidden until granted individually.
6. On the issued invoice, confirm **Record payment** requires **Manage
   Payments → Record own payments**, and **Issue credit note** requires
   **Manage Credit Notes → Issue** — both buttons should be hidden until
   their respective capability is granted, even if the user already has
   full Invoices access.
7. Record a payment as User 1 (Record own granted). Confirm User 2 can
   see it (read unconditional) but **Delete payment** stays hidden until
   **Delete own**/**Delete others'** is granted as appropriate — same
   own/others split as Vendor Payments (§13.5). Confirm **Apply credit**
   and **Email receipt** each require their own dedicated grant
   independently of delete.
8. As Owner, confirm every action above works regardless of Team grants,
   for all three resources.

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
3. **`apps/design-system-native`** (`pnpm dev:ui-native`, then `--web`
   or a simulator): browse Button, Text Field, Card, Badge, **Bottom
   Tab Bar**, **Floating Tab Bar**. Confirm a wide browser window
   shows the desktop shell (top bar + left sidebar at a fixed ~224px
   width, not full-width) and narrowing it below ~768px switches to
   the mobile list → push-detail stack. Click the Search button (or
   ⌘K on web) and confirm it filters the component list and jumps to
   the selected one. **On Bottom Tab Bar and Floating Tab Bar**,
   confirm the "Live demo" section actually works — click between all
   5 tabs (Home/Jobs/Expenses/Messages/Profile) and confirm the
   content changes and the active tab's icon/color updates — check
   this on BOTH the desktop layout and the mobile layout (a real
   shipped bug had the live demo crash with "Couldn't register the
   navigator" specifically on the desktop layout, fixed 2026-08-30).
   **On Floating Tab Bar specifically**, confirm: the bar is a true
   floating pill with visible margin on all sides (not flush with the
   preview box's edges, not a rounded rectangle), the active tab's
   highlight is a true rounded capsule matching the outer pill's
   curvature (most visible on the rightmost tab, where a flatter
   radius showed as a visible seam against the pill's own curve —
   fixed 2026-08-30), every tab shows its icon stacked above its
   label, and there's no white area visible behind the bar in either
   light or dark mode (a real shipped bug had the demo's preview box
   and its `NavigationContainer` both losing their theme — fixed
   2026-08-30). **Also confirm**: tapping a different tab makes the
   highlight capsule visibly SLIDE from the previously selected tab to
   the newly selected one, rather than instantly jumping/disappearing
   from one and reappearing on the other (tap a tab that's NOT
   adjacent to the currently selected one, e.g. Home → Messages, to
   make any snap-vs-slide difference obvious) — this was added
   2026-08-30, replacing an earlier instant-swap. **Also confirm all 5
   tab icons AND labels are level with each other** — same vertical
   position and size for every tab, none sitting higher or lower than
   the others; check this specifically at a NARROW/phone-width layout
   (a real device or simulator, or a narrow browser window — not just
   a wide desktop window) since two distinct bugs shipped here and
   only showed up at real phone widths: (1) icons at inconsistent
   heights due to icon-font glyph inconsistency, fixed 2026-08-30 by
   migrating from `@expo/vector-icons` to `lucide-react-native`; (2)
   "Messages"/"Expenses" (the longest labels) wrapping to two lines on
   a narrow screen and shifting that tab's whole icon+label block,
   fixed 2026-08-30 by forbidding label wrapping — confirm long labels
   truncate with an ellipsis ("Expens…", "Messa…") rather than
   wrapping or clipping abruptly. Check this on both Bottom Tab Bar
   and Floating Tab Bar, in both light and dark mode. Click the
   theme-toggle icon in
   the top bar/header and cycle through all three states, confirming
   at each step that BOTH the icon AND every background/text/border
   color on screen (the sidebar, top bar, card borders, body text,
   etc.) are consistent with the reported preference: **sun icon =
   light mode**, **moon icon = dark mode**, **monitor icon = system**
   (resolves to the device/browser's real light/dark preference). Two
   real shipped bugs were found and fixed here 2026-08-30: (1) the
   toggle changed internal state but no color on screen ever visibly
   changed (a build-time CSS generation gap affecting web and native
   equally), and (2) after fixing that, the icons themselves were
   mapped to the wrong preference (moon shown for light, sun shown for
   system, etc.), which made a now-correctly-working toggle look
   broken because the icon didn't match the state a user would expect
   from pressing it. Confirm both the icon-to-state mapping and the
   actual color change on a device/simulator AND in a web browser
   (`--web`). **Also confirm**: the top bar/header itself (not just
   the page content below it) changes color with the theme — a real
   shipped bug had the React Navigation header stay light in dark mode
   while the rest of the screen correctly went dark, fixed 2026-08-30.
   **Also confirm "system" actually tracks your real OS/browser
   preference** — set your OS or browser to dark, reload the app fresh
   (don't just click the toggle) and confirm it boots straight into
   dark mode with no click needed; then explicitly cycle the toggle
   back to the monitor icon and confirm it's still dark; then switch
   your OS/browser preference to light while the app is on "system"
   and confirm it live-updates to light without a reload. All three of
   these were broken (system always resolved to light on web) and
   fixed 2026-08-30. **Also confirm the preference survives a reload**
   — pick light or dark explicitly, reload the page (web) or restart
   the app (native), and confirm it comes back in the same mode
   instead of resetting to system; this was a real shipped bug
   (preference was in-memory only) fixed 2026-08-30.
   **On the Button page specifically**, check every variant's
   **Disabled** example in the States/Examples section — the label
   text must be clearly visible (muted gray, not white-on-transparent)
   in both light and dark mode; this was a real shipped bug (invisible
   disabled-button text) fixed 2026-08-30. Also check the **Loading**
   example (all variants) — the spinner must be clearly visible (muted
   gray, not white-on-transparent) in both light and dark mode; this
   was a second, related shipped bug (invisible loading spinner) fixed
   the same day.
4. **`apps/showcase-native`** (native-only, `expo-router` — run via its
   own dev script, real device/simulator required, no web/Expo Go
   fallback). **Components tab (2026-09-14)**: browse to each of the 9
   components added/caught up this session — Full Width Button, Select
   Field, Select List Field, Segmented Control, Floating Label Field,
   Native Text Field (iOS-only; confirm it shows a plain notice instead
   of crashing on Android), Form Row / Form Section, Divider, Stepper —
   confirm each has a real demo screen that renders without error (not
   the "Component not found" fallback, which is what a missing
   `component-demos.ts`/`component-catalog.ts` entry looks like). Then
   open the **Templates → Edit** entry (the Job Edit form,
   `job-edit-form.tsx`) on both iOS and Android. Confirm the redesigned
   form layout: each section (Details/Schedule/Billing/Notes) shows an
   uppercase caption above ONE card with no border of its own, and
   fields inside a card are separated by thin full-bleed dividers
   rather than each field having its own bordered box.
   **Floating labels** (Title, Client, Status, Job value, Notes):
   confirm each shows its label CENTERED in the row acting as the
   placeholder when empty, and — for Title/Job value/Notes — that
   focusing the field animates the label up to a small caption above
   the value (Client/Status have no focus state, so their label
   snaps to the floated position immediately once a value is picked,
   with no animation). Confirm the required asterisk appears inside
   the label text itself ("Title *", "Client *", "Job value *"), and
   that clearing Title or leaving Client unset and tapping Save still
   shows the inline error text below the row with the label/value
   tinted red (there's no border to recolor in this borderless
   layout). **Client field**: confirm it shows the current client's
   name with a chevron, tapping it opens a full sheet with a search
   box and a scrollable list of ~10 demo clients; type a partial name
   and confirm the list filters live; tap a result and confirm the
   sheet closes and the row now shows the picked name; confirm the
   previously-selected client shows a checkmark when reopening the
   sheet. **Status field**: confirm it opens a native menu popup with
   4 options (not the searchable sheet — Status is a short fixed
   list, only Client uses the searchable-popup pattern).
   **Cross-field consistency checks (four real, reported/fixed visual
   bugs — verify each explicitly, not just "does it look fine"):**
   (1) every row in a card (Title/Client/Status/Job value, and
   separately Start date/Due date/Retention held) should be the SAME
   height — no row should look taller or shorter than its neighbors;
   (2) the value text size in Title/Client/Job value/Notes should
   visually match Status's value text size exactly — a real shipped
   bug had `NativeTextField`'s value rendering noticeably larger
   (SwiftUI's system-default size) than `SelectField`'s explicit 14px;
   (3) there should be clear, comfortable vertical spacing between a
   floated label and its value below it, not a cramped near-overlap;
   (4) Start date/Due date's pills should sit flush with the row's
   right edge, aligned with where Retention held's switch sits — a
   real shipped bug had the date pills sitting noticeably short of
   the right edge (SwiftUI's `.compact` date-picker style bakes in
   its own internal trailing padding) compared to the switch. All
   four were fixed 2026-09-13 (`ROW_HEIGHT` in `FormRow`, a new
   `font`/`floatingAbove` treatment on `NativeTextField`, loosened
   label-position constants in `FloatingLabelField`, and a measured
   `marginRight` on `DateTimePicker`'s iOS wrapper). This is a new
   component pilot (`Divider`, `SelectListField`, `FloatingLabelField`,
   and `TextField`/`NativeTextField`/`SelectField`'s `variant="row"`/
   `floatingLabel` props, all in `packages/ui-native`, added
   2026-09-13) — check both light and dark mode, since it's new
   NativeWind `dark:`-paired styling. **Test on a real Android
   emulator/device, not iOS only** — three real bugs shipped through
   iOS-only testing and were only caught once this screen was actually
   run on Android: (a) Title/Job value's value text rendering BESIDE
   the floated label instead of below it (Android defaults an unset
   `textAlignVertical` to center; fixed by setting it to `"top"`
   unconditionally); (b) once (a) was fixed, Title/Job value's
   label-to-value spacing was still visibly tighter than Client/
   Status's — confirm all four Details rows now show matching spacing
   (pixel-measured at 33-35px across all four after the fix); (c)
   **light mode showed no visible card/group boundaries at all, on
   BOTH iOS and Android** — confirm the page background reads as a
   distinct light gray behind crisp WHITE cards (not white-on-white)
   in light mode, on both platforms; dark mode was never affected by
   this bug (it already had visible contrast) but should still be
   checked for the same gray-background/lighter-card relationship.
   **Notes field (the form's one multiline/textarea field)**: tap into
   it and confirm the keyboard actually opens and typing works — a
   real shipped bug had this field completely untappable (its wrapper
   collapsed to a near-zero hit-test area against an unconstrained
   parent, even though it still LOOKED like a normal box in a
   screenshot) on both platforms. Once confirmed tappable, also check
   it reads as a proper multi-line textarea, not a single input row:
   the placeholder/label should sit anchored at the TOP-LEFT of a
   real multi-line-tall box (not vertically centered like the other
   fields), and the box itself should have a real minimum height
   roughly matching the other cards' content, not collapse to one
   line when empty.
   **Client select — full-width sheet content + a 120-option stress test
   (fixed/added 2026-09-14)**: tap the "Client" row to open its bottom
   sheet. Confirm the search box and the option list BOTH span the
   FULL width of the sheet, edge to edge (matching the sheet's own
   width) — a real, reported bug had both rendering visibly narrower
   than the sheet, floating in the middle of it. `CLIENT_OPTIONS` is
   now 120 generated, realistic company-name-shaped entries (not the
   original 10) — a deliberate stress test. Confirm: the list scrolls
   smoothly through all 120 without jank; typing in search (e.g.
   "stone" or "build") filters down to a genuinely smaller, correct
   subset live as you type; clearing the search shows all 120 again;
   selecting an option closes the sheet and shows that option's label
   in the Client row. This same `matchContents`/`snapPoints` fix
   applies to every `BottomSheet` caller with explicit `snapPoints`
   (not just this one) — if a FUTURE fixed-height sheet anywhere in
   `packages/ui-native` ever renders its content narrower than the
   sheet again, check `BottomSheet`'s own `matchContents`/
   `fitToContents` wiring first before assuming it's a new bug.
   **Option row height + reopen-scroll-position (fixed 2026-09-14,
   found immediately while testing the above)**: each row should feel
   like a comfortable, real tap target (52px min height) — not
   cramped/thin (a real regression from the full-width fix above,
   since rows were previously laid out against an accidentally
   oversized container). Separately: pick an option far down the list
   (e.g. the ~50th), close the sheet (select it, or dismiss without
   selecting), then reopen the Client row. Confirm the sheet opens
   ALREADY SCROLLED to that same option — visible near the top of the
   visible area — not reset back to the very top of all 120 requiring
   a fresh scroll-down to find the current selection again.
   **Crew size — a new `Stepper` field (added 2026-09-14)**: below Job
   value in the Details section, confirm a "Crew size" row with a `-`
   button, a number, and a `+` button — identical in appearance on
   BOTH iOS and Android (deliberately the SAME custom design on both
   platforms, not a native-vs-custom split). Tap `+`/`-` and confirm
   the number updates immediately; confirm `-` disables/stops
   responding at 1 and `+` disables/stops responding at 20 (visibly
   dimmed at both limits, tapping past either limit does nothing).
   **Refactor: `FormRow`/`FormSection`/the unsaved-changes guard/the
   keyboard-scroll mechanism all moved to `packages/ui-native` (2026-09-14)
   — a pure extraction, no intended behavior change.** Re-run every check
   in this whole section (form layout, floating labels, validation errors,
   the back-button discard alert, focusing Notes near the bottom of the
   form) end to end — this refactor touched the exact code paths those
   checks exercise, so it's the one most likely to have silently changed
   something even though none was intended.
   **Home screen's period `SegmentedControl` (2026-09-14)**: on the Home
   tab, confirm the This week/This month/This year control above the KPI
   carousel still looks and behaves exactly as before (now backed by
   `@spine/ui-native`'s own `SegmentedControl` wrapper instead of a direct
   `@expo/ui` import) — tapping a segment still switches the selection
   with no visible change in behavior.
   **Home screen refactor: `GaugeIndicator`/`KpiCard`/`ActionTile` moved to
   `packages/ui-native` (2026-09-14) — re-run the whole Home screen after
   this.** Confirm the revenue-goal gauge on the welcome card still sweeps
   in from 0% on load with the same spring "snap into place" bounce (not
   an instant jump), the KPI carousel's gradient cards look and scroll
   exactly as before, and Quick Actions' 4 tiles still show their
   icon+label in a tinted rounded box, unchanged visually. **Also confirm
   the real, previously-missing behavior this fixed**: tapping any Quick
   Actions tile (New quote/Log expense/Add photo/New job) now shows an
   alert naming the action — the tiles were completely untappable before
   this change (a plain `View` with no `onPress` at all), so this is a new,
   correct behavior, not a regression if it wasn't there before.
   **Header (fixed 2026-09-13)**: reach this screen via a real in-app
   push — Templates tab → a job's detail screen → Edit. Confirm the
   header looks like `(tabs)/components/[slug]`'s own detail header:
   a small bold centered title (NOT an iOS large/oversized title), a
   visible back chevron, and — on iOS — a TRANSPARENT header with no
   bottom border, blurring the scrolled content behind it as you
   scroll the form (not a solid opaque bar). Check this explicitly in
   BOTH light and dark mode — a real, shipped bug had the header stay
   solid white in dark mode specifically while the rest of the screen
   was correctly dark, caught only once verified in both modes rather
   than whichever mode happened to be open in the simulator. On
   Android, the header keeps its solid themed background (no blur
   equivalent there) — that's expected, not a gap.
   **Back chevron discard-confirmation timing, iOS (fixed 2026-09-14)**:
   make an edit (e.g. change Title), then tap the header back chevron.
   Confirm the "Discard changes?" alert appears IMMEDIATELY, before the
   screen has moved at all — not after the screen has already visibly
   slid away and back. Confirm tapping "Discard" navigates back and
   shows the alert exactly ONCE — not a second time right after (a
   real, reported bug: the back button's native pop animation used to
   start before the JS discard-check could run, and a separate bug
   meant confirming discard once could immediately re-trigger the same
   alert a second time). Confirm "Keep editing" dismisses the alert and
   leaves the form exactly as it was, still on the Edit screen. With NO
   unsaved changes, confirm the back chevron navigates back immediately
   with no alert at all.
   **Header Save/Delete actions, same shape on both platforms (added
   2026-09-13)**: on iOS, confirm the header shows a checkmark "Save"
   button plus a "•••" button that opens a native menu with a single
   destructive "Delete job" action. On ANDROID, confirm the header now
   shows the equivalent pair as plain icons — a check icon (Save) and
   a "⋮" icon that opens a real native dropdown menu with "Delete job"
   in red/destructive styling; tap "⋮" and confirm the menu actually
   opens (a real bug here made it silently do nothing) and dismisses
   cleanly on an outside tap/back press. There is no sticky bottom
   Cancel/Save bar and no standalone "Delete job" button anywhere in
   the form on either platform anymore — both were removed.
   **In-content Save/Cancel (added 2026-09-13)**: scroll to the bottom
   of the form, past Notes, on BOTH platforms. Confirm a GENUINELY
   full-width "Save" button (filled) followed by a full-width "Cancel"
   button (outlined) underneath it — both buttons' pill backgrounds
   should span the same width as the cards above them, not sit
   centered/content-sized in the middle of the row. This uses a new
   `FullWidthButton` component, not the regular `Button` — a plain
   `fullWidth` prop on `Button` was tried and reverted after it turned
   out full-width filled buttons aren't achievable that way on iOS (a
   real, confirmed `@expo/ui`/SwiftUI limitation, not a bug to
   "eventually fix" the same way — see the CHANGELOG entry for the
   full investigation if this ever needs revisiting). Save here should
   behave identically to the header Save (same "Job updated"
   confirmation); Cancel should behave identically to the existing
   Cancel behavior — if there are unsaved changes, a discard
   confirmation appears before navigating back; with no changes, it
   navigates back immediately. Also confirm the spacing between the
   Notes box and the Save button reads the same as the spacing between
   every other section on the screen (Details/Schedule/Billing/Notes)
   — it should NOT look like an oversized gap; if it does, re-check
   that both buttons are actually rendering full-width first, since an
   undersized centered pill button was what made this look wrong
   originally.
   **Button shape (added 2026-09-13)**: on BOTH platforms, confirm Save
   and Cancel show a real rounded-RECTANGLE corner, not a full pill/
   capsule shape — the corner should be a modest, visible curve (not
   a half-circle end-cap). This exercises `FullWidthButton`'s `shape`
   prop; on Android specifically this is the surface that once caught
   a real bug (an earlier attempt silently broke BOTH buttons entirely,
   no error shown anywhere) — if Save/Cancel are ever missing entirely
   on Android after a change near this code, suspect the `shape`/
   `Shape.*` wiring first (see the CHANGELOG entry for the exact root
   cause: `Shape.RoundedCorner(...)` must be called as a plain
   function, never rendered as JSX). On iOS, `shape` is now a plain RN
   `borderRadius` (see the note below on iOS's implementation change).
   **iOS top spacing on first render (fixed — 2026-09-13, real bug,
   not "investigated, not fixed" anymore)**: cold-launch the app
   straight to Job Edit (kill the app fully first, not just a Fast
   Refresh reload) and confirm the gap above Save is visible
   IMMEDIATELY on first render — matching the spacing between every
   other section on the screen. The original bug: Save had NO visible
   top spacing at all on first render, then visibly jumped down into
   the correct position the first time either button was tapped. Root
   cause was `@expo/ui`'s `Host`/`matchContents` reporting its true
   native content size back to RN asynchronously, one tick after the
   first layout pass — fixed by moving `FullWidthButton` off
   `@expo/ui`'s `Host`/`swift-ui Button` on iOS ENTIRELY (now a plain
   RN `Pressable` styled to approximate the native look; Android is
   unchanged, still real `@expo/ui/jetpack-compose`). See the CHANGELOG
   entry for the full investigation, including a wrong intermediate
   diagnosis (a `ScrollView` `gap-6` className) that was drafted and
   reverted before this fix. Also confirm Save/Cancel still show real
   button styling (filled blue Save, outlined Cancel) — a related bug
   during this fix (`Pressable`'s function-style `style` prop silently
   applying NO styling at all on a real device, suspected NativeWind
   babel-interop interaction) was caught and fixed by computing the
   style as a plain object from local pressed state instead; if a
   future edit to `IOSFullWidthButton` reintroduces a function-style
   `style` prop, verify on a REAL device that styling still applies,
   not just that typecheck/tests pass.
   **"Site visit" — a `mode="datetime"` field (added 2026-09-13)**: in
   the Schedule section, confirm a "Site visit" row exists below Due
   date, showing a real combined date+time value (e.g. "5 Aug 2026,
   9:30 AM"). On iOS, confirm it renders as TWO pills side by side (a
   date pill and a time pill) with NEITHER pill clipped or cut off at
   the card's right edge — this exercises a real, previously-shipped
   layout bug (the two-pill layout overflowed the card at the
   date-only control's original width) fixed alongside the underlying
   `datetime` support itself. On Android, confirm tapping the trigger
   opens the DATE dialog first; confirming it opens the TIME dialog
   next (not a combined dialog — Android has no native widget for
   that); confirming the time dialog updates the field to show BOTH
   the newly-picked date and time merged together, not just one or
   the other. Cancelling either dialog should leave the field
   unchanged. If either platform ever shows only a date with no time
   for this field, suspect `displayedComponentsForMode`/
   `AndroidDateTimePickerField`'s two-step flow in
   `date-time-picker.tsx` — this exact silent gap (dropping the time
   component) is what prompted this fix in the first place.

---

## 15. Reports & Dashboard (FEAT-09, Phase 4 Stage 3 · Money Out & Books)

Best run against the demo data's seeded jobs/invoices/vendor bills/expenses
(§1.7) — the "active" demo job ("Marina office fit-out") has a real
job-tagged vendor bill and expense so it shows nonzero cost, not just
revenue.

1. Go to **Dashboard**. Confirm a 4-card KPI row: Cash position,
   Receivables, Overdue invoices, Revenue this month — all real numbers
   derived from the ledger, not placeholders. Cross-check "Receivables"
   matches Receivables' own Total outstanding figure (§9).
2. **Dashboard v2 Stage 2 — chart widgets (S-09.11)**: below the KPI row,
   confirm 4 chart cards render with real data:
   - **Revenue trend** (uses `@spine/ui`'s `TrendBarChart`) — a bar chart,
     one bar per month, each non-zero bar showing its exact currency
     amount as a label directly above it (not just on hover — the label is
     always visible). A month with zero revenue shows no label rather than
     a fake "$0.00". Click the 3M/6M/12M toggle and confirm the chart
     re-fetches and re-renders with the right number of bars each time.
     Hover a bar and confirm the tooltip also shows the exact amount.
   - **Receivables aging** (uses `@spine/ui`'s `DonutChart`) — a donut with
     a **legend beside it** (not just hover) listing every bucket's label
     and amount, plus a **center total**. Cross-check the legend's figures
     match Receivables' own bucket totals (§9) exactly. Colored current/
     due-soon/overdue, not the app's accent color. If nothing is
     outstanding, confirm it shows "Nothing outstanding" instead of an
     empty/broken ring.
   - **Pipeline by stage** (uses `@spine/ui`'s `TrendBarChart`, horizontal) —
     a horizontal bar per lead stage (New/Qualified/Proposal/Won/Lost),
     bar length by total deal value, each bar showing its value + lead
     count as a label at the end (a stage with 0 leads shows a quiet "—"
     rather than an invisible sliver with no number). Click "View board"
     and confirm it lands on `/leads`.
   - **Job profitability** — a "Top performers"/"Needs attention" ranked
     list (top 3 / bottom 3 by margin), each row with a margin bar colored
     green (positive) or red (negative). Click "View all" and confirm it
     lands on `/reports`.
3. **Regression check**: reload the dashboard a few times and confirm all
   4 chart widgets consistently render without a flash of broken/empty
   state — each widget independently fetches its own data, so one being
   slow shouldn't block the others from appearing.
4. **Dashboard v2 Stage 3 — non-financial widgets + role-adaptive layout
   (S-09.12, S-10.19)**: as Owner or Staff, confirm 4 more cards below the
   charts:
   - **My overdue follow-ups** — lists activities assigned to you with a
     past due date and no completion, each showing how many days overdue.
     Click one and confirm it lands on that contact (or `/leads` if it's
     lead-only). "Nothing overdue" if you have none.
   - **Upcoming meetings** — meetings in the next 7 days, each with a
     colored dot matching its calendar color and a "Today, 9:00 AM"-style
     time label. Click "View calendar" and confirm it lands on
     `/meetings`.
   - **Invoices due this week** — issued invoices due in the next 7 days,
     each with a "Due today"/"Due tomorrow"/"Due in Nd" badge. Click one
     and confirm it lands on that invoice.
   - **Job milestones due** — pending milestones due soon or overdue
     across ALL jobs (not just one), overdue ones badged red. Click one
     and confirm it lands on that job.
5. **Upcoming meetings scope (S-10.19)**: open **Settings → Upcoming
   meetings**. Confirm two options: "Only my meetings" / "Every org
   meeting," default "Only my meetings." Switch to "Every org meeting,"
   save, reload the dashboard — confirm the Upcoming meetings widget now
   shows meetings organized by other users too, not just your own. Switch
   back.
6. **Field's dashboard is a genuinely different, shorter layout — not the
   Owner page with cards hidden.** Log in as a Field user (§13's setup).
   Confirm the dashboard shows ONLY: My overdue follow-ups, Upcoming
   meetings, Job milestones due, and Recent activity — no KPI row, no
   charts, no Invoices due. Confirm Upcoming meetings shows only Field's
   own meetings even if the org setting (step 5) is set to "Every org
   meeting" — this is a hard rule, not a preference, enforced server-side.
7. **Recent activity feed (S-09.14)**: on the Owner/Staff dashboard,
   confirm a full-width "Recent activity" card below the other widgets,
   listing up to 6 recent events newest-first (quote viewed/accepted,
   payment received, expense approved, job completed, milestone
   completed), each with a relative time ("2h ago", "3d ago") and a link
   to its source document. Approve an expense, then complete a milestone
   or mark a job completed — reload the dashboard and confirm both show up
   at the top of the feed within a few seconds, and that each recipient
   (Owner/Staff) also gets a real email for it (check MailDev at
   http://localhost:1080) — same delivery pattern as every other
   `.notify()`-triggered event in this app (S-10.11/S-03.7), not a
   feed-only side channel.
8. **Field's activity feed excludes financial events.** As the Field user
   from step 6, confirm their Recent activity card never shows a "payment
   received" or "expense approved" entry, even if those events happened
   recently in the org — job/milestone-completion and quote-view/accept
   entries are still visible to Field.
9. **Widget customization (S-09.13)**: on the Owner/Staff dashboard, click
   **Edit layout** (top-right). Confirm the widget grid stays in place —
   no separate list — with a small drag-handle + eye-icon control
   overlaid on each widget card's own top-right corner. Confirm the
   **KPI row is NOT part of this** — it has no drag handle, no eye icon,
   and never moves, since it's a pinned header above the customizable
   grid, not a widget. Drag a card to a new position (try same-row and
   diagonal moves) — confirm the grid re-orders immediately, in place.
   Click the eye icon on one widget — confirm it dims (not removed yet,
   so it can still be found while editing). Click **Done** — confirm the
   dashboard now reflects the new order, the hidden widget is gone
   entirely (not greyed out), and the KPI row is unchanged and still
   above everything.
10. **Persistence**: reload the page — confirm the same custom order and
    hidden widget persist (not reset to default), and the KPI row is
    still pinned at the top. Log out and log back in (or open a different
    browser/incognito with the same account) — confirm the same layout
    still applies, proving it's saved server-side per-user, not just in
    browser storage.
11. **Re-showing a hidden widget restores its position.** Reopen
    Edit layout, click the eye icon again on the widget you hid in step 9
    — confirm it reappears in the SAME position it was in before being
    hidden, not appended to the end.
12. **Regression check**: confirm a second user (e.g. a Staff account) on
    the same org has their OWN independent layout — customizing the
    Owner's dashboard must never affect what a Staff or Field user sees,
    since this is a per-user preference, not an org-wide one. Also confirm
    the KPI row is pinned identically for every role that sees it — it
    isn't part of anyone's saved layout.
13. Go to **Reports**. Confirm three tabs: Profit & Loss, Balance Sheet,
    Job Profitability.
14. **Profit & Loss tab**: pick a date range covering all demo data (e.g.
    this calendar year). Confirm Income/Expense sections list real
    chart-of-accounts lines with amounts, and Net profit = Total income −
    Total expenses.
15. Click any account line (e.g. "4100 — Sales — Services"). Confirm a
    drill-down dialog opens listing the journal entries behind that
    figure, each linking to its source document (invoice/payment/vendor
    bill/expense) — S-09.4's "click any figure, see the documents behind
    it." Click through one link and confirm it lands on the right
    document.
16. Click **Export CSV** on the P&L tab — confirm a CSV downloads with
    Section/Code/Account/Amount columns matching the on-screen figures.
17. **Balance Sheet tab**: pick an "as of" date. Confirm Assets,
    Liabilities, and Equity sections, and that **Total assets = Total
    liabilities + Total equity** exactly (the balance sheet must always
    balance). Confirm Equity includes a computed "Retained Earnings
    (current period)" line reflecting net profit to date.
18. **Job Profitability tab**: confirm every job appears with contract
    value, revenue, cost, margin, and margin %. Confirm the "Marina office
    fit-out" demo job shows a nonzero **cost** (from its job-tagged demo
    vendor bill + expense) — every other demo job showing `cost: 0` (no
    vendor bills/expenses tagged to them) is correct, not a bug. Click a
    job name — confirm it navigates to that job's detail page.
19. As a Staff user with **View dashboard summary**, **View receivables**,
    **View payables**, and **View job profitability** all granted (the
    four capabilities that replaced the old single "View dashboard &
    reports" toggle — confirm they're independently toggleable in the
    privilege matrix, e.g. granting only "View receivables" shows the AR
    aging widget/report but not payables or job profitability) but not
    Owner: confirm the dashboard KPI row, the aging/pipeline/
    job-profitability chart widgets, the non-financial widgets (step 4),
    Recent activity (step 7), Customize dashboard (step 9), and the Job
    Profitability report tab all load normally, but the **Revenue trend
    chart** widget and Profit & Loss / Balance Sheet on the Reports page
    all render nothing / show a clear "Owner-only report" message
    (S-09.2/S-09.3/S-09.11's revenue trend stay Owner-only with no
    capability bypass at all). Additionally grant **View ledger /
    journals** and confirm the account **drill-down** behind a P&L/Balance
    Sheet figure now works for this Staff user too (Owner already has
    this unconditionally) — without that grant, drilling down should be
    rejected even though the underlying P&L/Balance Sheet figure itself
    is still Owner-only regardless.
20. **Period close (S-09.8)**: open **Settings → Chart of accounts**,
    scroll to **Period close**. Add a period covering today, click
    **Close**. Try to issue a new invoice or record/approve an
    expense/vendor bill dated today — confirm it's rejected with "falls
    within a closed fiscal period." Click **Reopen** and confirm the same
    action now succeeds.
21. **Custom account (S-09.9)**: in the same Chart of accounts pane,
    click **Add account**, create one (e.g. code `6950`, "Software
    Subscriptions", type Expense). Confirm it appears in the list
    immediately, and that a new Expenses › Categories category can
    select it as its posting account.
22. **Regression check**: after adding a custom account or closing/
    reopening a period, reload Settings → Chart of accounts and confirm
    the existing system accounts (AR, AP, tax, retention) are still
    present and still read-only.

---

### Issued PDFs are kept (US-INV-17)

1. Open a draft invoice and click "Preview PDF". Change the business name
   in Settings → Business and preview again: the PDF shows the new name.
2. Issue the invoice and click "Download PDF". Now change the business
   name, logo or the contact's address and download again: the PDF is
   unchanged.
3. Email the invoice, then send a reminder (§7): both attachments are the
   same PDF as the download.
4. Do the same for a sent quote (§4) and a payment receipt (§8).
5. Credit notes: open a credit note from Billing → Credit Notes or the
   invoice's Credit notes section. A draft shows "Preview PDF"; an issued
   one shows "Download PDF". The PDF reads "CREDIT NOTE", its number,
   "Credited to", "Against invoice <number>", the reason, lines and "Total
   credited", and stays unchanged after the business details change.
6. With the API's files folder made read-only, issue an invoice: issuing
   still succeeds. Make it writable again: the PDF is stored by the retried
   job (or on the first download).

## 16. File storage (US-OPS-27, Phase 6)

Files are stored by the `local` driver unless `STORAGE_DRIVER=s3`.

1. With no `STORAGE_DRIVER` or `S3_*` in `.env`, restart the API. Upload a
   business logo (Settings), a receipt on an expense (§11.2) and a photo on
   a job (§5). Reload each page: every file still shows.
2. Confirm each file exists on disk at
   `apps/api/.data/files/<org-id>/<2-char prefix>/<file-id>` — the folder
   names are ids, never the uploaded file name.
3. Open a job photo in its own tab. In DevTools → Network the
   `/files/<id>` response is 200 with `Content-Type: image/…`,
   `Content-Length`, `ETag` and `Accept-Ranges: bytes`. Reload: 304.
4. Sign out and open the same `/files/<id>` URL: 401. Sign in as a user of
   another organisation and open it: 404.
5. Production stack: `docker compose --profile minimal up -d` with no
   `S3_*` in `.env`. Upload a logo, then `docker compose exec api ls -R
   /data/files` shows it and `docker compose exec api id -un` prints
   `node` (not root). `docker compose restart api`: the logo still shows.
6. S3 driver: `COMPOSE_PROFILES=rustfs pnpm dev:infra:up`, set
   `STORAGE_DRIVER=s3` and the commented `S3_*` values from
   `.env.development.example`, restart the API. Upload a photo: opening it
   redirects (302) to `localhost:9000`. Files uploaded in step 1 still open.

7. Integrity (US-OPS-28): upload a receipt, then overwrite its file on disk
   (`echo broken > apps/api/.data/files/<org>/<xx>/<id>`). Opening it now
   shows an error and the API answers 409 "This file is damaged. Restore it
   from your latest backup." As an Owner, the dashboard shows "1 stored file
   is damaged or missing — restore from your latest backup." with the file
   listed; a Staff or Field user sees no warning.
8. Delete another file from disk: it's reported as "(missing)" the same way.
9. Put the original bytes back (or restore the folder from a backup). After
   the weekly check runs, the warning disappears. To run it now, restart
   the API with a file that has no checksum, or call
   `FileIntegrityWorker.run()` from a script.

10. Safe uploads (US-OPS-29): rename a `.txt` file to `receipt.pdf` and
    attach it to an expense — the form shows "This file type isn't
    supported. Upload a photo or a PDF." An SVG or GIF logo is refused the
    same way. The file pickers only offer JPEG, PNG, WebP, HEIC and PDF.
11. Upload a phone photo that has location data (check with an EXIF viewer
    first) as a job photo. Download it again from the job: the location is
    gone and the photo still shows the right way up.
12. In DevTools, any `/files/<id>` response has `X-Content-Type-Options:
    nosniff` and `Content-Disposition: inline; filename="…"` for photos
    and PDFs.

13. Moving off MinIO (US-OPS-30): with `COMPOSE_PROFILES=rustfs pnpm
    dev:infra:up`, set `STORAGE_DRIVER=s3` and the `S3_*` values, restart
    the API and upload a few files. Then run
    `pnpm --filter @spine/api files:migrate --from s3 --to local`: it
    prints "Copied: <n>  Skipped (already in local): <m>  Failed: 0". Set
    `STORAGE_DRIVER=local`, restart: every file still opens. Run the
    command again: "Copied: 0". The bucket still holds the originals.
14. Delete one object from the bucket before migrating: the command lists
    it as "missing from s3", exits with an error, and that file's record
    still points at S3.

15. Disk space (US-OPS-31): `curl localhost:4000/health/ready` shows
    `"storage":{"driver":"local","usedPercent":<n>}`. To see the banner,
    run the API with `FILES_DIR` on a small, nearly full volume (e.g. a
    50 MB disk image filled to 90%): Owners see "Storage is <n>% full. Free
    up space or add disk before uploads stop working." on every page
    within 15 minutes of a restart; Staff and Field don't.
16. Fill that volume completely and upload a photo: the uploader shows
    "There's no space left to store this file. Ask an owner to free up
    space." and the rest of the app keeps working.

Regression checks:
- Quote, invoice and receipt PDFs still show the business logo (§4, §7, §8).
- **Load demo data** still seeds the logo and job photos (§1.7).
- Every page still lays out normally for Owners, Staff and Field (the new
  banner slot is empty when there's nothing to show).
- Contact logos, profile avatars and expense receipt links still open, and
  uploading each still works (logo crop, avatar, receipt, job and milestone
  photos).

## 17. Read access (US-OPS-20, Phase 6)

Set up an Owner, a Staff member in a Team without "View receivables", and
a Field user assigned to one job (§13).

1. As Staff and as Field: `GET /org/invitations` → 403, and Users →
   Invitations isn't reachable. As Owner: the invitations list shows.
2. As Staff: `POST /demo-data/seed` and `DELETE /demo-data` → 403. (Loading
   demo data is only offered in the Owner's onboarding; deleting it only
   in the Owner's Settings → Data.)
3. As the Staff member without "View receivables": the dashboard has no
   "Invoices due this week" widget, and the route returns 403. Grant it
   to their Team: the widget appears.
4. As Field: a photo on the assigned job opens; a photo on another job's
   `/files/<id>` URL → 404. Your own expense receipt opens; another
   person's receipt → 404. An invoice PDF's `/files/<id>` → 404.
5. As Field: Expenses lists only your own expenses; another person's
   `/expenses/<id>` → 404.
6. As Staff: everything above opens (except the receivables widget in 3).
7. Upload a logo in Settings but don't save: the file opens for you; as
   another Staff member its `/files/<id>` → 404.

Regression checks: contact logos, avatars, the business logo, job photos
and receipts still show for everyone who should see them (§2, §5, §11,
§13).

## 18. Field and job money (US-JOB-19, Phase 6)

With a Field user assigned to one job (Jobs → Crew):

1. As Field, Jobs lists only that job, with no "Contract value" or
   "Retention" columns.
2. Open it: no contract value or retention in the header, milestones show
   no amounts, and there's no Costing tab. Notes, Photos and Milestones
   still work, including "Mark complete".
3. Open another job's URL directly (`/jobs/<id>`): "Job not found".
4. The dashboard's "Job milestones due" lists only that job's milestones.
5. As Staff without "View job profitability", the Costing tab is hidden;
   grant it to their Team and it appears. Owners always see it.

Regression checks: Owners and Staff still see contract value, retention
and milestone amounts everywhere (§5).

## 19. Sidebar by role (US-TEAM-18, Phase 6)

1. As Field: the sidebar shows "Overview" › Dashboard and "Work" › Jobs,
   Meetings, Expenses — nothing else.
2. As Staff in a Team without "View receivables" / "View payables": no
   Receivables / Payables. Without any report grant: no Reports. Staff
   never see Team (Users, Teams).
3. Grant "View receivables" to their Team and reload: Receivables appears.
4. As Owner: every section, including Team.

## 20. No-access page (US-OPS-12, Phase 6)

1. As Staff without report grants, open `/reports` and `/receivables`:
   "You don't have access to Reports" / "…Receivables", naming the
   owners, with "Go to dashboard". DevTools → Network shows no
   `/reports/*` request from that page.
2. As Staff, open `/team/users`: "Team is only available to owners." —
   no mention of team permissions.
3. As Staff with "View job profitability", open Reports: it opens on Job
   Profitability; the Profit & Loss tab shows "Profit & Loss is only
   available to owners."
4. As Field, open `/invoices`: the no-access page, without the "change
   your team's permissions" part.
5. Trigger a refused action (e.g. remove a grant from a Staff member's
   Team while they have the page open, then use that button): a toast
   reads "You don't have permission to do that", not a raw error.

## 21. Self-approval (US-PUR-20, Phase 6)

1. As a Staff member whose Team can approve expenses, submit an expense and
   open it: no Approve/Reject; the drawer reads "Someone else needs to
   approve your own expense."; "Delete expense" is there; Edit is in the
   row's actions.
2. Open a colleague's submitted expense: Approve and Reject work.
3. As Owner, open your own submitted expense: Approve works.

## 22. Owners on the Users page (US-TEAM-16, US-TEAM-17, Phase 6)

1. Team → Users: "Users" / "Everyone with access to this organisation."
   appear once, at the top.
2. On a Staff member's row: ⋯ → "Promote to Owner" opens "Make <name> an
   owner?" naming your business. "Cancel" changes nothing; "Make owner"
   (blue, not red) makes them Owner.
3. The Primary Owner's row has no "Deactivate". As the Primary Owner, its ⋯
   menu shows only "Transfer primary ownership…"; as another Owner, the
   row has no ⋯ menu at all.

## 23. Setup checklist (US-ONB-12, Phase 6)

1. As Staff or Field: the dashboard has no "Get started" card.
2. As Owner after "Load demo data" only: the card shows with none of the
   three steps ticked.
3. Dismiss it as one Owner: another Owner no longer sees it either.

## 24. Exact decimals (US-TAX-07, Phase 6)

1. Settings → Tax: add "New York" at 8.875%. Reopen it: 8.875.
2. On a quote, a line of quantity 0.3 at 33.33 shows 10.00 in the editor
   and, after saving, on the quote and its PDF.
3. A line of quantity 1.005 at 1.00 totals 1.01 (not 1.00).
4. A 12.5% discount on 3 × 33.33 (99.99) is 12.50; 20% VAT on the rest
   (87.49) is 17.50; the line total 104.99. Editor and saved figures match.
5. Job milestones: 33.3333 / 33.3333 / 33.3334 % saves; 33.333 × 3 is
   refused with "Milestone percentages must total 100%".

Regression checks: existing quotes, invoices, credit notes, vendor bills and
job milestones show the same totals as before the upgrade (§4, §7, §11, §5).

## 25. Deposits against advance invoices (US-PAY-13, Phase 6)

1. Create an advance (deposit) invoice for 5,000.00 with a tax rate on the
   line, and issue it: its tax is 0.00.
2. "Record payment" for 5,000.00 offers the advance invoice; allocate it all.
   The invoice shows "Paid". The payment's journal entry: Bank 5,000.00 Dr,
   2200 Customer Advances 5,000.00 Cr, no Accounts Receivable.
3. The customer's credit shows 5,000.00. Apply it to the final invoice: its
   balance drops by 5,000.00; the entry is 2200 Dr / Accounts Receivable Cr.
4. A 2,000.00 payment on a fresh 5,000.00 advance invoice: "Partially paid",
   3,000.00 outstanding.
5. Deleting a payment that paid an advance invoice is refused.

## 26. Milestone ownership (US-JOB-20, Phase 6)

1. As Staff with "Edit own milestones" only: on a job you created, "Define
   milestones" opens and saves; on a colleague's job the button is hidden.
2. As Staff with "Edit others' milestones": edit a colleague's job's
   milestones. The job's creator can still edit them afterwards; the
   first Staff member still can't.

## 27. Retention on progress invoices (US-JOB-21, Phase 6)

1. Open a progress invoice raised from a milestone on a job with retention
   (demo: the job with retention accumulating, §5). Under the header:
   "Job <name>" and "Milestone <name> (<pct>%)", both linking to the job.
2. Totals: Subtotal, Tax, Total, "Retention held (<pct>%)" (negative),
   "Amount due" = Total − retention. Below: "Retention is held in
   Retention Receivable until you release it from the job. Held on this
   job so far: <amount>."
3. Issue a new progress invoice and download its PDF: it has the same
   retention and amount-due rows. Email it: the email states the
   retention held and the amount due.
4. A progress invoice on a job with 0% retention shows no retention row.

## 28. Ledger balance check (US-RPT-12, Phase 6)

1. As Owner, the dashboard shows no "out of balance" warning.
2. To see the warning, a developer can unbalance the dev ledger on purpose
   (insert a stray journal line with `session_replication_role = replica`)
   and run the check (`LedgerIntegrityService.check(orgId)` or wait for
   02:00): the dashboard reads "Your books are out of balance by <amount>.
   Contact the person who runs Spine." and an in-app notification arrives.
   Undo it and run the check again: the warning goes.
3. As Staff, `GET /reports/ledger-integrity` → 403.

## 29. Trial Balance (US-RPT-13, Phase 6)

1. As Owner, Reports › "Trial Balance": choose "As of", "Refresh". Each
   account with a balance shows on its Debit or Credit side; the "Total"
   row's debit and credit match; the status reads "Balanced — total
   debits equal total credits."
2. Untick "Hide accounts with no balance": zero-balance accounts appear.
3. Click an account: its journal entries open.
4. "Export CSV" downloads Code, Account, Debit, Credit and a Total row.
5. As Staff, the tab shows "Trial Balance is only available to owners."

## 30. Tax Summary on Reports (US-RPT-14, Phase 6)

1. As Owner, Reports › "Tax Summary": choose "From"/"To", "Refresh". Cards:
   "Tax collected" (on issued invoices, after credit notes), "Tax paid" (on
   recorded vendor bills and approved expenses), "Net payable".
2. "Collected by rate" lists each named rate or group with taxable amount
   and tax; after issuing a credit note, an "Adjustments from credit notes
   and voided invoices" row appears; "Total collected" equals the card.
3. "Export CSV" downloads the same rows plus tax paid and net payable.
4. Settings › Tax no longer has a tax summary section.
5. As Staff, the tab shows "Tax Summary is only available to owners."

Regression checks: §10's tax summary steps now happen on Reports, not in
Settings › Tax.

## 31. Invite-only sign-up (US-AUTH-08, Phase 6)

1. Signed out, on an instance with an owner, open `/signup`: "This Spine is
   invite-only" naming your business, a "Log in" button, no form. "Log in"
   goes to `/login`, which has no "Sign up" link.
2. Open an invitation's sign-up link (`/signup?inviteId=…&email=…`): the
   normal form, with the invited email.
3. `curl -X POST localhost:4000/api/auth/sign-up/email` with a new email and
   no invitation → 403 "This Spine is invite-only…".
4. On a fresh install (empty database), `/signup` shows the first-account
   form.

## 32. Password reset (US-AUTH-09, US-AUTH-10, Phase 6)

1. Signed out, `/login` → "Forgot password?" → `/forgot-password` with "Reset your password", the explanation, "Email", "Send reset link", "The link works once and expires in 1 hour." and "Back to log in".
2. Enter an address with no account → "Check your email" naming it. The resend button reads "Resend link in 0:59" and counts down; after 60 seconds it reads "Resend link" and works.
3. Enter your own address. With SMTP set up, an email "Reset your Spine password" arrives. Without SMTP the page looks the same and the API log says no link was sent (and shows no token).
4. Open the link in another browser while still signed in in the first: "Choose a new password", "For <your email>. You'll be signed out on your other devices."
5. Type two different passwords → "The passwords don't match." under "Confirm new password". Type a matching pair → the dashboard opens, signed in.
6. In the first browser, reload: you're sent to `/login`. The old password fails; the new one works. On the phone app, the next request signs you out too.
7. Open the same link again → "This link can't be used" with "Request a new one".
8. On the phone app's login, "Forgot password?" opens the web page in the phone's browser.
9. Send 11 reset requests within 15 minutes from one network → the 11th shows "Too many reset requests from this network. Wait 15 minutes and try again."

Regression: `/login` still signs in, and shows "Sign up" only on a fresh install (§31).

## 33. Invitation can't be used (US-AUTH-11, Phase 6)

1. Signed out, open `/accept-invite/<made-up id>`: "This invitation can't be used", "It may have expired, been cancelled, or already been accepted. Ask whoever invited you to send a new one." and "Log in instead", which goes to `/login`. No business name appears.
2. As an Owner, invite someone, then cancel the invitation from Team › Users. Open its link signed in and signed out: the same page.
3. Open an accepted invitation's link, and one past its expiry: the same page.
4. A fresh pending invitation still shows "You've been invited" with sign-up/log-in (signed out) or Accept/Decline (signed in as the invitee).

Regression: the invitation sign-up link (`/signup?inviteId=…&email=…`) still shows the form (§31); accepting an invitation still joins the organisation.

## 34. Signed out mid-task (US-AUTH-12, Phase 6)

1. Open Contacts › "Add contact" and type a name. In another tab, log out (or delete the `better-auth.session_token` cookie in dev tools).
2. Back in the first tab, press "Save contact": "You've been signed out" with "Your session ended, so this change wasn't saved yet. Log in again to save it — the draft stays open in this tab." and "Log in again".
3. "Log in again" → "Log in as <your email>." and "Password". Log in: the dialog closes, the drawer and the typed name are still there, and nothing was saved yet. Press "Save contact" again: it saves.
4. Open Contacts, don't type anything, and sign out in another tab. Within 20 seconds (the notification bell's refresh) the page goes to `/login?next=%2Fcontacts`; logging in returns to Contacts.
5. Signed out, open `/login?next=//example.com` and log in: you land on the dashboard, not another site.

Regression: a Staff user without a capability still gets the "You don't have permission to do that" toast (US-OPS-12), not the signed-out dialog.

## 35. Branded emails (US-NTF-10, Phase 6)

1. With a logo and address in Settings › Business, send a quote to a contact with an email. In MailDev (or your inbox): the From name is your business; the subject is "<Business> sent you a quote (QUO-…)".
2. The email has a coloured bar at the top, your logo and name, "Your quote is ready", "Hi <first name>,", a box with Quote, Total and Valid until, one "View quote" button, the small print, and a footer with your name and address. "View quote" opens the public quote page.
3. Turn images off in the mail client: your business name still shows, and the email still reads correctly.
4. View the plain-text version: same content, with the link written out.
5. Remove the logo and send another quote: no broken image; the name shows alone.

Regression: the quote PDF is still attached; the quote's email status still turns "sent" (§3).

## 36. Every email in the branded layout (US-NTF-11, Phase 6)

Send each of these and check each one has the coloured bar, your logo and name, a heading, and your footer:
1. Invite someone: "<You> invited you to join <Business> on Spine", naming the business from Settings › Business (not "<Name>'s Organisation"), with an "Accept invitation" button that opens the invitation.
2. "Forgot password?" for your own address: "Reset your password" with a "Choose a new password" button.
3. Email an invoice, then send a reminder on an overdue one: the facts box shows the invoice, total, balance due and due date; no button; the PDF is attached. The reminder's subject reads "Reminder: INV-… is now N days overdue".
4. Record a payment from a contact with an email: "Thanks — we've received your payment" with the amount and how much was applied. Send its receipt: "Your receipt" with the PDF.
5. As a member, get a notification email (invite someone to a meeting, approve an expense, complete a milestone): one button to the record, and the footer says "You're getting this because you're a member of <Business>."

Regression: quote emails still match §35; notification bells and push still arrive as before.

## 37. Push from your own profile (US-NTF-12, Phase 6)

1. Log in as a Field or Staff user and open Profile & Preferences: a "Notifications" heading, then "Browser notifications" showing this device's state ("Not enabled on this device" and "Turn on"), then "Meeting reminders".
2. Press "Turn on" and allow notifications: it reads "Enabled on this device". Assign this user to a meeting from another account: a browser notification appears.
3. As an Owner, open Settings from the user menu: there's no "Browser notifications" section any more.

Regression: Meeting reminders on the profile still save; the notification bell still works (§12).

## 38. Expired quote links (US-QUO-21, Phase 6)

1. In Settings › Business profile, fill in "Business email" and "Business phone", and save. Reopen it: both are kept.
2. Send a quote and copy its link from the email. Revise the quote, then open the old link signed out: your logo and name, "This quote link has expired", the explanation naming your business, and a box with your address, email (opens mail) and phone (opens the dialler).
3. Open `/quote/anything-made-up`: "This quote link isn't valid", with no business name or details.
4. Open a current quote link: the quote loads as before.

Regression: accepting and declining a quote on its public page still work (§3); onboarding's business step still saves.

## 39. Emailed quote links stay live (US-QUO-22, Phase 6)

1. Load demo data. In MailDev, open each demo quote email's "View quote" link: every quote whose current version is "sent" opens.
2. QUO-0003 was revised by the demo: its first email's link shows "This quote link has expired"; the email for its revision opens the revised quote.
3. Send a quote, wait a day (or advance the clock), and open the link again: it still loads. It stops only after 30 days or when you revise the quote.

Regression: the quotes list still groups a revised quote under its newest version with "Superseded" on the old one.

## 40. Payment instructions in Settings (US-INV-16, Phase 6)

1. As an Owner, Settings › "Payment instructions": the description, the "How customers can pay" field with "Up to 600 characters. Leave empty to hide the block.", and the note that issued invoices keep their instructions.
2. Paste more than 600 characters and press "Save": "Keep this under 600 characters." and nothing is saved.
3. Enter a few lines (bank, account, reference) and save: "Saved". Reopen Settings: the text is still there.
4. Open Business profile, change the address and save, then come back: the payment instructions are still there.

Regression: Business profile still saves name, logo, address, email and phone (§38).

## 41. Payment instructions on invoices (US-INV-15, Phase 6)

1. Set payment instructions (§40). Issue an invoice and download its PDF: a "How to pay" box under the totals with your text, line breaks kept.
2. Email that invoice: the email shows the same text in a "How to pay" box above "The invoice is attached as a PDF.".
3. Change the instructions in Settings. Download the first invoice's PDF again and send it a reminder: both still show the old text. Issue a new invoice: it shows the new text.
4. Clear the instructions and issue another invoice: no empty "How to pay" box in the PDF or email.

Regression: invoice totals, retention and balance due still print as before (§4); invoice PDFs are still stored at issue (US-INV-17).

## 42. Repeat conversion warning (US-QUO-23, Phase 6)

1. Convert an accepted quote to a job, go back to the quote and press "Convert to job" again.
2. The dialog reads "Converting again creates a separate job. The amount isn't split between them. Only do this if you mean to bill or track this quote's work more than once." Under "Existing job", each job is on its own line and opens the job.
3. "Convert to job anyway" is blue (primary), not red. Pressing it creates a second job.
4. Do the same with "Convert to invoice": the text says "invoice" and the existing invoices are listed as links.

Regression: with Settings › "Repeat quote conversion" set to "Block", the second conversion is refused with no dialog; set to "Off", there's no dialog.

## 43. Job names from quotes (US-JOB-23, Phase 6)

1. Convert an accepted quote whose first line is "Project management" for "Sunstone Retail Fitouts": the job is "Project management — Sunstone Retail Fitouts".
2. Convert it again (confirm the warning): "… (2)".
3. On a database with older jobs named "Job for QUO-…", run `pnpm db:migrate:dev`. They're renamed the same way, and each job's History shows the rename. Jobs you'd renamed yourself keep their names.

Regression: the Jobs list, job detail and the phone's job screen show the new names; editing a job's name still works (§5).

## 44. Job numbers (US-JOB-22, Phase 6)

1. Create a job (or convert a quote): it gets "JOB-001", then "JOB-002". The Jobs list shows a "Number" column beside "Contact", and searching "JOB-002" finds it.
2. Job detail's subtitle reads "JOB-001 · <customer>".
3. Settings › Numbering: change Job's prefix to "WRK" and its starting number to 50, then save. The next job is "WRK-050".
4. A progress invoice's job card reads "JOB-… · <job name>".
5. After `pnpm db:migrate:dev` on a database with older jobs, each has a number in the order they were created, and new jobs continue from there.

Regression: converting a quote twice still warns (§42), now listing "JOB-… · <name>".

## 45. Receivables and payables CSV (US-PAY-10, US-PUR-14, Phase 6)

1. Receivables › "Export CSV": a file with a header and one row per open invoice. Amounts look like "1234.50" with the currency in its own column, and each row has its bucket. It opens cleanly in a spreadsheet.
2. Type an invoice number or contact into the search box, then export again: the file has only the rows on screen.
3. Payables › "Export CSV": the same, one row per open bill. On an organisation with no open bills, the file has only the header row.

Regression: the Reports page's CSV exports (P&L, Balance Sheet, Trial Balance, Job profitability) still download as before.

## 46. Expense categories from Expenses (US-PUR-19, Phase 6)

1. As an Owner, open Expenses: the subtitle reads "Submit an expense for approval. Categories are managed from Expenses › Categories." and there are "Expenses" and "Categories" tabs.
2. Categories lists each category with its posting account. "Add category", edit, archive, restore and delete work as they did in Settings.
3. Settings (user menu) no longer has "Purchases".
4. As a Staff member whose Team has no category rights, open Expenses: the subtitle reads "Submit an expense for approval.", with no Categories tab; `/expenses/categories` shows the no-access page. Grant the Team "Edit own" expense categories and reload: the tab appears.
5. As Field: no tab, and the no-access page at `/expenses/categories`.

Regression: submitting and approving expenses still works (§11); the expense form still lists active categories only.

## 47. History reads as sentences (US-SET-13, Phase 6)

1. Open a contact: there's no "History" tab. The clock button beside Edit opens "History".
2. Change the contact's phone and email in one save: the entry reads "<You> changed the phone from … to … and changed the email from … to …". Change five fields at once: three are listed, then "and 2 more".
3. On a contact with invoices, credit notes or a job, its history reads "issued an invoice", "created a credit note", "invoiced a milestone" — never "undefined" or long ids.
4. Open History on an invoice, a quote and a job: the same sentence style.

Regression: the History dialog still loads only when opened.

## 48. "Save" in Settings (US-SET-14, Phase 6)

1. Open Settings and visit every section: no button reads "Continue".
2. Industry template: pick a template and press "Save" — "Saved".
3. Chart of accounts: rename an account (it saves straight away), then press "Save" — "Saved".

Regression: onboarding still shows "Continue" on each step.

## 49. Business name everywhere (US-TEAM-15, Phase 6)

1. Sign up a new organisation and set the business name in onboarding (or Settings › Business profile) to "Riverstone Builders".
2. Invite someone as Staff: the email says "<You> invited you to join Riverstone Builders as staff." — never "<Name>'s Organisation".
3. Change the business name in Settings and send another invitation: it uses the new name.
4. On an older database, run `pnpm db:migrate:dev`: organisations whose name was "<Owner>'s Organisation" now carry the business name.

Regression: the sign-up page's "invite-only" message still names the business (§31).

## 50. Money format (US-OPS-24, Phase 6)

1. With Settings › Currency & locale at USD / en-US, check Invoices, Quotes, Payments, Receivables, the dashboard, Reports and an invoice's detail: amounts read like "$12,024.75", right-aligned in tables, in the normal font. No "USD" after numbers.
2. A credit note, discount or retention shows "−$…" with a proper minus sign.
3. Change the locale to de-DE and reload: "12.024,75 $". Try en-IN with INR: "₹1,20,247.50".
4. Download an invoice PDF: the same format. A negative uses a dash, and an INR invoice reads "INR 1,20,247.50".
5. Send a quote: the email's Total reads "$…". Approve an expense: the notification reads "… $85.00".
6. Use the app normally with several people from one office for a while: no "Too Many Requests" errors.

Regression: CSV exports still have plain decimals ("1234.50") with a currency column (§45).

## 51. Dark-mode text on filled controls (US-OPS-25, Phase 6)

1. Switch to dark mode. Primary buttons ("+ New", "Send", "Record payment", "Log in"), danger buttons, avatars and the notification count have dark text on the coloured fill, easy to read.
2. Switch to light mode: the same controls have white text, as before.
3. On the phone app in dark mode, an empty text field's placeholder is a light grey, readable on the dark background.

Regression: disabled buttons, secondary and ghost buttons look as before in both modes.

## 52. Confirmation colours (US-OPS-10, Phase 6)

1. Edit a recurring meeting: "Edit recurring event" shows a blue "All events". Delete one: "Delete recurring event" shows a red "All events".
2. On a billable expense, "Bill to customer": "Create invoice" is blue.
3. Delete a contact, quote, invoice or payment, void a vendor bill, remove an address, deactivate a user: the confirm button is red.
4. Save a tax rate, approve an expense, release retention, promote someone to Owner: the confirm button is blue.

## 53. Plain wording (US-OPS-21, Phase 6)

1. New quote: "Valid until" says "Quote shows as expired after this date." New invoice: "Due date" says "Drives the overdue flag once issued." Record a payment: no "(S-06.4)".
2. Team › Teams › a Team › expand a privilege group: every description is plain English — no "edit_own", "Phase", "S-11.2" or "(mobile)".
3. Onboarding: the Financial year step says document numbers never reset; the Team step says "You can invite people later from Team › Users.".
4. Settings › Business profile: the Industry helper doesn't mention "the next step".
5. Invoices: a void invoice's Balance due shows "—".

## 54. Light page behind white cards (US-OPS-32, Phase 7)

1. In light mode, open Dashboard, Invoices, Jobs, Pipeline and Reports. The page behind the content is a soft warm grey; cards, tables, the sidebar, filter inputs and outlined buttons ("Edit layout", "Refresh", "Columns") are white with a thin border.
2. Open a dialog (Settings, "Record payment") and a drawer: they are white on a dimmed page.
3. Tab to a button or input on the page and inside a card: the focus ring is blue with a white gap, in both places.
4. Open a public quote link (or any `/quote/...` link): the page is white, not grey. Download a quote or invoice PDF and open a customer email: both stay white.
5. Switch to dark mode: nothing changes from before (near-black page, slightly lighter cards).

Regression: muted grey text, amber "due soon" and red "overdue" text are still easy to read on the grey page (§51); Pipeline columns, the Settings dialog and onboarding look as before apart from the page colour.

## 55. Organisation theme (US-SET-09, Phase 7)

1. As an Owner, open Settings › Branding. "App theme" shows Spine Blue (marked "Default"), Harbour Teal, Plum and Graphite, each with a colour swatch, and the note "Each person still chooses light or dark mode in their own Profile & Preferences."
2. Pick Harbour Teal and press Save: "Saved" shows and buttons, links, the active sidebar item and focus rings turn teal straight away.
3. Sign in as a Staff or Field member (another browser): their app is teal too. Switch them to dark mode: still teal (a lighter teal), with dark text on teal buttons.
4. Paid, due-soon, overdue and draft chips look exactly as before in both modes.
5. Press "Reset to Spine defaults", then Save: blue returns for everyone after a reload.
6. As Staff, open Settings: there's no way to change the theme (Settings is Owner-only).

Regression: dashboard charts, the Pipeline board and status chips keep their colours; the public quote page and PDFs are unaffected (US-SET-10 handles document colour).

## 56. Document colour and footer (US-SET-10, Phase 7)

1. Settings › Branding: "Document colour" shows #2954E5 with a blue swatch and "✓ Readable on white (6.0:1, passes AA)".
2. Type #8FB3FF: a red message says it's too light (2.0:1) and Save is disabled. Type #0D6E6E (or use the swatch picker): the check passes again.
3. Type a footer such as "Licence 4471 · Payment due within 21 days." The preview shows the bar, "INVOICE" and the total in teal and the footer under it. Switch to dark mode: the preview stays white.
4. Save, then download a draft invoice, a draft quote, a new receipt and a credit note: each has a teal bar, teal title and total, and the footer above the page number on every page. Send an invoice email: teal bar on top, footer at the bottom.
5. Open an invoice issued before the change and download its PDF: it is exactly as it was (old colour, no new footer).
6. Enter more than 300 characters in the footer: "Keep the footer under 300 characters." and Save is disabled.

Regression: PDFs without branding set still use Spine Blue and show no footer line; payment instructions and notes still print (§40); the theme tiles (§55) still work.

## 57. Pipeline stages (US-CRM-19, Phase 7)

1. As an Owner, open Settings › Pipeline stages: New, Qualified and Proposal (Open) then Won and Lost (with a padlock), each with its lead count, and the intro "The columns on your pipeline board…".
2. Rename Proposal to "Quote sent" and Save. On Pipeline the column is titled "Quote sent" and still has its leads.
3. "+ Add stage", name it "Site visit booked", drag it above "Quote sent" (or Tab to it and use the arrow buttons) and Save: the board shows it in that place, empty.
4. Keep adding stages: at 12, "+ Add stage" is disabled and the note reads "Up to 12 stages."
5. Won and Lost have no drag handle; rename Won to "Signed" and Save — the board, the lead forms and the dashboard's "Pipeline by stage" show "Signed", and open-lead counts on Contacts still leave it out.
6. Add and edit a lead from the board and from a contact's Leads list: the Stage picker lists your stages in order.

Regression: dragging a card between columns still moves the lead; the dashboard pipeline chart shows every stage in board order; demo data (Settings › Demo data) puts leads into your stages.

## 58. Deleting a pipeline stage (US-CRM-20, Phase 7)

1. Settings › Pipeline stages: add a stage and press its red ✕ — it disappears at once (it has no leads).
2. Press ✕ on a stage with leads (e.g. Proposal with 3): "Delete “Proposal”?" asks "Move 3 leads to:" and "Delete stage" stays disabled until you choose a stage.
3. Choose Qualified and press "Delete stage", then Save. On Pipeline, Proposal is gone and its leads are in Qualified.
4. Won and Lost show a padlock instead of ✕.
5. As Staff, try `PUT /org/lead-stages` (or open Settings): refused — only Owners change stages.

Regression: Cancel in the delete dialog keeps the stage and its leads; leaving the pane without saving changes nothing.

## 59. New item from the quote line (US-CAT-06, Phase 7)

1. New quote: type in a line's Item field. Matching catalogue items appear under "ITEMS" with price and unit; choosing one fills the name, price and tax.
2. Type a name that matches nothing (e.g. "Bathroom refit"): the list ends with "Use “Bathroom refit” as a one-off line" and an "Also save to catalogue" tick box.
3. Tick it and choose the one-off line: under the field, "Added to the catalogue when you save the quote — give it a price first." Enter a price; the note drops the second half. Save as draft: Catalogue lists "Bathroom refit" at that price (unit "each"), and the quote line is linked to it.
4. "Don't add it" under the field clears the mark; saving then leaves the catalogue unchanged.
5. As Staff without Catalogue rights: the one-off line still works but there's no "Also save to catalogue".
6. Keyboard: arrows move through the list, Enter chooses, Escape closes; Tab reaches the tick box.

Regression: saving a quote with only catalogue items creates nothing new; editing a draft keeps its lines; the tax picker on each line still works.

## 60. Duplicate a quote (US-QUO-24, Phase 7)

1. Open a sent quote and press "More ▾": "Duplicate as new draft", "Email again" and "View history" (bundles arrive with US-QUO-25).
2. "Duplicate as new draft" opens a new Draft with the same contact, lines, notes and terms, no number and a validity date in the future.
3. Change a catalogue item's price, then duplicate a quote that uses it: the copy keeps the original quote's price.
4. On the copy, "More ▾" → "View history": the first entry reads "Duplicated from QUO-<number> by <you>".
5. "Email again" on a sent quote: a toast says it's being emailed again and the email status shows sending, then sent. The customer's earlier link still opens.
6. As Staff without "create quotes", the menu has no "Duplicate as new draft".

Regression: Revise still creates the next version; the quote's History is still reachable (now from "More ▾").

## 61. Save quote lines as a bundle (US-QUO-25, Phase 7)

1. On a quote with item lines, "More ▾" → "Save lines as a bundle…": the dialog explains bundles, shows "Bundle name", a one-line summary of the lines and total, and "Description".
2. Press "Save bundle" with no name: "Give the bundle a name." Fill it in and save: a "Bundle saved" toast.
3. Catalogue › Bundles lists it with its lines and total. Filter by Active/Archived; search by name.
4. Edit the quote's lines afterwards: the bundle's lines stay as they were.
5. Row menu: Edit (name and description), Archive/Restore, Delete (with a confirmation). As Staff with "own" catalogue rights, you can change your own bundles but not someone else's.
6. Staff without catalogue rights don't see "Save lines as a bundle…".

Regression: Catalogue › Items works as before (filters, drawer, archive); the quote's other More ▾ actions still work.

## 62. Add a bundle while building (US-QUO-26, Phase 7)

1. Save a quote's lines as a bundle (§61). On a new quote, type part of its name in a line's Item field: "BUNDLES" comes first, with the bundle's total and "Adds <n> lines: …", then "ITEMS".
2. Choose the bundle: its lines replace that line, in order, with the bundle's prices and tax. Each line can be edited, moved or removed like any other.
3. Archive a catalogue item one of the bundle's lines came from, then add the bundle again: that line is still added (as a one-off line).
4. On a new invoice, the same picker offers the bundle.
5. On a new vendor bill, there are no bundles (items only, as before).
6. A bundle saved from a quote in another currency isn't offered.

Regression: picking a single catalogue item still fills one line; "Use … as a one-off line" (§59) still works; invoice totals match their lines.

## 63. Automatic reminders settings (US-INV-18, Phase 7)

1. As an Owner, Settings › Automatic reminders: "Send reminders automatically" is off; the schedule lists 3 days before, on the due date, 7 and 14 days after (the last three ticked) and "Every 14 days after that, up to 3 more times"; "Send at" is 9:00 AM (organisation time — the server's `TZ`).
2. Turn it on, untick every day and Save: "Pick at least one reminder." Tick one and Save: "Saved".
3. "Preview email" shows the reminder your most overdue invoice would get ("Reminder: invoice INV-… is N days overdue"), with the payment instructions if set; with nothing overdue, a sample.
4. As Staff, Settings isn't available and `PUT /org/settings/invoice_reminders` returns 403.

Regression: the manual "Send reminder" on an overdue invoice still sends, now with the subject "Reminder: invoice INV-… is N days overdue".

## 64. Scheduled reminders (US-INV-19, Phase 7)

1. Turn on Settings › Automatic reminders with "Send at" a few minutes from now (organisation time = the server's `TZ`). Make an issued invoice due 7 days ago with a balance, for a customer with an email.
2. Within 15 minutes of "Send at", the customer gets one email: "Reminder: invoice INV-… is 7 days overdue", showing the balance due, due date and payment instructions, with the PDF attached. The invoice history shows "Automatic reminder sent".
3. Wait for the next 15-minute run: no second email. Restart the API: still no second email today.
4. On another invoice due 7 days ago, click "Send reminder" by hand first. The run then sends nothing for it today.
5. On a customer's contact page, turn on "Pause automatic reminders" ("Reminders paused" toast). Their overdue invoices get no automatic reminders; "Send reminder" by hand still works. A vendor's page has no switch.
6. A paid, voided or fully credited invoice never gets a reminder.

Regression: the contact page header (name, badges, email, tax ID, Edit/Archive/Delete) looks and works as before in light and dark mode; manual "Send reminder" still sends; Settings › Automatic reminders (§63) saves and previews as before.

## 65. Recurring invoices: set up (US-INV-20, Phase 7)

1. As an Owner, Invoices › "Recurring invoices": the list (empty to begin with) and the note "Runs happen at 6:00 AM organisation time…".
2. "+ New recurring invoice": Name, Customer, Repeats (Weekly, Monthly, Every 3 months, Yearly), On (Monday–Sunday for weekly, otherwise "1st of the month" … "28th of the month" and "Last day of the month"), Starts, Ends (Never, On a date, After a number of invoices), Payment due, "When it runs" (issue and email is selected) and the lines.
3. Pick a start date last month and press "Save schedule": "Pick today or a later start date." Pick today and save: the row shows "Active", "Monthly · 1st", the next 1st as "Next invoice", the lines' total and "Issue and email". A schedule ending before its first invoice is refused.
4. As Staff, with "Manage recurring invoices" turned off on your Team (Teams page), Invoices has no "Recurring invoices" button and `GET /recurring-invoices` returns 403. Turned on, you can set one up. Field users never see it.

Regression: Invoices list toolbar (filters, "New invoice") looks and works as before in light and dark mode; the invoice line editor on New invoice works as before; the Teams page lists "Manage recurring invoices" under Manage Invoices.

## 66. Recurring invoices: automatic run (US-INV-21, Phase 7)

1. Set up a recurring invoice starting today, Weekly on today's weekday, "Issue the invoice and email it to the customer", for a customer with an email. After 6:00 AM organisation time (the server's `TZ`), within 15 minutes, an issued invoice appears for that customer (next number, due after the chosen payment terms, posted to the books) and the customer gets the invoice email. The schedule's "Next invoice" moves on a week.
2. Restart the API the same day: no second invoice.
3. Same with "Create a draft for me to review": a draft appears, and Owners get "Recurring invoice ready to review: <name>" in the bell (and by email) linking to it.
4. With Ends "After a number of invoices" = 1, after the first invoice the schedule shows "Finished" and "—" for the next invoice.
5. Stop the API over a run date and start it again later: one invoice for the missed date, then the next date is after today.

Regression: manual New invoice → issue → email still works; the Recurring invoices list (§65) looks the same in light and dark mode.

## 67. Recurring invoices: pause, edit, delete (US-INV-22, Phase 7)

1. On Invoices › Recurring invoices, each row shows name, customer, repeats, next invoice, amount, status and when it runs.
2. Row menu › Pause: the row shows "Paused" and "—" for the next invoice. Leave it over a run date: no invoice is created.
3. Row menu › Resume: "Active" again, with the next date after today. Nothing is created for dates missed while paused.
4. Row menu › Edit (or click the name): change the price under "Edit lines" and save. The amount updates. Invoices the schedule already created keep their old price.
5. Row menu › Delete: "Delete this schedule? Invoices it already created are kept." Confirm: the row goes; its invoices are still on Invoices.

Regression: "+ New recurring invoice" (§65) still opens an empty dialog after editing one; the list looks right in light and dark mode.

## 68. Bulk payment reminders (US-INV-23, Phase 7)

1. On Invoices, tick an unpaid issued invoice, a paid one and a void one. A dark bar shows "3 selected · <amount> outstanding", "Send reminders (1)" and "Clear".
2. Press "Send reminders (1)": the toast says "1 reminder sent" and lists the paid and void invoices with why they were skipped. The customer gets one reminder email.
3. Tick the reminded invoice again: "Send reminders (0)" is disabled (already reminded today). "Clear" hides the bar.
4. As Staff without "Send a payment reminder" on your Team, ticking rows shows the bar without "Send reminders".

Regression: the Invoices table (sorting, search, column picker, row menu) and the one-click "Send reminder" work as before in light and dark mode.

## 69. Bulk PDF download (US-INV-24, Phase 7)

1. On Invoices, tick two issued invoices and a draft, then press "Download PDFs" on the bar. A file "invoices-<today>.zip" downloads. It holds one PDF per issued invoice, named by number and identical to each invoice's own "Download PDF". The toast says "Downloaded 2 PDFs" and that the draft was skipped.
2. Tick only a draft and press "Download PDFs": "None of these invoices has a PDF yet — drafts are skipped. Issue them first."
3. More than 100 selected: "Select 100 or fewer invoices." (100 is the limit for every bulk action.)

Regression: the bulk bar's "Send reminders" and "Clear" (§68) still work; single-invoice "Download PDF" serves the same file as before.

## 70. Customer statements (US-PAY-14, Phase 7)

1. Open a customer with invoices. "Send statement" opens "Send a statement" with Period (Last 30 days, Last 90 days, This year, Custom; Custom shows From and To date), Show (Open invoices only, All activity), the summary (Opening balance (<date>), Invoiced, Paid and credited, Balance due), To (their email) and Message ("Hi <name>, …").
2. Change the period: the summary updates. Check the figures against Reports › Receivables for the customer.
3. "Download PDF": a PDF downloads and nothing is emailed.
4. "Send statement": the customer gets the email with the PDF and your message; the toast reads "Statement sent to <email>"; the Timeline shows "Statement sent to <email> for <period>. Balance due <amount>."
5. A customer with no invoices: "Send statement" is disabled with "No invoices for this customer yet."
6. As Staff without "View receivables" on your Team, the button isn't shown and the statement routes return 403. Field users never see it. Vendors have no button.
7. With SMTP not configured, sending says email isn't set up; downloading still works.

Regression: the contact page header (badges, Edit/Archive/Delete, Pause automatic reminders) and Timeline look and work as before in light and dark mode.

## 71. Statement PDF (US-PAY-15, Phase 7)

1. From "Send a statement" (§70) with "All activity", "Download PDF": the header shows your business (logo or initials), "STATEMENT", the period, "Statement for <customer>" with their address and "Balance due".
2. The table has Date, Reference, Type, Charges, Payments, Balance, starting with "Opening balance", then each invoice, payment, credit note and void with a running balance that ends at the balance due.
3. The aging strip shows Current, 1–30, 31–60, 61–90 and 90+ days. The amounts add up to what the customer owes on open invoices.
4. With Settings › Payment instructions set, "How to pay" appears at the bottom; clear them and it disappears.
5. With "Open invoices only", paid invoices and their payments are gone and there's no opening balance row.
6. The PDF stays light, whatever the app theme.

Regression: invoice, quote and receipt PDFs look as before.

## 72. Bulk expense approval (US-PUR-21, Phase 7)

1. As an Owner on Expenses, tick two submitted expenses. A dark bar shows "2 selected · <total>", "Approve (2)", "Reject…" and "Clear". Approved and rejected expenses can't be ticked.
2. "Approve (2)": the toast reads "2 expenses approved". Each has its own number and posts its own journal entry (check Reports › General ledger), and each submitter is notified, the same as approving one at a time.
3. Tick two more and press "Reject…": one dialog asks for a comment. Leave it blank: "Add a comment — it's sent with every rejected expense." Enter one and confirm: "2 expenses rejected", and both show your comment.
4. As Staff with approval rights, your own submitted expense's tick box is disabled and the page says "Your own expenses can't be selected for approval — someone else approves them." As an Owner you can tick your own.
5. As Staff without "Approve expenses", the list has no tick boxes.

Regression: the Expenses list (filters, "My expenses only", row menu, detail drawer approve/reject) works as before in light and dark mode.

## 73. Construction template cost categories (US-ONB-13, Phase 7)

1. In a new organisation, at onboarding's Template step (or Settings › Industry template), "Construction / Contracting" adds "Sets up cost categories for materials, labour, subcontractors, plant hire, fuel and freight, and site overheads."
2. Choose it and save. Settings › Chart of accounts lists 5300 Plant & Equipment Hire, 5400 Fuel & Freight and 5500 Site Overheads & Permits. Expenses › Categories lists Materials (5000), Subcontractors (5100), Site labour (5200), Plant & equipment hire (5300), Fuel & freight (5400) and Site overheads & permits (5500), under a note saying what the template set up.
3. Save Construction again: nothing new appears.
4. In another organisation, first rename account 6300 to code 5300 "Vehicle Lease" and add a category "Materials", then choose Construction. Nothing is duplicated, and the note says "Kept your existing account 5300 · Vehicle Lease. Kept your existing category “Materials”".
5. Switch to General Services: the categories and accounts stay. Rename or archive one: it behaves like any other category.
6. Load demo data in a Construction organisation: demo expenses use Fuel & freight, Site overheads & permits and Plant & equipment hire.

Regression: onboarding's Template step and Settings › Industry template save General Services and Generic as before; Expenses › Categories (add, rename, remap, archive) works in light and dark mode.

## 74. Job cost budget (US-JOB-24, Phase 7)

1. Open a job, press "Edit job": under "Budget and progress", "Cost budget" says "What you expect this job to cost. Leave blank if you don't budget it."
2. Enter -5 and save: "Enter a budget of zero or more." and nothing saves. Enter 32,000.00 and save; reopen: 32000.00. The job's History shows the change with your name.
3. Clear the field and save: the job has no budget.
4. Apply an accepted variation order: the contract value rises, the budget stays the same.
5. As a Field user, the job API returns no `costBudgetAmount`, and the job history shows no budget changes.

Regression: Edit job still saves name, site address, status, dates, notes and retention % in light and dark mode.

## 75. Job budget used (US-JOB-25, Phase 7)

1. Give a job with recorded cost a budget about twice its cost. On "Costing", the Budget card shows Cost budget, Spent and Remaining (green) and "50% of budget used", with "Warning at 80% · over at 100%".
2. Lower the budget so cost is about 85% of it: the bar turns amber and the label reads "Nearing budget — 85% used" with a warning icon.
3. Lower it below cost: "Over budget by <amount>" in red with an icon; Remaining shows a negative amount; the bar is full.
4. Clear the budget: "No budget set" and "Set a budget", which opens Edit job. Members without edit rights on the job don't see the button.
5. Jobs list: "Budget used" shows "50%", "Nearing · 85%" or "Over · 1xx%" (with an icon), and "—" for jobs without a budget. Staff without "View job profitability" don't see the column.

Regression: the Costing tab's contract value, revenue, cost and margin match before; the Jobs list (search, sort, filters) works in light and dark mode; Progress bars elsewhere (onboarding checklist) look the same.

## 76. Job cost by category (US-JOB-26, Phase 7)

1. On a job with bills or approved expenses tagged to it, open "Costing". "Cost by category" lists each expense account ("5000 · Cost of Materials") with its amount and share, largest first, and "Total cost" equal to the Cost figure above. The donut shows the same split with the total in the middle.
2. With more than six accounts carrying cost, the donut shows the five largest and "Other"; the list shows them all.
3. As an Owner (or Staff with "View ledger"), click a row: the account drill-down opens with only this job's lines. Without "View ledger" the rows aren't links.
4. A job with no costs: "No costs yet — bills and approved expenses tagged to this job show up here."
5. Check the donut and list in dark mode; the colours come from the theme.

Regression: Reports › account drill-down (from the trial balance, P&L, balance sheet) still lists every line for the account; the dashboard's receivables donut still shows its legend.

## 77. Job billed to date (US-JOB-27, Phase 7)

1. On a job with a contract value, issue two progress invoices for it. "Costing" › Billing shows "Contract value", "Billed to date" (their totals, tax included, before retention) with "N% of contract", "Left to bill", and the Billed bar.
2. Issue a credit note against one of them: "Billed to date" drops by the credit note's total.
3. An advance invoice or a retention release on the job doesn't change "Billed to date".
4. Bill past the contract value: "Left to bill" reads "Billed over contract by <amount>" in red.
5. Jobs list: "Billed" shows each job's percentage (job-profitability viewers only).

Regression: credit notes still post and appear on the invoice; a job's revenue on "Costing" drops by a credit note issued against one of its invoices.

## 78. Percent complete vs billing (US-JOB-28, Phase 7)

1. Edit job › "Percent complete" ("Your estimate of how much of the work is done."). Enter 120 or -5: "Enter a percentage from 0 to 100." Enter a value and save.
2. On a job billed 40%: at 55% complete, "Costing" › Billing shows "Work complete 55%" and "Billing is 15 points behind the work — check for a milestone to invoice." At 30%: "Billing is 10 points ahead of the work." At 45% or blank: no line.
3. Mark the job Completed: percent complete stays as it was.
4. As a Field user, the job shows percent complete through the API, but no costing.

Regression: Edit job's other fields save as before; the Billing card's figures (§77) are unchanged.

## 79. Progress claim numbers (US-JOB-29, Phase 7)

1. On a job, complete a milestone and raise its invoice: the draft's job card says "Claim number is given when the invoice is issued."
2. Issue it: the card reads "Progress claim N of this job", one more than the job's last claim. The invoice keeps its usual INV number.
3. Download the PDF: "Progress claim N · JOB-00x" sits under the invoice number. Email it: the email lists "Claim: Progress claim N · JOB-00x".
4. Void that invoice and issue the next progress invoice: the voided one keeps "Progress claim N (void)"; the new one is N + 1.
5. Advance, standard and retention-release invoices on the job get no claim number.

Regression: invoice numbers stay gapless across claims; the invoice PDF and email for standard invoices look as before.

## 80. Filter bills and expenses by job (US-PUR-22, Phase 7)

1. On Vendor Bills, the job filter offers "All jobs" and each job as "<number> · <name>". Choose one: only its bills show, the counters count only those, and the URL gains `?jobId=`. Reload: the filter stays.
2. The note "Showing vendor bills on <job>." links to "See expenses on this job" (Expenses, same filter) and "Open the job's costing".
3. Filter by a job with nothing tagged: "No vendor bills on this job" / "No expenses on this job" with "Clear filter".
4. On a job's Costing tab, "View bills and expenses" opens Vendor Bills filtered to that job.
5. As a Field user on Expenses, the job filter lists only your assigned jobs and shows only your own expenses on them.

Regression: Vendor Bills' status and vendor filters and Expenses' status filter and "My expenses only" work as before, alone and with the job filter, in light and dark mode.

## 81. Labour as headcount × day rate (US-PUR-23, Phase 7)

1. Expenses › "Submit expense": "Enter as" shows "Amount" (selected) and "Headcount × day rate". Choose the second: the Amount field goes; Trade / Workers / Day rate rows appear with "+ Add trade"; Job is required ("Labour is always for a job."); with a 5200 Direct Labour category (e.g. the Construction template's "Site labour"), it's preselected with "Preselected: posts to 5200 Direct Labour."
2. Enter 4 Mason at 950.00, 3 Carpenter at 900.00 and 8 Helper at 650.00: each row shows its total and "Total for the day · 15 workers" reads 11,700.00.
3. Leave a trade blank or workers at 0: "Every row needs a trade, at least one worker and a day rate." Leave the job empty: "Labour is always for a job — choose one."
4. Save with a job. Open the expense: the drawer lists "4 Mason × $950.00 = $3,800.00" and the others; the amount is 11,700.00. Approve it: it posts to the category's account, tagged to the job (Costing tab cost by category shows 5200).
5. Start another labour expense and type "Mason": it's suggested and its last day rate fills in (you can change it).
6. Nothing asks for worker names, attendance or hours.

Regression: "Amount" entry, editing a submitted expense, receipts and approval work as before in light and dark mode.

## 82. Job profitability chart (US-RPT-15, Phase 7)

1. Reports › Job Profitability: "Contract, billed and cost by job" shows three bars per active or on-hold job (Contract value, Billed to date, Cost) with a legend naming each, largest contract first. With more than 10 jobs: "Showing 10 of N jobs — the table lists them all."
2. A job with a budget has a dashed "Cost budget" marker over its cost bar. Hover or focus a job: the tooltip lists contract value, billed to date and %, cost, budget and % used, and margin.
3. The table adds "Billed to date", "Billed %" and "Budget used" after "Contract value"; the figures match each job's Costing tab.
4. Switch the filter to Completed, then All: the chart and table follow; "Export CSV" downloads the same jobs with "Billed to date", "Billed %" and "Budget used %" as plain numbers.
5. With a screen reader the chart is announced as "Contract, billed and cost by job" and points to the table.
6. Check the chart in dark mode.

Regression: the dashboard's "Job profitability" widget still lists every job; the other report tabs are unchanged.

## 83. Needs your attention (US-DASH-12, Phase 7)

1. Open the dashboard as an Owner: "Good morning|afternoon|evening, <first name>" and "<weekday> <day> <month> · <business> · <n> things need you today".
2. "Needs your attention" lists one row per kind, in order: overdue invoices, expenses waiting for approval, quotes needing discount approval, milestones ready to invoice, quotes expiring this week, vendor bills due within 3 days, jobs over budget. Each row has a title with its count, a line naming the first record (amount and age), and a button. The chip by the heading equals the number of rows.
3. Pay the overdue invoice (or approve the expense) elsewhere, then come back: that row is gone.
4. As Staff without "Approve expenses", there's no expenses row; with it, your own submitted expenses never count. The note reads "Only things you can act on".
5. In a new organisation: "You're all caught up" with "Overdue invoices, approvals, expiring quotes and bills due will show up here when they need you." and the header says "nothing needs you right now".

Regression: the KPI row, setup checklist (Owners) and widgets below still show; "Edit layout" still hides and shows widgets; light and dark mode.

## 84. Attention actions (US-DASH-13, Phase 7)

1. With exactly one overdue invoice, press "Send reminder" on its row: the toast reads "Reminder sent for INV-…" and the customer gets the reminder.
2. With two or more overdue invoices, "Send reminder" opens Invoices filtered to Overdue with them all ticked and the bulk bar showing.
3. "Review" (expenses) opens Expenses filtered to Submitted. "Approve" and "Follow up" open the quote. "Raise invoice" opens the milestone's job. "Pay bill" opens "New vendor payment" for that vendor. "Review" on a job over budget opens its Costing tab.
4. As Staff without "Send a payment reminder", the overdue row's button reads "Open".

Regression: Invoices, Expenses and Vendor Payments opened normally (no query string) look and filter as before.

## 85. Dashboard key figures (US-DASH-14, Phase 7)

1. As an Owner, the KPI row shows Cash position, Profit this month, Receivables and Overdue. Each has its amount, a small 8-week line and "▲/▼ n% vs last month" (or "No data last month" in a new organisation).
2. The change is green when good (cash or profit up, receivables or overdue down) and red when not, always with the arrow and sign. Check it in dark mode.
3. Receivables shows "Current … · overdue …"; Overdue shows "n invoice(s)".
4. Click each card: Balance Sheet, P&L, Receivables, and Receivables with "Showing overdue invoices only." ("Show all" clears it).
5. As a Field user there's no KPI row.

Regression: Reports and Receivables opened from the sidebar look as before; the dashboard below the KPI row is unchanged.

## 86. Money in and out (US-DASH-15, Phase 7)

1. As an Owner, the dashboard shows "Money in and out" where "Revenue trend" used to be, with 12M selected.
2. Above the chart: "In · 12 months", "Out · 12 months" and "Net". Net is green with "+" when positive and red with "−" when negative. Check both themes.
3. The legend reads "Money in (payments received)" and "Money out (bills, expenses)". Hover a month: the tooltip shows its in, out and net.
4. Choose 3M and 6M: the bars and totals change, and the labels say "3 months" / "6 months".
5. Record a payment: this month's "in" goes up by that amount. Pay a vendor bill: "out" goes up. Moving money between Cash and Bank changes neither.
6. In a new organisation with no payments or bills, the card reads "Money in and out appears after your first payment or bill."
7. As Staff without "View dashboard summary" the card is absent; as a Field user it's absent.

Regression: Edit layout can still hide, show and reorder the card, and a saved layout that mentioned "Revenue trend" still loads. Reports' own charts are unchanged.

## 87. Today (US-DASH-16, Phase 7)

1. On the dashboard, "Today" sits beside "Needs your attention". If the "Get started" checklist is showing, it sits beside "Money in and out" instead.
2. Add a follow-up due later today on a contact, assigned to you: it shows "Today", its notes, and "Follow-up · <contact>". Make one overdue from yesterday: it shows "Due <weekday>".
3. A meeting later today shows its time and "Meeting · <location>". Your next meeting after today shows as "Tomorrow 9:00" or "Wed 10:00".
4. A pending milestone due within 7 days on a job you can see shows "Due <day>" and "Milestone · <job>". One due in 10 days doesn't show.
5. Entries are in time order. Clicking one opens the meeting, job or contact.
6. "Open calendar" opens Meetings in day view on today.
7. With nothing scheduled, the card reads "Nothing scheduled today."
8. As a Field user, Today shows only milestones on your assigned jobs and only your own meetings.

Regression: Settings › Upcoming meetings ("Only my meetings" / "Every org meeting") still decides which meetings Staff see in Today. Meetings opened from the sidebar still open in week view. Edit layout still hides, shows and reorders the remaining widgets.

## 88. Staff dashboard (US-DASH-17, Phase 7)

1. As Owner, untick "View dashboard summary" for the Staff user's Team. Log in as that Staff user.
2. "Needs your attention" says "Only things you can act on". Give the user an overdue follow-up: "1 follow-up is overdue" appears, and "Open" opens that contact.
3. A sent quote the user created that expires within 7 days reads "Your quote QUO-… expires <day>". The Owner's expiring quotes aren't listed.
4. Submit an expense as this user (with "Approve expenses" granted): it never appears in their own list.
5. The KPI row shows Receivables, Overdue, Open pipeline and Quotes won this month ("$… accepted"). Untick "View receivables": only Open pipeline and Quotes won remain. "Quotes won this month" opens Quotes filtered to Accepted.
6. Give the Team "View dashboard summary" back: the row shows Cash position, Profit this month, Receivables and Overdue, plus "Money in and out".
7. The sidebar has no Team section.

Regression: the Owner's attention list and KPI row are unchanged, with no follow-ups row. Quotes opened from the sidebar show every status.

## 89. Field dashboard (US-DASH-18, Phase 7)

1. As Owner, assign the Field user to an active job with a site address and a pending milestone due within 7 days. Reject one of the Field user's expenses with a reason.
2. Log in as the Field user. The header reads "1 job on your list · 2 things need you".
3. "Needs your attention" shows "Milestone due <day>" with "Mark complete", and "Your expense was rejected" with the category, amount, the reason in quotes, and the reviewer's name, plus "Fix and resubmit". Each button opens the job or the expense.
4. "My jobs" lists the job with its number, customer, site address and "Next: <milestone> · due <day>". "Directions" opens a map route in a new tab.
5. "My expenses" shows up to 5 expenses with date, amount and an Approved, Rejected or Submitted chip. "Submit expense" opens the form.
6. "Recent activity on my jobs" shows only milestone and job events on assigned jobs. No quotes or payments appear.
7. Nowhere on the page is a contract value, invoice, payment or report figure. Check both themes.

Regression: Owner and Staff dashboards don't show the Field cards. Expenses opened from the sidebar has the "Mine" toggle off and no drawer open.

## 90. Activity feed actors (US-DASH-19, Phase 7)

1. Record a payment: the dashboard's "Recent activity" shows your avatar and "<You> recorded a payment of **$…** from <customer>", with the amount in bold.
2. Open a sent quote's public link three times within a few minutes: one row reads "<customer> viewed QUO-… · 3 times" with the latest time.
3. Accept a quote from its public link: "<customer> accepted QUO-… · **$…**".
4. As Field, complete a milestone: the Owner's feed shows "<Field user> completed <milestone> on <job>".
5. Submit an expense: "<you> submitted an expense · <category> · **$…**". Clicking it opens the expense on Expenses. Clicking a payment row opens it on Payments.
6. "View all" opens Activity with the last 100 events. As Field, it shows only events on your jobs, with no money.
7. Check dark mode: avatars and bold text stay readable.

Regression: Payments and Expenses opened from the sidebar have no drawer open.

## 91. Retention held and jobs in progress (US-DASH-20, Phase 7)

1. In an organisation on the Construction template, with no saved dashboard layout, "Retention held" and "Jobs in progress" show below "Money in and out".
2. Issue a progress invoice on a job with retention: "Retention held" shows the total, "on 1 job · in Retention Receivable until released", and the job with its amount. "Release" opens the job with the Release retention dialog. Release it: the card reads "No retention held." on one line.
3. "Jobs in progress" lists active jobs with name, number, contract value, a billed bar and "<n>% billed", and Budget used ("No budget", a percentage, "Nearing · …", or "Over · …" in red with an icon). "Job profitability" opens Reports on that tab.
4. Switch to a General services organisation (or a new one) with no saved layout: both cards are hidden. Edit layout shows them dimmed, and "Show widget" brings them back.
5. As Staff without "View receivables" there's no Retention card and no empty slot. Without "View job profitability" there's no Jobs in progress card.
6. At 1440px and at tablet width, no card leaves a gap in its row or overflows its column. Pipeline by stage shows values after the bars. Check dark mode.

Regression: Pipeline by stage, Receivables aging and Job profitability look as before.

## 92. Daily digest email (US-NTF-13, Phase 7)

Set up SMTP (or the dev mail catcher). Set "Send at" a few minutes ahead in Profile › Notifications (US-NTF-14), or wait for 7:00 AM on a weekday.

1. As an Owner with an overdue invoice and expenses waiting: within 15 minutes of "Send at", one email arrives. The subject reads "Your Spine day: <n> things need you · <Day d Mon>".
2. It shows "Good morning, <name>", "Here's what needs you at <business> today.", a table of attention counts (with totals for overdue invoices, expenses and bills), "Today" (meetings later today, milestones due within 7 days), "Yesterday" (money received, quotes accepted, quotes viewed) and "Open dashboard", which opens the dashboard.
3. The footer reads "You get this daily digest because you're an owner of <business>. Turn it off or change the time in Profile › Notifications."
4. No second email arrives the same day, even after restarting the API.
5. In an organisation with nothing open and nothing yesterday, no email arrives.
6. As Field (digest turned on): the email shows counts only, with no amounts anywhere and no "Yesterday". The footer says "a member of".
7. On a Saturday, with "Monday to Friday", nothing arrives.
8. Without SMTP configured, nothing is sent and the API keeps running (one warning in the log).

Regression: other emails (quote, invoice, reminders, notifications) look the same. The dashboard's attention rows are unchanged.

## 93. Digest preferences (US-NTF-14, Phase 7)

1. Open Profile & Preferences: tabs Profile, Password, Appearance and Notifications. Each of the first three holds what the page used to show (avatar and name/email; change password; theme).
2. Notifications shows Browser notifications, Daily digest and Meeting reminders.
3. As an Owner who never changed it: the switch is on, Send at is 7:00 AM, Days is Monday to Friday. As Staff or Field: the switch is off.
4. Change Send at to 6:30 AM: "Daily digest on: …" confirms. Tomorrow's digest arrives at about 6:30 AM organisation time (within 15 minutes).
5. Choose "Every day": a digest arrives on Saturday too.
6. Turn the switch off: "Daily digest turned off." No digest arrives the next morning. Send at and Days are greyed out while it's off.
7. Reload `/profile?tab=notifications`: it opens on the Notifications tab with your choices kept.
8. Check keyboard (tab through switch and selects), dark mode, and phone width.

Regression: changing theme, name, email, avatar and password still works from their tabs. The meeting reminder choice still saves.

## Known gaps — don't file these as bugs

- Owners' "View all" on the dashboard feed opens the full Activity page, not the audit log; it moves to the audit log with US-SET-11 (Phase 7 step 7).
- Session-less signed file links (`/files/<id>?exp=&sig=`) work but no
  screen creates one yet; they arrive with the stories that need them.
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
- The tax collected/paid report (§10.14, `GET /org/tax/summary`) now
  lives on Reports › "Tax Summary" (US-RPT-14), not Settings → Tax — it has its own
  working per-rate breakdown UI that Reports deliberately doesn't
  duplicate (see CHANGELOG's own note on this). No CSV export on that
  specific view, unlike every report on the new Reports page. Tax
  **paid** on that report has a real source (Input Tax Receivable
  postings from recorded vendor bills, §11.4) but will still read 0 for
  any org with no recorded vendor bills yet — expected, not a bug.
- The job **variation order** line editor (`variation-order-line-editor.tsx`)
  still uses the pre-FEAT-08 flat tax-percentage input, not the new
  named rate/group picker §10 exercises for Quotes/Invoices/Catalogue —
  it still computes correctly, just without a tax picker UI. Not yet
  retrofitted.
- A variation order's acceptance does NOT automatically fold its value
  into the job's contract value — applying it (§5.11) is a deliberate,
  separate manual step. A proactive in-app + email notification now
  fires when a variation order is accepted (§5.11), but the "Apply to
  job" click itself is still required and intentionally not automated.
- Mobile (`apps/mobile`) doesn't exist yet — S-07.2/S-07.3's mobile-native
  receipt capture and offline expense-submission queueing are Phase 5
  scope; the web-based expense submission built in §11 covers S-07.2's
  web half only, per that story's own "web submission this stage" split.
- No standalone `/credit-notes` list page — credit notes are only
  reachable from the invoice they correct.
- Multi-org (one Owner account across several orgs) is explicitly out of
  scope for v1 — don't test for it.
- Meeting invites (§6.1) have only two visibility tiers, `private` and
  `org` — there is no "visible to a specific Team" tier. Explicitly out
  of scope for v1 per the PRD, not a missing feature.
- Recurring meetings apply the invite list to the whole series — there's
  no way to invite someone to just one occurrence of a repeating
  meeting. Also explicit v1 scope, not a bug.
- The "starting soon" reminder (§12 step 6) polls every 5 minutes, so a
  reminder can fire up to ~5 minutes later than its exact configured
  lead time — this is a deliberate trade-off (see CHANGELOG), not
  imprecise timing to file as a bug.
