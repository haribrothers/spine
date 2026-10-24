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
   Since US-ONB-17, deletion also removes the demo's journal entries and
   number series (section 185).

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
10. Open **Settings › Emails › Email log** (the quotes page's email
    queue was retired by US-SET-27, section 212) — confirm the quote's
    email shows as queued, sent or failed.
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
4. Open that payment's detail drawer. The footer shows History, one main
   action (**Apply credit** when there's credit, else **Email receipt**),
   **More** and **Close**; everything else is under **More**:
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

1. Go to **Purchases → Payables**. Confirm the cards Total owed, Overdue,
   Due in 7 days and 90+ days, and the age bar naming every bucket (the
   layout is section 224's since D-230).
2. Confirm "By bill" lists every outstanding **recorded** vendor bill,
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
3. *(`apps/design-system-native` was removed in D-240; every `@spine/ui-native` component is documented in `apps/showcase-native`, below.)*
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

1. As Owner, Reports › "Trial Balance": choose "As of" (it reloads by itself). Each
   account with a balance shows on its Debit or Credit side; the "Total"
   row's debit and credit match; the status reads "Balanced — total
   debits equal total credits."
2. Untick "Hide accounts with no balance": zero-balance accounts appear.
3. Click an account: its journal entries open.
4. "Export CSV" downloads Code, Account, Debit, Credit and a Total row.
5. As Staff, the tab shows "Trial Balance is only available to owners."

## 30. Tax Summary on Reports (US-RPT-14, Phase 6)

1. As Owner, Reports › "Tax Summary": choose "From"/"To" (it reloads by itself). Cards:
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

1. In light mode, open Dashboard, Invoices, Jobs, Pipeline and Reports. The page behind the content is a soft warm grey; cards, tables, the sidebar, filter inputs and outlined buttons ("Edit layout", "Export", "Columns") are white with a thin border.
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
4. Click each card: Balance Sheet, P&L, Receivables, and Receivables with "Show" set to "Overdue only" (choose "All outstanding" to clear it).
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

## 94. Organisation audit log (US-SET-11, Phase 7)

1. As an Owner, Team › Audit log opens with "Every change to records in <Business>, newest first. Only owners can see this page."
2. The table shows When, Who, Action, Record and Details for the last month, newest first.
3. Set Person, Record type and Action: only matching entries remain. Narrow From/To to a day with no changes: "No changes match these filters. Widen the dates or clear a filter."
4. Click a record (a quote, an invoice, a milestone): it opens that record (a milestone opens its job).
5. With more than 50 entries: "1–50 of <total> entries". Next shows 51–100, and Previous goes back.
6. On Team › Users, promote a Staff user, demote them, deactivate and reactivate them. Each appears as "User · <name>" with "Staff → Owner", "Owner → Staff", "Active → Deactivated" and "Deactivated → Active". Transfer primary ownership: "Primary owner transferred" with both names.
7. As Staff, open `/team/audit-log`: the no-access page. There's no "Audit log" in their sidebar.
8. On the dashboard, an Owner's Recent activity "View all" opens the audit log.
9. Check dark mode and phone width (the table scrolls sideways).

Regression: contact and invoice History sections still show their entries. Team › Users actions still work.

## 95. Audit log CSV (US-SET-12, Phase 7)

1. On Team › Audit log, set Record type to Invoice and a date range, then press "Export CSV". `audit-log-<today>.csv` downloads.
2. Open it in a spreadsheet: the header reads timestamp, actor_name, actor_email, action, record_type, record_id, record, changes. Every row is an Invoice inside the date range. Timestamps are ISO 8601 (UTC), and `changes` holds JSON.
3. Clear the filters and export again: all entries are there, newest first. A record name with a comma or quote stays in one cell.
4. In an organisation with a large log (e.g. after demo data and bulk actions), the export starts downloading at once and finishes.
5. As Staff, `/org/audit-log.csv` returns 403.

Regression: the audit log table and its filters are unchanged.

## 96. Data export (US-SET-15, Phase 7)

1. As an Owner, open Settings › Data export. "Records as CSV" and "Files" are ticked, and "Records as JSON" isn't.
2. Press "Prepare export": the button shows "Preparing…" and the pane says large exports are prepared in the background. Within a minute, "Last export: <date> by <you> · <size> · Download again (link expires in 7 days)" appears.
3. With SMTP set up, an email "Your <Business> data export is ready" arrives. Its button opens Spine with Settings on Data export. The email has no attachment and no file link.
4. "Download again" downloads `spine-export-<date>.zip`. Unzipped, it holds one CSV per table with a header row, `members.csv`, `files/` with your receipts, photos and PDFs, and `README.txt` listing each file with a description and row count.
5. Tick only JSON (untick CSV and Files) and prepare again: one `.json` per table and no `files/`. Tick both formats: `csv/` and `json/` folders.
6. Search the export for a password or session token: none. Settings holding secrets aren't in `settings.csv`.
7. As Staff or Field there's no Settings, and `POST /org/exports` returns 403.

Regression: other Settings panes open as before. Settings › Demo data still works.

## 97. Data export privacy (US-SET-16, Phase 7)

1. Prepare an export as an Owner and copy the "Download again" link.
2. Open the link in a private window (signed out): "Not found" (404). Signed in as Staff or Field: 404. As an Owner: the ZIP downloads.
3. Team › Audit log, Record type "Data export": "Prepared" and "Downloaded" entries with who did each.
4. The "export is ready" email has a button to Settings › Data export and no attachment or file link.
5. To check expiry, set the export's `expires_at` in the past (or wait 7 days). The link now answers 404, Settings › Data export no longer offers "Download again", and the ZIP is gone from the files volume.
6. A file id taken from the export (`data_exports.file_id`) answers 404 at `/files/<id>`, even for an Owner.

Regression: other file links (photos, receipts, PDFs) still open for the people allowed to see them.

## 98. Global search (US-OPS-22, Phase 7)

1. On any page, press ⌘K (Mac) or Ctrl+K: the search palette opens with the cursor in the field. The magnifier button in the sidebar footer opens it too.
2. Type one character: the hint shows. Type "harbor": CONTACTS, QUOTES, JOBS, INVOICES (and VENDOR BILLS, EXPENSES when they match), at most 5 each. Each result has a second line and a status on the right.
3. Type an invoice number ("INV-0010", or "inv 10"): that invoice is the first result. Do the same with "QUO-4".
4. Type nonsense: "No results for “…”".
5. The footer reads "↑↓ to move · Enter to open · Searches contacts, quotes, invoices, jobs, bills and expenses".
6. Click a result: the record opens and the palette closes.
7. As Field: searching an invoice number or a customer finds nothing from Invoices, Quotes, Contacts or Bills. Only jobs you're on and your own expenses appear.
8. Check dark mode and a phone-width window (the palette fits with a margin).

Regression: ⌘K inside the palette doesn't open a second one. The sidebar footer (user menu, help, notifications) still fits when the sidebar is collapsed.

## 99. Search by keyboard and screen reader (US-OPS-23, Phase 7)

1. With VoiceOver (macOS) or NVDA (Windows): press ⌘K / Ctrl+K. It announces a "Search" dialog and a combo box.
2. Type "harbor": the first result is highlighted. Press Down and Up: each highlighted result is read out (title, second line, status).
3. Press Enter: that record opens and the palette closes.
4. Tab to a button (e.g. "Edit layout"), press ⌘K, then Escape: the palette closes and focus is back on that button.
5. Turn on "Reduce motion" in the operating system: the palette appears without scaling in. Turn it off: a short scale-in.
6. Without a mouse, everything in steps 1–4 works with the keyboard alone, and the focus ring is visible on the search button in the sidebar.

Regression: other dialogs (Settings, confirmations) still return focus as before. Comboboxes elsewhere (contact pickers) still filter and select as before.

## 100. Dark mode on Phase 7 screens (US-OPS-26, Phase 7)

1. Switch Profile › Appearance to Dark. The sidebar shows the light "spine" wordmark.
2. Dashboard: cards are a shade lighter than the page. Status colours are the dark ones (green paid, amber due soon, coral overdue, blue primary). In "Money in and out" the money-out bars are dark grey and the money-in bars blue. Sparklines and the aging bar read clearly.
3. Press ⌘K: the page behind is clearly darkened, and the palette's panel stands off it. Do the same with a Settings dialog, a confirmation dialog, a drawer (an invoice's payment drawer) and a dropdown menu.
4. Check Invoices with rows ticked, Settings › Automatic reminders and Data export, Team › Audit log, Activity, Profile › Notifications, Recurring invoices, a job's Costing tab and Reports › Job profitability. No text is hard to read, and table headers and the palette footer are legible.
5. Light mode: the "due soon" chips and amber avatars read clearly on their tints.
6. Send an invoice email and download a PDF while in dark mode: both are light.
7. With a screen reader, the setup checklist's ticks and the "All contacts" filters announce their names.

Regression: light mode looks as before apart from the slightly darker amber. Shadows under menus and dialogs look the same in light mode.

## 101. Bank, cash and card accounts (US-BANK-01, Phase 8)

1. As an Owner, the sidebar has a "Money" section with "Banking". Open it: the breadcrumb reads "Money › Banking" and the list shows "Bank Account" (marked "Default") and "Cash in Hand", each with "Balance in Spine". An organisation that already had payments shows their real balance on Bank Account.
2. "Add account": the dialog asks for "Type" ("Bank account", "Cash", "Credit card"), "Name" (placeholder "e.g. HDFC Current"), "Bank name", "Last 4 digits" and "Use as default for new payments". The hint reads "Ledger account 1011 · Asset." Choose "Cash": the bank fields disappear. Choose "Credit card": the hint changes to 2300 and "Liability".
3. Add "HDFC Current" with a bank name and last 4 digits: the toast reads "Account added", the row shows "HDFC Bank · ••0193" and $0.00. Settings › Chart of accounts lists 1011 HDFC Current under assets.
4. Add a credit card: its row shows "$0.00 owed" and the "Owed on cards" card counts it.
5. Add another account called "hdfc current": the dialog shows "You already have an account called hdfc current. Choose another name." and nothing is added.
6. Add an account with "Use as default for new payments" ticked: it gets the "Default" badge and Bank Account loses it.
7. Row menu › "Edit": rename the account. The ledger account is renamed too, and Team › Audit log shows "Money account" entries for the add and the change.
8. As Staff, Banking isn't in the sidebar and /banking shows the no-access page unless their Team has "View bank balances and registers". With it, the list shows balances but no "Add account" or row menu. As a Field user, Banking isn't in the sidebar and /banking shows the no-access page.

Regression: the dashboard's "Cash position" and "Money in and out" now include every bank and cash account (cards excluded); with only the two starting accounts they show the same figures as before. Recording a payment, vendor payment or expense still posts to Bank Account.

## 102. Account register (US-BANK-02, Phase 8)

1. Record a customer payment and a vendor payment, and approve an expense. Open Banking: Bank Account shows the new balance, "Never reconciled" and "3 entries". The cards at the top show "Not yet reconciled" with the total and "Last reconciled" reads "Never".
2. Click "Bank Account": the breadcrumb reads "Money › Banking › Bank Account" and the line under the title reads "Bank account · ledger 1010". The cards show "Balance in Spine" (as of today), "Money in" and "Money out" for the range, and "Unreconciled".
3. The table lists newest first: Date, What ("Payment RCP-…", "Vendor payment VP-…", "Expense EXP-…"), Contact, Reference, Money in, Money out, Balance and "Not reconciled". Each balance is the running balance after that row. Below the table: "Opening balance on <from>".
4. Click a row's "What": the payment, vendor payment or expense opens in its own page.
5. Move "From" to after the first entry: that entry leaves the list, the opening balance includes it and the running balances don't change. Choose "Unreconciled only": the same rows and balances stay (nothing is reconciled yet).
6. Compare the balance on the last day of a month with Reports › Balance Sheet for that date: Bank Account matches.
7. Open a credit card account: the columns read "Paid off" and "Spent", the balance column "Owed", and the first card "Owed on this card".
8. Open Cash in Hand with nothing on it: "Nothing has gone in or out of this account yet."
9. As Staff without "View bank balances and registers", /banking/<id> shows the no-access page and `GET /money-accounts/<id>/register` returns 403.

Regression: Vendor Payments opens a payment's drawer from `/vendor-payments?id=<id>`, as Payments and Expenses already did. The Banking list still adds accounts and moves the default.

## 103. Choose the account on payments and expenses (US-BANK-03, Phase 8)

1. Add a second bank account and a credit card in Banking.
2. Payments › "Record payment": below Amount, "Paid into" lists every active account (cash and card marked) and starts on the default, with "Your organisation's default account. Change it if the money went into another account." Pick the second bank account and record the payment.
3. Open "Record payment" again: "Paid into" starts on the account you just used and reads "Last used by you. Change it if the money went into another account." Log in as someone else: they still start on the default.
4. Open the recorded payment: "Paid into" shows its account next to "Method", read-only. The account's register in Banking lists the payment and its balance went up.
5. Do the same from an invoice's "Record payment", from Vendor Payments › "Record payment" ("Paid from") and from a "Pay bill" link on the dashboard.
6. Submit an expense as an Owner or Staff member: the form has "Paid from". Choose the credit card. Approve it: the card's register shows it as "Spent" and Banking shows the card's balance as owed.
7. As a Field user, submit an expense: there's no "Paid from". As an approver, open it: "Paid from" shows the default account. Approve it and, in the approve dialog, change "Paid from" to Cash in Hand: the expense posts to Cash in Hand.
8. Archive an account in the database (or after US-BANK-06, from Banking) and try to record a payment to it through the API: 400 "Choose one of your active accounts.".

Regression: bulk-approving expenses still works and posts each to the account it carries. Payments, vendor payments and expenses recorded before this change show the account they actually posted to.

## 104. Transfers between accounts (US-BANK-04, Phase 8)

1. As an Owner, Banking › "Transfer" (it's disabled with fewer than two accounts): the dialog "Transfer between accounts" asks for "From" (starts on the default), "To", "Amount", "Date" and "Reference", and the button reads "Move money".
2. Choose the same account in both: "Choose two different accounts." and nothing is saved.
3. Move $3,000.00 from Bank Account to a second account with reference "TRF-0004". The line above the buttons reads "Posts Dr <To> / Cr <From>. Both registers show it." The toast reads "Moved $3,000.00 from Bank Account to <To>". Both balances change.
4. Open each register: one reads "Transfer to <To>" (money out), the other "Transfer from Bank Account" (money in), both with reference TRF-0004.
5. Pay off a credit card with a transfer from the bank: the card's register shows "Paid off" and what's owed drops.
6. In the register, the transfer's row menu › "Delete transfer" › confirm: the toast reads "Transfer deleted", the row shows "Deleted", a "Transfer deleted" row dated today reverses it, and both balances are back. Team › Audit log shows "Transfer" created and deleted.
7. Close a fiscal period, then try a transfer dated inside it: it's refused with "… falls within a closed fiscal period".
8. As Staff without "Record transfers and other money in or out", there's no "Transfer" button and no row menu, and `POST /bank-transfers` returns 403. As a Field user, 403.

Regression: the Banking list, register filters and opening balance still read correctly with transfers in them; the dashboard's "Money in and out" counts neither side of a transfer between two bank or cash accounts.

## 105. Money in and money out (US-BANK-05, Phase 8)

1. Banking › "Money in": the dialog asks for "Into account", "Date", "Category", "Amount", "Contact" and "Description" (no "Tax"). The shortcuts read "Owner's capital", "Loan received" and "Interest received". Choose "Owner's capital": the category shows "3000 · Owner's Capital". Record $10,000.00: the toast reads "Money in recorded" and Bank Account goes up.
2. "Money out": the shortcuts read "Owner's drawings", "Loan repayment" and "Bank charges" (6900 Other Expenses). Open the category list and search "Receivable", "Payable", "Tax" or "Advances": nothing is offered and the list reads "No matching account. Use a payment, bill or tax payment for this.". Bank, cash and card accounts aren't offered either (use Transfer).
3. Bank charges of $11.80 with GST 18%: the amount reads "Includes $1.80 tax, which goes to Input Tax Receivable." After saving, Reports › Balance Sheet shows Input Tax Receivable up by $1.80 and Other Expenses up by $10.00.
4. The register reads "Money in — Owner's Capital" and "Money out — Other Expenses", with the description as the reference and the contact if one was chosen.
5. Row menu › "Delete entry" › confirm: the toast reads "Entry deleted", the row shows "Deleted", a "Money out deleted — …" row dated today reverses it, and the balance goes back. Team › Audit log shows "Money in or out" created and deleted.
6. A new organisation's chart of accounts has 4800 Interest Received; an existing organisation gains it after the upgrade unless code 4800 was already used.
7. As Staff without "Record transfers and other money in or out", there's no "Money in" / "Money out" and `POST /bank-transactions` returns 403; Field 403.

Regression: Transfer still works and deleting a transfer still reads "Delete transfer". The Chart of accounts settings pane lists 4800 under income.

## 106. Archive a money account (US-BANK-06, Phase 8)

1. Move $1,000.00 into a second account, then its row menu › "Archive": "Move the $1,000.00 out of this account before archiving it." and nothing changes.
2. Bank Account's row menu › "Archive" (the default): "Choose another default account first.".
3. Transfer the money back, then "Archive": the toast reads "Account archived" and the account leaves the list. The totals at the top don't count it.
4. The filter "Active accounts" › "Archived accounts": the account is listed. Its register still opens with its history.
5. Record payment, Record vendor payment, the expense form, Transfer and Money in/out no longer offer it. Recording a payment to it through the API returns "Choose one of your active accounts.".
6. Archived accounts › row menu › "Restore": "Account restored", and it's back in the list and the pickers. If you'd since added another account with the same name, restoring says "You already have an account called <name>. Choose another name.".
7. Team › Audit log shows the account archived and restored. As Staff, there's no row menu and the routes return 403.

Regression: adding, editing and moving the default still work; "Archived accounts" with none reads "No archived accounts".

## 107. Banking rights for a Team (US-BANK-12, Phase 8)

1. As an Owner, Team › Teams › General Staff › Privileges › expand "Banking": "View bank balances and registers", "Record transfers and other money in or out" and "Reconcile accounts", all off. Each switch is announced by its name with a screen reader.
2. Turn on "Reconcile accounts": "View bank balances and registers" turns on too, and the note reads "“View bank balances and registers” turned on too. Reconciling needs to see the account."
3. Turn "View bank balances and registers" off: "Reconcile accounts" turns off too, with "“Reconcile accounts” turned off too. Reconciling needs to see the account."
4. As a General Staff member with banking off: there's no "Money" section in the sidebar and /banking shows "You don't have access to Banking". Record payment still offers "Paid into" with account names.
5. Turn on "View bank balances and registers": Banking appears with balances, but no Transfer, Money in or Money out. Turn on "Record transfers and other money in or out": those buttons appear and work.
6. As a Field user, Banking isn't in the sidebar, /banking shows the no-access page, and every banking API route returns 403.

Regression: the rest of the privilege matrix still saves one switch at a time and by group; "Everything in <group>" switches still set the whole group.

## 108. Attachments on records (US-OPS-33, Phase 8)

1. Vendor Bills › "New bill": below the lines there's "Attachments" with a drop zone reading "Drop files here or add files · PDF, JPEG, PNG, WebP or HEIC, up to 10 MB each, 10 per record". Drop a PDF: it's listed with "added when you save". Save: the bill opens with the PDF attached, "added by <you> · <date>".
2. On the bill, "Add files" › choose a photo: it's listed with a thumbnail, name, size, who added it and when. PDFs show a "PDF" badge. Click the name: it opens in the browser. "Download" saves it.
3. Add a .txt file: "This file type isn't supported. Upload a photo or a PDF.". Add a file over 10 MB: "This file is over 10 MB. Upload a smaller copy, or split the PDF.".
4. Add files until there are 10, then one more: "A record can hold up to 10 files. Remove one first." and "Add files" is disabled.
5. The same section appears on a quote, an invoice, a credit note (drawer), a payment (drawer), a vendor payment (drawer), an expense (drawer) and a contact (Attachments tab). In Banking, a money in/out row's menu › "Attachments" opens a drawer with the section.
6. Vendor Bills and Expenses lists show a paperclip with the count next to records with files; a screen reader reads "2 attachments".
7. The record's History reads "<you> attached <file name>".
8. As Staff who can read but not edit bills, the section shows the files but no "Add files" or drop zone; with no files the section is hidden.
9. Light and dark mode: the drop zone, badges and any error message are readable (axe passes).

Regression: the expense receipt (separate from attachments) still uploads and opens; contact logos and avatars still upload. Error messages in alerts everywhere now use full-contrast text.

## 109. Who can open attachments (US-OPS-34, Phase 8)

1. As an Owner, attach a PDF to an invoice and a photo to a vendor bill. Click each name: the PDF and the photo open in the browser. "Download" saves them with their original names.
2. As Staff (any Team), open the same invoice and bill: their files open. Attach a file to a money in/out entry in Banking: Staff without "View bank balances and registers" can't open it (copying its link gives "File not found"); with it, they can.
3. As a Field user, submit an expense and attach a PDF to it: it's listed in the expense drawer and opens. Paste the invoice attachment's link: "File not found" (404). `GET /attachments?entityType=invoice&entityId=<id>` returns 404 too.
4. Log in to another organisation and paste any of these links: 404.
5. Settings › Data export with "Files" ticked: the ZIP has `attachments/<record type>/<record id>/<file id>-<name>` for every attached file, `attachments.csv` listing them, and the new `money_accounts`, `bank_transfers` and `bank_transactions` tables. README.txt counts files/ and attachments/ separately.

Regression: receipts, job photos, logos, avatars and issued PDFs still open for the same people as before (US-OPS-20). The storage-integrity warning names an attached file as "Attachment on a vendor bill: “…”".

## 110. Remove an attachment (US-OPS-35, Phase 8)

1. On a draft bill, a file's "Remove" › the dialog reads "Remove <name>?" and "The file is deleted from Spine. …" with no reason field. "Remove attachment": the file leaves the list, its link gives 404, and History reads "<you> removed attachment <name>".
2. On a recorded bill, as Staff (even with bill rights): no "Remove". As an Owner: "Remove" › "This bill is recorded, so only an owner can remove its files, with a reason. The bill's history records it." with "Reason". "Remove attachment" stays disabled until a reason is typed. After removing, History reads "<you> removed attachment <name> — <reason>".
3. The same wording names the record on an issued invoice ("This invoice is issued, …"), a sent quote, a payment, a vendor payment, a reviewed expense and a bank entry.
4. On the "New bill" form, "Remove" on a file you just dropped takes it off the list straight away (it isn't attached).
5. As a Field user, remove a file from your submitted expense; once it's approved, "Remove" is gone.
6. A file that is also an expense's receipt stays readable as the receipt after being removed as an attachment.

Regression: adding files still works after a removal, and the 10-file limit counts only files still attached.

## 111. Credit note excess as customer credit (US-PAY-16, Phase 8)

1. Fully pay an invoice, then "Issue credit note" (now offered on paid invoices) for $300.00: the dialog reads "$0.00 reduces what's owed on INV-…; $300.00 becomes credit for <customer>.". Issue it.
2. On a part-paid invoice with $200.00 left, credit $500.00: "$200.00 reduces what's owed …; $300.00 becomes credit …". After issuing, the invoice's balance is $0.00, and Reports › Balance Sheet shows Customer Advances up by $300.00.
3. Try to credit more than the invoice's total (counting earlier credit notes): "You can credit up to <amount> on this invoice.".
4. The credit note's drawer shows "Credit for the customer $300.00".
5. Open another unpaid invoice for the same customer: "Apply credit" is there. The dialog lists "Credit note CRN-…" and any unallocated payments, each with what's available, prefilled oldest first up to what's owed. "Apply credit": the toast reads "Credit applied", the balance drops, and the credit note's credit falls.
6. The customer's statement ("All activity") shows the credit note as a credit line for its full amount; applying the credit adds no line, and the balance due is what's owed less credit held (it can be negative).
7. As Staff without "Apply credit", "Apply credit" isn't shown and `POST /credit-notes/:id/apply-credit` returns 403.

Regression: a credit note within the balance still reduces only what's owed; Payments' own "Apply credit" still works; statements for customers without credit read as before.

## 112. Refund a customer (US-PAY-17, Phase 8)

1. Record a $500.00 payment from a customer with an email address, allocated to nothing. Open it: "Refund" is under "More" in the drawer's footer.
2. "Refund": "Refund <customer>" asks for "Refund from" (this payment, "$500.00 of credit"), "Amount" (prefilled $500.00), "Date", "Paid from", "Method", "Reference" and "Send refund confirmation". Refund $200.00 with the confirmation ticked.
3. The toast reads "Refunded $200.00 to <customer>" and "The customer has been emailed a confirmation."; the email reads "We've refunded $200.00". The payment's unallocated credit is now $300.00, and the drawer lists the refund under "Refunds".
4. Try to refund $300.01: "You can refund up to $300.00 from this payment.". "Apply credit" also offers only $300.00.
5. The chosen account's register shows "Refund" as money out. Reports › Balance Sheet: Customer Advances down by $200.00.
6. "Delete refund": the refund shows "Deleted", the credit is back to $500.00, and the register gets a "Refund deleted" row dated today.
7. From a credit note with credit left (US-PAY-16), "Refund" works the same and its "Credit for the customer" drops.
8. On the contact page, "Refund" appears when the customer holds credit and lets you choose which credit to refund.
9. The customer's statement shows refunds as charge lines ("Refund") and deleted ones as "Refund removed".
10. Without email set up, the refund still saves and the toast says "Email isn't set up, so no confirmation was sent.".
11. Deleting a payment that has refunds: "Delete this payment's refunds first.".

Regression: recording, applying and deleting payments without refunds behave as before.

## 113. Refund right for a Team (US-PAY-18, Phase 8)

1. Team › Teams › General Staff › Privileges › "Manage Payments": "Refund customers" is listed and off.
2. As a General Staff member, open a payment with unallocated credit: "Apply credit" is there but "More" has no "Refund"; a contact holding credit shows no "Refund" either. `POST /customer-refunds` returns 403.
3. Turn "Refund customers" on: "Refund" appears and works. A Field user still gets 403.

Regression: the other "Manage Payments" switches and the group switch still save.

## 114. Vendor credits (US-PUR-24, Phase 8)

1. Purchases › "Vendor Credits" (new in the sidebar) is empty: "No vendor credits yet". The cards read Total credits, Draft, Open ("<amount> to use") and Used.
2. "New vendor credit": "Vendor", "Vendor's credit note number" ("Spine gives it a VCR number when recorded"), "Against bill", "Currency", "Date", "Job", lines like a bill's, "Notes", attachments and "Total credit".
3. Choose a vendor, then "Against bill": only their recorded bills are offered; choosing one copies its lines (edit them down) and its job. "Save as draft".
4. The draft's page shows "Draft vendor credit", the vendor, "their <number>" and the bill link, with "Edit", "Delete draft" and "Record". "Record": it becomes "VCR-0001", "Open", and "Open — <amount> to use"; Edit and Delete go.
5. Reports › Balance Sheet: Accounts Payable down by the total; the line accounts and Input Tax down by their parts. With a job, Jobs › Costing shows the job's cost lower.
6. The list shows Number ("— (unrecorded draft)" for drafts), Vendor's number, Vendor, Status (Draft, Open, Used, Void), Date, Amount and Balance; filter by status and vendor.
7. As Staff without "Record vendor credits", a draft shows no "Record"; Field users can't open Vendor Credits.

Regression: Vendor Bills, recording bills and the bill line editor are unchanged. Settings › Numbering lists "Vendor Credit" (VCR).

## 115. Apply a vendor credit to bills (US-PUR-25, Phase 8)

1. With an open $400.00 credit for a vendor with two open bills ($300.00 older, $500.00 newer): Vendor Payments › "Record payment", choose the vendor: "<Vendor> has $400.00 of credit. Apply it first?" links to the credit.
2. On the credit, "Apply to bills": the bills are listed oldest first, prefilled $300.00 then $100.00. Change the first to $301.00: "You can apply up to $300.00 to this bill." Put it back and "Apply credit".
3. The credit shows "Used" and "Applied to bills" with both bills. The ledger has no new entry (P24a). The older bill's page lists "Credits applied: VCR-0001 · their CN-4471 $300.00", a "Credits applied" total line and balance $0.00; the newer one owes $400.00.
4. Payables, the dashboard's "due soon" items and search treat credited bills as paid down. Paying more than the newer bill's $400.00 is refused.
5. "Remove" an application on the credit: the credit is "Open" again and the bill's balance comes back.
6. Voiding a bill with credits applied: "Remove the vendor credits applied to this bill before voiding it.".
7. As Staff without "Apply and refund vendor credits", "Apply to bills" isn't shown and the API returns 403.

Regression: bills without credits read and pay exactly as before.

## 116. Refund from a vendor (US-PUR-26, Phase 8)

1. On an open $400.00 vendor credit, "Record refund": "Amount" starts at $400.00, with "Date", "Paid into" (last used or default), "Method" and "Reference". Enter $400.01: "This credit has $400.00 left to refund.".
2. Record $150.00 into Bank Account with reference EFT-88: "Refunds from the vendor" lists it, and the credit reads "Open — $250.00 to use". Bank Account's register shows "Vendor refund" money in; Balance Sheet: Accounts Payable up by $150.00.
3. Refund the rest: the credit is "Used".
4. "Delete refund": it shows "Deleted", the balance comes back, the credit is "Open" again, and the register gets a "Vendor refund deleted" row dated today.
5. As Staff without "Apply and refund vendor credits", "Record refund" and "Delete refund" aren't shown; the API returns 403.

Regression: applying credits to bills still works alongside refunds; the two together can't exceed the credit.

## 117. Void a vendor credit (US-PUR-27, Phase 8)

1. On a recorded credit with a refund or a bill application, "Void" › enter a reason › "Void credit": "Remove its <n> applications and refunds first." and nothing changes. ("Void credit" stays disabled until a reason is typed.)
2. Remove the applications and delete the refunds, then void with "Entered twice": the credit reads "Void — Entered twice", Apply and Refund disappear, the list shows "Void" with balance $0.00, and Balance Sheet: Accounts Payable back up by the total (P24 reversed, dated today).
3. As Staff without "Void vendor credits", "Void" isn't shown and the API returns 403.

Regression: drafts are still deleted, not voided.

## 118. Vendor credit rights for a Team (US-PUR-28, Phase 8)

1. Team › Teams › General Staff › Privileges › "Vendor credits": seven switches, all on. They are "Create/edit own vendor credits", "Edit others' vendor credits", "Delete own draft vendor credits", "Delete others' draft vendor credits", "Record vendor credits", "Apply and refund vendor credits" and "Void vendor credits".
2. Turn "Record vendor credits" off. As a General Staff member, open a draft vendor credit: "Edit" is there and "Record" isn't. `POST /vendor-credits/:id/record` returns 403.
3. Turn off "Apply and refund vendor credits": "Apply to bills", "Record refund" and the Remove/Delete refund buttons go. Turn off "Void vendor credits": "Void" goes.
4. As a Field user, every `/vendor-credits` route and `DELETE /vendor-refunds/:id` return 403, and Vendor Credits isn't in the sidebar.

Regression: the "Manage Vendor Bills" switches still save, and the group switch turns all seven on and off.

## 119. Tax payments and refunds (US-TAX-08, Phase 8)

1. Set up a GST 18% rate. Issue a $100.00 + GST invoice ($18.00 output tax) and record $59.00 of Money out with GST ($9.00 input tax).
2. Reports › Tax Summary › "Record tax payment". The top row shows Tax collected $18.00, Input tax available $9.00 and Net payable $9.00. "Input tax used" is 9.00 with "You have $9.00 to use." and "Amount paid" is 9.00. The preview reads "Posts Dr Output Tax Payable $18.00 / Cr Input Tax Receivable $9.00 / Cr <account> $9.00."
3. Change "Period" to last quarter or last month: the figures reload. Change "Input tax used" to 9.01 and "Record payment": "You have $9.00 of input tax to use. Lower the amount."
4. Set it back to 9.00, add a reference and "Record payment". The toast reads "Tax payment recorded". "Tax payments and refunds" lists "Tax payment for <period> · <account> · <reference>" with "$9.00 + $9.00 input tax". The Tax Summary cards still show $18.00 collected and $9.00 paid.
5. Banking › the account's register shows "Tax payment" for −$9.00. The Balance Sheet shows Output Tax Payable and Input Tax Receivable both down by the amounts in step 4.
6. "Delete" on the payment: it's struck through and marked "Deleted". The register shows "Tax payment deleted", and the input tax is available again.
7. "Record tax payment" › "Record a tax refund instead": "Amount" (defaults to the input tax available), "Paid into", "Date" and "Reference". "Record refund": the toast reads "Tax refund recorded" and the list shows "Tax refund". A refund above the input tax available is refused with the same message.
8. As Staff, with any grants, the Tax Summary shows no access and `/tax-payments` and `/tax-refunds` return 403. Field gets 403 too.

Regression: the Tax Summary's cards, per-rate table and CSV export are unchanged by tax payments. Money in/out still refuses 1200 and 2100 as categories ("Use a payment, bill or tax payment for this.").

## 120. Payment drawer actions fit (US-PAY-17 fix, Phase 8)

1. Open a payment with unallocated credit as an Owner. The drawer is wider than before. Its footer has, in one row: History, "Apply credit", "More" and "Close".
2. "More" lists "Download PDF", "Email receipt", "Refund" and "Delete payment" (in red). Each works as before: the PDF opens, the receipt is emailed, the refund dialog opens, and the delete confirmation opens.
3. Open a fully allocated payment: the main button is "Email receipt", and "More" has "Download PDF" only (no Refund or Delete).
4. At phone width (390px), the footer stays inside the drawer and wraps if needed. Use the keyboard: Tab to "More", Enter opens it, the arrow keys move through the items, and Escape closes it.
5. In dark mode, the menu and the red "Delete payment" are readable.

6. The credit note drawer has the same layout:
   - With credit left: "Refund", with "Download PDF" under "More".
   - With nothing to refund: "Download PDF" (or "Preview PDF" for a draft) as the button, and no "More".
7. The vendor payment drawer has "Delete payment" under "More" when the payment can be deleted, and no "More" otherwise.
8. A submitted expense shows "Reject", "Approve", "More" (with "Delete expense" in red) and "Close". At phone width, "Close" wraps onto a second line inside the drawer. On your own expense, the note "Someone else needs to approve your own expense." still shows.

Regression: the PDF links, refund, delete, approve, reject and bill-to-customer flows work as before.

## 121. Edit a submitted expense (US-PUR-10)

1. As Sarah (Staff), submit an expense and open it. The drawer shows "Edit" and "More" (with "Delete expense"). Click "Edit": the "Edit expense" dialog opens with the expense filled in, under "Only a submitted expense can be edited — an approved expense has already posted to the ledger."
2. Change the amount and description, then "Save expense". The toast reads "Expense updated", the drawer shows the new figures, and the status is still "Submitted".
3. On Expenses, the row menu (⋯) for a submitted expense offers "View", "Edit" and "Delete". Approved and rejected rows offer "View" only.
4. As an Owner, open a colleague's submitted expense: "Reject" and "Approve" show, and "Edit" is under "More".
5. Open an approved or rejected expense: there's no "Edit". `PUT /expenses/:id` on it returns 400 with the message above.
6. As Sarah with "Edit others' expenses" off, a colleague's submitted expense has no "Edit", and `PUT` returns 403.
7. As Marcus (Field), "Edit" works on your own submitted expense. On anyone else's, it's refused.
8. With a screen reader, the form's "Amount" and "Tax amount" fields are announced by name.

Regression: submitting a new expense still opens a blank "Submit an expense" form, including straight after editing one. Approving, rejecting, deleting and labour entries work as before.

## 122. Escape with a toast showing

1. Open an expense and click "Edit" (under "More" for an Owner). Save the change. The "Expense updated" toast shows, and focus is on the drawer's "More" (or "Edit") button, not lost.
2. While the toast is still showing, press Escape once: the toast and the drawer both close.
3. Do the same with a payment: email a receipt, then press Escape while "Receipt sent" shows. The drawer closes with one press.
4. Press F8 to move focus to a toast, then press Escape: only the toast closes.
5. With no dialog open (e.g. after deleting an expense from the list), Escape closes the toast and nothing else happens.

Regression: toasts still close on their own, swipe away on touch, and are announced by screen readers. Escape inside a dialog opened over a drawer (e.g. "Apply credit") closes only that dialog.

## 123. Import a bank statement (US-BANK-07, Phase 8)

1. As an Owner, Banking › Bank Account › "Import statement". The dialog reads "Import statement — Bank Account" and asks for a CSV.
2. Choose a CSV with headers "Txn date, Narration, Ref no., Withdrawal, Deposit, Balance". The file name, row count and size show. "Separate money in and money out columns" is chosen, with Date = Txn date, Description = Narration, Reference = Ref no., Money out = Withdrawal, Money in = Deposit and Balance = Balance. "First rows" shows up to ten rows.
3. Include a row with the date 31/09/2026 and one with the amount "abc". "Import <n> lines": "Imported <n−2> lines · skipped 0 already imported · 2 rows couldn't be read", and each bad row is listed with its row number and reason. "Done": the toast repeats the summary.
4. Import a second file that overlaps the first: the mapping is already filled in, and the overlapping lines are counted as "skipped … already imported".
5. Switch to "One amount column (money in positive)" for a file with a single signed Amount column. Withdrawals written as -58.20, (58.20) or 58.20 DR all import as money out.
6. Choose a PDF: "Export the statement from your bank as CSV, then import it here." Choose a CSV with more than 5,000 rows, or over 2 MB: "Split the statement into smaller files (up to 5,000 lines)."
7. As Staff without "Reconcile accounts", there's no "Import statement", and the import routes return 403. Field users get 403. An archived account has no "Import statement".
8. Team › Audit log shows "imported a statement into Bank Account".

Regression: the register's balances, filters and row menus are unchanged. Contact import still works (it has its own CSV parser).

## 124. Match statement lines (US-BANK-08, Phase 8)

1. Record a payment, a few money-out entries and a capital injection dated before the statement. Import a statement whose lines match them (§123).
2. Bank Account › "Reconcile". The breadcrumb reads "Money › Banking › Bank Account › Reconcile" and the title "Reconcile Bank Account". Enter the end date and the statement's closing balance, then "Start reconciling".
3. The cards show the closing balance, "Cleared in Spine" ("opening <x> + 0 matched") and "Difference" in red. The note says the opening balance is Spine's balance before the first statement line.
4. A line with one Spine entry of the same amount within 3 days reads "Suggested match", with "Match" and "Not this one". "Match": it reads "Matched" and the entry leaves the right-hand list. "Not this one" on another line: the suggestion goes and "Exclude" shows.
5. Click an unmatched line's description to select it, then tick entries on the right. If they don't add up: "Selected entries add up to <x>; the line is <y>." and "Match" stays disabled. Tick until they add up ("2 entries add up to the line."), then "Match".
6. "Exclude" on a line: a dialog asks for a note. "Exclude line": it reads "Excluded — <note>" and counts as matched.
7. As lines match, "Cleared in Spine" and "Difference" update. When the difference is $0.00 the footer reads "Spine agrees with the statement".
8. Leave the page and come back: the matches and exclusions are still there. "Unmatch" and "Include" undo them.
9. Change the end date to an earlier day: matches on lines or entries after it are dropped.
10. Delete a money-out entry, then reconcile to today: neither it nor its reversal is offered.
11. As Staff without "Reconcile accounts", there's no "Reconcile" button, /banking/<id>/reconcile shows the no-access page, and the routes return 403. Field gets 403.

Regression: the register, statement import and money in/out are unchanged.

## 125. Create from a statement line (US-BANK-09, Phase 8)

1. On the reconcile page (§124), an unmatched line with no suggestion shows "Create" and "Exclude". "Create" on a money-in line: the drawer "Create from statement line" shows "<date> · <description> · +<amount>. Saving matches the line to the new entry." and "Record it as" with "Customer payment", "Transfer from another account" and "Other money in".
2. "Customer payment" › "Continue": "Record a payment" opens with the amount and date fixed (greyed) and "Paid into" showing this account. Choose the customer and "Record payment". The page reads "Recorded and matched to <line>." and the line is "Matched".
3. "Create" on a money-out line offers "Vendor payment", "Expense", "Transfer to another account", "Other money out" and "Tax payment" (the last two for an Owner).
4. "Expense": Amount, Date, Category, Job, "Paid from" (this account) and Description, all in the drawer. "Save and match": the expense is recorded and approved, appears under Expenses as approved, and the line is matched.
5. "Other money out" › "Continue": the Money out form opens with the account, date and amount fixed. Choose "Bank charges" and record it: the line is matched.
6. "Transfer to another account": the Transfer form opens with "From" fixed to this account. Choose "To" and "Move money": matched. "Tax payment": the tax payment form opens with the amount fixed and no refund switch.
7. Cancel any form: the drawer comes back, and nothing is recorded.
8. As Staff without "Create/edit own payments", "Customer payment" isn't offered. Without "Record transfers and other money in or out", the transfer and other-money options aren't offered. Staff never see "Expense" or "Tax payment". With nothing allowed: "You can't record any of these entries. Ask an owner, or exclude the line."
9. In a browser set to an Indian or Australian time zone, record a customer payment and a vendor payment: the saved date is the date picked (it used to be the day before).

Regression: Payments, Vendor Payments, Banking's Transfer and Money in/out, and Reports › Tax Summary › "Record tax payment" work as before when opened from their own pages.

## 126. Finish a reconciliation (US-BANK-10, Phase 8)

1. On the reconcile page with a difference, "Finish reconciliation" is disabled and the footer reads "Difference <amount> — match or create entries until it's zero."
2. Match until the difference is $0.00: the footer reads "Spine agrees with the statement · <n> lines matched." and "Finish reconciliation" is enabled. Click it: "<Account> is reconciled to <date>. Its entries show the Reconciled tick in the register."
3. The register: matched entries, entries before the first statement line, and any deleted-and-reversed pairs up to the end date read "Reconciled". Later entries read "Not reconciled". The balance is unchanged.
4. Banking: the account shows the end date under "Last reconciled", and "Last reconciled" at the top shows it. The unreconciled count drops.
5. Team › Audit log: "<you> finished Reconciliation", with the account and closing balance.
6. Try to delete a reconciled payment (Payments › drawer › More › Delete payment): "This entry is part of a finished reconciliation of <account> to <date>. Undo that reconciliation first." The same goes for a vendor payment, a transfer or money in/out entry (the register has no Delete on reconciled rows), a refund and a tax payment.
7. Start the next reconciliation with an end date on or before the last one: "Choose a date after <date>, when this account was last reconciled."
8. In a reconciliation still in progress, match an entry, then delete its document: the deletion works and the statement line is unmatched again.
9. As Staff without "Reconcile accounts", `POST /bank-reconciliations/:id/finish` returns 403.

Regression: balances, the Balance Sheet and the dashboard's cash figures are the same before and after finishing. Deleting unreconciled documents works as before.

## 127. Review or undo a reconciliation (US-BANK-11, Phase 8)

1. Reconcile an account twice (two month-ends, §124–126). Bank Account › "Reconciliations": the breadcrumb reads "Money › Banking › Bank Account › Reconciliations", and the description reads "Every finished reconciliation of Bank Account. Only the latest can be undone."
2. The cards: "Reconciled to <latest date>" with its closing balance, "Reconciliations 2 · since <first date>", and "Entries matched" with the total. The table lists both, newest first, with closing balance, entries matched, who finished it and when, and "Latest" or "Finished".
3. The older row reads "Undo the later reconciliations first." and has no Undo. `POST /bank-reconciliations/<older id>/undo` returns 400 with the same message.
4. "Undo" on the latest: "Undo this reconciliation?", "Statement to <date> · <n> entries. Its entries go back to unreconciled; nothing is deleted. Its statement lines go back to unmatched." and "Only the most recent reconciliation of an account can be undone." Click "Undo reconciliation": the toast reads "Reconciliation undone", and the older one becomes "Latest".
5. The register: that reconciliation's entries read "Not reconciled" again. Banking shows the older date under "Last reconciled". The audit log reads "<you> undid Reconciliation".
6. Their documents can now be deleted. Reconcile to the same date again: its statement lines are offered unmatched.
7. With no reconciliations: "No reconciliations yet". As Staff without "Reconcile accounts", the page shows no access and the routes return 403.

Regression: finishing and matching (§124–126) work as before.

## 128. Opening account balances (US-RPT-16, Phase 8)

1. As an Owner, Settings › "Opening balances": "Not started" and "Bring in opening balances". Click it: the dialog closes and "Opening balances" opens (breadcrumb "Settings › Opening balances"), with "Account balances".
2. "Cutover date" is the start of your financial year (Settings › Financial year). The card reads "balances as of <the day before>".
3. Every account is listed by type. Accounts Receivable and Retention Receivable read "From opening invoices · $0.00", Accounts Payable "From opening bills · $0.00", and Customer Advances "From opening credit · $0.00". There are no inputs on those rows, and Opening Balance Adjustments isn't listed.
4. Enter a few balances that don't balance. Debits, Credits and "Opening Balance Adjustments <difference>" update as you type, and the warning reads "… your old books didn't balance, or a figure is missing. The difference sits in Opening Balance Adjustments until you fix it." Typing a credit on an account with a debit clears the debit.
5. "Save balances": "Saved. The Balance Sheet on <day before> shows these balances." Reports › Balance Sheet as of that day shows them, with Opening Balance Adjustments under equity.
6. Change a figure and save again: the Balance Sheet shows the new figures (the old entry was reversed).
7. Record any document dated after the cutover date but before a new one you then pick: saving says "<n> documents are dated before the cutover date. Pick a date on or before <earliest>, or move those documents."
8. Settings › Opening balances now reads "Draft — not locked" with the cutover date. Staff can't open /opening-balances (no access), and the API returns 403.

Regression: Settings' other panes work as before. Settings › Chart of accounts lists 3900 Opening Balance Adjustments (a system account). Money in/out and manual journals can't use it.

## 129. Opening customer invoices and credit (US-RPT-17, Phase 8)

1. Opening balances › "Customer invoices": the cards and "No opening invoices yet." "Add invoice": Customer, Invoice number, Invoice date, Due date, Amount due, Retention held ("Optional — held back on a job until the job is done.") and Job.
2. Add one dated before the cutover date: it's listed. Add one dated on or after it: "An opening invoice is dated before the cutover date (<date>)." Add one with a number already in Spine: "Invoice <number> already exists. Use the number from your old system exactly once." Retention without a job: "Choose the job the retention is held on."
3. "Import from CSV" with columns Customer, Invoice no., Invoice date, Due date, Amount due, Retention, Job: the columns are guessed. Pick the date format, then "Import <n> invoices". A name that doesn't match a customer: "<n> customer names didn't match anyone in Spine: …" with "Create these customers" (creates them and imports) or "Fix the file" (closes, nothing imported). Bad rows are listed with the reason.
4. "Account balances": Accounts Receivable reads "From opening invoices · <total amount due>", and Retention Receivable shows the retention.
5. Invoices: each opening invoice shows "Opening balance". It ages by its due date on Receivables. Open one: there's no "Download PDF", no "Email invoice" and no "Void". "Brought in from your old system, so it has no lines…". "Record payment", "Send reminder" (no PDF attached) and "Issue credit note" work. Attach the original PDF under Attachments.
6. Once paid or credited, its row on Opening balances reads "Paid or credited" and can't be edited or removed.
7. Jobs: the job with opening retention › "Release retention" includes it.
8. "Customer credit" › "Add credit": choose a customer and an amount. It's listed, and the customer's invoices can use it ("Apply credit"). Payments lists it, but "Delete payment" says "This is opening credit. Remove it in Settings › Opening balances."
9. Change the cutover date on "Account balances" and save: the Balance Sheet shows the opening invoices and credit on the new day before.
10. Staff get 403 on every `/opening-balances/…` route.

Regression: ordinary invoices still download their PDF, email with it attached, and void as before.

## 130. Opening vendor bills and vendor credits (US-RPT-18, Phase 8)

1. Opening balances › "Vendor bills" › "Add bill": Vendor, Bill number, Bill date, Due date and Amount due. Save: it's listed. The same vendor and number again: "Bill <number> from <vendor> is already in Spine. Enter each bill once." A bill date on or after the cutover date is refused.
2. "Import from CSV" (Vendor, Bill no., Bill date, Due date, Amount): an unknown vendor gives "<n> vendor names didn't match anyone in Spine: …", with "Create these vendors" or "Fix the file".
3. "Vendor credits" › "Add credit": Vendor, Amount and "Vendor's credit note number". It's listed as "VCR-000n · their <number>".
4. "Account balances": Accounts Payable reads "From opening bills · <bills less credits>".
5. Bills: each opening bill shows "Opening balance", reads "Brought in from your old system, so it has no lines…", and has no "Void". Payables lists it by due date. Pay it from Vendor Payments.
6. Vendor Credits: the opening credit is "Open". "Apply to bills" and "Record refund" work, and "Void" says "An opening vendor credit can't be voided. Remove it in Settings › Opening balances."
7. Once paid or applied, an opening bill or credit can't be edited or removed on Opening balances.

Regression: ordinary bills and vendor credits record, pay, apply and void as before.

## 131. Review and lock opening balances (US-RPT-19, Phase 8)

1. Opening balances › "Review": the cards show the opening invoices, bills, credits and Opening Balance Adjustments, highlighted when it isn't zero. "Trial balance on <day before cutover>" lists every account with a balance and totals that agree.
2. With adjustments left, "Lock opening balances": the dialog adds "Opening Balance Adjustments still holds <amount>. Lock anyway?" "Go back" closes it. "Lock anyway" locks.
3. Locked: "Locked on <today>" and "Unlock". On every tab the inputs are disabled, there's no Save, Add or Import, and rows have no Edit or Remove. Settings › Opening balances reads "Locked".
4. Try to record anything dated before the cutover date (a payment, an expense, money out): "… falls within a closed fiscal period". Dated on or after it works.
5. Team › Audit log: "<you> locked Opening balances".
6. "Unlock" › confirm: "Everything up to <date> opens again so the opening balances can be changed." Editing works again, and the audit log shows "unlocked". Lock again: no second period is created.
7. Staff get 403 on lock and unlock.

Regression: other fiscal periods (Reports › close a period) still close and reopen as before.

## 132. Post an adjusting journal (US-RPT-20, Phase 8)

1. As an Owner, the sidebar's Reports section has "Journals". Open it, then "New journal": "For adjustments no document covers. Journals are never edited — a mistake is reversed." Date (today), Reason ("e.g. Depreciation for March") and two empty lines.
2. In an Account box, search "Receivable", "Payable", "Tax", "Advances" or "Opening": nothing matching is offered. The note lists those accounts and says to use invoices, bills, payments or Record tax payment.
3. Enter Other Expenses debit 400.00 and Accumulated Depreciation credit 350.00: the totals read $400.00 and $350.00, the alert reads "Debits and credits must be equal — out by $50.00.", and "Post journal" is disabled. A line with both a debit and a credit keeps only the last one typed.
4. Make them equal, add a job on one line, then "Post journal". The journal's page opens: "JNL-0001", "Posted", date, reason, "posted by <you>", and the lines with the job.
5. Reports › P&L / Balance Sheet move by the amounts. The drill-down shows "Journal JNL-0001 — <reason>", linking to the journal. A journal line on a bank account shows in its register as "Journal JNL-0001".
6. Post one dated inside a closed fiscal period: "… falls within a closed fiscal period".
7. Settings › Numbering lists "Journal" (JNL). Staff, even with "View ledger / journals", get 403 posting.

Regression: reports, registers and other numbering types are unchanged.

## 133. Reverse a journal (US-RPT-21, Phase 8)

1. Open a posted journal: "Copy to new journal" and "Reverse". "Reverse": "Reverse JNL-000n", with "Reversal date" (today) and "Reason". "Reverse journal" stays disabled until a reason is typed.
2. Reverse it: the page reads "Reversed", and the Reversal card reads "Reversed on <date> by <you>" with the reason. "Reverse" is gone. Reports are back where they were. The drill-down shows "Journal JNL-000n reversed — <reason>".
3. Reversal date inside a closed fiscal period: "… falls within a closed fiscal period".
4. A journal with a line on a bank account reconciled since (§126): "This entry is part of a finished reconciliation of <account> to <date>. Undo that reconciliation first."
5. "Copy to new journal": "New journal" opens with the same reason and lines. Change what's wrong and post: it gets the next number.
6. Team › Audit log: "<you> reversed a journal".

Regression: posting journals (§132) is unchanged.

## 134. The journals list (US-RPT-22, Phase 8)

1. Reports › Journals with none: "No journals yet. Most businesses only need one for year-end adjustments."
2. After posting and reversing some: the cards read Total journals, Posted, Reversed and "Posted this year" (since the start of the financial year). The list shows number, date, reason, status, total and who posted it, newest first. Search, the Status filter and the From/To dates narrow it.
3. Footer: "Members with "View ledger / journals" can read journals; only owners post or reverse them."
4. As Staff without "View ledger / journals": no "Journals" in the sidebar, /journals shows the no-access page, and the API returns 403. Grant it: "Journals" appears, the list and a journal open, and there's no "New journal", "Reverse" or "Copy to new journal". Field gets 403.

Regression: Reports (the tab page) is unchanged and still shown to Staff with any report right.

## 135. Every report in one place (US-RPT-23, Phase 8)

1. As an Owner, Reports: "Every report you can open, derived from the ledger." Cards for Business overview (Profit & Loss, Balance Sheet, Trial Balance), Receivables (Receivables), Purchases (Payables), Tax (Tax Summary), Jobs (Job profitability) and Accountant (Journals). More reports appear as later stories land.
2. Type "ledger" in "Search reports": only Trial Balance and Journals stay. Clear it: all are back. Type nonsense: "No reports match …".
3. Star Tax Summary and Profit & Loss: "Favourites" appears at the top with both. Reload, then sign in on another browser: they're still there. Unstar one: it leaves Favourites.
4. Open each report: the breadcrumb reads "Reports › <name>" and the page works as the old tab did (dates, drill-down, Export CSV); dates apply as they change (US-RPT-40).
5. The dashboard's Cash and Profit cards open the Balance Sheet and Profit & Loss pages. An old bookmark like /reports?tab=tax lands on Tax Summary.
6. As Staff with only "View job profitability": Reports lists only Job profitability, and /reports/profit-and-loss shows "Profit & Loss is only available to owners." With "View ledger / journals" only: Reports appears and lists Journals. Field: no Reports.
7. Team › a Team › Privileges › Reports & Ledger has "View financial statements", off.

Regression: Receivables and Payables still open from the sidebar. The tax payment dialog (§119) still opens from Tax Summary.

## 136. The general ledger (US-RPT-24, Phase 8)

1. As an Owner, Reports › Accountant › General ledger: "Every account's opening balance, entries and closing balance." From is the first day of this quarter, To is today, "Hide accounts with no activity" is ticked.
2. Post a journal dated last month (Dr 6900, Cr 1510) and one dated today. The ledger updates by itself: 1510 and 6900 show. 6900 reads "Opening balance … Dr" (last month's journal), one row for today's journal with its reason as the description and a running balance, and "Closing balance … Dr"; 1510 reads Cr.
3. Record a payment and an expense today, then reopen the General ledger: the bank account, Accounts Receivable and the expense account appear; each row's source reads "Payment RCP-…", "Expense EXP-…". Click one: its document opens.
4. Accounts: pick only 6900: only 6900 shows. Clear it.
5. Untick "Hide accounts with no activity": every account shows, ten to a page, with "No entries in this period." on the quiet ones; page through with the pager and change "per page".
6. Set From and To to a month with nothing posted (ticked): "Nothing posted in this period".
7. As Staff with "View ledger / journals": Reports lists General ledger and it opens. Without it: /reports/general-ledger shows the no-access page. Field: no Reports.
8. Dark mode: the tables, links and Dr/Cr balances are readable.

Regression: Trial Balance's account drill-down (§29) and the Journals list (§134) are unchanged.

## 137. The day book (US-RPT-25, Phase 8)

1. As an Owner, record money in and post a journal today. Reports › Accountant › Day book: "Every journal entry in date order." From and To are today. Both entries show with their date, source ("Money in", "Journal JNL-…"), contact · narration (the journal's reason) and one row per line — debits first — with Totals equal on both sides.
2. Source → Journals: only the journal stays. Source → All sources: both are back.
3. Type the journal's reason in "Search entries": only it stays. Type nonsense: "No entries match your search".
4. Widen From to the start of the month: older entries appear in date order; page through with the pager.
5. Click an entry's source: its document opens (invoice, payment drawer, bill, expense, journal, bank account, opening balances).
6. As Staff with "View ledger / journals": Reports lists Day book and it opens. Without it: the no-access page. Field: no Reports.
7. Dark mode: the table and links are readable.

Regression: General ledger (§136) is unchanged.

## 138. Cash Flow (US-RPT-26, Phase 8)

1. In a new organisation, record money in to Owner's Capital dated last quarter. Then, today: money out to Fixed Assets, money in to Sales — Services, money out on a card to Travel & Vehicle, and an invoice left unpaid.
2. Reports › Business overview › Cash Flow: "Where cash came from and where it went." From is the first of this quarter, To is today. "Cash at start" is the capital; "Net change" shows ▼ and "less cash than at the start" when it's negative; "Cash at end" equals the bank account's balance on Banking.
3. Operating activities: "Net profit", "Increase in receivables and retention" (the unpaid invoice, negative), "Tax collected less paid" (if it carried tax) and "Increase in card balances" (the card spend). Investing: "Fixed Assets" (negative). Financing: nothing in this period. Each section has its "Net cash from …" total, and the totals add up to Net change.
4. Click "Net profit": a dialog lists Sales — Services and the expense accounts with their amounts. Escape closes it.
5. The note under the statement reads "Cash at end equals the total of your bank and cash accounts on <To>. Card accounts are liabilities, not cash."
6. Change the dates to last quarter: the capital shows under Financing as Owner's Capital.
7. As Staff with "View financial statements": Reports lists Cash Flow and it opens. With only "View ledger / journals": the no-access page. Field: no Reports.
8. Dark mode: cards, table and the note are readable.

Regression: Profit & Loss's net profit for the same range matches Cash Flow's "Net profit".

## 139. Compare profit and loss and the balance sheet (US-RPT-27, Phase 8)

1. As an Owner with income and expenses across two quarters, open Profit & Loss, set From Jul 1 and To Sep 30, Compare with → "Previous period". The subtitle reads "Jul – Sep 2026 compared with Apr – Jun 2026". Cards show Total income, Total expenses and Net profit with "▲/▼ n% vs previous period". The table has Account, "Jul – Sep 2026", "Apr – Jun 2026", Change and Change %, grouped Income / Expenses with totals and Net profit.
2. Each change carries an arrow and a sign (▲ +, ▼ −); a figure that was zero before shows "—" for Change %. Nothing relies on colour.
3. "Same period last year": the second column is Jul – Sep 2025 and the cards say "vs last year".
4. Set Jan 1 – Dec 31 and "Each month": twelve month columns plus Total; no Change columns. Set a range over 24 months: 'Choose 24 months or fewer for "Each month".'
5. "No comparison": the original Profit & Loss list is back, with drill-down and Export CSV.
6. Balance Sheet, As of today, Compare with → "Previous year end": columns for today and the last day of the previous financial year (Settings › Financial year), with Change; totals for assets, liabilities, equity and liabilities + equity.
7. In a time zone ahead of UTC (e.g. Asia/Kolkata), From Jul 1 stays Jul 1 in the subtitle and the columns.
8. Dark mode: tables, arrows and cards are readable.

Regression: Profit & Loss and Balance Sheet without a comparison look and export as before (§15).

## 140. Sales by customer and by item (US-RPT-28, Phase 8)

1. Issue invoices this quarter to two customers — one with three of a catalogue item, one with one of it and a hand-typed line — and leave one invoice as a draft.
2. Reports › Sales › Sales by customer: "Net of credit notes · <range>". Cards show Customers, Invoices (issued only), Sales before tax and Total with tax. Rows are largest first with invoice count, sales before tax, tax, total and % of sales; the percentages add to 100%.
3. Issue a credit note on the larger customer's invoice and reopen the report: their sales drop by the credit note's amount before tax; Invoices doesn't change.
4. Click a customer: "Invoices for <name>" lists their invoices with number, date and total; a number opens the invoice.
5. Tab "Sales by item": the catalogue item shows its quantity (less the credited quantity), sales before tax and average price; "Items not from the catalogue" is last. The note under the table explains where the figures come from.
6. Click an item: its invoices. Search narrows rows on both tabs.
7. Pick a range with no invoices: "No sales in this period".
8. As Staff with "View financial statements": both open. Without it: the no-access page. Field: no Reports.
9. Dark mode: cards, table and dialog are readable.

Regression: Receivables and the invoice list are unchanged.

## 141. Expenses by category and purchases by vendor (US-RPT-29, Phase 8)

1. This quarter: record a bill to Cost of Materials with tax, a vendor credit against it, an approved expense, money out to Rent and a depreciation journal.
2. Reports › Purchases › Expenses by category: "From bills, expenses, journals and money out · <range>". Cards: Total expenses, Categories, Largest category (its amount, with its name and % under it). Each expense account shows a share bar, amount and % of total, largest first; the vendor credit has reduced Cost of Materials. The bar has an accessible name with its percentage.
3. As an Owner, click a category: the account drill-down lists its entries. As Staff with "View financial statements" but not "View ledger / journals", categories aren't links.
4. Tab "Purchases by vendor": each vendor shows bills, before tax, tax and total, net of the vendor credit, largest first. Opening bills from Opening balances aren't counted.
5. Click a vendor: "Bills from <vendor>" lists their bills in the range; a number opens the bill.
6. A range with nothing: "No expenses in this period" / "No bills in this period".
7. As Staff without "View financial statements": the no-access page. Field: no Reports.
8. Dark mode: cards, bars, table and dialogs are readable.

Regression: Payables and the vendor bill list are unchanged.

## 142. Payments received and made (US-RPT-30, Phase 8)

1. This quarter: a payment allocated to an invoice into the bank account, a payment with nothing allocated into cash, a payment against an opening invoice, and a vendor payment against a bill.
2. Reports › Receivables › Payments received: cards show Payments, Received and Held as credit ("1 payment"). Rows are newest first with number, date, customer, method, account, amount and Allocated to — the invoice number, "<number> (opening)" for the opening invoice, "Held as credit" for the unallocated one.
3. Refund part of the held payment (Payments › Refund) and reopen the report: its row shows "<amount> refunded" and Held as credit drops.
4. Account → Cash: only the cash payment shows. All accounts: all are back.
5. Click a payment number: the payment drawer opens. Click an invoice number: the invoice opens.
6. Tab "Payments made": the vendor payment with its bill; the number opens the vendor payment drawer and the bill number opens the bill.
7. As Staff with only "View receivables": Payments received opens and the "Payments made" tab isn't shown; /reports/payments-made shows the no-access page. The reverse with only "View payables". Field: no Reports.
8. Dark mode: cards, table and links are readable.

Regression: the Payments and Vendor Payments lists are unchanged.

## 143. Credit notes, vendor credits and refunds (US-RPT-31, Phase 8)

1. This quarter: a credit note on an unpaid invoice, a credit note on a paid invoice with part of it refunded, and a vendor credit raised against a bill, partly applied to it and partly refunded.
2. Reports › Receivables › Credit notes and refunds: cards Credited (with the count), Applied, Refunded, Still held. The unpaid invoice's credit note shows its whole amount as Applied; the paid one shows Refunded and Still held. Zero amounts show "—".
3. Click a credit note number or its invoice: the invoice opens (credit notes show on their invoice).
4. Tab "Vendor credits": the vendor credit shows "VCR-… · <vendor reference>", the bill, Amount, Applied, Refunded and Still held. Void a different vendor credit: it isn't listed.
5. A range with none: "No credit notes in this period" / "No vendor credits in this period".
6. As Staff with only "View receivables": only Credit notes and refunds, no Vendor credits tab; the reverse with only "View payables". Field: no Reports.
7. Dark mode: cards and table are readable.

Regression: the Credit Notes and Vendor Credits lists are unchanged.

## 144. Profit & Loss on a cash basis (US-RPT-35, Phase 8)

1. Set a cutover date (Settings › Opening balances) at the start of the year and add an opening invoice. This year: pay the opening invoice; issue a 1,000.00 services invoice with no tax and record a 500.00 payment; record a 400.00 bill and pay 100.00 of it; money out to Rent; post a depreciation journal.
2. Profit & Loss: "Basis" shows Accrual selected. Click Cash: the subtitle reads "<range> · Cash basis"; cards show Cash received (income) 500.00, Cash paid (expenses), and Net profit (cash basis) with "accrual basis: <figure>".
3. The table shows Sales — Services 500.00, Cost of Materials 100.00, Rent and Depreciation as posted, and "Net profit (cash basis)".
4. The note reads "Payments on invoices from before <cutover date> aren't counted — that income was in your old books." The explanation under it says the Balance Sheet, Trial Balance and Tax Summary stay on the accrual basis.
5. Export CSV on Cash: the file is named "profit-and-loss-cash-basis-…" and starts with "Basis … Cash basis".
6. Compare with → Previous period on Cash: the columns are cash-basis figures and the subtitle ends "· Cash basis". Switch back to Accrual: the accrual figures return.
7. Balance Sheet, Trial Balance and Tax Summary have no Basis switch.
8. Keyboard: Tab to Basis and use arrow keys to switch; the selected option is announced. Dark mode is readable.

Regression: Accrual Profit & Loss, its comparison (§139) and Export CSV are unchanged.

## 145. Export every report (US-RPT-32, Phase 8)

1. As an Owner with data this year, open each report from Reports. Each has "Export" offering "CSV" and "Excel (.xlsx)"; the menu works with the keyboard (Enter opens it, arrows move, Escape closes).
2. Profit & Loss › Export › Excel: the file is named "profit-and-loss-<from>-<to>.xlsx". Rows 1–4 read the business name (Settings › Business), "Profit & Loss", the range with "· Accrual basis", and "Amounts in <currency>". The heading row is bold and stays put when you scroll. Amounts are numbers (they sum in Excel) with two decimals.
3. Profit & Loss › Export › CSV: "Account,Amount,Currency" with plain decimals like 12345.50.
4. Compare with → Same period last year, then export: both files have the two period columns, Change and Change %. Basis → Cash: the subtitle row and file name say cash basis.
5. Balance Sheet with "Previous year end", Trial Balance with "Hide accounts with no balance" unticked, General ledger with two accounts picked, Day book with Source → Journals, Payments received with Account → Cash: each export has exactly those filters.
6. Type in a list's search (Sales by customer, Payments received, Journals…) and export: only the matching rows are in the file.
7. Tax Summary exports CSV and Excel. Receivables and Payables: Export › CSV is the same file as before; Excel works too.
8. As Staff with only "View receivables": Receivables and Payments received export; other reports' routes answer 403.

Regression: the old "Export CSV" downloads (/export.csv links bookmarked from Phase 4–6) still work.

## 146. Report PDFs (US-RPT-33, Phase 8)

1. With a logo and business name in Settings › Business, open Profit & Loss › Export › PDF. The file is "profit-and-loss-<from>-<to>.pdf". The top shows the logo, business name, "Profit & Loss", the range with "· Accrual basis" and "Amounts in <currency>". Sections are headed and totals bold; negative amounts carry a minus sign.
2. The footer reads "<business> · Accrual basis · Prepared <today>" and "Page 1 of 1". Export a long General ledger: every page has the footer and "Page n of m".
3. Basis → Cash, then PDF: the subtitle and footer say "Cash basis".
4. Compare with → Each month over a year, then PDF: the page is landscape and the month columns fit.
5. Switch the app to dark mode and export again: the PDF is light (white page, dark text).
6. Remove the logo: the PDF still downloads, without it.
7. Every other report's Export › PDF downloads a PDF named after the report and its range or date.

Regression: invoice, quote, credit note and receipt PDFs are unchanged.

## 147. Print any report (US-RPT-34, Phase 8)

1. Open Payments received with more than ten payments this quarter. Export › Print: the print preview has no sidebar, breadcrumbs, From/To, Account, Export, search, Columns or pager. It shows "Payments received", a line "<business> · <range>" and every payment, not only the first ten.
2. Close the preview: the table is back to ten rows a page.
3. Print a long General ledger or Day book: column headings repeat at the top of every printed page and no row is cut across two pages.
4. Switch the app to dark mode and print: the preview is black text on white.
5. Profit & Loss, Balance Sheet ("As of <date>"), Cash Flow, Trial Balance and Tax Summary print with their title and range or date; Receivables and Payables print with the business name.
6. Use the browser's own print shortcut (Ctrl/Cmd+P) instead: the chrome is still left out; the table prints the page on screen.

Regression: screens look the same as before; tables still page.

## 148. The accountant's Team (US-RPT-36, Phase 8)

1. As an Owner, Team › Teams › a Team › Privileges › Reports & Ledger: "View financial statements" is off. Turn it on (and leave "View ledger / journals" off) for the Team a Staff member is in.
2. As that Staff member: Reports lists Profit & Loss, Balance Sheet, Trial Balance, Cash Flow, Tax Summary and the sales and purchase reports. Each opens and exports (CSV, Excel, PDF) and prints.
3. On Profit & Loss, Balance Sheet and Trial Balance the account names aren't links. Turn on "View ledger / journals" too: they open the drill-down.
4. Tax Summary: no "Record tax payment" button and no payments list; the note says owners and members with "View financial statements" can see it.
5. As that Staff member, try Journals › New journal, Settings › Opening balances, closing a period and Settings: refused (no button, or "You don't have permission…").
6. Turn "View financial statements" off: Profit & Loss shows "You don't have access to financial statements. Ask an owner."
7. As a Field user: none of these reports appear; their URLs show the no-access page.

Regression: Receivables, Payables and Job profitability still follow their own privileges; Owners see everything as before.

## 149. Payables on the dashboard (US-DASH-21, Phase 8)

1. Record two vendor bills: one due a week ago, one due in three days. Dashboard › Payables: Current, Overdue (in the overdue colour, with its amount) and Total; the bar shows the current share; "Bills due in the next 7 days 1 · <amount>"; "Oldest overdue <bill number> · 7 days".
2. Click Overdue: Payables opens with "Show" set to "Overdue only" and only the overdue bill; "All outstanding" brings the rest back.
3. Pay the overdue bill: the card's Overdue drops to $0.00 and "Oldest overdue" reads "None".
4. The KPI row still shows Cash position, Profit this month, Receivables and Overdue — not Payables.
5. As Staff without "View payables": no Payables card. With it: the card shows.
6. Edit layout: Payables can be moved and hidden like the other cards.
7. Dark mode: figures, bar and links are readable; the bar's meaning doesn't rely on colour (amounts are written).

Regression: the Payables page without ?overdue=1 lists every open bill as before.

## 150. Top expenses on the dashboard (US-DASH-22, Phase 8)

1. In a new organisation the Top expenses card reads "No expenses in this period."
2. Record money out to seven expense accounts this month. The card shows "Top expenses · this quarter" with the five largest as bars, each with its amount and %, and "Other" for the rest; the figures match Reports › Expenses by category for the same dates.
3. Period → This month, then This financial year: the title and figures follow (the year starts on Settings › Financial year).
4. As an Owner, click an account name: the drill-down lists its entries for the period. As Staff with "View financial statements" only, names aren't links.
5. Staff without "View financial statements": no Top expenses card.
6. Narrow window (phone width): bars sit under their labels and stay readable. Dark mode is readable.

## 151. Accounts on the dashboard (US-DASH-23, Phase 8)

1. Dashboard › Accounts lists Cash in Hand, the bank account and any card or extra bank accounts you've added, each with its icon and balance; archived accounts aren't listed.
2. Spend on a card account: its balance reads "<amount> owed".
3. Finish a reconciliation on the bank account (Banking › Reconcile): the card reads "Reconciled to <date>"; the others still say "Not reconciled".
4. Click an account name: its register opens. "Banking" opens Banking.
5. Staff without "View banking": no Accounts card.
6. Dark mode and phone width: names truncate, balances stay readable.

## 152. Ready to bill on the dashboard (US-DASH-24, Phase 8)

1. In a new organisation, Ready to bill reads "Nothing waiting to be billed."
2. Complete two milestones on a job without invoicing them. The card shows "Completed milestones not invoiced · 2" and their total. Click it: a list of jobs with their milestone count and amount; a job opens on its Milestones tab. Invoice one milestone: the count drops.
3. Approve two billable expenses and one that isn't billable. "Approved billable expenses not billed · 2" shows what they'd invoice for, tax included. Click it: Expenses shows only those two, with "Showing approved billable expenses not yet on an invoice." and "Show all".
4. Bill one expense onto an invoice: the count drops to 1.
5. A cancelled job's completed milestones aren't counted.
6. Staff without "View receivables": no Ready to bill card.

## 153. Tax this period on the dashboard (US-DASH-25, Phase 8)

1. Record a taxed sale and a taxed purchase this month. Dashboard › Tax this period: Collected, Input tax and Net payable match Reports › Tax Summary for this month; the note reads "<Month Year> · nothing paid yet".
2. Settings › Tax › Return period → Quarterly. The card now covers this quarter ("Oct – Dec 2026"), with the quarter's figures.
3. Record a tax payment for the quarter (Tax Summary › Record tax payment): the note reads "… · paid <amount>".
4. Click the card: the Tax Summary opens with From and To set to the period.
5. Staff without "View financial statements": no Tax this period card.
6. Keyboard: Tab reaches the card's link and Enter opens the Tax Summary. Dark mode is readable.

Regression: the Tax Summary opened from Reports still defaults to the start of the year to today.

## 154. Accrual or cash on the dashboard (US-DASH-26, Phase 8)

1. Issue a 1,000.00 invoice this month and record a 500.00 payment on it. Dashboard: "Accrual" is selected; Profit this month is $1,000.00; the money chart is "Income and expenses" with Income and Expenses in the legend and tooltip.
2. Click "Cash": Profit this month reads $500.00 with "cash basis · …" under it; the chart becomes "Money in and out" (payments received, bills and expenses paid).
3. Reload, then sign in on another browser: Cash is still selected.
4. Switch back to Accrual: both figures return.
5. Staff without "View dashboard summary" don't see the switch (they have no profit figure). Field: no switch.
6. Keyboard: Tab to the switch, arrow keys change it; the selection is announced. Dark mode is readable.

Regression: Money in and out (§ US-DASH-15) reads exactly as before on Cash, including the 3M/6M/12M range.

## 155. Set up a recurring bill (US-PUR-29, Phase 8)

1. Vendor Bills shows "Recurring bills" beside "New vendor bill". Open it: "No recurring bills yet".
2. "+ New recurring bill": Name, Vendor, Repeat and On, Starts on (today by default), Ends, Due, Paid from ("Not set" or a money account), When it runs ("Record the bill" selected) and Lines. Save with no lines: "Add at least one line." A line without an expense account: "Choose an expense account on every line." A start date in the past: "Pick today or a later start date."
3. Save a monthly schedule on the 1st: the list shows it Active with "Monthly · 1st", the next bill date, the amount and "Record".
4. Open a recorded or draft bill › "Make recurring": the dialog opens with the bill's vendor and lines (collapsed to a summary with "Edit lines"). Name it and save: you land on Recurring bills with the new schedule.
5. Click a schedule's name: "Edit recurring bill" with its details.
6. Team › a Team › Privileges › Manage Vendor Bills has "Manage recurring bills"; Teams that create bills have it on. As Staff without it: no "Recurring bills" button, and /vendor-bills/recurring says to ask an Owner. Field: no access.
7. Dark mode and phone width: the dialog and list are readable.

Regression: Recurring invoices are unchanged.

## 156. Recurring bills run automatically (US-PUR-30, Phase 8)

1. Create a monthly recurring bill starting today on today's day of the month, "Record the bill". After 6:00 AM (or within 15 minutes if it's later), Vendor Bills lists a recorded bill from the vendor dated today, numbered "<name> · <date>", with the schedule's lines, due on the set day and the note "Created by Recurring bill <name>". Payables includes it.
2. Recurring bills shows the next bill date a month on.
3. Another schedule set to "Save as a draft for me to check": its bill is a draft, and Owners get "Recurring bill ready to review: <name>" in the bell and by email; the link opens the draft.
4. Restart the API several times on the same day: still one bill per schedule for today.
5. With "Ends after 1 bill": after its bill, the schedule shows "Finished" and no next date.
6. (Developer check) Stop the server over a run date and start it later: each missed date gets its bill once, in date order.

Regression: recurring invoices still create one invoice per due date.

## 157. Pause, edit or stop a recurring bill (US-PUR-31, Phase 8)

1. Recurring bills › a schedule's "…" menu: Edit, Pause, Delete. Pause: the status reads "Paused", Next bill "—", and a toast says it won't create bills until resumed. The 6:00 AM run creates nothing for it.
2. "…" › Resume: "Active" again, with the next date in the future (no bills for dates passed while paused).
3. Edit it, change the amount and save: future bills use the new amount; bills it already created keep theirs.
4. "…" › Delete: "Delete this schedule? Bills it already created are kept." → Delete schedule. The schedule is gone; its bills are still in Vendor Bills.
5. Keyboard: the menu opens with Enter, arrows move, Escape closes; the confirmation traps focus.

Regression: Recurring invoices' row menu still says "Invoices it already created are kept." and pauses, resumes and deletes as before.

## 158. Import catalogue items (US-CAT-09, Phase 8)

1. Catalogue › Import: "Import catalogue items". Choose a CSV with headings like "Item Name, Description, Unit, Price, Tax, Income Account": the fields are matched to those columns; change one with its menu, or pick "Not in the file". Preview stays disabled until Name is matched.
2. Include in the file: a good row, a row with a name already in the catalogue, a row repeated in the file, a tax that doesn't exist ("VAT 20%"), an account code that doesn't exist ("9999"), a row with no name and a price of "twelve". Preview: "<n> ready to import · <m> duplicates to skip · <k> rows with problems", with each row flagged ("Unknown tax VAT 20%", "Unknown account 9999", "Name is missing", "Price twelve isn't an amount", "Duplicate — skipped").
3. "Import <n> items": the summary reads "Imported <n> items · skipped <m> duplicates · <k> rows failed" and lists the duplicates. "Download failed rows" saves "<file>-failed-rows.csv" with the original columns and a "Problem" column.
4. Done: the new items are in the catalogue with their price, unit, tax and accounts; the existing item is unchanged.
5. Import the same file again: everything good is now a duplicate; nothing changes.
6. Staff without "Create/edit own catalogue items": no Import button; the route answers 403.
7. Keyboard: the file chooser, menus and buttons work with Tab, Enter and Space. Dark mode is readable.

Regression: adding and editing a single item is unchanged; contacts import is unchanged.

## 159. Every report laid out the same way (US-RPT-40, Phase 8)

1. Open each report in turn: Profit & Loss, Balance Sheet, Trial Balance, Cash Flow, Tax Summary, Job profitability, General ledger, Day book, Sales by customer and by item, Expenses by category, Purchases by vendor, Payments received and made, Credit notes and refunds, Vendor credits, Receivables and Payables. Each one shows, in order:
   - The header. Its description ends with the range ("· Jan 1 – Oct 6, 2026", or "· As of Oct 6, 2026"); Job profitability, Receivables and Payables have no range.
   - Tabs, where the report has siblings.
   - The toolbar: labelled 40px filters on the left; Export, then any blue button, on the right, all lined up along the bottom.
   - One row of three or four KPI cards, all the same height.
   - A chart, where the report has one.
   - The table.
   - One grey footnote.
2. No report has a Refresh button.
   - Change From on Sales by customer: the cards and table update by themselves, with a spinner in the toolbar while they load.
   - Tick or untick "Hide accounts with no balance" on Trial Balance: the list updates.
   - Pick an account on General ledger: the list updates.
3. Profit & Loss:
   - Tabs: Profit & Loss, Balance Sheet, Trial Balance, Cash Flow; each opens its page.
   - Cards: Total income, Total expenses, Net profit, Net margin.
   - "Income and expenses by month" charts each month of the range. Choose a range over 24 months and the chart disappears.
   - Compare with › Previous period: the header adds "compared with …", the cards show "▲/▼ n% vs previous period", and the table gains the other range, Change and Change %.
   - Basis › Cash: the header ends "· Cash basis".
4. Balance Sheet:
   - Cards: Total assets, Total liabilities, Total equity.
   - The table shows uppercase sections, bold subtotals, and "Total liabilities + equity" on a shaded row.
5. Trial Balance:
   - Cards: Accounts, Total debits, Total credits, Difference "$0.00 ✓ balanced".
   - Search the accounts and use Columns.
   - The table ends with a shaded Total row, and the footnote reads "Balanced — total debits equal total credits."
6. Cash Flow: no green banner; the footnote starts "✓ Cash at end equals …". The table ends with "Net change in cash".
7. Tax Summary: Export sits on the right with "Record tax payment" after it (Owner only). The three cards look like every other report's.
8. Job profitability:
   - The "Jobs" filter is labelled.
   - Cards: Jobs, Contract value, Billed to date, Margin.
   - The chart sits below the cards.
   - Status shows as a coloured badge, and the table ends with a Total row.
9. General ledger:
   - Tabs: General ledger, Day book.
   - Cards: Accounts, Lines, Total debits, Total credits. These cover every account, not just the page.
   - Each account's table ends with a shaded "Closing balance".
10. Receivables and Payables:
    - "Show" offers All outstanding and Overdue only.
    - Cards: Total outstanding, Current, Overdue (n invoices or bills), 90+ days.
    - "Outstanding by age" splits one bar across Current, 1–30, 31–60, 61–90 and 90+ days, each with its amount and %.
    - From the dashboard, the Overdue card opens Receivables with Show set to "Overdue only".
11. Journals: the filters are on the left; Export, then "New journal" (Owner), on the right. There's no button top right.
12. Dark mode: every report's cards, tables, chart and age bar are readable. At phone width the toolbar wraps and nothing scrolls sideways except wide tables.
13. Keyboard: Tab reaches every filter, the tabs, Export and the table's buttons. Each filter is announced with its label.

Regression:
- Export (CSV, Excel, PDF) still downloads what's on screen, search included, and Print still prints every row.
- Drill-downs from P&L, Balance Sheet, Trial Balance and Expenses by category still open.
- Staff without "View ledger / journals" still see figures but no drill-down.

## 160. Tax types (US-TAX-10, Phase 9)

1. As the Owner of a business whose tax country is India (Settings › Tax › Country, from US-TAX-09), open Settings › Tax › Add rate. "Tax type" offers CGST, SGST, UTGST, IGST and Cess, with the hint "Reports and GSTR-1 split tax by type: CGST, SGST, UTGST, IGST, cess."
2. Add "CGST 9%" (CGST), "SGST 9%" (SGST) and "IGST 18%" (IGST). Each row reads "9% · CGST", "9% · SGST", "18% · IGST".
3. Add group "GST 18%" from CGST 9% and SGST 9%: the row reads "CGST (9%) + SGST (9%) · Intra-state". A group of IGST 18% alone reads "IGST (18%) · Inter-state".
4. Try a group of CGST 9% and IGST 18%: the dialog stays open and shows "A GST group is CGST + SGST (or UTGST) at the same rate, optionally with cess." Try CGST 9% with an SGST at another rate: the same message.
5. In a business outside India, "Tax type" offers VAT, GST, Sales tax and Other, and a group can combine any rates.
6. A rate created before this change shows "· Other" and still applies on quotes and invoices.
7. Keyboard: the Tax type menu opens with Enter or Space and is announced as "Tax type". Dark mode is readable.

Regression: adding, editing, archiving and restoring rates and groups works as before; quote and invoice lines still pick rates and groups.

## 161. Start with my country's tax rates (US-TAX-09, Phase 9)

1. Sign up a new business and go through the wizard. Pick INR on the Currency step. On the Tax step:
   - The question reads "Where is your business registered for tax? …".
   - India (GST) is chosen and reads "CGST, SGST, IGST and cess at the current slabs. GST details come next."
   - The other choices are listed with their own lines, ending with "Another country — I'll add my own rates".
2. Continue with India, then open Settings › Tax:
   - Country reads "India (GST)".
   - The rates include "CGST 9%" (9% · CGST), "SGST 9%" and "IGST 18%".
   - The groups include "GST 18%", reading "CGST (9%) + SGST (9%) · Intra-state".
   - "GST 12%", "GST 28%", "IGST 12%", "IGST 28%" and every "(UT)" group show "Archived".
3. Change Country to United Kingdom (VAT):
   - "Added 4 rates. Your existing rates are unchanged — archive the ones you no longer use." appears.
   - VAT 20%, VAT 5%, VAT 0% and Exempt are listed.
   - Every GST rate is still there, unchanged.
4. Create and issue an invoice: the PDF is titled "VAT INVOICE". A deposit invoice still reads "DEPOSIT INVOICE".
5. Change Country to United Kingdom again: nothing is added, and no duplicate rates appear.
6. In a new business, pick Australia, New Zealand, the UAE and Saudi Arabia in turn:
   - Each adds its standard rate (10%, 15%, 5%, 15%), a zero rate and Exempt.
   - The invoice title becomes "TAX INVOICE".
7. In a new business, pick "Another country": the next screen is "Default tax rate" with Tax name and Rate, as before.
8. Keyboard: arrow keys move between countries, Continue works with Enter, and the Country menu is announced as "Country". Dark mode is readable.

Regression:
- Return period is kept when Country changes.
- Existing businesses keep their rates and invoice title until they choose a country.

## 162. Supply types (US-TAX-11, Phase 9)

1. Catalogue › Add item:
   - "Supply type" offers Taxable, Zero-rated, Exempt and "Non-taxable (outside GST/VAT)".
   - The hint reads "Zero-rated, exempt and non-taxable items have no tax and are reported separately."
   - Choosing a default tax switches it to Taxable.
   - Exempt with a tax shows "An exempt line has no tax. Change the supply type to Taxable to add tax." and Save is refused.
2. Save "Design consultation" as Exempt with no tax.
3. New invoice:
   - A blank line shows "Supply type: Zero-rated".
   - Pick "Design consultation": Supply type reads Exempt.
   - Pick a rate on that line: the message appears in red under Supply type. Saving is refused with the same message.
4. Change the line's Supply type to Taxable: the message and the field go away. Remove the tax: Supply type comes back, reading Zero-rated.
5. Do the same on a quote, a vendor bill, a vendor credit, a recurring invoice, a recurring bill and a variation order.
6. Issue the invoice with an exempt line: the invoice page shows "· Exempt" after the line's details. Edit the catalogue item to Zero-rated: the issued invoice still shows Exempt.
7. Save a quote with an exempt line as a bundle, then add the bundle to a new quote: the line is Exempt.
8. Keyboard: Tab reaches Supply type, which is announced as "Supply type"; the message is read out when it appears. Dark mode is readable.

Regression:
- Lines with tax look as before, with no extra field.
- Totals, issuing and PDFs are unchanged.
- Converting a quote to an invoice keeps each line's supply type.

## 163. GST registration and contacts' GST details (US-TAX-12, Phase 9)

Use a valid GSTIN such as 29AAACK0000A1ZK (Karnataka) or 33AABCU9603R1ZU (Tamil Nadu). 29AAACK0000A1ZL has a wrong check character.

1. Wizard, India: the next card is "GST details".
   - Type 29AAACK0000A1ZL: "This GSTIN isn't valid — check the 15 characters."
   - Fix the last character to K: State fills as "Karnataka (29)".
   - Fill Legal name and press Continue: the Numbering step opens.
   - "Not registered yet — skip this step" also moves on.
2. Settings: "GST" is listed under Tax for an Indian business and is absent for any other.
   - The pane shows what you saved.
   - Choose State "Tamil Nadu (33)": "This GSTIN belongs to Karnataka." appears and Save is refused.
3. Save a Chandigarh (04) GSTIN in a new Indian business. Settings › Tax: "GST 18% (UT)" and the other in-use "(UT)" groups are no longer archived; "GST 12% (UT)" and "GST 28% (UT)" are.
4. Contacts › Add contact (Indian business):
   - "GST treatment" lists the five treatments.
   - Registered business with no GSTIN: Save shows "Enter the GSTIN — it's needed for a registered business or SEZ."
   - Type a valid GSTIN: State fills in, with "State filled from the GSTIN."
   - Save: the contact page header reads "Registered business · Karnataka (29)" and "GSTIN: …".
5. Edit the contact to Consumer: the GSTIN is no longer required. Overseas: the field reads "Tax ID" and accepts any text.
6. Addresses › Add address: "State" lists the GST states. The saved address reads "…, Tamil Nadu (33)".
7. Contacts › Import a CSV with "GSTIN" and "State" columns: they map by themselves.
   - A state can be "29" or "Karnataka".
   - A bad GSTIN or an unknown state flags its row.
   - Imported rows with a GSTIN are registered businesses with the state filled in.
8. In a business outside India: contacts show "Tax ID" as before, addresses have no State picker, and there's no GST pane.
9. Keyboard and screen reader: every field is labelled; errors are announced. Dark mode is readable.

Regression: the return period (Settings › Tax) and the dashboard's "Tax this period" still follow each other; contact create, edit and import work as before outside India.

## 164. Place of supply (US-TAX-13, Phase 9)

Set up an Indian business with GST state Karnataka (29). Its rates come from the India preset.

1. Settings › Tax: "Default tax preference" shows Intra-state "GST 18%" and Inter-state "IGST 18%".
2. Catalogue › Add item:
   - "Intra-state tax" ("Same state as your business.") is GST 18% and "Inter-state tax" ("Another state, export or SEZ.") is IGST 18%.
   - Save "Modular kitchen" with both.
3. Add a customer with a billing address in Karnataka and a site address in Tamil Nadu.
4. New invoice for that customer:
   - "Place of supply" reads "Tamil Nadu (33)" with "From the site address · Inter-state, so items use their IGST rate."
   - Add "Modular kitchen": its tax is IGST 18%.
   - Add it again and change that line's tax to GST 5% by hand.
5. Change Place of supply to Karnataka (29):
   - The banner reads "The place of supply changed to Karnataka (29): 1 line switched to CGST + SGST; 1 line you changed by hand keeps its tax — check it."
   - Line 1 shows GST 18%.
   - Line 2 keeps GST 5% and shows "Check this line's tax — the place of supply changed."
6. Save and issue: the invoice page reads "Place of supply Karnataka (29) (intra-state)". Change the customer's address: the issued invoice doesn't change.
7. An overseas customer gets "Other countries (96)" and IGST (export). An SEZ customer is inter-state.
8. Vendor bill from a vendor in Maharashtra: the place of supply is Maharashtra (27) and the bill is inter-state. A vendor in Karnataka is intra-state.
9. Credit note on an issued invoice: it has the invoice's place of supply.
10. Outside India, or in an Indian business with no GST state: there's no Place of supply field and documents behave as before.
11. Keyboard: Place of supply is labelled and reachable by Tab; the banner and line warnings are announced. Dark mode: the banner and the warnings are readable.

Regression:
- Saving a draft keeps all its lines.
- Converting a quote keeps its place of supply.
- Recurring schedules and variation orders work as before.

12. Exports under LUT (D-181): tick Settings › GST › "We export under LUT" and save.
    - A new invoice for an overseas customer shows "The customer is overseas · Export under LUT, so items have no IGST."
    - An item added has no tax and is Zero-rated.
    - Untick it: a new invoice for that customer charges IGST 18%.
13. Recurring invoice, recurring bill and variation order (D-183): for a customer in Tamil Nadu, an item added uses IGST 18%; for one in Karnataka, GST 18%. Changing the schedule's customer between them switches the lines and shows the banner.

## 165. HSN and SAC codes (US-TAX-14, Phase 9)

Use an Indian business with a GST state, as in section 164.

1. Catalogue › Add item:
   - "HSN/SAC code" reads "4, 6 or 8 digits. Copied to each line; change it there if needed.".
   - Type 94031: "Enter 4, 6 or 8 digits." Type 9403: the message goes.
   - Save the item.
2. New invoice for a registered business:
   - Add the item: the line's HSN/SAC reads 9403. Change it to 940310.
   - Add a one-off line: its HSN/SAC is empty.
   - Save.
3. Issue: "Issue without HSN/SAC codes?" says "1 line has no HSN/SAC code. GSTR-1 needs them."
   - "Go back" leaves the draft.
   - "Issue anyway" issues it.
4. Issue an invoice to a consumer with lines without codes: no question is asked.
5. Change the item's code: the issued invoice keeps 940310.
6. Quotes, vendor bills and vendor credits show HSN/SAC the same way. Saving a quote as a bundle and adding the bundle keeps the codes.
7. Catalogue › Import a CSV with an "HSN/SAC" column:
   - It maps by itself.
   - "9403 60" imports as 940360.
   - "94" fails the row with "HSN/SAC 94: enter 4, 6 or 8 digits."
8. Outside India there's no HSN/SAC field anywhere.
9. Keyboard: HSN/SAC is labelled; errors are announced. Dark mode is readable.

Regression: lines and totals save as before.

## 166. 0% rates and their supply type (D-182, Phase 9)

1. In a UK business, Settings › Tax lists "VAT 0%" as "0% · VAT · Zero-rated" and "Exempt" as "0% · VAT · Exempt".
2. Add a 0% rate: "Lines with this rate are" offers Zero-rated, Exempt and "Non-taxable (outside GST/VAT)". A rate above 0% doesn't ask.
3. New invoice: pick Exempt on a line and Supply type becomes Exempt. Pick VAT 0% and it becomes Zero-rated.
4. Add a catalogue item with tax Exempt: its supply type becomes Exempt.

## 167. Every character on PDFs (US-SET-20, Phase 9)

1. In an INR business, add a customer named "राम कुमार शर्मा" and an item named "Café Ελληνικά".
2. Issue an invoice to them and download the PDF:
   - Money reads "₹2,41,900.00" (never "INR").
   - The customer name prints in Devanagari, and the item name's accents and Greek print correctly.
   - A credit note shows its negative amounts with a minus sign.
3. Download the quote, credit note, receipt and statement PDFs and a report PDF (Profit & Loss): all use the same font, and ₹ prints everywhere.
4. A Tamil name prints as missing glyphs; that's expected until v1.1.
5. Copy text from the PDF in a viewer: "Profit" pastes as "Profit" (ligatures map back).
6. Invoices issued before this change still download with their old look.

## 168. Paper size and columns (US-SET-17, Phase 9)

1. Settings › Documents:
   - The text reads "Choose what each document shows. The preview updates as you change options."
   - Tabs: Quotes, Invoices, Credit notes, Receipts, Statements. Invoices is open, with a sample invoice in the preview.
2. Change Paper size to Letter: the preview's page gets shorter and wider.
3. Columns:
   - Untick Discount: the Disc. column goes, and the discounted line's unit price drops (12,500.00 → 11,250.00) while its amount stays the same.
   - Untick "Quantity and unit": Qty and Unit price go.
   - Untick "Tax per line": the Tax column goes.
   - Totals never change.
4. Save, then issue an invoice: its PDF is Letter with those columns hidden. Change the options again: the issued invoice's PDF doesn't change, but a draft's preview does.
5. Credit notes: no Discount option. Receipts and Statements: Paper size only.
6. In an Indian GST business, "HSN/SAC" appears among the columns.
7. As Staff: Settings isn't available, and the preview and save routes answer 403.
8. Keyboard: tabs move with the arrow keys; every checkbox is labelled. The preview is a light PDF in dark mode too.

Regression: existing quote, invoice, credit note, receipt and statement PDFs look as before when no options are saved.

## 169. Document titles, terms and notes (US-SET-18, Phase 9)

1. Settings › Documents › Quotes:
   - Title "Quotation", Default terms "Valid for 30 days.", Default notes "Prices include delivery.".
   - The preview shows QUOTATION.
   - Save.
2. Type 2,001 characters in Default terms: "Keep terms under 2,000 characters." shows and Save is refused.
3. New quote: Notes and Terms start with the defaults. Change them, save, and the quote keeps your text. Editing an existing quote doesn't bring the defaults back.
4. Credit notes, Receipts and Statements: set terms and notes. Their PDFs and previews print them under the content.
5. Clear a title: the default title prints again.
6. In an Indian GST business, the Invoices and Credit notes tabs show Title "Tax Invoice" / "Credit Note", greyed out, with "Set by your GST settings". GST invoices print TAX INVOICE.

## 170. Signature and amount in words (US-SET-19, Phase 9)

1. Settings › Documents:
   - Signature is greyed out until a signature is uploaded.
   - "Upload signature" takes a PNG or JPEG; a PDF is refused with "Upload a PNG or JPEG image.".
   - After uploading, Signature is ticked for this tab.
2. Tick Signature on Invoices and Statements only, tick "Amount in words" on Invoices, and save.
3. A draft invoice's PDF shows the signature above "Authorised signatory — <business name>". Under the totals: "Amount in words: Rupees … Only" for INR, or "… dollars and … cents" for USD.
4. A quote's PDF has no signature (not ticked). A statement shows it.
5. Issue an invoice, then "Remove signature" and save:
   - New invoices have no signature.
   - The issued one still does.
6. As Staff, the signature image opens from its file link; as Field, it doesn't.
7. Rupee check: ₹2,41,900.00 reads "Rupees Two Lakh Forty-One Thousand Nine Hundred Only"; ₹12,500.50 reads "Rupees Twelve Thousand Five Hundred and Fifty Paise Only".

## 171. GST invoices and credit notes (US-TAX-15, Phase 9)

Use an Indian business with GST state Karnataka (29) and GSTIN 29AAACK0000A1ZK.

1. Invoice a registered Karnataka customer for two items on GST 18% with HSN codes, issue it and open the PDF:
   - It's titled TAX INVOICE.
   - Your GSTIN prints beside your address; their address and GSTIN print under their name.
   - "Place of supply: Karnataka (29) · Intra-state supply".
   - Columns: HSN/SAC, Qty, Unit price, Taxable value, CGST 9%, SGST 9%, Amount.
   - Totals: Taxable value, CGST 9%, SGST 9%, Total.
   - The CGST and SGST amounts add up to the line's tax.
2. Invoice a Maharashtra customer with IGST 18%: "Inter-state supply" and an IGST 18% column; no CGST.
3. Mix 5% and 18% lines: the CGST/SGST headings drop the rate, and each cell shows its own rate under the amount.
4. Export to an overseas customer:
   - "Supply meant for export with payment of IGST", with their full overseas address and "Other countries (96)".
   - With "We export under LUT" on (Settings › GST), it reads "… under LUT without payment of IGST".
5. Invoice with only exempt and non-taxable lines: BILL OF SUPPLY.
6. Settings › Documents › Invoices › tick "Tax summary table": an HSN/SAC table follows the lines (Taxable value, CGST, SGST, Total tax).
7. Issue a credit note on the first invoice: CREDIT NOTE, with the same GST details and "Against invoice INV-… dated …".
8. In a business without GST: PDFs look as before (Subtotal, Discount, Tax; no GSTIN or place of supply). Ticking "Tax summary table" there gives a summary by rate.

## 172. UPI ID for payments (US-INV-25, Phase 9)

1. In an INR business, open Settings › Payment instructions:
   - A "UPI" section shows "UPI ID" (placeholder "e.g. riverstone@okhdfc") and "Payee name" (placeholder: the business name).
   - "Show a UPI QR code on invoices" is greyed out until a UPI ID is entered.
   - The footer reads "Issued invoices keep the instructions and QR code they were issued with — …".
2. Enter "river stone@okhdfc" and save: "Enter a UPI ID like name@bank.". Try "riverstone" as well: same message.
3. Enter "riverstone@okhdfc": the QR switch turns on. Save, reload and reopen the pane: the ID and the switch are kept.
4. Turn the switch off, save, reload: it stays off.
5. In a USD business, the pane shows only "How customers can pay"; there are no UPI fields.
6. Regression: the payment instructions text still saves, and more than 600 characters is still refused (section for US-INV-16).

## 173. UPI QR code on invoices (US-INV-26, Phase 9)

Use an INR business with UPI ID "kaveriinteriors@okhdfc", payee name "Kaveri Interiors Pvt Ltd", the QR switch on and payment instructions set.

1. Open a draft invoice's PDF. The "How to pay" box shows a QR code and "Scan to pay ₹… with any UPI app · kaveriinteriors@okhdfc · note Draft invoice", above the payment instructions.
2. Issue an invoice for ₹2,41,900.00 and open its PDF. It reads "Scan to pay ₹2,41,900.00 with any UPI app · kaveriinteriors@okhdfc · note INV-…".
3. Scan the code with a UPI app (don't pay):
   - The payee is Kaveri Interiors Pvt Ltd.
   - The amount is 241900.00.
   - The note is the invoice number.
4. Check that nothing was recorded: the invoice is still unpaid, and Payments has nothing new.
5. Record a ₹41,900 payment against it:
   - The PDF still shows ₹2,41,900.00.
   - Send a reminder. The email shows "Balance due ₹2,00,000.00" and "The QR code on the attached invoice is for ₹2,41,900.00; pay ₹2,00,000.00 to clear it."
6. Turn the QR switch off and issue another invoice: "How to pay" shows only the instructions.
7. Issue an invoice in USD: no QR code.
8. Clear the payment instructions with the QR switch on: "How to pay" shows only the QR line.
9. Regression:
   - In a USD business, invoice PDFs and emails look as before (section for US-INV-15).
   - Reminders for invoices without a QR code don't mention one.

## 174. Tax Summary by rate, tax type and supply class (US-RPT-37, Phase 9)

Use an Indian business (GSTIN 29AAACK0000A1ZK, Karnataka) for Jul 1 to today.

1. Issue an invoice in Karnataka for ₹1,80,000 at GST 18% plus a ₹10,000 exempt line. Issue one to a Mumbai customer for ₹1,00,000 at IGST 18% plus a ₹5,000 zero-rated line.
2. Issue a ₹10,000 credit note at 18% on the first invoice.
3. Record:
   - A bill for ₹50,000 at GST 18%, ₹12,000 exempt and ₹8,400 non-taxable.
   - A ₹5,000 vendor credit at GST 18%.
   - An approved expense with ₹1,800 IGST.
   - Money out of ₹5,900 at GST 18%.
4. Record a ₹10,000 tax payment for Q3.
5. Open Reports › Tax Summary:
   - The cards read: Tax collected ₹48,600.00, Tax paid ₹10,800.00, Net payable ₹37,800.00, and Paid to the tax authority ₹10,000.00 with "Still to pay ₹27,800.00".
   - "By tax type": CGST ₹15,300 / ₹4,500 / ₹10,800; SGST the same; IGST ₹18,000 / ₹1,800 / ₹16,200; Cess ₹0. The total row matches the cards.
   - "Collected by rate": GST 18% ₹32,400 and IGST 18% ₹18,000, then the credit-note adjustment.
   - "Paid by rate": GST 18% ₹9,000 (taxable ₹50,000) and IGST 18% ₹1,800.
   - "Supply class":
     - Zero-rated: ₹5,000 sales.
     - Exempt: ₹10,000 sales and ₹12,000 purchases.
     - Non-taxable: ₹8,400 purchases.
6. Export as Excel: the paid side, tax types, supply classes and payments are all there.
7. In a USD business, "By tax type" lists the business's own tax types; the other tables work the same.
8. Regression:
   - Recording and deleting tax payments still updates the list and cards (section for US-TAX-08).
   - The dashboard tax card still opens this report for its period (US-DASH-25).

## 175. GSTR-1 export (US-TAX-16, Phase 9)

Use an Indian business with GSTIN 29AAACK0000A1ZK (Karnataka), and issue documents dated last month:

- Invoices:
  - A registered Karnataka customer, ₹1,80,000 at GST 18% with HSN 9403.
  - A consumer, ₹10,000 at GST 18%.
  - A Tamil Nadu consumer, ₹1,20,000 at IGST 18%.
  - An overseas customer, at IGST 18%.
  - A line marked exempt.
- A credit note against an invoice from the month before.
- One invoice voided.

1. Reports lists GSTR-1 under Tax. A USD business doesn't see it.
2. Open GSTR-1:
   - The subtitle reads "<Month Year> · GSTIN 29AAACK0000A1ZK".
   - The cards show documents with the invoice range, taxable value and tax.
3. Check the tables:
   - B2B has the registered invoice.
   - B2CL has the ₹1,20,000 Tamil Nadu sale.
   - B2CS has the small consumer sale.
   - CDNR has the credit note, as a negative.
   - Exports has the overseas sale.
   - Nil, exempt and non-GST has the exempt value.
   - The HSN summary shows a count of codes.
   - Documents issued shows the invoice range and "1 void".
4. The footer reads "Spine prepares this file; it doesn't file your return. Check it, then upload it on the GST portal."
5. Download JSON. The file is named `GSTR1_29AAACK0000A1ZK_<MMYYYY>.json` and has `"version": "GST3.2.4"`. In it:
   - The credit note in `cdnr` has `inum` and `idt` from the earlier invoice.
   - `doc_issue` counts the voided invoice in `cancel`.
6. **Manual, outside Spine:** import the JSON into the GST offline tool. It opens without schema errors, and its totals match the page.
7. Switch Filing to Quarterly: the periods read like "Jul – Sep 2026", and the figures cover the three months.
8. As Staff without "View financial statements" the page says you don't have access. Field users can't open it.
9. The audit log shows "GSTR-1 file · Downloaded" with the period and format.

## 176. GSTR-1 checks and Excel (US-TAX-17, Phase 9)

Use the GST business from section 175.

1. Create the problems:
   - Issue an invoice this month to a consumer, with one line that has no HSN/SAC (choose "Issue anyway").
   - In a test database, clear a registered customer's GSTIN after invoicing them.
2. Open GSTR-1 for this month:
   - The "Problems" card shows the count and "fix before uploading".
   - "Fix these before you upload" lists "Registered customer with no GSTIN — <name>" with "Open contact", and "1 line with no HSN/SAC — INV-…" with "Open invoice".
   - Each link opens the right record.
3. With nothing wrong:
   - The panel is gone.
   - The Problems card says "Nothing to fix".
   - The Tax card says "equals the Tax Summary". Compare it with Reports › Tax Summary for the same month: tax collected is the same figure.
4. Issue an invoice today, backdated to last month, then open last month: the Tax card still says "equals the Tax Summary" (D-185).
5. In a test database, post output tax to 2100 with no document behind it, then reopen the month:
   - The Tax card shows "Tax Summary says ₹…".
   - The panel lists "Tax in the file (₹…) doesn't match tax collected on the Tax Summary (₹…)" with "Open Tax Summary".
6. Download Excel (`GSTR1_<GSTIN>_<MMYYYY>.xlsx`):
   - The sheets are b2b, b2cl, b2cs, cdnr, cdnur, exp, exemp, hsn(b2b), hsn(b2c), docs and Problems.
   - Totals per sheet match the page and the JSON.
   - Problems ends with the footer.
7. The audit log shows a GSTR-1 file download for each of JSON and Excel.
8. Regression: Tax Summary figures are unchanged (section 174).

## 177. Invoices post on their issue date (D-185, Phase 9)

1. Create a draft invoice with an issue date last month and issue it.
2. Open Journals or the general ledger: the invoice's entry is dated last month, not today.
3. Profit & Loss and Tax Summary for last month include it; this month's don't.
4. Close last month's fiscal period, then try to issue another invoice dated in it: it's refused with "Cannot post a journal entry dated … — that date falls within a closed fiscal period".
5. An invoice with no issue date still posts today.
6. Regression:
   - Voiding an invoice still reverses it on the day it's voided.
   - Credit notes post on the day they're issued.
   - Receivables aging is unchanged.

## 178. Tally account mapping (US-RPT-39, Phase 9)

1. Reports › Export to Tally › Account mapping (`/reports/tally/mapping`):
   - The breadcrumb reads Reports › Export to Tally › Account mapping.
   - Each account shows its code, name, Spine type and a Tally group.
2. Check the defaults:
   - 1000 Cash in Hand → Cash-in-Hand; your bank account → Bank Accounts; a card account → Bank OD A/c.
   - 1200 and 2100 → Duties & Taxes; 1500 → Fixed Assets; 2500 → Loans (Liability); 3000 → Capital Account.
   - 4100 → Sales Accounts; 5000 → Direct Expenses; 6000 → Indirect Expenses.
3. The picker offers Tally's predefined groups (Bank Accounts … Unsecured Loans).
4. Filter to Expense and search "Rent".
5. Change 6000 Rent to Direct Expenses: "Save mapping" turns on. Save: you see "Mapping saved". Reload: it's kept.
6. As Staff with "View financial statements" the pickers are read-only and the page says "Only an Owner can change the mapping." Field users can't open it.
7. Check light and dark mode, and that the pickers work by keyboard.

## 179. Export to Tally (US-RPT-38, Phase 9)

1. In a business with, this month:
   - An issued invoice, and a customer payment against it.
   - A credit note.
   - A recorded bill, and a vendor payment against it.
   - A vendor credit.
   - A transfer.
   - An approved expense.
   - A manual journal.
2. Reports › Export to Tally (Accountant group):
   - The subtitle reads "A file your accountant imports into TallyPrime or Tally.ERP 9."
   - From defaults to 1 April for a rupee business (1 January otherwise).
3. The cards show ledgers, vouchers and "Accounts on default groups" with "review the mapping".
4. The table lists each Spine document with its Tally voucher type (Sales, Purchase, Receipt, Payment, Contra, Journal, Credit Note, Debit Note) and count, with a total.
5. "Account mapping" opens the mapping (section 178). Change Rent to Direct Expenses and save, then come back.
6. Press Export. `tally-<from>-<to>.zip` downloads with masters.xml, vouchers.xml and README.txt.
7. Check the files:
   - Every account used is a LEDGER under its group (Rent under Direct Expenses).
   - Customers are under Sundry Debtors and vendors under Sundry Creditors, with address, state and GSTIN.
   - Invoices are Sales with a New Ref bill; payments are Receipt with an Agst Ref to the invoice.
   - The README lists the accounts on defaults.
8. **Manual, outside Spine, before each release:**
   - Import `docs/samples/tally/masters.xml`, then `vouchers.xml`, into a test company in TallyPrime 6.x or 7.x and in Tally.ERP 9. Both import without errors (R-16).
   - Then import a real export and compare Tally's Trial Balance with Spine's for the same dates.
9. As Staff with "View financial statements" you can export but not change the mapping. Field users can't open it.
10. The audit log shows "Tally export · Downloaded".

## 180. Apply credit when issuing (D-187, Phase 9)

1. In an INR business with a UPI ID, record a ₹500 payment from Lakeview Homes without allocating it (a deposit).
2. Create a ₹1,180 draft invoice for them and press "Issue Invoice":
   - "Apply this customer's credit?" says they have ₹500.00 of credit from payments and credit notes.
   - It offers "Go back", "Issue without credit" and "Apply credit and issue".
3. Choose "Apply credit and issue":
   - The toast ends "₹500.00 of credit was applied."
   - Balance due is ₹680.00, and the payment shows on the invoice.
   - The PDF's QR code reads "Scan to pay ₹680.00 with any UPI app".
4. With credit that covers the whole invoice, the issued PDF has no QR code.
5. "Issue without credit" leaves the credit alone; "Apply credit" still offers it afterwards (US-PAY-16).
6. A customer with no credit: Issue goes straight through, with no question.
7. Staff who can issue but not apply credit:
   - They aren't asked.
   - Sending `applyCredit` to the API is refused with "You don't have permission to apply credit. Issue it without, or ask an owner."
8. A registered customer with lines missing HSN/SAC: the HSN warning comes first, then the credit question.

## 181. Customer email templates (US-SET-21, Phase 9)

1. Settings › Emails:
   - It lists Quote, Invoice, Payment reminder, Receipt, Credit note and Statement, each with its subject and first line.
   - The text reads "Your own words in the emails customers get. The branded layout around them stays the same."
2. Open Invoice and set the subject to "Invoice {document_number} from {business_name}" using the Insert buttons (they go where the cursor is).
3. `{link}` is offered only on Quote, and `{due_status}` only on Payment reminder.
4. Type `{invoice_no}`: "{invoice_no} isn't a placeholder Spine knows. Use one from the list." Save is refused until it's fixed.
5. The Message is a rich text editor (bold, italic, lists, link). In it:
   - Use Insert to add `{customer_name}` at the cursor.
   - Make a word bold, add a bullet list and a web address.
   - Save: "Your changes have been saved."
6. On an issued invoice, press "Email invoice". The send dialog:
   - To is the customer's email.
   - The subject and message are your template with this invoice's number, amount and dates.
   - "Attach the invoice PDF" is ticked.
7. Change the subject and send. The email arrives:
   - With your subject, and your paragraphs, bold word and list as you formatted them.
   - The web address is a clickable link.
   - The plain-text part shows "• " bullets.
   - Inside the branded layout: heading, details, payment instructions and the PDF.
   - The next "Email invoice" starts from the saved template again.
8. Untick "Attach the invoice PDF": the email has no PDF.
9. "Send reminder" on an overdue invoice starts from the reminder template: "Reminder: invoice INV-… is N days overdue".
10. "Send Quote" opens the dialog. `{link}` (and the number, for a draft quote) stays as a placeholder until it's sent; the email has the link.
11. Email a receipt from a payment, and a credit note from its invoice's Credit notes section (the Email button). Both go with their PDFs.
12. Send a statement: the dialog's Subject and Message start from the Statement template, with the period and balance filled in.
13. Regression:
    - Automatic and bulk reminders still go, using the saved reminder template.
    - Emails sent before the change are unchanged.
    - Staff without "Send" don't see the dialogs.

## 182. Preview, test and reset an email (US-SET-22, Phase 9)

1. Settings › Emails › Receipt: change the subject without saving and press Preview:
   - The email shows in the branded layout, light even in dark mode.
   - It's made from your latest payment ("Made from RCP-… · <customer>"), or sample details when there are none.
2. Close the preview: Settings stays open.
3. Press "Send me a test": "Test sent to <your email>. Only you get it." The email arrives at your address only, subject "[Test] …". The customer gets nothing.
4. Without SMTP set up: "Email isn't set up yet, so a test can't be sent. Ask an Owner to set up email."
5. Save, then press "Reset to default":
   - "Reset the receipt email?" asks first.
   - Confirming brings back "{business_name} sent you a receipt ({document_number})", saved.
   - Reset is greyed out when the email is already Spine's.
6. Preview a quote whose message uses `{link}`: it shows an example link.
7. Staff can't preview or send tests (403).

## 183. Rich text email messages (D-189, Phase 9)

1. In Settings › Emails, the Send dialogs and the statement dialog, Message is a rich text editor. It has Bold, Italic, Bullet list, Numbered list and Link, and screen readers announce it as "Message".
2. Paste formatted text from a web page: only bold, italics, lists, links and paragraphs remain.
3. Send an email with a link to `javascript:…` (via the API): the link text arrives without a link.
4. A customer named `<b>Test</b>` is greeted as written, not in bold.
5. Regression:
   - Default emails look as before.
   - Quote notes and terms editors work as before.

## 184. Optional modules (US-SET-23, US-SET-24, US-SET-25, US-ONB-14, Phase 9)

1. Settings › Modules, as an Owner:
   - It lists Leads & meetings, Jobs & field, Approvals and Recurring documents, each with a switch and its description.
   - The note reads "Contacts, quotes, invoices, payments, purchases, banking, tax and reports are always on."
   - Staff don't see the pane, and `PUT /org/modules` answers 403 for them.
2. Switch Approvals off:
   - The confirmation names what disappears and says "Nothing is deleted. …".
   - "Keep it on" leaves the switch alone. "Switch off", then Save.
3. With Approvals off:
   - A Field user's new expense shows Approved, and its entry is in the ledger.
   - A quote with a 40% discount sends without approval.
   - The "awaiting approval" attention row is gone.
4. With an active Field user, switch Jobs & field off and save: "1 person uses the field app. Change their role or deactivate them first." The switch stays on.
5. Deactivate the Field user, then switch Jobs & field and Leads & meetings off. Check:
   - The sidebar has no Jobs, Pipeline or Meetings.
   - `/jobs` and `/meetings` show "<Module> is switched off. An owner can switch it on in Settings › Modules."
   - The dashboard has no jobs or pipeline widgets, and Today has no meetings or milestones.
   - Search finds no jobs.
   - Settings has no Pipeline stages, Upcoming meetings or Meeting reminders.
   - Reports has no Job profitability.
   - Teams › Privileges has no Manage Jobs, Leads or Meetings.
   - Bills, expenses, journals and bank matches have no Job field.
   - Quotes have no "Convert to job", and contacts have no Leads tab.
6. On the mobile app, a Field user's job screens get "Jobs & field is switched off …" (API 403 `MODULE_OFF`).
7. Switch Recurring documents off: no recurring invoices or bills are created that morning. Modules shows "Switched off <date> — schedules are paused."
8. Switch everything back on:
   - Jobs, leads, meetings, Team grants and settings are as they were.
   - The save says "Recurring documents were off from <date> to <date>; missed dates were skipped."
   - Schedules show their next future date, and nothing is back-filled.
   - Expenses approved while Approvals was off stay approved; new ones wait for approval.
9. US-ONB-14:
   - A new business choosing Generic in the wizard sees "Jobs are switched off — turn them on in Settings › Modules if you need them." and starts without Jobs.
   - Construction or General Services starts with everything on.
   - Settings › Industry template says "Modules stay as they are. Change them in Settings › Modules.", and changing it doesn't touch modules.
10. Regression:
    - An existing business has every module on.
    - Owners' and Staff's sidebars still match their rights (US-TEAM-18).

## 185. Demo data stays out of my numbers and books (US-ONB-17, Phase 9)

1. On a fresh business, load demo data. Its documents are numbered from their own series:
   - `DEMO-QUO-…`, `DEMO-INV-…`, `DEMO-CRN-0001`, `DEMO-RCP-…`, `DEMO-VPY-0001`, `DEMO-EXP-…` and `DEMO-JOB-001` to `003`.
   - The Day book shows only demo entries.
2. Add a customer of your own, invoice them and issue it: it's `INV-0001`.
3. Invoice a demo customer (say Priya Nair) and issue it: it's the next `DEMO-INV-…` number.
4. Record a vendor credit of your own for the demo vendor Apex Timber Supply (leave it as a draft).
5. Settings › Data › "Delete all demo data":
   - The confirmation says it deletes "… and the entries they made in your books. Your own records stay.".
   - Afterwards the pane says "No demo data is currently loaded." and "Kept 1 demo contact that your own records use.".
6. After deleting, check:
   - Trial Balance, Profit and Loss, General ledger and Day book show only your own `INV-0001`.
   - The Tax Summary, GSTR-1 (India) and the Tally export have nothing from the demo.
   - Jobs is empty, and Contacts shows only your customer and Apex Timber Supply.
7. Load demo data again: its invoices start at `DEMO-INV-0001`. Your next own invoice is `INV-0002`.
8. Regression:
   - Section 1 step 7 (load demo data) still seeds everything it lists, now with `DEMO-` numbers.
   - The payment reminder preview (US-INV-18) names a `DEMO-INV-…` invoice on a demo business.
   - Voiding a demo invoice and deleting a demo payment still post reversing entries; both go when the demo is deleted.

## 186. Industry templates for more kinds of business (US-ONB-20, Phase 9)

1. Sign up and choose "Set up my business". The Template step lists, in order:
   - Construction / Contracting, Interior design & fit-out, Trades (electrical, plumbing, HVAC), IT services & agency, Professional services, General Services and Generic.
   - Each has a line saying what it sets up.
2. Pick Professional services:
   - The step says "Jobs are switched off — turn them on in Settings › Modules if you need them.". Continue.
   - The sidebar has no Jobs.
   - Expenses › Categories says "Set up by the Professional services template: 6 new categories and accounts 5900 Research & Subscriptions and 6450 Professional Indemnity Insurance. …".
   - It lists Subscriptions & research (5900), Associates & subcontractors (5100), Professional fees (6400), Insurance (6450), Travel (6300) and Office supplies (6900).
3. On another new business, pick Trades:
   - Every module is on.
   - Accounts 5700, 5710 and 5720 and their six categories exist.
4. Settings › Industry template, switch to IT services & agency and save:
   - Its categories are added, and the Trades categories stay.
   - Modules don't change.
   - Saving IT services again adds nothing.
5. Rename account 5600 to "Showroom Stock" before choosing Interior design & fit-out. The note keeps it: "Kept your existing account 5600 · Showroom Stock".
6. Regression: Construction still sets up 5300–5500 and its six categories (section 1 of US-ONB-13); Generic still starts without Jobs (section 184 step 9).

## 187. Choose the country and industry of the demo business (US-ONB-18, Phase 9)

1. Set your computer's time zone to India (or open the browser with `Asia/Kolkata`).
2. Sign up and press "Just show me around (use defaults)". "Explore a demo business" opens:
   - Country shows India (GST), with "Your tax country, currency and industry template change to the demo's. …".
   - Industry shows Construction / Contracting, with "You'll see Shilpa Buildcon.".
   - Both lists hold seven countries and five industries.
   - Pick Interior design & fit-out: the line becomes "You'll see Tarang Interiors.".
3. "Load demo business" (a few seconds). The dashboard opens with rupee amounts. Then check:
   - Settings: currency INR, tax country India, financial year from April, template Interior design & fit-out.
   - Settings › Data: "Tarang Interiors · India (GST) · Interior design & fit-out".
4. Look around, and check:
   - Invoices: about six months of `DEMO-INV-…` numbers in date order, some paid, one part-paid and overdue, one voided today, and one draft.
   - Payments come after their invoices.
   - Quotes: draft, sent and revised.
   - Jobs: three — one just started with a variation order, one half invoiced, one finished.
   - Bills: paid, overdue, voided and draft. Expenses: approved, waiting and rejected.
   - Every report has figures, and the Trial Balance balances.
5. Repeat on fresh businesses for, say, United Kingdom × Trades and United States × IT services & agency. Each has local names, addresses and money.
6. Professional services starts with Jobs switched off and has no jobs.
7. On a business with an invoice of its own, Settings › Data › "Load demo data":
   - Country is fixed to your tax country, with "Demo data uses your business's country: …".
   - Loading changes none of your settings (currency, template, business name).
8. With demo data loaded, Settings › Data offers only "Delete all demo data". Through the API, a second load answers 409 "Demo data is already loaded. Delete it first to load another demo business.".
9. Regression:
   - `POST /demo-data/seed` with no body still loads Riverstone Builders (section 1 step 7), which e2e relies on.
   - On an install where sign-up is closed (any install after its first owner), loading a demo succeeds and Sarah Mendes and Marcus Webb can sign in with `DemoPassword123!`.
   - If loading fails part-way (stop the database mid-load), nothing demo is left and "Load demo data" works again.
   - Section 185 (delete leaves no trace) holds for every country and industry.

## 188. An Indian GST demo business (US-ONB-19, Phase 9)

1. Load India × any industry. Settings › GST shows:
   - A Karnataka (29) GSTIN, legal and trade name, monthly returns and "We export under LUT" on.
   - Settings › Business has the UPI ID `demo.business@example`, which pays no one.
2. Contacts include:
   - Registered businesses in Karnataka and Maharashtra.
   - Consumers in Bengaluru and Hosur (Tamil Nadu).
   - An SEZ unit and, for interior design, IT and professional services, a client in Dubai.
   - Registered vendors in Karnataka and Tamil Nadu, and one unregistered vendor.
3. Catalogue items have HSN/SAC codes and the GST 18% group with IGST 18% for other states.
4. Invoices:
   - Within Karnataka: CGST + SGST. To Pune: IGST, place of supply 27.
   - To the SEZ unit: one with IGST, the recent one zero-rated under LUT.
   - To Dubai: an export, zero-rated (place of supply 96).
   - The PDFs show GST details and a UPI QR.
5. GSTR-1 for this month and last month:
   - B2B (with the SEZ invoice as SEWOP), B2C large (the Hosur invoice above ₹1,00,000), B2C small, CDNR (today's credit note), HSN summary and, where the industry exports, EXP all have rows.
   - The checks list no problems, and the totals equal the Tax Summary.
6. The Tax Summary shows CGST, SGST and IGST collected and paid, zero-rated sales, and the unregistered vendor's bill as non-taxable purchases.
7. Regression: the Tally export of the period has the demo's vouchers, and after deleting the demo it has none.

## 189. A VAT or GST demo business in my country (US-ONB-21, Phase 9)

1. Load the United Kingdom, Australia, New Zealand, the UAE and Saudi Arabia × IT services & agency, each on a fresh business. Each has:
   - Local contacts, addresses and phone numbers.
   - Amounts in GBP, AUD, NZD, AED or SAR at local price levels.
   - The country's preset rates.
2. Each Tax Summary has:
   - The standard rate (VAT 20%, GST 10%, GST 15%, VAT 5%, VAT 15%).
   - Untaxed sales for the client abroad (zero-rated, or outside the scope in the UK).
   - Tax paid on bills and expenses.
3. United Kingdom × Construction:
   - Invoice PDFs are titled "VAT invoice".
   - The new-build stage payment is zero-rated.
4. United Kingdom × Trades: mobility aids are at VAT 5%.

## 190. Set up Spine (US-ONB-15, US-ONB-16, Phase 9)

1. As a new Owner, open the user menu and choose "Set up Spine". The page shows:
   - "Done 0 of 13" (1 of 13 if the server has SMTP set up), "To do" and "Not needed 0", and a progress bar.
   - 14 cards in order, from "Business details and logo" to "Field app", each with its line.
   - Backups has no chip, and says "Spine can't check backups yet — whoever runs the server sets them up. Not counted below.".
   - No "How it works" links (they come with the bundled guide in Phase 12).
2. Business details and logo → "Set up":
   - Settings opens on Business profile, over the page.
   - Enter a name and address, save and close. You're back on Set up Spine, the card says "Done" and its button reads "Review".
3. Check the other cards turn Done from real data:
   - Tax: choose a country (India also needs a GSTIN and state).
   - Chart of accounts: add an account or rename one.
   - Opening balances: lock them.
   - Bank and cash accounts: add an account, or rename the bank account.
   - Payment instructions: add bank details or a UPI ID.
   - Documents and emails: save any document or email setting.
   - Numbering: set a starting number.
   - Payment reminders: switch them on.
   - Modules: save Settings › Modules.
   - Invite your team: invite someone.
   - Field app: add a Field user.
4. Bank and cash accounts → "Set up" opens Banking. Opening balances opens Opening balances. Invite your team opens Team › Users.
5. Email sending and Backups → "Read the guide" opens the README's self-hosting section in a new tab.
6. Field app disappears when Jobs & field is switched off.
7. "Mark as not needed" on Payment reminders:
   - The card moves to "Not needed" and the counts change ("of 12").
   - "Show again" brings it back.
8. Load demo data on a fresh business. The page says "Demo data is loaded — these reflect the demo business. Delete it in Settings › Data to set up your own.", and Business, Tax and Modules show Done.
9. Dashboard:
   - With a customer, an item and a sent quote of your own, "Get started" becomes "Finish setting up Spine — <n> left" with "Set up Spine".
   - When every card is done or not needed, the card goes away.
10. As Staff or Field:
    - There's no "Set up Spine" in the user menu.
    - `/setup` shows "Set up Spine is only available to owners."
    - `GET /org/setup-status` answers 403.
11. Regression: Settings still opens from the user menu and from `?settings=<pane>` links.

## 191. The field app: sign in, Profile, errors (US-MOB-01, US-MOB-02, US-MOB-10, US-MOB-19, US-MOB-20, US-MOB-21, Phase 5)

Run the app on an iPhone simulator and an Android emulator (`pnpm --filter @spine/mobile ios` / `android`, a dev build because of `@expo/ui`). Use the API's own address in development (`http://localhost:4000` on the iOS simulator, `http://10.0.2.2:4000` on the Android emulator). Load the demo business and sign in as Marcus Webb (Field).

1. After Welcome (section 197), Sign in shows the Spine logo on its illustration, "Sign in", "Use the email your office invited you with.", Server, Email, Password, "The server address is the link you open Spine with on a computer.", "Sign in", "Forgot password?" and "You stay signed in on this phone until you sign out."
2. Errors sit under their field:
   - A server that isn't Spine (e.g. `example.com`): "Can't reach that server. Check the address — it's the link you open Spine with on a computer." under Server.
   - A wrong password: "That email and password don't match. Check both, or reset your password." under Password.
   - An empty field: a line under that field; nothing is sent.
3. "Forgot password?" opens the web app's reset page in the phone's browser. With no server typed it asks for the server first.
4. Sign in. You land on Today: a large title "Today" (iOS) or "Today" headline (Android), "Good morning, Marcus" and "Riverstone Builders · <date>". Tabs: Today, Jobs, Expenses and Search — on iOS Search is the separate round button beside the glass tab bar; on Android it's a fourth tab with labels on every tab. Expenses says what it will hold (Jobs, Search and the rest of Today are section 192).
5. Scroll Today on iOS: the large title collapses into the bar.
6. Tap the avatar: Profile opens as a sheet (iOS) or a page (Android) with "Marcus Webb", "Field · Riverstone Builders", email, server, Appearance (System, Light, Dark), Sync "All synced", the Field note and "Sign out". Switch Appearance to Dark and back: every screen, the tab bar and the sheet follow it.
7. Kill the app and reopen it: you're on Today without signing in. Turn the phone's dark mode on: the app follows it (Appearance on System).
8. Sign out: you're back on Sign in with the server and email filled in; the session no longer works on the server.
9. As the Owner on the web, deactivate Marcus. In the app, pull Today down to refresh: you're signed out to Sign in with "Your access to Riverstone Builders was removed." Reactivate him and sign in again.
10. Stop the API with the app open and pull Today down: "Couldn't load your jobs", "The Spine server didn't answer. You're online, so it may be restarting — try again in a minute." and "Try again" — no saved-jobs link yet. Start the API and tap "Try again".
11. Turn on airplane mode and pull Today down: "You're offline" — not "Couldn't load".
12. Restart the API with `MOBILE_MIN_VERSION=99.0.0` and pull Today down: "Update Spine to keep going", "Your company's Spine server needs a newer version of this app. It only takes a minute." and "Open App Store" / "Open Google Play". Restart without it; reopen the app.
13. Android: the system back gesture closes Profile like the back arrow; TalkBack reads "Profile, Marcus Webb" on the avatar and a label on every control.
14. Regression (API, US-TEAM-04): a deactivated member's existing session — web cookie or phone token — gets 403 "Your access to <Business> was removed." from every API route. Other members are unaffected, and reactivating restores access.
15. Android colours (US-MOB-20): Sign in is Spine blue and Sign out Spine red (not a muted purple or brown); the selected Appearance segment reads clearly in light and dark.
16. Regression (component docs, US-MOB-21): `pnpm --filter @spine/ui-native test` passes its doc-screen and a11y coverage checks; the showcase app's Components list has Scroll Edge Mask, and Floating Label Field shows the sign-in (email and password) example.

## 192. The field app: Today, Jobs, a job, Search and Notifications (US-JOB-16, US-MOB-03 to US-MOB-06, US-MOB-19, US-MOB-22, US-MOB-23, Phase 5)

Same setup as section 191: load a demo business (any country; its first job has a milestone due this week and Marcus Webb is on every demo job's crew) and sign in as Marcus on the iPhone simulator and the Android emulator. Money and dates follow the business's currency and locale.

1. Today: the header has "All synced" (left on iOS, before the bell on Android), the bell and the avatar. The welcome card shows "Good morning, Marcus", "<Business> · <weekday, date>" and the gauge "Milestones this month" with "<n> of <n> done".
2. Switch "This week" / "This month" / "This year": the gauge label and its count, and the KPI cards ("Due this week/month/year", "Overdue", "Photos", "My expenses") change with it. Swipe the cards sideways. The only money on Today is "My expenses" — Marcus's own.
3. Quick actions: Add photo, Log expense, Scan receipt and Directions. Directions opens the maps app at the first of today's sites. The other three say they arrive in the next update (US-MOB-11, US-MOB-13).
4. "YOUR JOBS TODAY · <n>" (iOS) / "Your jobs today · <n>" (Android) lists only Active jobs with a milestone overdue or due in the next 7 days: name, customer, site address, the due chip ("Due Sat", "Due tomorrow", or "<n> days late" in red) and "Next: <milestone>". On the web, move that milestone's due date three weeks out and pull Today down: the card goes (the job is still on the Jobs tab). Put it back.
5. On a job card, "Call <name>" (iOS: full name; Android: first name) opens the dialler with the contact's number; "Directions" opens the maps app at the site. Tapping the card opens the job in the Jobs tab, and back returns to the Jobs list.
6. "NEXT MEETING": as the Owner on the web, create a meeting in the next 7 days and invite Marcus. Pull Today down: it shows with its day, time and place, and opens the meeting. Decline it as Marcus on the web (or remove him): it goes. Switch Leads & meetings off in Settings › Modules: no meeting section. Switch it back on.
7. Jobs tab: "ASSIGNED TO YOU · <n>" (Android: "Assigned to you · <n>") with each job's name, "<customer> · <town>" and a chip ("Milestone due …", "Milestone <n> days late" or "All milestones complete"), and "Only jobs your office has put you on the crew for. Pull down to refresh." There's no search field. Pull down: it refreshes.
8. US-JOB-16: as the Owner, take Marcus off one job's crew (Job › Crew). Pull Jobs down: the job is gone, and opening it from an old notification says "This job isn't on your list". Take him off every crew: "No jobs assigned to you yet", "When your office adds you to a job's crew, it shows up here with its address and contact." and "Check again". Put him back on and tap "Check again".
9. Open a job: status ("Active"), the name, "<job number> · <customer>", the site address with "Directions", the contact (name, title) with the green call button, "MILESTONES" (each pending one with "Due <day date>" and "Mark complete" — the first filled; completed ones "Completed <date>"), "PHOTOS · <n>" with four thumbnails ("+<n>" on the last when there are more) and "See all", and "QUOTES TO PRESENT" (a sent variation-order quote: "<number> · <first line>", "Sent <date> · waiting for the customer", "Present"). No contract value, milestone amount or invoice anywhere. "Add photos" is the camera in the toolbar on iOS and a floating button on Android. Mark complete, Present and Add photos say they arrive in the next update.
10. "See all" opens "Photos · <n>" with "<job> · <number>", photos grouped by day ("Today", "Mon, Oct 5"…) newest first, three to a row.
11. Search (iOS: the round search button; Android: the fourth tab): with nothing typed, "Search jobs and expenses" and "Find a job by name, customer or address, or one of your expenses by category or description." Type a job's street: "JOBS · 1" with the match highlighted. Type an expense category Marcus used: "YOUR EXPENSES · <n>" with amount and status. A group with no matches isn't shown. Type "zebra": "No results for “zebra”" and "Search covers the jobs you're on and your own expenses. Try a customer name, a street or an expense category."
12. Tap a job result: it opens in the Jobs tab. Back on Search, clear the field: the search is under "Recent searches" (newest first, up to 10). iOS: "Edit" then the red minus removes one. Android: "Clear" removes them all.
13. Turn airplane mode on and search again: results still come (from the phone). Turn it off.
14. Notifications: the bell shows the unread count ("9+" above nine). As the Owner on the web, reject an expense Marcus submitted with a reason, approve another, and add Marcus to a crew and take him off another. Bring the app to the front: the bell's count goes up. Tap the bell: "NEW" and "EARLIER" (Android: "New", "Earlier"), each with its icon, message, detail line and time — "<Owner> rejected your expense" with "<category> · <amount> · “<reason>”", "<Owner> approved your expense", "You're on the crew for <job>" with "Added by <Owner> · <address>", "You're off the crew for <job>". Unread ones have a blue dot (iOS) or a tinted row (Android).
15. Tap the rejection: it opens the expense with its amount, "Rejected" and the reason, and the notification is read. Tap the crew one: the job opens. Tap "Read all": every dot goes and the bell has no count. With none at all: "You're all caught up" and "Expense decisions, crew changes and meeting invitations show up here."
16. Jobs & field off (as the Owner, after changing Marcus to Staff): the Jobs tab, job cards, the job KPIs and the Add photo and Directions tiles are hidden, and Search finds only expenses. Switch it back on and change Marcus back to Field.
17. Dark mode (US-MOB-19, US-MOB-20): Today and a job follow the phone's dark mode — iOS grouped background near-black, cards a shade lighter, Spine blue with dark text on filled buttons ("Mark complete"); Android the Material dark roles. Text stays readable on every chip and card.
18. Regression (web): the Owner still gets "Expense approved — <category>, <amount>" in the bell when someone else's expense is approved; the person who submitted it gets "<name> approved your expense" instead. Job › Crew still adds and removes people.
19. Regression (demo data): loading a demo business reports `crewAssignmentsCreated` and the demo's first job shows on the web dashboard's "Today" with its milestone due this week.
20. Loading (D-201): sign out and in again (the phone's copy is cleared), then slow the network (Network Link Conditioner on the simulator's Mac, or the emulator's "Network › Poor" profile). Today shows grey blocks in the shape of the gauge, the KPI cards, the job cards and the meeting, while the heading and quick actions are already there; nothing jumps when the data arrives. Switch to "This week": only the gauge and cards turn to blocks — the month's numbers don't linger — and switching back to "This month" shows it at once. Jobs, a job (heading, milestones, photos, quotes), Photos, Notifications, Search (typed before anything loaded), an expense and a meeting each show their own blocks, never "No jobs…", "You're all caught up" or "No results" while loading. With Reduce Motion on, the blocks don't pulse. VoiceOver/TalkBack reads "Loading jobs" (and so on) once per section. There's no full-page spinner anywhere; pull to refresh keeps the content and shows the system spinner.

## 193. The field app: offline, Sync and Fix (US-MOB-07, US-MOB-08, US-MOB-09, Phase 5)

Same setup as section 191. Until Group 4 lands (taking photos, new expenses, Mark complete), nothing in the app puts items in the outbox; steps 5–11 need a build with Group 4, and the automated tests (`apps/mobile/src/__tests__/us-mob-07`, `08`, `09`) cover them meanwhile.

1. Today with a connection: the pill reads "All synced". Tap it: Sync opens (a sheet with Close on iOS, a page with the back arrow on Android) with "All synced" and "Everything has reached your office." Profile's Sync row opens it too.
2. Open a job, then turn on airplane mode (Android: `e2e/us-mob-07-offline.yaml` does steps 2–4). Today shows "You're offline" and "Photos, expenses and milestone updates are saved on this phone and sync when you're back online. Showing jobs as of <time>." with the time the jobs were last fetched; the saved jobs, figures and meeting are still there.
3. Still offline, open the job you saw before: its details, contact, milestones, photos and quotes load from the phone. A job never opened shows its name from the list and skeletons for the rest.
4. Turn airplane mode off: the banner goes by itself and the screens refresh.
5. Offline, add two photos to a job, log an expense and mark a milestone complete. The pill reads "3 waiting to sync" in amber; the job's card on Today shows "2 photos waiting" (and "Completion waiting" on the other); on the job the milestone shows "Completion waiting" and the photos show "Waiting". Sync shows "3 items waiting", "You're offline · sends automatically when you reconnect" and WAITING with each item, its job and time.
6. Sign out while they wait: the warning says "<n> site photos and <n> expense are still waiting to sync. Signing out deletes them from this phone."; "Send them first" opens Sync.
7. Back online: they send by themselves (no button needed) and move to SENT TODAY; the pill says "All synced"; on the web the photos, expense and completion are there once each.
8. Exactly once: offline, add a photo; turn the connection on and off quickly while it sends, a few times. On the web the job has that photo once. (The API test us-mob-09 replays every step with the same key.)
9. Needing fixing: log an expense with a receipt over 10 MB (a large photo from the library on a test phone with compression turned off, or the API test). Sync shows NEEDS FIXING · 1 with "Expense · <category> · <amount>" and "Didn't send: the receipt photo is over 10 MB" in red, and "Fix".
10. Fix: the reason in red, Category, Amount, Job, Date, the receipt with "<size> · over the 10 MB limit", "Retake photo", "Choose a different photo", "Remove photo", "Send again" and "Delete this expense" (Android: the bin at the top, with a note). Retake or choose a photo (allow the camera or photos when asked; refusing offers Settings), then "Send again": it sends. "Delete this expense" asks first and removes it from the phone.
11. Someone else first: queue a completion offline; as the Owner on the web complete the same milestone; reconnect. Sync shows it under SENT TODAY as "Milestone completed · Already completed by <Owner>"; the milestone keeps the Owner's completion, and the phone's photos are on the job.
12. Network trouble isn't a failure: stop the API with items waiting. They stay "Waiting" (not red), and Sync says "Couldn't reach your Spine server · tries again automatically"; start it and they send within a few minutes, or at once with "Try sending now".
13. Update required: restart the API with `MOBILE_MIN_VERSION=99.0.0` with items waiting: "Update Spine to keep going" says "<n> items waiting to send are kept on this phone and sent after you update." Restart without it: they send.
14. Regression (web): completing a milestone twice from the web (two tabs) now succeeds quietly the second time instead of "Only a pending milestone can be marked complete"; the milestone keeps the first completion.

## 194. The field app: photos, expenses and Mark complete (US-MOB-11 to US-MOB-15, Phase 5)

Same setup as section 191. Use a real phone or the Android emulator for the camera (the iOS Simulator has none; on the emulator the saved picture is the emulator's own test frame). `e2e/us-mob-11-photos.yaml` (Android) and `e2e/us-mob-13-expense.yaml` (both) cover steps 2–5 and 8–9.

1. Camera explainer (US-MOB-14): on a fresh install, tap "Add photos" on a job. Before any system prompt: "Allow camera access", "Spine uses the camera for site photos and receipt pictures. Photos go only to your company's Spine server — never anywhere else.", the three reasons, "Continue", "Not now" and where to turn it on (iOS "Settings › Spine › Camera"; Android "Settings › Apps › Spine › Permissions"). "Not now" goes back to the job. "Continue" then the system prompt: allow, and the camera opens. Refuse it on another install: "Continue" becomes "Open Settings" and opens them.
2. Camera (US-MOB-11): the job's name is at the top with a chevron (tap to choose another of your jobs), flash on/off, the shutter and "Done". Take two: "2 taken · saved on this phone" and the latest thumbnail with "2". Close with photos taken: "Discard 2 photos?" — "Keep taking" or "Discard".
3. "Done": "2 photos", each photo large with the strip below ("+" takes more), "Caption" per photo, "Job" and "Milestone (optional)", the note about uploading in the background, and "Save 2 photos" (iOS, bottom) / "Save" (Android, top). iOS "Retake" drops the photo shown and goes back to the camera. Android: three outlined fields with their labels on the outline — "Caption" (hint "What does this photo show?"), "Job" ▾, "Milestone (optional)" ▾ — no white card; the caption's outline turns blue and thicker while typing, without the text moving. Check light and dark.
4. Save: you're back on the job; "PHOTOS · <n>" counts them, marked "Waiting" until sent; the pill on Today shows them, then "All synced". On the web, the job's Photos tab has them with the caption, and under the milestone when one was chosen.
5. Offline (airplane mode): steps 2–4 work the same; they send when you're back online (section 193).
6. Today's "Add photo" opens the camera on today's first job; "Directions" still opens maps.
7. Expenses tab (US-MOB-12): "WAITING TO SYNC" (expenses still on the phone; a refused one shows "Didn't send: …" in red and opens Fix) and "SUBMITTED BY YOU" with the category icon, category, date, job, amount and "Submitted" (blue), "Approved" (green) or "Rejected" (red). A rejection shows the reason in red with "— <reviewer>" (Android: "Rejected · <reason>"). "+" beside the avatar (iOS) / the floating "Log expense" (Android) opens New expense. With no expenses: "No expenses yet". Only your own are ever listed.
8. New expense (US-MOB-13): "Amount" / "Headcount × day rate"; "Amount (<currency>)", "Category", "Job" (with "No job"; hidden when Jobs & field is off), "Date", "PAID BY" "Me — pay me back" / "Company", "Description", "RECEIPT" ("Take a photo" / "Choose a photo") and "Your office approves it before it's paid back. No signal? It's saved and sent later." "Submit" with nothing filled in: "Choose a category." and "Enter an amount above zero." under their fields. Android: outlined fields (labels on the outline) — the amount with the currency symbol, "Category" ▾, "Job" ▾, "Date" with a calendar icon (tap: the date dialog), "Description"; the two errors turn those outlines red with the message underneath. Check light and dark.
9. Fill it in with a receipt (the receipt camera shows a frame, "Fit the whole receipt inside the frame", flash and a gallery button) and Submit: it shows under WAITING TO SYNC, then moves to SUBMITTED BY YOU once sent, with the receipt attached on the web. A receipt over 10 MB (a large photo from the library on a test build with compression off) says "This photo is over 10 MB. Retake it closer, or choose a smaller one." and isn't queued.
10. "Headcount × day rate" (D-199): the category posting to 5200 Direct Labour is preselected; "TRADES" rows of Trade, Workers and Day rate with each row's total, "Add trade", "Total for the day" and "Labour is always for a job. Only trades, headcounts and day rates — no names or hours." Typing a trade you've used before suggests it with its last day rate (only your own — another person's trades never appear). Submit without a job: "Labour is always for a job — choose one."; with an incomplete row: "Every row needs a trade, at least one worker and a day rate." On the web the expense shows the rows and the total.
11. Today's "Log expense" opens New expense; "Scan receipt" opens it with the receipt camera already up.
12. Fix → "Edit expense" (US-MOB-09): a refused expense opens in the same form ("Fix expense", "Send"); change it and send: it goes again.
13. Mark complete (US-MOB-15): on a job, "Mark complete" opens a sheet with the milestone, "<job> · due <date>", "PHOTOS OF THE FINISHED WORK" (with "Add", opening the camera), "NOTE FOR THE OFFICE (OPTIONAL)", "Your office is told straight away so they can bill this stage. No signal? It's saved and sent when you're back online." and "Mark complete" (Android: "Mark complete?", with "Cancel" and "Mark complete" at the bottom, and the note as an outlined field labelled "Note for the office (optional)", its text starting at the top; tapping anywhere in it focuses it). Complete it: the milestone shows "Completion waiting", then "Completed"; on the web it's completed with the note and photos, and the office got one "Milestone completed" notification.
14. Two phones complete the same milestone offline, then both reconnect: it's completed once (the first); the other's Sync shows "Milestone completed · Already completed by <name>".
15. Regression (web, US-PUR-23): an Owner's labour expense still suggests every trade used in the business; a Field user's phone suggests only their own.

## 195. The field app: present a quote, accept with a signature or decline (US-QUO-19, US-QUO-20, US-MOB-16 to US-MOB-18, Phase 5)

Same setup as section 191. You need a sent quote that is a variation order on (or the source quote of) a job the phone's user is on. As an Owner, send a quote for the job's customer and add it as a variation order on the job.

1. On the job, "QUOTES TO PRESENT" lists it with "Present". Tap it (US-MOB-16):
   - The quote opens full-screen with "Hand the phone to your customer" (iOS beside "Done"; Android under the ✕ and the number).
   - It shows the business and address, "QUOTE <number>" (iOS), "Prepared for <customer>", "Valid until <date>", each line with "<qty> × <price>" and its amount, Subtotal, each tax by name, Total and NOTES.
   - In India the taxes are "CGST (9%)" and "SGST (9%)". Elsewhere they're the rates' names, e.g. "Sales Tax (15%)". The figures match the quote's PDF.
   - "Decline" and "Accept quote" are at the bottom.
2. "Decline": a sheet titled "Decline quote" says "<customer> is declining <number> for <total>. <Business>'s office is told straight away.", with "Reason (optional)" ("For example, the price or the timing"), a red "Decline quote" and "Cancel". Android uses an outlined reason field, with Cancel beside the button. "Cancel" goes back to the quote.
3. "Accept quote" (US-MOB-17):
   - The screen shows "Accept <number>", the customer and total, "Your name", "Sign below" with "Clear", and "By signing, I accept this quote for <total> on behalf of <customer>. Spine records your signature, the time and the <Business> staff member present (<your name>)."
   - "Accept and sign" is off: "Type the customer's name to continue.", then "Sign in the box to continue." once a name is typed.
   - Sign with a finger from left to right: the stroke draws and the screen doesn't go back. "Clear" empties the box.
4. Type a name, sign, "Accept and sign":
   - The phone shows "Quote accepted", "<number> · <total>", "Signed by <name> at <time>. <Business>'s office has been told and the quote is now locked." and Customer, "Witnessed by <you>", "Method: In person, on this phone".
   - "Back to job" (or Android's back) returns to the job, and the quote is no longer under QUOTES TO PRESENT.
   - On the web, Owners and Staff got "Quote <number> was accepted in person." A variation order also says to apply it to the job.
5. On the web, open that quote (US-QUO-20):
   - It shows "Accepted on site", "Signed by <name> on <date> at <time>, witnessed by <name>", the signature, and "View signature full size", which opens the image.
   - "More" › "View history" reads "<you> recorded the customer's acceptance of this quote on site, signed by <name>".
   - A quote accepted through the emailed link instead says "Accepted online by the customer on <date>", and its history reads "The customer accepted this quote online".
6. Present another quote, "Decline", give a reason, "Decline quote": you're back on the job without it. The web quote shows "Declined on site", who recorded it and the reason, and the office got "Quote <number> was declined in person."
7. Offline (US-MOB-18), with airplane mode on:
   - iOS: "Present" shows "Quotes need a connection", "Accepting a quote locks the price, so it has to reach your office straight away. Move somewhere with signal or Wi-Fi, then try again.", "Photos, expenses and milestone updates still work offline.", "Try again" and "Back to job". Turn the connection back on and "Try again" opens the quote.
   - Android: the same words in an alert over the job, with "Back to job" and "Try again".
   - With the quote already open, going offline makes the decline sheet say "Needs a connection — declining can't be saved offline." and its button stays off.
8. Security: a Field user can't open, accept or decline a quote on a job they aren't on (404), and can't open the signature file (404). Staff and Owners can.
9. Regression: Mark complete, Add photos and the job's photos still work from the same job screen (section 194). The web quote page for a draft or sent quote shows no acceptance panel.

## 196. The field app on Android follows Material 3 (US-MOB-20, Phase 5)

On an Android phone, compare each screen with its `Mob…Android` artboard in `docs/design/screens/`, in light and then dark mode (Today and a job against `MobHomeAndroidDark` and `MobJobDetailAndroidDark`).

1. Today: the sync pill top left, the bell and avatar top right, and a large "Today" below. Scroll: "Today" moves into the bar with the pill beside the bell, and the bar turns grey. The welcome card and job cards are grey-filled with no border. Tonal pills ("Call …") and the tab bar's selected pill are pale blue (deep blue in dark mode).
2. A job: the site and contact sit in an outlined card. Milestones and quotes are plain lists. The other milestones' "Mark complete" is tonal. "Add photos" floats bottom right. The photos show (not blank). "+n" over the last tile is dark with light text in both themes.
3. Profile: the avatar beside the name. Then Email and Server rows with icons, and the sync row with "Last sent <time>" once something has been sent. Then "Appearance", the Field note, an outlined red "Sign out" with an icon, and the version.
4. Search: a rounded search bar with the avatar inside. Tap it: it becomes a full-width bar with ← and, once you type, ✕. ← (or the back gesture) leaves the search. With recent searches: "Recent searches" in blue with "Clear". No results: the icon sits in a grey rounded square.
5. Every outlined field (Sign in, New expense, photo review, Mark complete's note, a quote's name and reason) matches its artboard:
   - 56 dp tall, a mid-grey outline (blue and thicker while typing, red on error), corners barely rounded.
   - The label sits in the outline's top edge. Dropdowns end in a small ▾.
   - A date reads "8 Oct 2026" (or "Oct 8, 2026" by the phone's locale).
   - Segmented buttons have the same grey outline and semibold labels.
   Sign in: outlined Server, Email and Password fields. The server hint is under the Server field. A wrong server shows the field in red with an error icon and the message under it. The eye shows and hides the password.
6. New expense: outlined fields, muted "Paid by" and "Receipt" labels, the receipt buttons without a card. "Headcount × day rate":
   - The trade being edited is an outlined card (Trade, Workers, Day rate with the currency).
   - "Add trade" folds it to one line ("Mason / 4 × $220.00   $880.00"). Tap that line to edit it again.
   - "Total for the day" has no card.
7. Receipt camera: ✕ top left with "Receipt" beside it.
8. Back gesture:
   - On the camera with photos taken: "Discard <n> photos?".
   - On New expense with a receipt taken, or Mark complete with photos: it closes and the photos aren't left waiting on the phone.
   - On Quote accepted: back to the job.
   - Elsewhere it does what the drawn back arrow does.
9. TalkBack: swipe through Today, a job, Expenses, New expense, Search, Profile, Sync, Notifications, Mark complete, the camera and a presented quote. Every control is read with a name (no "unlabelled button").
10. Regression (iOS): Today, Profile, Search, Sign in and New expense look as before (sections 191–195).

## 197. The field app: icon, splash, Welcome and the new Sign in (US-MOB-01, US-MOB-24 to US-MOB-27, Phase 5)

The phone carries the new Spine logo (D-203); the web keeps its own until its rebrand (Q-25). Icons and the splash need a fresh dev build (`npx expo prebuild --clean`, then `pnpm --filter @spine/mobile ios` / `android`). To see Welcome again, delete the app from the device and install it again. Compare against the canvases "10 Brand and app icon", "11 Splash and Welcome" and "12 Sign in" and the `MobSplash*`, `MobWelcome*` and `MobSignIn*` artboards.

1. **App icon (US-MOB-24):**
   - iPhone home screen: the layered mark on the teal-to-blue gradient, corners rounded by iOS, labelled "Spine".
   - Long-press the home screen › Edit › Customize › Dark: the mark on iOS's dark backdrop. Tinted: a one-colour silhouette in the chosen tint.
   - Android launcher: the same art. Change the launcher's icon shape (circle, squircle, rounded square, teardrop) where the launcher allows: the mark is never clipped.
   - Android 13+: turn on Themed icons in Wallpaper & style: a one-colour silhouette in the phone's colours.
2. **Splash (US-MOB-25):** cold-start the app in light mode, then dark mode.
   - Each time: the gradient mark, about 96 dp, centred on `#F7F6F3` (light) or `#121110` (dark). No wordmark, no spinner, no white flash.
   - Android 12+: only the system splash, no second one after it.
   - In airplane mode, the splash still hides as soon as the first screen is ready; it never waits on the network.
3. **Welcome (US-MOB-26),** on a fresh install:
   - The mark rises out of the splash from the same spot, its layers breathe apart and settle, and five cards slide out from behind it: today's job, "3 photos saved", a fuel receipt, a signed quote with its signature drawing itself, and "Foundations · Completed".
   - "Today’s jobs, in your pocket", the sentence and "Get started" fade up. Everything is still within about 1.5 s, then the cards float gently.
   - Tap "Get started" while it's still animating: it works at once and opens Sign in.
   - Kill and reopen the app: Sign in, not Welcome. Sign in, sign out, reopen: still no Welcome.
4. Welcome, continued:
   - Reduce Motion (iOS Settings › Accessibility › Motion) or Remove animations (Android › Accessibility): Welcome appears in its final state and nothing moves. Reinstall to see it.
   - VoiceOver / TalkBack: the illustration is skipped. You hear "Today’s jobs, in your pocket", heading; the sentence; "Get started", button; and the footer.
   - Android back on Welcome closes the app.
   - Dark mode: the brand colours stay; the cards are dark with a hairline border.
   - Largest text size: the illustration shrinks first, the words scroll, and "Get started" stays reachable.
5. **Already signed in:** install this build over an older one while signed in. You land on Today; after signing out you see Sign in, never Welcome.
6. **Sign in (US-MOB-01):**
   - The vertical logo (mark over SPiNE) sits on the illustration — glow, dashed orbits, three faded cards — fading into the page, then "Sign in".
   - Only the orbits drift and the sparkles twinkle, slowly; nothing moves with Reduce Motion.
   - VoiceOver reads the logo as "Spine" and skips the rest of the illustration.
   - Dark mode: the wordmark turns light.
7. Sign in, continued:
   - Tap Email: the illustration folds to the horizontal logo, and Server, Email, Password and "Sign in" stay above the keyboard on a small phone (iPhone SE, small Android). Dismiss the keyboard: the illustration returns.
   - A wrong password: "That email and password don't match. Check both, or reset your password." What you typed stays.
8. **Logo and brand colours (US-MOB-27):**
   - The showcase app (`apps/showcase-native`) has a "Spine Logo" demo (mark, horizontal, vertical, minimum sizes). *(Its Brand swatches page went with `apps/design-system-native`, D-240.)*
   - `pnpm --filter @spine/ui-native test` passes its doc-screen and a11y coverage checks.
9. Regression:
   - The web app, the docs site and the web design system still show the "S" logo.
   - Section 191: sign in, errors under their fields, Forgot password, Profile, sign out.
   - Section 196: Android screens keep Material 3 (outlined fields, pill buttons).

## 198. The Spine logo across the web app (US-SET-26, refinements before Phase 10)

Run the web app (`pnpm dev`) in Chrome and Safari, light and dark (the theme toggle and the system setting). Compare against the canvas "01 Spine logo on the web" and the `Brand*` artboards.

1. **Sign-in pages:** log out. Login, sign-up, forgot password, reset password, invite-only and an invitation link each show the horizontal logo (mark beside SPiNE) above the card. Switch to dark: the wordmark is light text straight away, with no flash of the blue one after the page loads.
2. **Sidebar:** sign in. The sidebar header shows the horizontal logo. Collapse it: only the gradient mark shows, centred. Hover it: it turns into the expand icon and expands the sidebar on click. Tab to it with the keyboard: the expand icon shows and a screen reader says "Expand sidebar".
3. **Theme:** as an Owner, pick Plum in Settings › Branding. The selected item and buttons turn plum; the SPiNE wordmark stays Spine blue (light) or light text (dark). Switch back to Spine Blue.
4. **Browser tab:** the tab and a bookmark show the app-icon tile (white mark on the teal-to-blue square), readable at the tab's size, in light and dark browser chrome. `/favicon.ico` and `/icon.svg` open while signed out.
5. **Home screen:** on an iPhone, Share › Add to Home Screen shows the iOS app-icon art. On Android Chrome, Add to Home screen shows the round icon (from the manifest's maskable icon). Opening it opens the normal website, with no install prompt. The browser bar is the page colour in light and dark mode.
6. **Push:** turn on browser notifications and trigger one (for example accept a quote from its public link). The notification shows the square app icon; on Android, the status bar shows the one-colour badge.
7. **Public quote page:** open a quote's public link. The footer shows the small mark before "Sent with Spine"; a screen reader says "Sent with Spine" once. The rest of the page is the business's own branding, unchanged.
8. **Unchanged:** a quote or invoice email and PDF still carry the business's logo and name, not Spine's.
9. **Design system:** `pnpm --filter @spine/design-system dev` has a SpineLogo page (horizontal, vertical, mark, minimum sizes), Brand swatches on Color, and the Sidebar, AppShell and Templates demos use the new logo.
10. Regression: section 191 (field app sign-in) still shows the phone's own logo; Settings › Branding's theme swatches still change only the accent colour (US-SET-09).

## 199. Welcome, login and passwords (US-AUTH-13 to US-AUTH-15, refinements before Phase 10)

Use a 1280 px-wide window in Chrome and Safari, light and dark. Compare against the canvas "02 Welcome, login and sign-up" and the `Auth*` artboards.

1. **Welcome (US-AUTH-13),** on a brand-new install with an empty database (`pnpm db:reset:dev`, no seed):
   - `/` and `/login` open `/welcome`.
   - It shows the logo, "Run your business on Spine", the three next steps and **Create your account**, which goes to `/signup`.
   - The illustration plays: three people (a tradesperson pointing up, the owner and a customer; two men, one woman) rise onto the ground in soft mint, sky and periwinkle, then the cards come in: the quote turns Accepted, the invoice turns Paid, a payment shows Paid. After about 3 seconds it settles and the cards drift gently.
   - The cards show only icons, grey placeholder lines and statuses — no names, document numbers or amounts.
   - In dark mode the people keep their light colours (ink on paper) and the cards turn dark.
   - At 1024, 1440 and 1920 px wide the people and cards stay together in the middle of the panel; nothing overlaps a face.
   - With Reduce Motion on, everything shows already settled and nothing moves.
   - A screen reader reads the heading, steps and button and skips the illustration.
2. Welcome, continued:
   - Create the first account. `/welcome` now goes to `/login` when signed out, and to the dashboard when signed in.
   - Below 1024 px wide the illustration disappears and the content is centred.
3. **Login (US-AUTH-14):**
   - The illustration shows one man with a coffee beside today's jobs (placeholder rows) and a quote marked Accepted — no names or amounts.
   - Email is focused. The eye shows and hides the password, and its label says "Show password" / "Hide password".
   - With Caps Lock on, typing in Password shows "Caps Lock is on.".
   - A wrong password: "That email and password don't match. Check both, or reset your password.", and Email keeps what you typed.
   - Many wrong tries: "Too many sign-in attempts. Wait a minute, then try again.".
   - While logging in the button reads "Logging in…".
4. **The same frame everywhere:** forgot password, "Check your email", reset password (including an expired link), invite-only (`/signup` on an install with an owner), an invitation link (`/accept-invite/<id>`, signed out and signed in) and "This invitation can't be used". All look like login: logo, form, illustration.
5. **Sign-up passwords (US-AUTH-15):**
   - The fields are Name, Email, Password and Confirm password, with an eye on both password fields.
   - Typing `riverstone8` shows Fair, with "At least 8 characters", "Not a common password" and "No repeats or sequences" ticked. `Deck&Pergola-2026` shows Strong with all five ticked.
   - A screen reader hears "Password strength: …".
6. Sign-up refusals:
   - `short`: "Use at least 8 characters.", and nothing is sent.
   - `Password123`: "That password is too common. Choose another one.".
   - Confirm password different: "The passwords don't match." when you leave the field.
   - A valid account goes to onboarding. While it works, the button reads "Creating your account…".
7. **Invitation sign-up:** from an invitation link, "Create account". The heading reads "Join <Business> on Spine" and "You've been invited as <Role>.", and the email is locked.
8. **Reset and Profile:** reset password and Profile › Password show the same meter and checklist. `qwerty123` is refused with "That password is too common. Choose another one." (the server refuses it too). Profile now asks to confirm the new password.
9. Regression:
   - Forgot-password emails, the 60-second resend wait and single-use reset links still work (sections on US-AUTH-09 and US-AUTH-10).
   - Invitations still accept and decline.
   - Session-expired login from the dialog still returns you to your page (US-AUTH-12).
   - The field app's sign-in is unchanged.

## 200. Onboarding in four stages (US-ONB-22, US-ONB-23, refinements before Phase 10)

Sign up a new owner (an install with open sign-up, or a fresh one). Use a 1440 px-wide window, light and dark, and compare with the canvas "03 Onboarding" and the `Onb*` artboards.

1. **Start (US-ONB-22):**
   - `/onboarding` shows "Welcome to Spine, <first name>", "Four short stages, about 6 minutes…", the four stages with a line each, and the three buttons.
   - Beside it: the dashboard, a paid invoice and the phone app drawn with grey lines (no names or amounts), and two people.
   - "Just show me around (use defaults)" still opens the demo business dialog, and "Skip to dashboard" still skips.
2. **The rail and tips:**
   - "Set up my business" shows the rail: Business (Details, Template), Money (Currency, Financial year, Tax), Documents (Numbering) and Books & team (Accounts, Team), with "About 6 min left" and a progress line.
   - Each Continue ticks the step and the minutes count down (5 at Currency, 1 at Team).
   - Every step has "Stage n of 4 · <stage> · Step n of n" above it and a tip under it ending "Change it later in Settings › …".
   - From the second step on, **Back** opens the previous step with what was saved.
3. **The preview (1280 px and wider):**
   - Typing the business name, address and logo shows them on the invoice before Continue; with no name it says "Your business".
   - Currency INR and locale en-IN show "₹1,25,000.00" and the date in Indian format.
   - Tax: India shows "CGST 9% + SGST 9%" and "₹22,500.00"; the UK shows "VAT 20%"; "Another country" shows the rate you type.
   - Numbering: an invoice starting number of 1042 shows "INV-1042".
   - Accounts and Team: the preview turns to "Your books" (accounts per group), "Your team" (you, then each invite as "Invited") and "Set so far".
4. **Narrow and short windows:**
   - At 1100 px the preview is gone; below 1024 px the rail becomes the bar at the top with the stage and minutes left.
   - In a short window (a laptop, 700 px tall), the wheel or trackpad scrolls each step down to Continue while the rail and preview stay put. Sign-up, login and the finish screen scroll the same way.
   - A long business name ("H2Z Facades and Interiors Factory Private Limited") wraps in the preview; the invoice number stays inside the card.
5. **Screen reader and motion:**
   - VoiceOver reads "Stage 2 of 4 · Money · Step 1 of 3", the heading, the form and the tip. The rail is "Setup steps", with the current step marked and "(done)" after done steps. The preview and the drawn screens are skipped.
   - With Reduce Motion, nothing slides or rises.
6. **Finish (US-ONB-23):**
   - On Team, "Finish" (or "Skip — finish setup") shows "You're set up" and "Spine is ready for <business>.".
   - The summary shows Business, Money ("INR · India (GST)"), Documents ("First invoice INV-1042") and Team ("1 invite sent" or "Just you for now").
   - Change opens the matching Settings pane over the screen; Team's Change opens Team › Users.
   - The three cards open New contact, the Catalogue and New quote; "See what's left to set up — <n> left" opens Set up Spine.
   - "Go to dashboard" leaves. Refreshing the finish screen, or opening `/onboarding` again, goes to the dashboard.
7. Regression:
   - Skipping from any step, or loading a demo business, still goes straight to the dashboard (US-ONB-02, US-ONB-18).
   - The template, tax (with GST details for India), numbering and accounts steps save as before (US-ONB-04 to US-ONB-07, US-ONB-14, US-ONB-20, US-TAX-09, US-TAX-12).
   - Documents are numbered as before (`INV-0001`, demo `DEMO-INV-0001`).

## 201. Dashboard polish (US-DASH-27 to US-DASH-29, refinements before Phase 10)

Use an owner on a business with Indian figures (Settings › Demo data, India, Construction). Check 1440 px, 1280 px and 1024 px wide, light and dark, and compare with the canvas "04 Dashboard polish" and the `Dashboard*` artboards.

1. **Loading (US-DASH-27):**
   - With a slow connection (DevTools › Network › Slow 4G), the dashboard first shows its shape in grey: Needs your attention, Today, four KPI cards and grey cards. No spinners anywhere.
   - Then each card shows its title and a grey outline of its content until its figures arrive. Nothing appears later and pushes cards down.
   - Money is in rupees from the start; "$" never shows first.
   - VoiceOver says "Loading dashboard" once. With Reduce Motion, the grey blocks don't pulse.
2. **KPI cards and big figures (US-DASH-28):**
   - Each KPI card has an icon in a coloured chip and a light tint: Cash position blue, Profit this month teal, Receivables purple, Overdue red. Text is easy to read on the tint, in light and dark.
   - At 1280 px every figure ("₹90,87,504.00", "₹44,88,682.00") shows whole on one line, with the trend line underneath across the card.
   - Payables and Tax this period show their three figures one above the other, each with its label; nothing overlaps.
   - Receivables aging shows "₹44.9L" in the ring and "Total ₹44,88,682.00" under the title; in a narrow card the legend sits under the ring.
   - Job profitability shows "−₹1,60,500.00" on one line; a long job name is cut short with "…" and shows in full on hover.
3. **Layout (US-DASH-29):**
   - At 1440 px and wider: Needs your attention, Today and Recent activity are in a column on the right. Scrolling the page keeps that column in view (on a short window where it doesn't fit, it scrolls with the page).
   - Income and expenses sits right after the KPI cards, across the main area. Every other card sits directly under the card above it: no stretched cards and no empty gaps between cards; columns only end unevenly at the bottom.
   - At 1280 px: Needs your attention and Today sit side by side at the top at the same height; the KPI cards are four across; the cards are in three columns, Recent activity among them.
   - At 1024 px: attention and Today one above the other, KPI cards two by two, cards in two columns.
   - Get started (a new owner) sits at the top of the cards at its own height.
   - Tab from the header: Needs your attention, Today, the KPI cards, then the cards in layout order.
4. **Edit layout:**
   - At 1440 px, Edit layout shows Recent activity in the grid with Hide and the drag handle; hiding it removes it from the side column after Done.
   - Dragging a card to a new place repacks the cards with no gaps.
5. Regression:
   - Staff and Field dashboards show only their cards (US-DASH-17, US-DASH-18), with the same loading and layout.
   - Accrual / Cash still switches Profit this month and the money chart (US-DASH-26); KPI cards still open their reports (US-DASH-14).
   - "Send reminder" and the other attention buttons still work (US-DASH-13); in the side column the button sits under its text.
   - Jobs in progress shows "% billed · budget" on each job's second line (US-DASH-20).
   - Job costing's "Cost by category" ring still shows at its size beside its table (US-JOB-26).

## 202. Contacts list polish and toggles (US-OPS-36, US-CRM-21 to US-CRM-23, refinements before Phase 10)

Use an owner on a business with demo data, plus a contact named "H2Z Facades and Interiors Factory Private Limited" with a long email. Check 1440 px and 1280 px, light and dark, and compare with the canvas "05 Contacts polish".

1. **Toggles (US-OPS-36):**
   - On Contacts, the view switcher sits in a grey track; the chosen view is a white chip with a blue outline and blue icon (in dark, a lifted grey chip with a light-blue outline). The other two are grey.
   - Hover each option: after a moment its name shows ("Table view", "List view", "Card view"). Tab to the switcher: the tooltip shows on focus too, and Escape hides it. VoiceOver reads "Card view, radio button, checked".
   - The same look on: Accrual / Cash on the dashboard and on Reports, 3M / 6M / 12M on Income and expenses, the theme switch on Profile › Appearance and in the user menu (icon-only there, with tooltips), and "Enter as" on a new expense.
2. **Long names and emails (US-CRM-21):**
   - Card view: the long name wraps to two lines, ends with "…" if longer, and never runs under the "⋯" button; the email is cut short with "…". Hovering shows the full text. Nothing crosses the card's edge.
   - List view: the name and email are cut short on one line, full text on hover.
   - Table view at 1280 px: no sideways scrolling; Status and the "⋯" column are visible; the long email ends with "…".
3. **Refresh (US-CRM-22):**
   - Beside the view switcher: "Updated just now" and the Refresh button (tooltip "Refresh list"). After a few minutes it reads "Updated 2 min ago".
   - Add a contact in another browser, then press Refresh: the list stays on screen, the icon turns (not with Reduce Motion), "Updating…" shows, and the new contact appears. VoiceOver says "Contacts updated".
   - Switch to another tab for over 30 seconds and come back: the list refreshes by itself.
   - With the API stopped, Refresh shows "Couldn't refresh the list. Check your connection and try again." with "Try again", and the list stays.
4. **Search, filters and stat cards (US-CRM-23):**
   - Search is on its own row under the filters in all three views; in the Table view "Columns" is on the right of that row. Typing narrows the list by name, email or phone.
   - The address follows: `?q=…`, `?type=vendor&type=both`, `?status=archived`, `?page=2`. Open a contact and press Back: the same search, filters and page. Paste the address into a new tab: the same list.
   - Press "Vendors": the card shows pressed ("Showing these · press again to clear") and the list shows vendors and "Customer & vendor". The counts on the cards don't change. Press it again to clear. "Total contacts" clears the type filter; "Active leads" opens the pipeline.
   - A search that matches nothing: "No contacts match "<text>"" with "Clear search". With a filter as well: "No contacts match these filters", and "Clear filters" clears the search too.
   - Go to page 2 of the table and press Refresh: you stay on page 2.
5. Regression:
   - Add contact, Import CSV (the duplicate check still sees archived contacts), Archive, Restore and Delete still work and the list updates (US-CRM-01, US-CRM-03, US-CRM-04, US-CRM-14).
   - Accrual / Cash still switches the dashboard and reports (US-DASH-26, US-RPT-35); the expense entry mode still switches (US-PUR-23).
   - The job costing "Cost by category" ring and reports tables look as before.

## 203. A pipeline that works (US-CRM-24 to US-CRM-28, refinements before Phase 10)

Use an owner on a business with demo data and a second member (Staff). Check 1440 px, 1280 px and a phone, light and dark, and compare with the canvas "06 Pipeline".

1. **The board (US-CRM-24):**
   - The header reads "Your open leads by stage, and what you've won and lost lately." Above the toolbar: Open pipeline (total and how many), Won this month, Win rate ("4 of 6 closed in the last 90 days", or "None closed in the last 90 days") and Overdue follow-ups.
   - The open stages share the width with no sideways scroll; Won and Lost are slim columns at the right showing a dot, the count, the name and "<total> · 30 days". Every column, slim ones included, reaches the bottom of the window, whatever its cards; a column with many cards scrolls on its own.
   - In Settings › Pipeline stages, add three open stages: six open stages still fit at 1280 px. Make the window narrower: the board scrolls sideways and a soft shadow at the right edge shows there's more.
   - Press Won: it opens beside the open stages as "Won · last 30 days", newest first, with "Older won leads: choose Won in the stage filter." Press the "><" button to close it. Choose Won in the stage filter: only the Won column shows, with every won lead.
   - Press Overdue follow-ups: only leads with a past-due follow-up show, the card shows pressed and the address has `overdue=1`; press it again for all leads.
   - An empty open stage says "No leads in this stage"; a business with no leads shows "No leads yet" with Add lead.
2. **Cards (US-CRM-25):**
   - Each card: title (or the contact's name once, when there's no title), contact, value, "N days in stage" and the owner's initials (hover for the name; a dashed "—" for Unassigned, hover says "Unassigned"). Won cards show "Won 2 Oct", lost cards "Lost …" and the reason.
   - Add a follow-up for tomorrow on a lead: the card shows "Call · Tomorrow 10:00". A past-due one shows "Overdue · 6 Oct" in red.
   - An open lead with no activity or change for 14 days carries an amber "No activity for 14 days" (not red).
   - Press "⋯": Open, Move to… (each stage, the current one ticked and greyed), Delete (only if you may delete it). Move a lead to Proposal: the counts and totals update; VoiceOver says "Moved to Proposal". On a card near the right edge the Move to… list opens to the left.
   - Tab to a card: a focus ring shows; Enter opens the drawer; Shift+F10 (or the menu key) opens its menu. Dragging a card with the mouse still moves it, including onto a slim Won or Lost column.
   - Delete from the menu asks first ("Delete this lead?") and says the lead's follow-ups go with it.
3. **Won and lost (US-CRM-26):**
   - Move a lead to Lost (drag, menu or the drawer's Stage): "Why was it lost?" with Price, Timing, Went with a competitor, No response, Other and a note. Choose one and Save reason: the card shows it, and so does the drawer. Skip: it's lost with no reason.
   - Move a lost lead back to an open stage, then to Lost again: no reason is chosen.
   - Move a lead to Won: "Won — <title>" with its contact, value and owner, "Not now" and "Create quote". Create quote opens a new quote with the lead's contact and currency and "For lead <title>". Change the contact: the line goes and the quote isn't linked. Save it: the lead's drawer lists it under Quotes with its status and total, and it opens the quote. Revise the quote: the new version is listed too.
   - As a Staff member without the right to create quotes, a move to Won shows no dialog, and the drawer has no Create quote.
4. **The lead drawer (US-CRM-27):**
   - Open a card: the title, stage chip, contact (opens the contact), "N days in stage" and "created by …". Fields: Title, Contact, Stage, Estimated value, Currency, Owner (Unassigned and every active member), Expected close, Source. Save changes updates the card; the creator doesn't change.
   - Follow-ups: open ones first by date, then the rest. Log activity and Add follow-up (the date is required) add to this lead and its contact; tick one done.
   - History: "Created in New" and each "Moved to Proposal from Qualified" with who and when, newest first. Leads made before this change show what's been recorded since.
   - Add lead (toolbar, or a column's Add lead): the drawer opens at that column's stage with just the details.
   - Without edit rights on a lead, the fields are read-only and there's no Save.
5. **Filters and refresh (US-CRM-28):**
   - Owner (All owners, My leads, each member, Unassigned) and Source (the sources in use) combine with search, stage and sort; the address follows (`/leads?owner=me&source=Referral`). Open a contact and press Back, or reload: the same board.
   - "Updated just now" and Refresh (tooltip "Refresh pipeline"): a lead added in another browser appears on Refresh, in place; VoiceOver says "Pipeline updated". Away from the tab for over 30 seconds, the board refreshes on return.
6. Regression:
   - Settings › Pipeline stages: renaming, reordering, adding and deleting stages (with a move) still show on the board (US-CRM-19, US-CRM-20).
   - The contact page's Leads tab and its Add/edit lead dialog, and its Activities tab, work as before (US-CRM-10, US-CRM-13).
   - Contacts' "Active leads" opens the pipeline; the dashboard's "Pipeline by stage" still counts every stage (US-DASH-*).
   - New quote from Quotes (no lead) still uses the organisation's currency (US-QUO-01).

## 204. A calendar that's easy to use (US-MTG-13 to US-MTG-17, refinements before Phase 10)

Use an owner on a business with demo data and a second member, with a few meetings this month (one recurring weekly, one linked to a contact) and one about four months ahead. Check 1440 px, 1280 px, 1024 px and a phone, light and dark, and compare with the canvas "07 Meetings".

1. **Mini calendar (US-MTG-13):**
   - Each day with a meeting you can see has one dot under its date (a recurring meeting on each day it occurs; a cancelled occurrence doesn't count). Hover a dotted day: "Wednesday, October 7 · 2 meetings". VoiceOver reads "Wednesday, October 7, 2026, 2 meetings".
   - In Week the week on screen is one shaded band; in Day just that day; in Month and Agenda nothing is shaded. The chosen day stays filled and today stays blue.
   - Press the main arrows into next month: the mini calendar moves with it. Page the mini calendar four months ahead: the far meeting's day gets its dot.
   - Tick My Activities: days with your follow-ups get dots too ("2 meetings and follow-ups"). Untick a colleague in Calendars: their meetings' dots go.
2. **New meeting and the working day (US-MTG-14):**
   - "New meeting" sits before Day / Week / Month / Agenda. On today it opens "New event" at the next half hour for 30 minutes; on another day at 9:00 AM. A Staff member without the right to create meetings has no button.
   - Week and Day open with 8 AM at the top, or, on today after 9 AM, the hour before now; the day headers stay in view as you scroll. A red line marks the current time on today's column and moves each minute; other weeks have none.
   - Open a meeting low on the screen or near the right edge: its quick view opens above or beside it and never runs off the window; the attendees are always readable. It opens in its final place — it doesn't jump up when the attendees appear (a placeholder row shows while they load).
3. **Sidebar lists (US-MTG-15):**
   - Upcoming: "Next 60 days", up to 8 meetings with "Today · 1:00 PM", "Tomorrow · 9:00 AM", "Tue 13 Oct · 9:00 AM" or "All day". Press one: the calendar moves to its day and its quick view opens. The people button still opens Manage attendees. With none: "Nothing in the next 60 days."
   - Meetings by contact counts the range in the heading ("This week", "Week of 11 Oct", "This month", "From 10 Oct"); each name opens the contact. With none: "No meetings linked to a contact in this range."
4. **Coming back (US-MTG-16):**
   - Change to Month and move ahead: the address shows `?view=month&date=…`. Reload, or open a contact and press Back: the same view and month. Open plain `/meetings`: the last view you used, on today.
   - The dashboard's "Open calendar" still opens today's Day view; a notification link (`?id=`) still opens Manage attendees and keeps the view and date.
5. **Every screen size (US-MTG-17):**
   - At 1280 × 800 the calendar and sidebar reach the bottom of the window with no page scroll.
   - At 1024 px a calendar button in the toolbar opens the mini calendar, Calendars, Upcoming and Meetings by contact in a sheet; picking a day closes it.
   - On a phone (collapse the left navigation first): it opens in Agenda; Week isn't offered (`?view=week` shows Day); the toolbar wraps and nothing scrolls sideways. Agenda rows show the time range, place and contact (or "Internal") and open the quick view.
6. Regression:
   - Drag to create, move and resize meetings; recurring "This event / All events"; Duplicate; delete with confirm (US-MTG-01, US-MTG-09, US-MTG-10).
   - Owners see private meetings; Staff don't see others' private ones; responses still work (US-MTG-05 to US-MTG-07, US-MTG-12).
   - A date picker elsewhere (e.g. a quote's Valid until) looks and works as before.
   - The pipeline board still reaches the bottom of the window (US-CRM-24).

## 205. A catalogue that's easy to keep (US-CAT-10 to US-CAT-15, refinements before Phase 10)

Use an owner on a business with demo data, a Staff member, and about a dozen catalogue items: a few in each of three categories, one taxable item with no tax, one exempt item, one archived, one used on a quote and an invoice. Check one Indian (GST) business and one elsewhere, at 1440 px and 1024 px, light and dark, and compare with the canvas "08 Catalogue".

1. **Setup cards (US-CAT-10):**
   - The cards read "Total items", "Categories" (with the first two named, "and N more"), "Missing tax rate" and "No income account" ("Posts to 4100 Sales — Services"), counting active items only, whatever the filters.
   - Press "Missing tax rate": just the taxable items with no tax show, the card reads "Showing these · press again to clear" and the address has `setup=tax`; press again to clear. On the GST business a zero-rated item doesn't count; elsewhere an untaxed item does unless it's exempt or non-taxable.
   - Press "No income account", then "Total items": every filter clears. With a screen reader each card is a button ("Show items missing a tax rate, 1") with its pressed state.
2. **The table (US-CAT-11):**
   - Tax names the tax ("GST 18%", "Sales tax 8%"), says "Exempt", "Non-taxable" or (GST) "Zero-rated", and shows "No tax" with a warning icon on a taxable item without one.
   - The description sits under the name (cut short, full text on hover). HSN/SAC shows on the GST business only (it can be turned on from Columns elsewhere). Only archived rows say "Archived".
3. **Many at once (US-CAT-12):**
   - Tick two rows: a dark bar reads "2 selected". The header box is part-ticked; press it to tick the page, again to clear.
   - Set tax › a rate: "Updated 2 items" and both rows show it. On the GST business pick "GST 18%": each item's inter-state tax becomes "IGST 18%" (open one to check); "No tax" clears both.
   - Set category (type a new one or pick one), Set income account: every selected item changes. As Staff, select one of your items and one of the owner's and change the category: "You can't change 1 of these items. Unselect them and try again." and nothing changes.
   - Archive two items: "Archived 2 items"; show Archived and restore them. Search or change a filter: the selection clears.
   - A row's "…" › Duplicate: "Add item" opens with "<name> (copy)" and the same fields; save it.
   - Export: `catalogue-<today>.csv` downloads with just the rows on screen (filters applied), columns Name, Description, Unit, Category, Price, Tax, HSN/SAC code, Income account, Expense account. Import that file into another business: it maps every column, Category included.
4. **Coming back (US-CAT-13):**
   - Search, Status, Category, Price (Min and Max in its popover; the button then reads "$40.00 – $100.00"), a setup card, a column sort and page 2 all show in the address. Reload, or open a quote and press Back: the same list. "Clear filters" clears them.
   - "Updated just now" ticks on; Refresh reloads in place; switch tabs for a minute and come back: it refreshes by itself.
5. **Bundles (US-CAT-14):**
   - The tabs read "Items N" and "Bundles N" (active ones). With no bundles, Bundles shows an icon, "No bundles yet", the two ways to make one and "Choose items", which opens Items.
   - Select three items › Make a bundle: each has quantity 1 and its amount; change quantities and the total before tax follows. Save: "Bundle saved", the Bundles count goes up and the bundle's total includes tax. Add it to a quote from the quote's bundle picker.
   - Select an item in another currency too: "Choose items in one currency." and Save is off.
6. **The drawer (US-CAT-15):**
   - Open an item: fields sit under Details, Price and tax, and Accounts; Save stays in view as you scroll. A used item says "Used on 1 quote and 1 invoice · last quoted <date>"; an unused one "Not used on a quote or invoice yet."
   - Delete the used item: the confirmation says it's on 2 documents and they keep their own copy of the line.
7. Regression:
   - Add, edit, archive, restore and delete a single item; Import (US-CAT-01 to US-CAT-09).
   - Pick a catalogue item and a bundle on a quote and an invoice; the line takes the item's price and tax (US-QUO-25, US-TAX-13).
   - Any other table with a Columns menu (Contacts, Invoices, Reports) sorts, pages and hides columns as before; no checkboxes appear on them.
   - Field users still can't open Catalogue's usage counts.

## 206. Quotes you can work from (US-QUO-27 to US-QUO-36, refinements before Phase 10)

Use an owner on a business with demo data (India and elsewhere), a Staff member without `quotes.send`, and quotes in every state: drafts, sent (one expiring within a week, one expired), revised, accepted (one converted to a job and an invoice) and declined. Check 1440 px, 1280 px and 1024 px, light and dark, and compare with the canvas "09 Quotes".

1. **Cards (US-QUO-27):**
   - "Open" counts sent, current quotes with their total value beside it ("+ other currencies" when some are in another currency); "Expiring in 7 days" (amber when above 0); "Won this month" with its value; "Win rate" with "5 of 12 in the last 90 days" (or "—" and "None closed in the last 90 days").
   - A revised quote counts once. Press each of the first three: the table shows just those quotes, the card says "Showing these · press again to clear", the address has `card=…`; press again to clear. Win rate isn't a button. The dashboard's "Quotes won this month" link still filters to accepted quotes.
2. **The list (US-QUO-28, US-QUO-29):**
   - Search by number, title, contact or a line's name; filter by status and by contact (only contacts with a quote are offered). Reload, or open a quote and press Back: the same list. "Clear filters" clears them. Refresh and "Updated just now"; switch tabs for a minute and come back: it refreshes.
   - Rows: the title under the number; a draft says "Draft" in italics; "Viewed 2×" beside a viewed quote's status, with "Last viewed …" on hover and for screen readers; Sent ("12 Oct", in the business's locale); Valid until with "in 5 days" (amber within a week), "today" or "Expired 6 days ago", or when it was accepted or declined. Expand a revised quote to see its earlier versions.
   - Row menu: a draft offers View, Edit, Send (opens the send dialog on its page), Preview PDF, Duplicate and Delete; a sent quote Copy customer link ("Link copied"), Download PDF, Duplicate and Revise; an accepted one Convert to invoice and Convert to job (each lands on the quote page and converts, with the repeat warning when it applies). As Staff without `quotes.send`, no Send or Copy customer link.
3. **A title (US-QUO-30):** add "Bathroom refit — 2nd floor" in the builder; it shows in the list, as the quote page's subtitle, on the PDF under the number and on the customer's page. Duplicate and revise keep it. A quote started from a won lead starts with the lead's title. A title over 120 characters can't be typed.
4. **The quote page (US-QUO-31):**
   - The number is the page title (a draft says "Draft quote"), with the status, "Viewed 3×", the title, the contact (a link), "Sent 12 Oct", "Valid until 15 Oct · in 5 days" and the place of supply. There's no "Back to quotes" — the breadcrumb leads back.
   - The primary button: Send quote (draft; hidden while a discount waits for approval), Copy customer link (sent, current), Convert to invoice (accepted), Revise (declined, expired or superseded). The rest sit beside it or under More (Duplicate as new draft, Save lines as a bundle…, Email again, View history, Delete draft).
   - Copy customer link: "Link copied — it works for 30 days, or until you revise the quote." Open the copied link in a private window: the customer's page loads; an earlier emailed link still works.
   - Lines are a table: Item with its description, Qty, Rate, Disc. and Tax only when a line has them, Amount; headings in bold across the row, text lines muted. Totals: Discount only when there is one; on a GST quote, CGST and SGST (or IGST) by name. A superseded version says "Superseded by v2" with a link.
5. **Activity and Related (US-QUO-32, US-QUO-33):**
   - Activity lists, newest first: Created, Edited, Sent, Emailed to … (or "Email failed: …"), Link copied, Viewed by the customer N times (views in a row grouped, "last …"), Revised from v1 (a link), Accepted or Declined online or in person with the comment, Converted to an invoice or a job (links), with who and when. A sent quote no one has opened ends with "Not viewed yet". "View history" opens the field-level history. More than six entries: "Show N earlier".
   - Related lists the lead (opens it in the pipeline's drawer), every version ("this one" marked), and the jobs and invoices made from any version; with none it isn't shown. With Jobs & field off, no jobs. Field users never see Activity or Related.
6. **The builder (US-QUO-34 to US-QUO-36):**
   - Each item is one row: handle, Item, Qty, Rate, Disc. %, Tax, Amount and a menu; its description (and HSN/SAC for GST, supply type when untaxed) sits under it, or "Add description" on a taxed line with none. Headings and text lines span the row.
   - Drag a row by its handle (text in the fields still selects normally); use the row's menu (Move up, Move down, Price includes tax, Remove line); or Alt + ↑/↓ — VoiceOver says "Moved to position 2 of 3". Enter in the last row's Tax adds a row with its Item field focused, as does "Add item".
   - Under 1024 px each row wraps into two lines; nothing scrolls sideways.
   - The bar stays at the bottom while you scroll: Subtotal, Tax, Total; Cancel, Preview PDF (opens the quote as it is on screen in a new tab, unsaved changes included; nothing is saved — "Unsaved changes" stays, and the quote's history has no new entry; every page has a faint diagonal "DRAFT — Preview only — not a valid quote" watermark, as does a draft's Preview PDF on its page, but not a sent quote's PDF), Save as draft / Save draft, Save and send (saves, then opens the send dialog; with a discount waiting for approval it opens the quote instead; hidden without `quotes.send`).
   - Change anything: "Unsaved changes" shows. Press Cancel, click Contacts in the sidebar, or press the browser's Back: "Leave without saving?" with "Keep editing" and "Leave". Close the tab: the browser asks. Opening the builder alone never shows "Unsaved changes".
   - Settings › Documents › Quotes: "Quotes valid for" (1–365, 30 to start). A new quote starts valid that many days ahead; "+15 days", "+30 days" and "+60 days" set it (the matching one shows pressed). Duplicate a quote with no validity: the copy uses the setting.
   - The Notes and Terms boxes show their placeholders inside the box when empty (and so does every other rich-text box, e.g. Settings › Documents' default terms).
7. Regression:
   - Build, edit, send, revise, duplicate and delete quotes; bundles in the line picker and "Save lines as a bundle…"; one-off lines with "Also save to catalogue" (US-QUO-01 to US-QUO-26, US-CAT-06).
   - GST quotes: place of supply switches lines between CGST + SGST and IGST, flagged lines warn; HSN/SAC carried (US-TAX-13, US-TAX-14).
   - The customer's page: view, accept and decline; on-site acceptance on the phone and its card on the quote page (US-QUO-08, US-QUO-09, US-QUO-19, US-QUO-20).
   - Convert to invoice and to job with the repeat warning (US-QUO-14 to US-QUO-16, US-QUO-23); discount approval (US-QUO-12).
   - Invoices', credit notes' and variation orders' line editors look and work as before.
   - A quote, invoice and credit note with a heading and a text line: on the PDF the heading is bold and larger, the text line plain and lighter; on the customer's quote page too (US-QUO-02).

## 207. Jobs you can run from one place (US-JOB-30 to US-JOB-38, refinements before Phase 10)

Use an owner on a business with demo data, a Staff member without `reports.view_job_profitability`, and the demo Field user (Marcus Webb) on one job. Have jobs that are active (one with a completed milestone not invoiced, one with a milestone overdue), on hold, and completed with retention held. Check 1440 px, 1280 px and 1024 px, light and dark, and compare with the canvas "10 Jobs".

1. **New job (US-JOB-30):**
   - "New job" in the toolbar opens the drawer. Create job with nothing filled says "Choose who the job is for." and "Give the job a name.". Pick a contact with a site address: Site address fills in, with "From <contact>'s address — change it if the work is elsewhere."; a contact with only a billing address fills that; typing your own address keeps it when you change the contact.
   - Fill name, contract value, retention, dates (an end before the start says "End the job on or after its start date.") and notes; Create job opens the job on Milestones with "Job JOB-007 created", "Set up how this job is billed" and "Add milestones".
   - "Choose a quote" lists accepted quotes with no job yet; pick one and Create job: the job is named after its first item, with its contact and value, and says "From QUO-…". With the repeat-conversion warning on and an invoice already made from the quote, the drawer says it's been converted before and offers "Create another job".
   - With no jobs, the empty state has "New job" and "Go to quotes". As the Field user, neither shows.
2. **Cards (US-JOB-31):** "Active" with its contract value ("+ other currencies" if some are in another); "Ready to bill" with the amount (amber above 0); "Over or near budget" only for people who can see job profitability; "Retention held" with "Across N jobs". Press each of the first three: the table shows just those jobs, the card says "Showing these · press again to clear", the address has `card=…`; press again to clear. The Field user sees no cards.
3. **The list (US-JOB-32, US-JOB-33):**
   - Search by number, name, contact or site; filter by status and contact (only contacts with a job). Reload, or open a job and press Back: the same list. "Clear filters"; Refresh and "Updated just now"; come back after a minute away and it refreshes.
   - Rows: the number and site under the name; Next milestone with "Due 14 Oct", "Due in 3 days" (amber) or "Overdue 2 days" (red), "Ready to bill", "All billed" or "No milestones yet"; Progress with Complete and Billed bars; a job billed past its contract shows "118%" in red with a warning icon, and "Billed over the contract" on hover or focus. Columns has Retention and Budget used. The Field user's rows have no money or Billed.
4. **The job page (US-JOB-34):**
   - The number is the page title; the name under it; the contact (a link), the site (opens Google Maps in a new tab), "Started 22 Jul · Due 30 Nov", "From QUO-…" (a link). No "Back to jobs" — the breadcrumb leads back.
   - The status chip opens Active, On hold, Completed, Cancelled (current one ticked); a change saves with a toast; Cancelled asks first ("Keep the job" / "Cancel the job"). Without the right to edit the job, the status is a plain badge.
   - One primary button: "Invoice <milestone>" when one is completed and not invoiced (opens the new invoice), else "Complete <next milestone>" (the completion dialog), else "Release retention" on a completed job with retention held. Edit job, Raise variation (opens the Variation orders tab's dialog) and More (Add photos, View history, Release retention when it isn't the primary).
   - Figures: Contract ("incl. 1 variation (+…)" once one is applied), Billed (with % and a bar), Cost (against the budget, amber near and red over; "No budget set") and Margin for people who can see job profitability, and Complete. The Field user sees only Complete, and no Activity.
5. **Milestones (US-JOB-35):** tabs show counts (Milestones 3, Variation orders 1, Photos 6, Notes 2, Crew 2) and update when you add a note, a photo or crew. "Billed X of Y" with a bar and "Edit milestones"; each milestone has a step marker (tick for invoiced, flag for completed, circle for pending), its badge, "30% of contract", "Due 30 Oct · in 20 days" or "Overdue 3 days" in red, "not invoiced yet" on a completed one, its amount and View invoice, Raise invoice or Mark complete. A completed job with retention held ends with "Retention held … — release it now the job is complete." A job without milestones says "Set up how this job is billed" with "Add milestones".
6. **Photos (US-JOB-36):** "Add photos" takes several files; each shows on its own tile while it uploads; one that fails (e.g. over the size limit) says why with Dismiss, and the rest still appear. Drag files onto the card: it highlights and they upload. Photos are grouped "Site photos · 2", then "Site preparation · completed 7 Aug · 2" and so on. Click one: it opens full size on a dark screen with "<group> · 2 of 3", the caption, "Added by … with “…” · 2 Oct, 4:38 PM"; ← and → (and the buttons) move within the group; Download saves the original; Close or Esc returns to the grid with focus back on the photo.
7. **Activity (US-JOB-37):** beside the milestones, newest first: Created (from QUO-… as a link), Status changed to …, Job details edited, Milestones set · 3 milestones, Milestone completed · …, Milestone invoiced · … · INV-… (a link), Variation raised · QUO-…, Variation applied · +…, "3 photos added with …" for photos added together, Note added, Crew assigned · …, Removed from crew · …, Retention released · INV-…; with who and when. "Show N earlier" past eight; "View history" opens the field-level history.
8. **Demo photos (US-JOB-38):** load demo data: each demo job's photos are real construction-site photos (the kick-off photo differs between jobs), not a blank square. Delete demo data: the jobs and their photos go.
9. Regression:
   - Create a job from a quote's page (Convert to job) with the repeat warning (US-QUO-14 to US-QUO-16, US-QUO-23).
   - Edit job (budget, % complete, retention), variation orders (raise, apply), notes, crew and Costing work as before (US-JOB-01 to US-JOB-29); the dashboard's "Release" link opens the release dialog (US-DASH-20).
   - The field app's jobs, milestones and photos are unchanged; a photo taken with a milestone on the phone shows under that milestone on the web (US-MOB-04 to US-MOB-07).
   - Switching Jobs & field off and on keeps the job page (US-SET-25).

## 208. Demo data that shows the refined screens (US-ONB-24 to US-ONB-27, refinements before Phase 10)

Load Riverstone Builders (the default), then delete it and load India · Construction and United Kingdom · IT services & agency in turn (Settings › Data). Repeat the checks for each.

1. **Pipeline (US-ONB-24):** cards carry two owners' initials (the owner's and Sarah Mendes's); the Owner filter narrows to each. Days in stage differ ("3 days in stage" … "24 days in stage"); exactly one open lead says "No activity for 1x days". Every open lead has an expected close date in its drawer. The strip shows "Won this month" (if the won lead closed this month), "Win rate" from the won and lost leads. Open the lost lead: "Price" with a note. Any lead's drawer lists Created and each stage it moved through, a week apart, ending in its stage.
2. **Quotes (US-ONB-25):** every quote has a title under its number. Sent dates differ; one quote says "in 5 days" (amber, counted in "Expiring in 7 days") and one "Expired 5 days ago". Some show "Viewed 2×"/"Viewed 3×", the newest sent version shows none. One quote is Accepted ("Won this month" counts it) and one Rejected with the customer's comment in its Activity. Open the accepted contract quote: Related lists its job; Activity ends "Converted to a job". A quote for a customer with a lead shows the lead in Related.
3. **Jobs (US-ONB-26):** every job has an end date. "Ready to bill" is 1 and that job's next step is "Invoice <milestone>"; "Over or near budget" is 1 (the newest job, amber "Nearing"); one job has "Complete 60%" as "Your estimate"; the finished job is Completed (India: retention held and "Release retention" its next step). The newest job says "From QUO-…". Milestones say "completed <date>" on their own days; the Activity panel reads in date order. Start a new job for a demo customer: the site address fills in.
4. **Catalogue and calendar (US-ONB-27):** "No income account" counts only the services (Riverstone 12 of 15; a professional-services demo counts every item); materials open with "Posts to 4000 Sales — Goods". Bundles shows two, and a quote's line picker offers them. Meetings start at different times; Upcoming lists at least three in the next two weeks, one tomorrow.
5. **Delete all demo data:** the bundles go with it; nothing of the demo is left in Pipeline, Quotes, Jobs, Catalogue or Meetings.
6. Regression:
   - Every demo still loads and deletes (US-ONB-17 to US-ONB-21); India's GSTR-1 and the Tax Summary agree; reports render; the Trial Balance balances.
   - The field app: the demo Field user sees the demo's jobs on Today (US-MOB-03, US-MOB-04).
   - The dashboard's Needs your attention, Jobs in progress and Recent activity show the demo's states (US-DASH-16 to US-DASH-29).

## 209. Invoices you can work from (US-INV-27 to US-INV-35, US-ONB-28, refinements before Phase 10)

Use an owner on a business with demo data, a Staff member without "Issue invoices" and "Send a payment reminder", and the demo Field user. Have invoices that are draft, due, part paid, paid, overdue, void, a deposit and a progress invoice with retention. Check 1440 px, 1280 px and 1024 px, light and dark, and compare with the canvas "11 Invoices".

1. **Cards (US-INV-27):** Outstanding, Overdue (red above 0) and Due in 7 days (amber above 0) show balance totals and counts, leaving out drafts, voids and paid invoices; an invoice in another currency adds "+ other currencies". Paid this month shows what payments dated this month paid against invoices, and how many payments, with "Received since" the 1st of the month (in a browser set to British English too, with no error in the console). Press each of the first three: the list shows just those, the card says "Showing these · press again to clear" and the address has `card=…`; press again to clear.
2. **The list (US-INV-28, US-INV-29):**
   - Search by number, customer, a line's name ("canopy") or a job's number or name; filter by status (more than one) and contact. Reload, or open an invoice and press Back: the same list, page and sort. "Clear filters"; Refresh and "Updated just now"; come back after a minute away and it refreshes. The dashboard's overdue link opens the list filtered to Overdue.
   - Rows: one status badge; "Progress claim 2 · JOB-002", "Deposit" or the job under the number; Issued; Due with "in 2 days" (amber within 7), "today", "Overdue 6 days" (red) or "Paid 2 Oct" (green); Total; Balance due with a green bar when part paid; a void invoice shows "—" for Due and Balance due.
   - The row menu: View; Edit and Issue on a draft (Issue opens the invoice and asks "Issue this invoice?", or the HSN/SAC or credit question); Record payment while owed (not on a deposit); Email invoice and Send reminder (when overdue) open the invoice with the email to check and send — nothing is emailed from the menu; Download PDF; Duplicate; Void (opens the void dialog); Delete draft (asks first). Each needs its right; the Staff member sees no Issue or Send reminder.
   - Tick rows and press "Send reminders (N)": "Send N payment reminders?" says how many customers get the email and how many ticked invoices are skipped; Go back sends nothing; Send reminders sends them (US-INV-23).
3. **The invoice page (US-INV-30):**
   - The number is the title ("Draft invoice" for a draft) with its status and, on a progress invoice, "Progress claim N"; the customer (a link), "Issued 4 Sept", "Due 4 Oct · Overdue 6 days" (a draft without a due date: "Not issued yet · due 30 days after issue"), the place of supply, the job and milestone, and "From QUO-…" (links). No "Back to invoices" — the breadcrumb leads back.
   - One primary button: Issue invoice (draft, beside Edit and Preview PDF), Send reminder (overdue, beside Download PDF and Record payment), Record payment (owed), else Download PDF. More holds Email invoice, Apply credit (when the customer has credit), Issue credit note, Duplicate as new draft, View history, Void invoice and Delete draft, each only with the right. Delete draft asks first.
   - Issued: the strip shows Total ("incl. IGST …"), Paid ("last on 2 Oct" with a bar, or "Nothing yet"), Retention held (or Credited) and Balance due with its due note (red when overdue).
   - Press Issue invoice on a draft: "Issue this invoice?" says who will owe what, when it's due, that it gets its permanent number and is posted to the books, and that it can then only be voided or credited. Go back: still a draft. Issue invoice: issued, with a toast. A draft to a registered business with a line missing its HSN/SAC code asks that question instead (one question, not two); so does a customer with credit to apply.
   - Open `/invoices/<id>?action=pay` (or `issue`, `email`, `remind`, `void`): that step's dialog opens (issuing still asks) and the address loses `?action=`.
4. **Lines and totals (US-INV-31):** a table — Item with its description, Qty, Rate, Disc. and Tax only when a line has them, Amount; headings bold across the row, text lines muted. Under it: Subtotal, Discount (only when there is one), tax by name (CGST and SGST, or IGST, on a GST invoice), Total, Retention held, Paid, Credited, Balance due. Payments, credit notes and attachments follow. An opening-balance invoice says it has no lines.
5. **Activity (US-INV-32):** newest first, with who and when: Created (or "Created from quote · QUO-…", "Created from milestone · …", "Duplicated from · INV-…", as links), Edited, Issued, "Emailed to …" (or "Email failed: …"), Reminder sent, Automatic reminder sent, "Payment recorded · ₹… · Bank transfer · RCP-…" (opens the payment), Credit applied, Credit note issued, "Voided: <reason>". "Show N earlier" past six; View history opens the field-level history. Record a payment: the entry appears without a reload.
6. **Payment terms (US-INV-33):** Settings › Documents › Invoices: "Invoices due in" is 30; 0 and 365 save, 366 is refused. With 15: a new invoice's due date is 15 days on with "+15 days" pressed and "Your terms: due 15 days after issue (Settings › Documents)."; the picks change it, and change with the issue date. Issue a draft with no due date (from a quote, a milestone, or saved without one): it's due its issue date plus 15. Release retention on a job: the release invoice has a due date. A recurring schedule's invoices keep the schedule's due days.
7. **The builder (US-INV-34):** compact rows as on quotes (Enter adds a row, Alt + ↑/↓ and the row's menu move it, drag the handle). The bar stays at the bottom while you scroll, with the totals and "Unsaved changes" once you've changed something. Cancel, a link or Back with changes asks "Leave without saving?"; closing the tab asks too. Preview PDF opens the invoice as on screen with "Preview only — not a valid invoice" on every page and saves nothing. "Save and issue" (with the right to issue) saves, then opens the invoice asking "Issue this invoice?" (Go back leaves the saved draft); without the right, only Save draft.
8. **Duplicate (US-INV-35):** from a paid, a void and a progress invoice: a new draft opens in the builder with the same customer, currency, lines, notes and terms, today's issue date, the terms' due date and "Duplicated from INV-…"; a progress invoice's copy is Standard, a deposit's stays Deposit. Its Activity says "Duplicated from" the source.
9. **Demo (US-ONB-28):** load Riverstone, then a localised demo. Overdue and Due in 7 days are both above 0 (Riverstone's deposit is due in 5 days). Open an overdue invoice: Activity shows "Emailed to …" and "Reminder sent" on their own days, and its payment on its day. No email goes out while loading.
10. Regression:
    - Issuing with missing HSN/SAC codes and with customer credit to apply (US-TAX-14, D-187); recording a payment, applying credit and issuing a credit note from the page (US-PAY-01, US-PAY-16); emailing and reminding with the editable email (US-SET-21); voiding with a reason (US-INV-08).
    - The quote page and builder: lines table, bar, Preview PDF and leave guard as before (US-QUO-31 to US-QUO-35).
    - Receivables, the dashboard's overdue count and reminders (US-INV-15 to US-INV-19, US-DASH-13) pick up invoices that now get a due date at issue.
    - The field app is unchanged; the Field user still can't open invoices (US-JOB-19).
    - Dashboard › Needs your attention with one overdue invoice: "Send reminder" opens that invoice with the reminder email to check and send; with several, the list opens filtered to overdue with them ticked (US-DASH-13).

## 210. A major action asks first (D-218, refinements before Phase 10)

For each action below: press it, check the question says what happens to the data (and whether it can be undone), press "Go back" and check nothing changed, then do it again and confirm. Deleting, voiding and removing have a red button; the rest a blue one. Check light and dark, and that Esc closes the question without acting.

1. **Vendor bills:** Record on a draft bill's page and from a row's menu ("Record this bill?" — the vendor, number and amount); Delete draft on the bill's page.
2. **Vendor credits:** Record ("Record this vendor credit?"); Remove from a bill (the bill owes that much again); Delete refund (reversed in the books, stays listed as deleted).
3. **Expenses:** tick submitted expenses and press Approve (N): "Approve N expenses?" with the total. Reject still asks for its comment (no second question).
4. **Quotes:** Revise (on the page and from a row's menu — the new version and that this one is superseded once it's sent); Convert to invoice and Convert to job (on the page, from a row's menu, and after the repeat-conversion warning, which is the only question then); Approve discount.
5. **Jobs:** remove someone from the crew (they stop seeing the job on the web and in the field app); Apply to job on an accepted variation (the amount added to the contract, percentage milestones worked out again).
6. **Opening balances:** Remove an opening invoice, bill, customer credit or vendor credit (its entry is reversed).
7. **Tax:** delete a tax payment or refund from the tax report's list.
8. **Customer refunds:** delete a refund on a credit note or payment.
9. **Banking:** Finish reconciliation (entries marked reconciled; their documents can't be voided or deleted; only the newest can be undone).
10. **Team:** Cancel a pending invitation ("Keep invitation" / "Cancel invitation").
11. Regression: Save, Save draft, creating drafts, Archive and Restore a contact, and Resend an invitation don't ask; the actions that already asked (void with a reason, delete from row menus, deactivate a user, reverse a journal, release retention, cancel a job, delete demo data) ask once, as before.

## 211. Credit notes you can work from (US-INV-36 to US-INV-41, US-ONB-29, refinements before Phase 10)

Use an owner on a GST business (India demo) and a non-GST one, a Staff member without "Apply credit" and "Refund a customer", and the demo Field user. Have a taxed invoice with a balance, a paid one, one already partly credited, and credit notes off an invoice, with credit left, applied and refunded. Check 1440 px, 1280 px and 1024 px, light and dark, and compare with the canvas "12 Credit notes".

1. **Issuing (US-INV-36):**
   - On an issued invoice, More › Issue credit note: "Issue a credit note" says which invoice, the customer and what's still owed. "Credit lines" lists the item lines with "N of M left"; a line already credited in full is greyed with "Fully credited".
   - Tick a line, set how many: the row's amount, Subtotal, the tax by name (CGST and SGST, or IGST, on a GST invoice; the rate's name elsewhere) and Total appear. A quantity above what's left says "Line 2 has 3 left to credit." and Issue stays off.
   - "Credit an amount": enter an amount (tax included); it's spread over the lines by what's left on each, each part's before-tax, tax and part shown; the parts add up exactly. More than the invoice has left says "You can credit up to … on this invoice.".
   - When the total is more than what's owed, "… reduces what's owed on INV-…; … becomes credit for …" shows beside the totals.
   - Issue credit note: the toast says "CRN-0007 issued" (and how much became credit); the invoice's balance, Credited and credit notes update. Open Reports › Tax Summary and (India) GSTR-1 for the month: the credit note's tax reduces the tax owed, by component, and the two agree.
   - An invoice with nothing left to credit has no "Issue credit note".
2. **New credit note (US-INV-37):** Credit Notes › New credit note asks "Which invoice?"; search by number, customer or job; only issued invoices with something left to credit show, each with "Left to credit". Continue opens the issue dialog; issuing opens the new credit note's page. Without "Issue credit notes" there's no New credit note.
3. **The credit note page (US-INV-38):**
   - The number is the title with "Credit left" (amber) or "Credited" (green); the customer, "Against INV-…" (links), the date, place of supply and reason. No drawer any more.
   - One primary button: Apply credit while credit is left (with the right), else Email credit note if it hasn't been emailed, else Download PDF; Refund and Download PDF beside it; Email and View history under More.
   - The strip: Credited ("incl. CGST + SGST …"), Off INV-… (when any), Applied (to INV-… or "To 2 invoices"), Refunded (when any) and Credit left. The lines table shows tax by name, then Off INV-…, Applied to INV-…, Refunded and Credit left under Total.
   - Apply credit lists the customer's open invoices in the credit note's currency, prefilled oldest first; applying updates the strip and toasts. Refund opens the refund dialog for this credit note; refunds and attachments follow the lines.
   - Links: the invoice's credit notes rows and its Activity ("Credit note issued · CRN-…", "Credit applied · CRN-…") open the page; a ledger drill-down on a credit note entry opens it; search (⌘K) finds credit notes by number, customer, invoice and reason. As the Field user, `/credit-notes/<id>` says it isn't found.
4. **Activity (US-INV-39):** newest first, with who and when: "Issued against INV-… · … off it, … as credit", "Emailed to …", "Credit applied · … to INV-…" (a link), "Refunded · … · UPI", "Refund deleted". "Show N earlier" past six; View history opens the field-level history.
5. **The list (US-INV-40, US-INV-41):**
   - Cards: Credited this month (total and count, "Issued since 1 Oct"), Credit to use (amber, customers count; press it to filter, "Showing these · press again to clear", `card=left` in the address) and Refunded this month.
   - Rows: the reason under the number, the customer, the invoice (a link), the date in the business's format, the total, and "Where it went" — "Off INV-…", "Applied …", "Refunded …" (green), "… left" (amber), or a mix. A draft left unissued says "Draft — not issued".
   - The row menu: View; Apply credit and Refund while credit is left; Email credit note; Download PDF — each needs its right (the Staff member sees no Apply credit or Refund). Apply, Refund and Email open the page with that dialog.
   - Search by number, customer, invoice, reason or a line's name; filter by where it went and contact. Reload, or open one and press Back: the same list. "Clear filters"; Refresh and "Updated just now"; come back after a minute away and it refreshes.
6. **Demo (US-ONB-29):** load an industry demo: three credit notes this month on their own days — one off its invoice, one applied to the customer's overdue invoice with credit left, one refunded. Riverstone: one off its invoice, one with credit left, one refunded. Delete demo data: the credit notes, their applied credit and refunds all go, and the Trial Balance balances.
7. Regression:
   - Apply credit on an invoice (US-PAY-16), refunds from a payment (US-PAY-17), the customer statement's credit lines, Receivables and the Credit notes and refunds report (US-RPT-31) read the same figures.
   - Emailing a credit note from the invoice's credit notes section (US-SET-21) still works.
   - The invoice page's Paid bar counts payments only; credit notes show under Credited.

## 212. The email log (US-SET-27 to US-SET-29, US-DASH-30, refinements before Phase 10)

Use an owner with email set up (MailDev locally), a Staff member and the demo Field user. Have a contact with an email address and one without. Check 1440 px, 1280 px and 1024 px, light and dark, and compare with the canvas "13 Email log".

1. **Every email (US-SET-27):**
   - Send a quote, email an invoice, send a reminder, record a payment with a receipt, email a credit note, send a statement, invite a member and send a test from Settings › Emails. Open Settings › Emails › "Email log": each one is there with the time ("Today"), the address and who it belongs to (a contact, or "<name> · team"), the kind beside the subject, the record (a link) and "Sent" with "1 of 4" (queued) or "1 of 1" (sent straight away).
   - Email an invoice to the contact without an address: within seconds it's "Retrying" with "Retrying at … · … has no email address on file", then "Failed" with "4 of 4" after its tries.
   - Cards: Waiting and Failed in the last 7 days filter the list ("Showing these · press again to clear", `card=` in the address); Failed is red above 0. Sent today counts what went out since midnight.
   - Filter by status and kind; change the range; search by address, subject or record number. Reload, or open a record and press Back: the same list. "Clear filters"; Refresh and "Updated just now".
   - As Staff or Field, `/emails` shows the no-access page and Settings has no Email log link.
2. **Retry and cancel (US-SET-28):**
   - On a failed or retrying invoice email, the menu has Retry now, Cancel (retrying only) and Open INV-…. Retry now asks "Retry this email?" with who it goes to and the last error; Go back does nothing; Retry email queues it ("Email queued again") with attempts from 0.
   - Cancel asks "Cancel this email?"; Cancel email shows "Cancelled" and "Cancelled by <you>"; the invoice's page says "Email not sent — cancelled" with "See it in the email log", which opens the log showing "Emails for INV-…". Its Activity says "Email not sent — cancelled".
   - A sent email has no Retry now or Cancel; a failed credit note, receipt, statement or invitation has only Open <record>.
3. **Not set up (US-SET-29):** stop the API, unset `SMTP_HOST`, start it. Send a quote: the log and Settings › Emails warn "Email isn't set up — 1 email is waiting. …"; the email stays Queued with "Waiting for email to be set up" and "0 of 4". Emailing a credit note says email isn't set up. Set `SMTP_HOST` again and restart: the waiting email goes out and the warning goes. With a wrong SMTP password, after three queued emails fail, the warning reads "Emails are failing — the last error was: …".
4. **Dashboard (US-DASH-30):** with a failed email in the last 7 days, the owner's Needs your attention shows "1 email failed" with "Invoice INV-… to …" and Review, which opens the log filtered to Failed. Staff and Field don't see it. The owner's daily digest lists "Emails that failed".
5. Regression:
   - The quotes list has no "Email queue" button; a quote's "Email delivery failed" message links to the email log (owners) instead.
   - Sending a quote, emailing or reminding an invoice and automatic reminders still send, and the quote's and invoice's email status and Activity still update.
   - Notifications by email, the daily digest, data export's "ready" email and password reset emails still arrive.

## 213. Payments you can work from (US-PAY-19 to US-PAY-26, refinements before Phase 10)

Use an owner on the India demo, a Staff member without "Apply credit" and "Refund customers", and the demo Field user. Have a customer with two open invoices (one overdue), a payment applied to two invoices with credit left, one fully applied, one refunded in part, and one reconciled. Check 1440 px, 1280 px and 1024 px, light and dark, and compare with the canvas "14 Payments".

1. **The payment page (US-PAY-19):**
   - Open a payment from the list: the receipt number is the title with "Credit left" (amber), "Fully applied" (green) or "Refunded"; under it the customer (a link), "Cheque · 7 Oct", "Paid into …" and the reference. No drawer any more.
   - One primary button: Apply credit while credit is left, else Email receipt, else Download PDF; Refund (with credit) and Download PDF beside it; More has Email receipt, View history and Delete payment (only when nothing is applied or refunded).
   - The strip: Received ("Cheque · 7 Oct"), Applied ("To INV-…" or "To 2 invoices"), Refunded (when any) and Credit left. "Applied to" lists each invoice's total, what this payment put on it, what it still owes ("Paid" at zero) and the date.
   - Links: the "Payment received" notification, a ledger drill-down on a payment entry, a bank register row, an invoice's Payments row and Activity, the email log's receipt row and an old `/payments?id=…` link all open the page. As the Field user, `/payments/<id>` says it isn't found.
2. **Activity (US-PAY-20):** newest first, with who and when: "Recorded · … by cheque into …", "Applied … to INV-…" (a link), "Receipt emailed to …", "Moved … off INV-… · “reason”", "Refunded · … · UPI", "Refund deleted". "Show N earlier" past six; View history opens the field-level history.
3. **The list (US-PAY-21, US-PAY-22):**
   - Cards: Received this month (total and count, "Received since 1 Oct"), Credit to use (amber, customers count; press it to filter, `card=credit` in the address) and Refunded this month.
   - Rows: the reference under the number, the date in the business's format, the customer, the method with the account under it, the amount, "Applied to" (links, "3 invoices" or "Not applied") and the credit left. Newest first.
   - The row menu: View; Apply credit and Refund while credit is left; Email receipt; Download PDF; Delete payment (nothing applied or refunded) — each needs its right. Apply, Refund, Email and Delete open the page with that dialog.
   - Filter by contact, method and date range (All time, This month, Last month, Last 90 days, This financial year); search by receipt number, reference, customer or an invoice it paid. Reload, or open one and press Back: the same list. "Clear filters"; Refresh and "Updated just now".
4. **Recording (US-PAY-23, US-PAY-24):**
   - From the list, an invoice's "Record payment" and a bank statement line's Create › Payment: the same dialog. From an invoice the customer is fixed and the invoice is ticked with its balance; from a statement line the amount, date and account are fixed.
   - Choose a customer: open invoices oldest due first, "12 days late" in red, "Deposit" for an advance invoice. Tick one: the amount fills; "Pay all" ticks all. Type an amount: it spreads oldest first and the rest is credit — "… goes on 2 invoices; … becomes credit for …". Lines above their balance are capped; more on the invoices than the amount is refused with what to do.
   - "Email a receipt to …" is on for a customer with an email address; turned off, no receipt goes. Recording opens the new payment's page.
   - Enter the same customer, amount and a date within 3 days of an existing payment (or its reference): "This looks like RCP-… — …" with "Open RCP-…"; recording still works.
5. **Search (US-PAY-25):** ⌘K, type a receipt number, a reference or a customer: a Payments group lists "RCP-… · customer · amount · date"; Enter opens the page. The Field user gets no Payments group.
6. **Move off (US-PAY-26):** on a payment's "Applied to" row (or an invoice's Payments row), "Move off INV-…" asks "Move … off INV-…?" with what the invoice will owe again and an optional reason; Go back does nothing. Confirm: "… is now credit", the row goes, Credit left rises, Activity shows "Moved … off …", the invoice owes it again and its Activity says so. Reports › account drill-down on 1100 and 2200 shows the P30 entry dated today. A deposit invoice's payment has no "Move off"; the Staff member without "Apply credit" sees no "Move off". A reconciled payment can still be moved off.
7. Regression:
   - Apply credit, refunds (US-PAY-17), deleting an unapplied payment (US-PAY-06) and a reconciled one refused (US-BANK-10) work from the page.
   - The receipt PDF lists only what's still applied; Receivables, aging, the customer statement and job revenue agree after a move-off.
   - The invoice page's Record payment, the demo payments and the bank statement's payment form still record correctly.

## 214. Menus that read at a glance (US-OPS-37, refinements before Phase 10)

Use an owner with the India demo. Check light and dark, and compare with the canvas "15 Menus".

1. Open each row menu and page "More" menu in Contacts, Catalogue (items and bundles), the Pipeline (a lead card), Meetings (the quick view), Quotes (row, page, a line's menu), Jobs (page), Invoices (row, page, a Payments row), Credit notes (row, page), Payments (row, page, an "Applied to" row) and the Email log: every action has an icon, 14 px and grey, the same distance before its label in every menu; rows are the same height; the hover/keyboard highlight covers the whole row.
2. The same action has the same icon everywhere: View an eye, Edit a pencil, Duplicate two sheets, Delete a bin, Email an envelope, Send reminder a bell, Record payment and Refund a banknote, Void and Cancel a ban sign, Download PDF a down arrow, View history a clock.
3. Destructive actions (Delete, Void, Delete payment, Cancel an email, Remove line) are red — icon and text — and last, after a divider.
4. Choice menus keep their markers: a lead's "Move to…" stages (the current one ticked), a job's status dots, the catalogue's tax picker.
5. With a screen reader, an item is read by its label alone ("Record payment, menu item").
6. Regression: banking, expenses, vendor bills and payments, team and settings menus still work; any icon they have is spaced the new way.

## 215. Every action says when it's done (US-OPS-38, US-CAT-16, refinements before Phase 10)

Use an owner with the India demo. Check light and dark, a phone-width window, and compare with the canvas "16 Toasts".

1. Payments → Record payment, tick less than the amount: the payment's page opens with "RCP-… recorded" and "₹… is credit for … — apply it or refund it." Record one that pays an invoice exactly: "It paid INV-…".
2. Pipeline: delete a lead (asks first) — "Lead deleted"; move a lead to Lost and Skip — "Lead marked lost … add why from the lead when you know"; move another and save a reason — the toast names the reason.
3. Meetings: delete a meeting — "Meeting deleted"; on a repeating meeting delete "This event" — the toast names the day and says the rest of the series stays.
4. Quotes: from a sent quote's page Revise, from a row Duplicate and Revise, from an accepted quote Convert to invoice and Convert to job, and delete a draft from its page: each asks where it did before, and the page that opens shows the toast.
5. Invoices: delete a draft from its page — the list says "Invoice deleted". Credit notes: New credit note from the list — the credit note's page opens with "CN-… issued".
6. Jobs: complete a milestone — "… completed"; Invoice it — the draft invoice opens with "… invoiced"; apply a variation — "Variation applied"; remove someone from the crew — "… removed". Create a job from the Jobs list — its Milestones tab opens with "Job … created" and the address has no `created=`.
7. Contacts: create a contact and delete one from its page — each toast shows on the page that opens. A payment deleted from its page — the list says "Payment deleted" and the address has no `deleted=`.
8. Delete a refund on a payment and remove an attachment anywhere — each has its toast.
9. Do four quick actions (or record, email and delete in a row): toasts stack bottom-right, newest on top, three at most — the fourth closes the oldest at once. Each closes after about 5 seconds; hovering the stack pauses them; × or Escape closes one. At phone width they span the bottom, two at most. With Reduce Motion, they appear without sliding. A screen reader reads each without moving focus.
10. Catalogue: tick items, Set tax → a rate: "Change the tax on N items?" with the new tax and "Quotes and invoices already issued keep their tax." Go back — nothing changes and the items stay ticked; Change tax — "Updated N items". Set category → "Move N items to “…”?" with Move items and Go back. Set income account → "Change the income account on N items?" with Change account and Go back. Archive and Restore don't ask.
11. A failed action (e.g. stop the API, then delete a payment, retry an email, revise a quote from a row, or Set tax on items) shows a red message above the page or list saying what went wrong, with a × — no toast; a failed bulk change keeps the items ticked.
12. Regression: an action you're not allowed to do still shows the permission toast; failed actions in dialogs still show their error in the dialog; Settings' "Saved" toast still shows; toasts don't cover a dialog's buttons.

## 216. Receivables you can chase from (US-PAY-27 to US-PAY-31, refinements before Phase 10)

Use an owner with the India demo. Check light and dark, and compare with the canvas "17 Receivables".

1. Open Receivables: the header says "as of" today in the business's format; tabs "By customer" and "By invoice" with counts; the cards, the age bar, then the filter bar (age on the left; Updated, Refresh, Export on the right) and the search bar with Columns — laid out like Payments and Catalogue.
2. By customer: one row per customer who owes, most overdue money first, with open invoices, oldest ("45 days late" / "Not due yet"), overdue, total owed, credit to use and last reminded; the totals row adds up. Open a customer — their invoices show under it, oldest due first, each opening the invoice.
3. With retention held on a job, the note under the bar gives the amount and the number of jobs, with "See jobs"; the cards and bar don't include it.
4. Press Overdue — the list narrows, the card is outlined, Current fades on the bar, the filter reads "Overdue" and the address has `?age=overdue`; press it again to clear. Press "31–60 days" on the bar — the same for that age. Choose "90+ days" with nothing in it — "Nothing 90+ days late." with Show all. The dashboard's Overdue card still opens Receivables on Overdue.
5. By invoice: each row has the job (and Deposit), the customer as a link, the due date with "Last reminded …" or "Never reminded", and the coloured age with "12 days late" / "Due in 5 days"; Columns adds Issued, Invoice total and Paid so far.
6. An invoice's menu: Record payment opens "Record a payment" with that invoice ticked; Apply credit shows only when the customer has credit; Send reminder opens the reminder email (asks before sending) — or is greyed with "Already reminded today." / "The customer has no email address."; Download PDF; Open invoice. Each finishes with a toast and the page refreshes in place.
7. A customer's menu: Send statement opens the statement dialog; Record payment opens the dialog with the customer chosen; Open contact.
8. Tick invoices — "Send reminders (n)" counts the ones that can go; it asks first, naming what it skips and why; the toast says how many were sent and the selection clears.
9. Search, a tab, an age, a sort and a page survive opening an invoice and going Back; Refresh says "Updated just now"; after 30 seconds on another tab the page refreshes.
10. Export with an age chosen — the CSV, Excel and PDF hold only that age's invoices.
11. Regression: Payables still shows its "Show" filter and unpressable cards; the dashboard's Receivables and Overdue cards still open this page; a Staff member without "View receivables" sees the no-access page.

## 217. Vendor bills you can work from (US-PUR-32 to US-PUR-36, refinements before Phase 10)

Use an owner with the India demo. Check light and dark, and compare with the canvas "18 Vendor bills".

1. Open a part-paid bill: the title is its number with "Partly paid"; under it the vendor (a link), bill date, due date with how late, job and place of supply, in the business's date format. One primary button (Pay bill); More holds View history, Make recurring, Duplicate and Void bill, each with its icon. The strip reads Total, Paid, Credits applied and Balance due.
2. Activity lists created, recorded and each payment, newest first, with who and when — on the bill's own days for demo bills. A payment row opens that payment.
3. With vendor credit open, "Apply credit" shows; it fills the credits oldest first up to the balance; applying shows a toast and the balance drops. Pay bill opens the vendor payment dialog with this bill ticked for its balance; recording it shows a toast and the bill reads "Paid".
4. Void an unpaid bill: a dialog needs a reason; afterwards the state is "Void", the balance "—" and Activity says why. A draft offers Record bill (asks first) and Delete draft (asks first).
5. The list: cards To pay, Overdue, Due in 7 days and Drafts to record with amounts; pressing Overdue, Due in 7 days or Drafts filters the list (in the address); press again to clear. Rows show bill date, due with how late, job, the state in words, and "—" for a void bill's balance; newest first. Filters, search (bill number, vendor or job), sort and page survive opening a bill and going Back; Refresh says "Updated just now".
6. A row's menu has icons: View, Edit and Record (draft), Pay bill (owed), Duplicate, Void (recorded), Delete (draft) — destructive last.
7. Tick drafts: "Record (n)" counts only the drafts, asks "Record n bills?" with their total, records them and toasts; any skipped are named.
8. New vendor bill: it looks like the new invoice page — a header card, compact line rows with Account (no Disc. %), only "Add item" (no headings or text lines), the bar at the bottom with the totals, Cancel, Save draft and Save and record; due quick picks set the due date; leaving with changes asks "Leave without saving?". Choose a vendor with an earlier bill — the due date is suggested ("Suggested: 30 days, as on this vendor's last bill"). Type a number this vendor already used (any case, extra spaces) — a warning names it with a link; you can still save. "Save and record" asks first, then opens the recorded bill with its toast.
9. From a bill's More, Duplicate opens a new bill with the same vendor, job, currency, place of supply and lines, today's date and an empty bill number.
10. Regression: Recurring bills, the job filter's note and links, opening-balance bills (no lines, can't be voided), attachments on bills, and the dashboard's "Pay bill" all still work.

## 218. Vendor credits you can work from (US-PUR-37 to US-PUR-41, refinements before Phase 10)

Use an owner with a vendor who has two recorded bills. Check light and dark, and compare with the canvas "19 Vendor credits".

1. From a recorded bill's More, choose "Record vendor credit": a new credit opens with the vendor, the bill under "Against bill", its currency, job and place of supply, and its lines copied. It looks like the new bill page — a header card, compact rows with Account, only "Add item", the bar at the bottom with Subtotal, tax and Total, "Unsaved changes", Cancel, Save draft and Save and record.
2. Type a credit note number this vendor already used (any case, extra spaces): a warning names that credit with a link; you can still save. Leaving with changes asks "Leave without saving?".
3. On a new credit, type a line, then choose a bill under "Against bill": it asks "Replace your lines with <bill>'s?"; "Keep my lines" keeps yours, "Replace lines" copies the bill's.
4. "Save and record" asks "Record this vendor credit?", then opens the credit with "VCR-… recorded" in a toast.
5. The credit's page: the title is its number with its state in words (Open, Partly used, Used, Void; "Draft vendor credit" before recording); under it the vendor (a link), "Their <number>", the date, "Against <bill>" (a link), job and place of supply, in the business's date format. One primary button (Apply to bills, or Record credit on a draft) with Record refund beside it; More holds View history and Void credit (and Delete draft on a draft), each with its icon. The strip reads Total, Applied to bills, Refunded and Left to use.
6. Apply to bills: the bill it's against comes first, marked "Against this credit", and is filled first; each bill shows its due date with how late; "Applying … · … left" follows the amounts; ticking a bill fills it from what's left. Applying shows "Credit applied" with how much and how many bills.
7. Record a refund, then remove the credit from a bill and delete the refund from their row menus: each removal asks first; every action shows a toast, and Activity lists applied, removed, refunded and refund deleted, newest first, with who and when. Void with a reason: the state reads "Void", Left to use "—", and Activity says why. Delete a draft: it asks first, then the list shows "Draft credit deleted".
8. The list: title "Vendor credits"; cards Credit to use, Drafts to record, Partly used and Unused 60+ days with amounts; pressing the last three filters the list (in the address); press again to clear. Rows show the number ("—" on a draft), their number, vendor, date, the bill it's against, job, the state in words, total and Left to use ("—" when void); newest first. Filters (state, vendor, job), search, sort and page survive opening a credit and going Back; Refresh says "Updated just now".
9. A row's menu has icons: View, Edit and Record (draft), Apply to bills and Record refund (credit left), Void (recorded), Delete (draft) — destructive last.
10. Tick drafts: "Record (n)" counts only the drafts, asks "Record n vendor credits?" with their total, records them and toasts; any skipped are named.
11. Regression: a bill's "Apply credit" and Credits applied, the vendor payment dialog's "Apply it first?" link to the credit, opening-balance vendor credits (Settings › Opening balances), and a Staff member without "Record" still seeing Edit but not Record credit.

## 219. Demo bills and vendor credits at every stage (US-ONB-30, refinements before Phase 10)

Load the India construction demo, then Riverstone Builders on another organisation; check light and dark.

1. Vendor bills: every card has something in it — To pay, Overdue, Due in 7 days (the part-paid bill, on job A) and Drafts to record (2). The list shows Paid, Overdue, Partly paid, Void and two Drafts; "Record (2)" records both drafts after asking.
2. The overdue bill shows "Apply credit" and, under Credits applied, the vendor credit raised against it; its Activity has "Credit applied" on the credit's day.
3. Vendor credits: four credits (two in Riverstone) — Partly used (against the overdue bill, applied part), Open and dated about 70 days ago (counted in Unused 60+ days), Used (with a refund under Refunds), and a Draft. Each credit's Activity reads on its own days: created and recorded on its date, applied and refunded afterwards.
4. Recurring bills: one active monthly schedule for the services vendor (Riverstone: Ridgeline, "Equipment yard rental"), with its next run date a few days ahead.
5. Record a vendor credit of your own for a demo vendor, then "Delete all demo data": the demo's bills, credits (with their applications and refunds) and schedule go; yours stays with its vendor, and the deletion says it kept that vendor.
6. Regression: Payables, Profit & Loss and the dashboard's bills to pay match the demo's bills; nothing of the demo is left in reports after deleting it.

## 220. Expenses you can work from (US-PUR-42 to US-PUR-45, refinements before Phase 10)

Use an owner and a Staff member who approves expenses, each with a few expenses of their own (one rejected, one billable on a job). Check light and dark, and compare with the canvases "20 Expenses" and "20b Expenses labour".

1. The list: title "Expenses" with the Categories tab; cards Waiting for approval (a Staff approver's counts other people's only; an Owner's counts all), Approved this month, Ready to bill and Rejected, in money; pressing Waiting, Ready to bill or Rejected filters the list (in the address), press again to clear. Rows show the date (a link), the number once approved ("—" before), the description over its category ("headcount × day rate" for labour), job, who submitted it ("You" for yours), who paid, the state in words (Waiting for approval, Approved, Billed, Rejected) with "Billable" when it's ready to bill, and the amount; newest first. State, category, submitted by, job, search, sort and page survive opening an expense and going Back; Refresh says "Updated just now". The dashboard's links (waiting, my rejected, ready to bill) open the list filtered.
2. A row's menu has icons: View, Edit (or "Fix and resubmit" on your rejected one), Approve, Reject, Bill to customer, Delete — destructive last. Approving or rejecting from it opens the same dialogs as the page; Delete asks first.
3. Tick expenses: a box is disabled on one you can't review (your own as Staff, or one already reviewed); "Approve" and "Reject" for the ticked ones ask first and toast.
4. An expense's page (`/expenses/<id>`; an old `?id=` link opens it): the number (or "Expense") with its state; under it category, date, "Submitted by …", job (a link) and who paid. An approver sees Reject, "Approve and next" and Approve; a ready-to-bill expense shows "Bill to customer"; More holds Edit, View history and Delete expense. The strip reads Amount, Tax, Paid from and Billable; the receipt previews beside the description and category account, and opens full size; Attachments and Activity follow (submitted, edited with what changed, approved with what posted, rejected with the reason, resubmitted, billed with a link to the invoice).
5. "Approve and next": asks first, approves, and opens the oldest expense still waiting on you, with a toast; when none is left it stays on the page and says "That was the last one waiting for approval."
6. Reject with no reason: "Say why it's rejected, so it can be fixed." With a reason, the page shows it at the top. As the submitter, "Fix and resubmit" opens the form with the reason; change it, add a receipt and "Resubmit": it's waiting again, with "Fixed and resubmitted" in Activity. An approved expense can't be edited ("…already posted to the ledger").
7. The form: the currency is a picker on the business's currency; choosing a tax rate works out the tax as included in the amount ("Worked out from <rate>, included in the amount."), and typing over it keeps yours. The same amount on the same day as one of yours (not rejected) warns with "Open it"; you can still submit.
8. Files: drop or choose several photos and PDFs at once ("Add files"): the first becomes the receipt with a preview, Replace and Remove; the rest are listed under it, each removable; "Add files" adds more at any time. With many files the files pane scrolls on its own while the form stays put (and the form scrolls on its own on a short window). After saving, the extra files are under Attachments on the expense's page.
9. "Submit and add another": submits with a toast and leaves the form open, emptied, keeping the date, currency, paid by and job.
10. Headcount × day rate: the labour category is preselected and the job required; rows of trade, workers and day rate add up; the page lists the trades with the day's total; editing a waiting one opens the rows filled in.
11. Regression: Field users see only their own expenses and pages; the field app's My expenses and new expense still work; Bank › an account's register opens an expense's page; Profit & Loss and job costing match what was approved; billing an expense from its page or the menu adds it to the customer's invoice.

## 221. Demo expenses with their receipts (US-ONB-31, refinements before Phase 10)

Load the India construction demo, then Riverstone Builders on another organisation.

1. Expenses: each of the five demo expenses (Riverstone: four, not "Fuel — no receipt attached") opens with a receipt previewed — a till-roll PDF from a fitting shop in the business's town, with the date, what was bought, any tax inside the amount and the total, in the demo's currency.
2. Activity reads on the expense's own days: submitted on its date, approved or rejected the day after (never later than today).
3. As the demo Field person, open another person's demo receipt by its file link: it's refused.
4. "Delete all demo data": the expenses and their receipts go.
5. With no file storage set up, the demo still loads, with expenses and without receipts.

## 222. Expense categories that guide (US-PUR-46 to US-PUR-48, US-ONB-32, refinements before Phase 10)

Use an owner with a few categories and expenses (one category unused), and a Field member. Check light and dark, and compare with the canvas "21 Expense categories".

1. Expenses › Categories: the breadcrumb reads Purchases › Expenses › Categories. The table lists each category's name over what it's for, Posts to ("6900 Other Expenses · default" when none is set), Default tax ("—" when none), Expenses (a link) and Approved this month in the business's currency ("—" when nothing), with Active or Archived in words; Active first, then by name. The 5200 category is tagged "Headcount × day rate".
2. The state filter (Active by default, Archived, All) and the search (name and what it's for) stay in the address; Clear filters resets them; Refresh says "Updated just now". With nothing matching, the empty state offers Clear filters.
3. Pressing a category's expense count opens the expenses list filtered to it (an archived one too, labelled "(archived)" in the filter).
4. A row's menu has icons: Edit, View history, Archive (or Restore), and Delete — a category in use shows Delete greyed out with "In use — archive it instead". Archive asks "Archive <name>?" saying its expenses keep it; Delete asks "Delete <name>?" with a red button; Restore, saves and adds each say what happened in a toast.
5. Add category: Name, What it's for (counted to 120), Posts to, Default tax rate (active rates). Typing a name another category has — any case, extra spaces, archived included — says "<Name> is already a category." ("— it's archived." with Restore it, which restores it and closes the form).
6. Edit a category and change Posts to: a note says expenses already approved stay in the old account and those approved from now on post to the new one. Approve an expense afterwards and check it posted to the new account; the earlier one didn't move.
7. Submit an expense: the category picker shows each category's line under its name, and typing searches both. Choosing a category with a default rate fills in Tax rate with "<Category>'s usual rate — change it if this receipt differs." and works out the tax; choosing one without a default clears it; picking a rate yourself is never overwritten. Editing a saved expense keeps its own rate.
8. As Field, submit an expense: the hints and default rates show; the Categories tab doesn't, and `/expense-categories/usage` is refused.
9. Demo (US-ONB-32): load the UK IT services demo into a new business — every category has its line, Hosting & cloud, Software subscriptions, Hardware for resale and Training & certification default to VAT 20%, and "Client entertainment" is archived. Load India construction or Riverstone: lines, no defaults, the archived one. "Delete all demo data" removes the archived one and clears the defaults; the template's categories stay.
10. Regression: the Construction and Professional services templates still list their categories with the setup note (sections on US-ONB-13 and US-ONB-20); headcount × day rate still preselects the 5200 category; the expenses-by-category report is unchanged.

## 223. Vendor payments you can work from (US-PUR-49 to US-PUR-55, refinements before Phase 10)

Use an owner with a vendor that has an email address and three recorded bills (one overdue), and a Field member. Check light and dark, and compare with the canvas "22 Vendor payments".

1. The list: title "Vendor payments"; cards Paid this month and Paid last month (amount and how many) and To pay (overdue bills' balance and how many, in red), which opens Vendor bills filtered to overdue. Rows: number with the reference under it, date in the business's format, vendor, method with the account under it, amount and the bills paid (links; "3 bills" for more); newest first.
2. Vendor (only vendors with a payment), Method and the date range filter it; search finds a number, a reference, a vendor or a bill number; all of it stays in the address and survives opening a payment and going Back; Clear filters clears it; Refresh says "Updated just now". An old `/vendor-payments?id=` link opens the payment's page.
3. Record payment: choose the vendor — their bills with a balance are listed oldest due first, with the bill date, due date and "N days late"; their open credit is offered first. Ticking a bill takes its balance and sets the amount; "Pay all" ticks every bill; typing an amount spreads it oldest first. The line before the button says what it pays ("… pays RTE-3302 in full and … of RTE-3340."), or by how much it doesn't add up — then Record stays off.
4. Record asks "Record this payment?" with the same line; Go back does nothing; Record posts it, the toast names it, and the payment's page opens. From a bill's Pay bill the bill is ticked for its balance and the bill refreshes; from Banking's statement line the amount, date and account stay fixed.
5. The same vendor and amount within 3 days, or the same reference, shows "This looks like VPY-…" with a link; it can still be recorded.
6. The payment's page: the number, the vendor (a link), date, method, "Paid from …" and the reference; Paid and Bills paid; "Paid to" with each bill's total, what this payment put on it, what it still owes ("Paid") and its due date; attachments; notes; Activity (recorded, paid on each bill, remittance advice emailed). A bill's Payments, the bank register, reports and search open this page.
7. Download remittance advice saves `remittance-VPY-….pdf`: your business, the vendor, the payment's details, and each bill by the vendor's invoice number with its date, total, paid now and still owed; light, never stored.
8. Email remittance advice (the next step when the vendor has an address and email is set up): To, Subject and a message naming the bills, with the PDF shown attached; Send toasts "Remittance advice sent", Activity and the email log (kind "Remittance advice", linking to the payment) record it. Without an address or email set up, it moves under More, greyed, saying why.
9. Delete payment (More, or a row's menu): asks "Delete VPY-…?" naming the bills that will owe again; confirming posts the reversal, the list toasts "VPY-… deleted", the bills owe again and their Activity says "Payment VPY-… deleted · owes … again". A payment matched to a bank statement line says "Can't delete … yet" with "Open <account>" instead, and the API refuses.
10. ⌘K: a vendor payment's number, reference or vendor finds it in a "Vendor payments" group, opening its page. As Field: no Vendor payments group, and the pages and routes are refused.
11. Regression: Payables, the AP aging and Profit & Loss still match after recording and deleting; US-PUR-25's credit offer, US-PUR-33's Pay bill and US-DASH-13's "Pay bill" link still open the dialog on the right vendor; the bank register's vendor payment rows open the page.

## 224. Payables you can pay from (US-PUR-56 to US-PUR-60, refinements before Phase 10)

Use an owner with three vendors: one with an overdue bill and a bill due in 3 days, one with an overdue bill and an open vendor credit, one with a bill with no due date; a draft bill; and a Staff member without `vendor_credits.apply`. Check light and dark, and compare with the canvas "23 Payables".

1. The page: "What you owe vendors, by how late it is · as of <today>" under the title; tabs "By vendor" and "By bill" with counts, then the cards, the age bar, the filter bar (the age on the left; "Updated just now", Refresh and Export on the right) and the search bar (search on the left, Columns on the right).
2. Cards: Total owed (bills and vendors), Overdue (amount and bills, red), Due in 7 days (not yet overdue and due within a week — amount and bills) and 90+ days. Pressing Overdue, Due in 7 days or 90+ days outlines it, says "Showing these · press again to clear", filters both tabs and puts `?age=` in the address; pressing again shows all. A part of the age bar does the same, by mouse or Tab and Enter.
3. The age filter offers All ages, Overdue, Due in 7 days, Current, 1–30, 31–60, 61–90 and 90+ days; an empty age says "Nothing 61–90 days late." (or "Nothing due in the next 7 days.") with "Show all". The dashboard's Payables "Overdue" link opens Payables on Overdue.
4. By vendor: one row per vendor — open bills ("2 bills"), the oldest ("33 days late", "Due in 3 days" or "No due date"), overdue, total owed, credit to use ("—" when none) and last paid ("Never"); most overdue money first; a totals row. Expanding a vendor lists their bills oldest due first, each opening the bill. Search matches vendor names.
5. By bill: the number with the job under it, the vendor (opening the contact), the due date in the business's format, the coloured age with how late in words, and the balance; Columns adds Bill date, Bill total and Paid so far. Search matches a bill number, a vendor or a job.
6. A bill's menu: Pay bill (the vendor payment dialog with this bill ticked for its balance), Apply credit (only while the vendor has credit; "Apply credit to …") and Open bill, each with its icon. A vendor's menu: Pay vendor (the dialog on that vendor), Apply credit (only with credit; against their oldest bill) and Open contact. As the Staff member without the credit right, Apply credit isn't there.
7. Tick two bills from one vendor: "2 selected", "Pay (2)" opens the dialog with both ticked for their balances; Record asks first; the toast names the payment, the page refreshes in place and the bills drop out. Tick bills from two vendors: "Pay (2)" is off and the bar says "Pick bills from one vendor — a payment is for one vendor."
8. With a draft bill: under the age bar "1 draft bill (…) isn't counted here — record it to include it." with "See drafts", opening Vendor bills on Drafts to record.
9. Export with an age chosen: the CSV, Excel and PDF hold only that age (and the search). Refresh updates in place; leave the tab for 30 seconds and come back — it refreshes. Tab, age, search, sort and page survive opening a bill and going Back.
10. Regression: the totals match the AP aging report and the dashboard's Payables card; Receivables' cards, age bar and filter are unchanged; Vendor bills' Pay bill and Vendor payments' Record payment still open the dialog as before; Field can't reach Payables.

## 225. Demo vendor payments and payables you can pay from (US-ONB-33, refinements before Phase 10)

Load an industry demo (e.g. India › Construction) into a new business, and Riverstone Builders into another.

1. Payables: the cards and age bar have money in Current, 1–30, 31–60 and 90+ days; 61–90 is empty and pressing it says "Nothing 61–90 days late."; "Due in 7 days" has the part-paid bill.
2. By vendor: the part-paid bill's vendor has "2 bills", expanding to the 90+ bill and the one due this week; on By bill, tick both and "Pay (2)" opens the payment dialog with them ticked. The 31–60 bill shows its job (where the industry has jobs).
3. Vendor payments: rows by Bank transfer (with a reference like "NEFT …"/"BACS …"/"ACH …"), Cheque ("Chq 00…") and Cash; the newest a few days ago, the oldest about four months ago; one row's "Bills paid" names two bills.
4. Open that payment: "Paid to" lists both bills in full; Activity reads "Remittance advice emailed to <vendor's address>" the day after "Recorded". The email log has no remittance — nothing was sent.
5. Riverstone: Apex Timber has 2 open bills (one 90+ days late), Granite State 2 (one 31–60 days late); its payment shows Bank transfer and "ACH 552190".
6. Delete all demo data: the bills and payments go; Payables says "Nothing outstanding".
7. Regression: Vendor bills' cards, the dashboard's Payables card and the AP aging report agree with Payables; the jobs' costs include the 31–60 bill.

## 226. Banking you can work from (US-BANK-13 to US-BANK-17, refinements before Phase 10)

Use an owner with two bank accounts, cash, a card, a few payments, money in and out and a transfer; a CSV statement for the default bank with a Balance column; and a Staff member with only `banking.view`. Check light and dark, and compare with the canvas "24 Banking".

1. Banking: tabs "Active" and "Archived" with counts; the cards Bank and cash, Owed on cards, Not yet reconciled and Last reconciled; pressing Not yet reconciled outlines it, says "Showing these · press again to clear" and shows only accounts with entries to reconcile. The Type filter, Updated, Refresh, Transfer, Money in, Money out and Add account sit in the filter bar; search and Columns below. Tab, type, card and search survive opening an account and going Back.
2. Rows: the type's icon and type in words, the name with "Default", the bank line, "Balance in Spine" ("owed" on a card), "Reconciled to <date>" or "Never reconciled", and "<n> unreconciled" opening the register on Unreconciled only.
3. A row's menu: Open register; Reconcile and Import statement; Money in, Money out and Transfer (that account chosen); Set as default, Edit and Archive — each with its icon. Archive asks "Archive <name>?"; the default account says "Choose another default account first."; an account with money says to move it first. Set as default toasts which account it replaces. As the Staff member: no Money in/out, Transfer, Reconcile, Import, Set as default, Edit or Archive.
4. The register: Reconcile is the primary button, with Record (Money in, Money out, Transfer — this account chosen) and More (Import statement, Reconciliations, Edit account). The range presets (This month, Last month, This quarter, Last 90 days, This year, Custom range with From and To), Type and Show filter it; search matches what, contact or reference; all of it is in the address and survives a reload. A reconciled row has a tick and "Reconciled"; an unreconciled row has nothing there. The Unreconciled card filters.
5. A money in or out entry, or a transfer, opens a drawer (its name or "View entry"): date, who recorded it, amount, account (From and To), category and tax, contact, description or reference, reconciled or not, attachments (money in or out), and Delete entry/transfer, which asks first and isn't offered once reconciled. Other rows open their document.
6. Export: CSV, Excel and PDF hold the rows on screen (range, type, search) between the opening and closing balance, named `<account>-<from>-<to>`.
7. Money in and Money out ask "Record money in/out?" naming the amount, account, category, date and any tax; Go back changes nothing. A transfer asks "Move <amount> from <A> to <B>?"; the same account on both sides says "Choose two different accounts." and Move money stays off.
8. Reconcile: with a statement imported after the last reconciliation, the end date and closing balance are filled in, with "From <file> · <date>"; once started, "Saved as you go — pick up where you left off." A bar says "<done> of <total> lines done". Tabs To do, Suggested, Matched and Excluded (with counts) and a search; a matched or excluded line moves to its tab. Selecting a line lists entries with the same amount first, marked "Same amount". "Match all suggested (n)" asks first, listing line → entry, and toasts "<n> lines matched".
9. Reconciliations: the end date opens the reconciliation; the row menu has View, Download report and Undo (off, with why, except on the newest). The page: the summary "Statement closing balance + Deposits not yet on the statement − Payments not yet on the statement = Balance in Spine on <date>" (with excluded lines when there are any), the opening and cleared balances, what's outstanding, matched lines (Show all) and excluded lines with notes; Download report saves `reconciliation-<account>-<date>.pdf`, light; Undo asks first.
10. Regression: balances match the Balance Sheet; payments, bills and expenses still choose their account; statement import and Create from a line work as before; Field can't reach Banking or any of these routes.

## 227. Demo banking (US-ONB-34, refinements before Phase 10)

Load an industry demo (e.g. India › Construction) and Riverstone Builders in two businesses.

1. Banking lists a "Business card" (••4410) owing what's left of its spending, alongside the bank and cash accounts.
2. The bank's register has a card payoff and a petty cash top-up (transfers), interest (money in) and bank charges (money out), each on its own day.
3. Reconciliations: last month is reconciled (finished on the 3rd, or today early in the month), with a cheque outstanding at the end of the month; open it and download the report.
4. Reconcile: this month is in progress — older lines matched, newer ones suggested, a cheque presented this month to match by hand, and "SMS ALERT CHGS" to Create or Exclude.
5. Delete all demo data: the card, the transfers, the money in and out, the statement and both reconciliations go; the bank account itself stays.

## 228. Users you can manage from (US-TEAM-19 to US-TEAM-23, refinements before Phase 10)

Use an owner with the demo loaded (Sarah Mendes, Staff on General Staff; Marcus Webb, Field), a second Team ("Accounts"), and a Staff member on no Team. Check light and dark, and compare with the canvas "25 Users".

1. Users: "Invite people" in the header; tabs "Active", "Deactivated" and "Invites" with counts; the cards People (owners · staff · field), Staff without a Team (pressing it outlines it, says "Showing these · press again to clear" and shows only them) and Pending invites (how many expired; opens Invites). The Role filter, Updated and Refresh sit in the filter bar; search (names or emails) and Columns below. Tab, role, card and search survive a reload.
2. Rows: avatar, name and email with "You", "Primary Owner" and "Demo" where they apply; the role; Teams as chips opening the Team, "No Team — can't open anything" in amber for Staff on none, "Everything" for owners and "Field access" for Field; "Last active" ("Just now", "2 hours ago", "Yesterday", "3 days ago", a date, or "Never signed in"); "Joined" in the business's date format.
3. A row's menu, each item with its icon: What they can open; Manage Teams (Staff); Change to Field / Change to Staff; Promote to Owner (Staff); Demote to Staff (another Owner, not the Primary Owner); Transfer primary ownership… (your own row, as Primary Owner); Deactivate (not on your own row or the Primary Owner's) or Reactivate (Deactivated tab).
4. Manage Teams: every Team with a tick and its size; Save Teams changes them at once and toasts "<name> is on <Teams>"; with none ticked the row warns. The audit log shows the change (record type User, "teams").
5. What they can open: role and Teams; each section as Can work here, View only or Can't open (with a key) (sign in as them to compare); permissions by group ("<n> of <total>"); "Edit on <Team> →" opens the Team; Manage Teams opens the dialog. Owners: "Owners can open everything…"; Field: "Field access is fixed…".
6. Change to Staff asks "Change <name> to Staff?" with Teams to tick (General Staff ticked); Change to Field names the Teams they come off. Each toasts; the person's next page uses the new role; the audit log shows the role change. Owners have neither.
7. Invite people: several emails (commas, spaces, new lines), up to 20; one that isn't an address shows in red and Send stays off; Role Staff or Field; for Staff, Teams they'll join (General Staff ticked). Sending toasts "<n> invites sent"; an address already a member or already invited stays in the dialog with why. Accept a Staff invite as the new person: they're on the Teams chosen.
8. Invites tab: email, role, Teams on joining, "<inviter> · <date>", "Expires in <n> days" or "Expired" in red; the menu has Copy invite link (toast "Only <email> can use it, signed in with that address."), Resend (toast) and Cancel invite (asks first, toast).
9. Deactivate asks first (for a demo person: "They're demo data, so they go when the demo data is deleted.") and toasts; Reactivate asks "Reactivate <name>?" (previous role and Teams back) and toasts. A failure says what to do next above the list. `PUT /org/members/<your id>/deactivate` answers 400 "You can't deactivate yourself."
10. Regression: onboarding's invite step still sends one invite; promoting asks "Make <name> an owner?"; the Primary Owner's row offers only What they can open and the transfer; Staff and Field still can't open Team pages; `GET /org/members` as Staff has no Teams, last active or demo fields; Teams › a Team's members still edit as before.

## 229. Setting a Staff or Field member's password (US-TEAM-24, refinements before Phase 10)

Use the demo (Sarah Mendes, Staff; Marcus Webb, Field), a second Owner and SMTP set up (MailDev), then without SMTP. Check light and dark, and compare with the canvases "26 User passwords" and "26b Choose your own password".

1. Users: Sarah's and Marcus's menus have "Change password" with its icon; your row, another Owner's and a deactivated person's don't. As the second Owner, the Primary Owner's menu says "Only <name> can change their own password, from Profile." `PUT /org/members/<Primary Owner>/password` answers 403 whoever asks; your own id answers 400.
2. The dialog: a suggested password is shown (Copy copies it; Hide hides it; Generate another changes it), rated Strong; a typed one updates the meter; under 8 characters or a common one is refused under the field. "What happens" lists sign-out, the email and passing it on yourself.
3. Change password: the toast says "<name>'s password changed"; their open web tab and the field app are signed out at once; MailDev has "<Owner> changed your <Business> password" with no password in it (without SMTP, the email log shows it Not sent); the audit log shows "Password set by an owner" on them, without the password.
4. Sign in as them on the web with the password you set: "Choose your own password" opens, saying who set it and when; any other address comes back here. The same password is refused ("That's the password you were given…"); mismatched Confirm says so; their own password opens the dashboard (or where they were going), and signing in with it later goes straight in.
5. On the field app: sign in with the password set → "Choose your own password" before Today; Sign out leaves; saving opens Today. An open app whose next request answers PASSWORD_CHANGE_REQUIRED moves to this screen.
6. Forgot password while still owing a choice: resetting by the emailed link counts as choosing; no choose screen after.
7. Regression: Profile › Password still asks for the current password; invites, Manage Teams, role changes and Deactivate work as before; Field can't reach Users; an Owner's own sign-in never shows the choose screen.

## 230. Demo people, Teams and invites (US-ONB-35, refinements before Phase 10)

Load an industry demo (e.g. India › Construction) and Riverstone Builders in two businesses; have a Team and an invite of your own first.

1. Users › Active: Sarah Mendes (Staff, General Staff), Neha Kapoor (Staff, General Staff and Accounts), Marcus Webb (Field), Kavya Iyer (Staff, "No Team — can't open anything") and Ravi Kumar (Field), all "Demo", each with their own Joined date; "Staff without a Team" reads 1. Deactivated: Tom Becker. Neha, Kavya and Ravi read "Never signed in".
2. Teams: "Accounts" (billing, payments, receivables, banking and reports). "What they can open" for Neha shows Banking and Reports; for Sarah it doesn't.
3. Jobs: Marcus crews every demo job; Ravi the first one only; Tom none. The field app as Ravi (DemoPassword123!) shows that one job.
4. Invites: sam.lee.demo@example.com (Staff, General Staff and Accounts, expires tomorrow) and dev.patel.demo@example.com (Field, Expired), invited by the owner; nothing in MailDev or the email log. Copy invite link and open it: "This invitation can't be used". Sign up as sam.lee.demo@example.com on a closed install: refused.
5. Audit log: Neha's Teams set and Tom deactivated, on their days, by the owner.
6. Delete all demo data: the demo people are gone from Users (their logins stay), "Accounts" and the two demo invites go; your own Team and invite stay. Load again: everything comes back.
7. Regression: signing in as Sarah or Marcus works as before; Sarah's access is General Staff's only.

## 231. Teams you can manage from (US-TEAM-25 to US-TEAM-29, refinements before Phase 10)

Use an owner with the demo loaded (General Staff with Sarah and Neha; Accounts with Neha; Kavya on no Team) and one Team of your own. Check light and dark, and compare with the canvas "27 Teams".

1. Teams: "Create Team" in the header; cards Teams (default · with no one yet), Staff on no Team (Kavya; opens Users filtered to Staff on no Team) and Staff on several Teams; search (name or description) in the address. Rows: name, "Default"/"Demo", description, member avatars and count, "Works in <n> of <total> sections" (a section counts when the Team allows an action there, or it's a report it opens), "<n> of <total>" permissions. With a module switched off, its permissions leave the totals.
2. A row's menu, each item with its icon: Open, Rename, Duplicate, Delete (not on General Staff or the only Team). Delete asks "Delete <Team>?", names anyone left on no Team, and toasts.
3. Create Team: name, description, Start from (Nothing allowed, or a Team with its permission count) — the new Team opens on Permissions with the copied permissions and no members; toast. Duplicate prefills "<Team> (copy)". A name in use (any case) says "There's already a Team called <name>." Rename changes name and description; General Staff's name can't change.
4. A Team's page: name, description, badges, Add people, a menu (Rename, Duplicate, Delete); tabs Members, Permissions, History in the address. Members show "Also on" and Last active; What they can open opens the access drawer.
5. Add people: only active Staff not on the Team, with their Teams ("No Team" in amber); tick several; toast names them. Remove asks first; on their only Team it warns they'll be on no Team; toast.
6. Permissions: the side panel shows each section as Can work here, View only (open, nothing allowed there) or Can't open (e.g. Quotes for Accounts, US-TEAM-30), with a key; switching marks "Changed", updates the group's "<on> of <total> · was <n>", the side panel (Added/Lost) and the bar ("<n> changes · Discard · Save changes"); turning on Reconcile accounts turns on View bank balances with a notice. Search, Show changed only and Expand all work. Switching tabs or leaving asks "Discard <n> unsaved changes?" (Keep editing keeps them); refreshing the page warns. Save asks, listing what turns on and off and the sections gained or lost; confirming saves once and toasts.
7. History: newest first — permission changes by label, members added or removed, name/description changes, created (from which Team). "Open in audit log →" shows only this Team ("One record · Show all"). The audit log lists record type "Team" with the Team's name linking to it.
8. Regression: a Staff member's access follows the saved permissions only (not the draft); Users › Manage Teams still works; Field and Owners can't be added to Teams; Staff and Field can't open Team pages or `/org/teams` routes.

## 232. Sections a Team can open (US-TEAM-30 to US-TEAM-32, refinements before Phase 10)

Use an owner with the demo loaded, and Sarah Staff (General Staff only) in a second browser. Check light and dark, and compare with the canvas "28 Team sections". Put everything back at the end (General Staff › Permissions › every section on).

1. General Staff › Permissions: a "Sections" card above the groups lists Contacts, Pipeline, Meetings, Catalogue, Quotes, Jobs, Invoices, Credit Notes, Payments, Vendor Bills, Vendor Credits and Vendor Payments (those of switched-on modules), each with Can work here / View only / Can't open and a switch. Each group starts with its Open permission (Expenses with "See everyone's expenses").
2. Switch Quotes off in the card: it reads Can't open and "Changed"; Manage Quotes shows Open Quotes off and its actions dimmed with "Open Quotes first." (they can't be switched); the notice names the actions that turned off; the side panel marks Quotes "Lost". Switch an action back on from the group's switch: Open Quotes comes with it. Discard puts everything back.
3. Close Quotes again and Save: the confirm lists the permissions turned off and "They'll no longer see Quotes"; toast. History shows the change.
4. As Sarah (refresh): Quotes isn't in the sidebar; `/quotes` and a quote's address show "You don't have access to Quotes" naming the owners. On a job made from a quote, the quote's number is plain text with a lock; on an invoice from a quote, likewise; ⌘K for a quote number finds nothing in Quotes. The dashboard has no quote rows in Needs your attention.
5. Close Contacts and Catalogue as well: Sarah's new invoice still picks a customer and catalogue items (names, prices, tax); a job's customer shows as text. A new expense and a vendor bill still pick a job. Recording a payment still lists the customer's invoices.
6. Turn "See everyone's expenses" off: Sarah's Expenses lists only her own; another person's expense address says it can't be found; approve and reject are off in the Team (turned off with it).
7. Users › Sarah › What they can open, Teams › Works in, and the side panel all show the closed sections as Can't open.
8. Regression: owners see and link everything; Marcus (Field) still has Jobs, Meetings and his own Expenses on web and phone; Neha (General Staff and Accounts) keeps what either Team opens; reopening a section brings it back at Sarah's next request; Teams list, Users and the access drawer still load.

## 233. Tabs that name their panel (refinements before Phase 10)

1. Banking, Payables, Receivables and an account's Reconcile page: with a screen reader (or the browser's accessibility tree), each tab names the panel below it, and moving between tabs reads the new content. Run axe (or Lighthouse) on each in light and dark: no "aria-valid-attr-value" errors.
2. Regression: tabs, counts, the tab kept in the address, cards, filters, search and Print look and behave as before; Tab moves from the tab list into the panel's controls.

## 234. One Settings for everyone (US-AUTH-16 to US-AUTH-19, US-SET-30 to US-SET-34, refinements before Phase 10)

Use an owner with the demo loaded and Sarah Mendes (Staff) in a second browser. Check light and dark, a 1920 × 1200 window and a phone width, and compare with the canvas "29 Settings for everyone".

1. User menu (both): photo or initials, name and email; Settings; Set up Spine (Owner only); Light / Dark / System (named "Follow system"); Sign out — each with its icon, no "Profile & Preferences".
2. Theme: pick Dark in one browser, then sign in as the same person in another (or a private window): it opens dark. Pick System and switch the computer to dark: Spine follows without a reload. With the API stopped, picking a theme still applies here and a toast says it couldn't be saved.
3. Owner › Settings: opens on Business profile with `?settings=business` in the address; groups Your account, Business, Money & tax, Documents & emails, Sales & meetings, Data and Team (Users, Teams, Audit log, Email log open their pages and close Settings). With Leads & meetings off, Pipeline stages, Upcoming meetings and Meeting reminders are gone.
4. Address: pick Numbering, refresh — still Numbering; Back goes back; close — the parameter goes. `?settings=nope` opens Business profile.
5. Unsaved changes: change a prefix in Numbering — a dot shows by Numbering (a screen reader says "Numbering, edited"); pick Branding, close or press Escape — "Discard unsaved changes to Numbering?"; Keep editing keeps the change; Discard drops it. Save, then leave — no question. Notifications never asks (it saves as it changes).
6. Search: "prefix" → Numbering ("Matches: invoice prefix, quote prefix"); Enter opens it; ↑/↓ move; "logo" → Branding; "GSTIN" → Business profile (and GST in India); "SMTP" → Emails; "zzzz" → "No matching settings." and Clear search.
7. Size: on a 1920 × 1200 window the dialog is about 1152 × 960 and Documents shows its sample page beside the options (D-237: an HTML sample, not the PDF — it follows paper size, title, each column, tax summary, amount in words, signature, terms, notes and Branding's colour and footer as you change them, and stays light in dark mode); on a 1280 × 800 laptop it keeps a margin; on a phone it fills the screen with the list first, then the pane with "Back to settings".
8. Sarah › Settings: opens on Profile; the list is Your account only; `/dashboard?settings=numbering` opens her Profile; `/profile` and `/profile?tab=password` open Profile and Password & security.
9. Profile: upload, crop and remove a photo (Remove asks first); the sidebar and menu show it. Name's Save is off until the name changes; saving toasts "Profile updated.". Change email: a wrong password says "That password isn't right."; another account's address says "Another account uses that email."; with the right password the email changes, a toast says so, and the old address gets "Your Spine sign-in email changed" (or it shows in the email log as not sent without SMTP).
10. Password & security: the devices list shows this browser ("This device", Active now) and others with their IP and last active; Sign out on another device asks first, toasts and signs that browser out; Sign out of other devices does it for all. Change password with "Sign out of my other devices" ticked signs the others out and keeps this one signed in; unticked keeps them.
11. Notifications: "Business default · <n> min" uses the Owner's Meeting reminders setting; the digest names the business's time zone.
12. Regression: onboarding's settings and Set up Spine's cards still open Settings panes and update when closed; Branding's note reads "Each person still chooses light or dark mode from their user menu."; every settings pane saves as before; Field and Staff can't save business settings (API 403).

## 235. Search that finds more (US-OPS-39 to US-OPS-49, refinements before Phase 10)

Use an owner with the demo loaded, Sarah Mendes (Staff) and Marcus Webb (Field) in other browsers. Check light and dark and a phone width, and compare with the canvas "30 Search".

1. Sidebar: "Search…" with ⌘K (Ctrl K on Windows) sits under the logo and opens search; collapsed, it's an icon with the tooltip "Search (⌘K)"; the footer has no search icon any more. ⌘K / Ctrl+K still opens it anywhere.
2. Before typing: the placeholder reads "Search records, pages and settings". With nothing opened yet: "Type a name, a number like INV-0010 or an amount like 2,389.50." and "You can search …" listing this person's areas (Marcus: "your meetings, jobs and expenses"). Open an invoice and a job, search "bluewater" and open a result, then reopen search: RECENT lists them newest first, RECENT SEARCHES has "bluewater"; choosing it fills the field. In another browser as the same owner, the same list shows. "Clear recent" empties both without asking.
3. Results: "harborview" shows Contacts, Leads, Meetings, Quotes, Jobs, Invoices… in the sidebar's order, each row with its section's icon, "harbor" in bold and a coloured status; each group ends with "See all … matching “harborview”", which opens that list with the search box filled. Meetings has no See all.
4. Contacts: a phone number's last digits ("555 0107"), part of a GSTIN or tax ID, or a contact person's name finds the contact, with "Phone …", "GSTIN …" or "Contact: …" on the second line. Marcus never sees contacts.
5. Amounts: "4,542.50", "$4,542.50" and "4542.5" find DEMO-INV-0002 first in Invoices with the amount in bold; "4,542" finds nothing for $4,542.50. Marcus gets no amount matches.
6. Actions, pages and settings: "new inv" → New invoice opens the invoice builder; "add lead", "new meeting", "record payment", "record vendor payment" and "add catalogue item" open their forms; "receivables", "trial balance" and "audit log" open their pages; "invoice prefix" opens Settings › Numbering. Sarah without invoice rights doesn't see New invoice and never sees business settings.
7. New groups: "marina" finds the lead (with its stage) and the walkthrough meeting (Upcoming or Past); "drywall" finds the catalogue item and opens it on Catalogue; "VCR-" with a number finds that vendor credit first.
8. Include archived: archive a contact; it doesn't show until "Include archived" is ticked (then "Archived"); the tick is remembered after a reload on this device.
9. Chips: Tab from the field reaches them; arrows move; Billing shows only invoices, credit notes and payments, up to 20 each, with no actions, pages or settings; reopening search is back on All. Marcus sees Sales (meetings), Jobs and Purchases (expenses).
10. Loading: with the network throttled (Slow 4G), choose a result — search stays open with a spinner on that row until the page shows, then closes; choosing another row meanwhile does nothing.
11. Phone width: the palette fills the screen and the chips scroll sideways. Screen reader: the dialog is "Search", the field a combobox; icons aren't read.
12. Regression: a document number ("INV-0010", "QUO-4") is still the first result; Settings' own search, the Reports page search and every list's search box work as before; Field still sees only their jobs, meetings and expenses.

## 236. Settings › AI assistant: the switch and the provider (US-AI-01, US-AI-02, Phase 10)

Use a new owner (no demo needed) and Sarah Mendes (Staff) in a second browser. For a local model, run Ollama on this machine or another on the network (`ollama serve`, then `ollama pull qwen3-vl:8b` (reads images) and `ollama pull qwen3:4b` (text only); `llama3.2-vision` doesn't load on current Ollama); for the cloud path, an Anthropic API key with a little credit. Check light and dark and a phone width, and compare with the canvas "01 Settings" of the Claude Design project "Spine web — Phase 10 AI assistant".

1. Owner › Settings: "AI assistant" (Bot icon) sits in Business after Modules; searching settings for "AI", "provider", "model", "budget" or "receipts" finds it. Sarah doesn't see it, and `/dashboard?settings=ai` opens her Profile.
2. A new install: the switch reads Off and the pane says "AI helps fill in forms — reading bills and receipts, drafting emails and quote lines, suggesting bank matches. It never saves, sends or posts anything by itself." Switching on says "Connect a provider first." and stays off.
3. Local model: choose "Local or OpenAI-compatible", enter `http://<ollama-host>:11434/v1`, open Model — it lists the server's models; you can also type one. Test connection with qwen3-vl:8b: "Connected · qwen3-vl:8b · reads images: yes"; with qwen3:4b: "reads images: no". A wrong address: "Couldn't reach <address>: the connection was refused. Check the address and key, then try again." Save toasts "AI provider saved".
4. Switch on with the local model: no question; toast "AI assistant is on". Settings › Modules shows "AI assistant" as the fifth module, "On · <ollama-host>:11434", and "Set up in AI assistant" opens this pane.
5. Anthropic: choose "Anthropic Claude", paste the key, pick or type a model (e.g. claude-sonnet-5-5), Test connection: "Connected · <model> · reads images: yes". Save while AI is on: "Send AI requests here?" names api.anthropic.com and lists what each feature sends and "Never sent: …"; Use this provider saves it. Reopen the pane: the key shows only as "••••" and its last four characters, with Replace key.
6. Switch off: "Turn off AI?" says "AI buttons disappear for everyone. Nothing already saved changes."; toast "AI assistant is off". Switch on again: no second question for the same provider.
7. Audit log (Team › Audit log, record type AI assistant): each switch, provider change and the acknowledgement ("Sends business data to api.anthropic.com"); the key appears only as "••••" and four characters.
8. Unsaved changes: edit the server address and pick another pane — "Discard unsaved changes to AI assistant?". Discard drops the edit.
9. Security: in Sarah's browser, `GET /org/ai` and `PUT /org/ai` answer 403; `GET /org/settings` doesn't include `ai` or `ai_provider_key`; `GET /org/settings/ai` answers 403. A data export's settings.csv has no `ai_provider_key` row. With AI off, `GET /ai/status` answers 403 "The AI assistant is off. An owner can switch it on in Settings › AI assistant."; the provider gets no request unless an Owner presses Test connection (watch Ollama's log).
10. Regression: Settings › Modules still switches its four modules as before and their Save is unchanged; every other Business pane opens and saves; Set up Spine and onboarding's settings still open their panes.

## 237. AI features and the monthly budget (US-AI-03, US-AI-04, Phase 10)

Use the owner from section 236 with AI on against Ollama (qwen3-vl:8b), and Sarah Mendes (Staff) in a second browser. Compare with the canvas "01 Settings".

1. Settings › AI assistant with AI on: Provider sits beside a Features card listing "Read bills and receipts", "Draft customer emails", "Draft quote lines" and "Suggest bank matches", each with where it shows, a switch (all on at first) and "What's sent". With AI off, neither Features nor Monthly budget shows.
2. What's sent: open each — it says exactly what that feature sends and "Never sent: bank account numbers, tax IDs and GSTINs, UPI IDs, passwords or keys." Pick qwen3:4b and Test connection, save: "Read bills and receipts" notes "Needs a model that can read images. PDFs with text still work."
3. Switch "Suggest bank matches" off: it saves at once, toasts "Suggest bank matches is off", and the audit log shows it. In Sarah's browser, `GET /ai/status` shows `bankSuggestions: false`.
4. Monthly budget: type "lots" and Save — "Enter the budget as a whole number of tokens, or leave it empty for no limit."; type 500 — the API says "Enter at least 1,000 tokens, or leave it empty for no limit."; type 2,000,000 and Save — toast "Monthly budget saved"; "This month" shows tokens used of 2,000,000 with the percentage in words and a bar, the request count, and Top features and Top people (or "None yet"). Empty and Save — "AI has no monthly limit."
5. Paused: with no AI feature built yet, check through the API — set the budget to 1,000, then insert `ai_requests` rows for this month totalling over 1,000 tokens (or wait for US-AI-08). The pane says "AI is paused until 1 <next month> — this month's budget is used up."; `GET /ai/status` has `pausedUntil`. Raise the budget and the pause lifts at once. Owners get "AI has used 80% of this month's budget." once and the paused message once (bell and email).
6. Security: Sarah's `GET /org/ai/usage` answers 403; `GET /org/ai/usage?month=2026-13` answers 400 "Give the month as YYYY-MM."
7. Regression: everything in section 236 still works; switching AI off and on keeps the feature switches and the budget.

## 238. Who may use AI, and the record of its use (US-AI-05, US-AI-06, Phase 10)

Use the owner from section 236 with AI on, Sarah Mendes (Staff, General Staff) and Marcus Webb (Field) in other browsers. Compare with the canvas "02 Team and audit".

1. Team › Teams › General Staff › Permissions: an "AI assistant" group lists "Use AI features", off. Switch it on: marked Changed, the bar says "1 change", and "What members will open" doesn't list AI but says "AI isn't a section. With Use AI features, members see AI on the bills, expenses, quotes, emails and reconciliations they can already work on." Save changes asks first and names it; History records it.
2. Sarah: before the save `GET /ai/status` says `canUse: false`; after it `canUse: true`. Marcus: `canUse: false`, `canReadOwnReceipt: true`.
3. Switch AI off in Settings: the "AI assistant" group disappears from Permissions; switch it back on — the grant is still there.
4. Audit log (record type "AI request"): once US-AI-08 onwards exist, each AI request shows the action ("Read a document" …), the record it was for (opens it) and "<provider> · <model> · <n> tokens · Worked" (or why it didn't). Until then, check through the API: `GET /org/audit-log?entityType=ai_request`.
5. Activity: `POST /vendor-bills` with `"aiAssisted": true` — the bill's Activity reads "Created as a draft · filled in with AI" (Sparkles icon), with who and when underneath; its History reads "… created this bill and filled it in with AI". Same for an expense ("Submitted for approval · filled in with AI") and a quote edited with `aiAssisted` ("Edited · filled in with AI").
6. Regression: Teams' other permissions, Sections, History and the Save confirm work as before; a Staff member's sidebar is unchanged; bills, expenses and quotes save and show their Activity as before when `aiAssisted` isn't sent.

## 239. Keep working when AI is unavailable (US-AI-07, Phase 10)

Use the owner from section 236, with AI on and the provider pointing at a local Ollama. Compare with the canvas "VendorBillBuilderAiError". The AI controls themselves arrive with US-AI-08 onwards; until then, check steps 1–3 through the API and step 4 on the bill page.

1. Stop Ollama (`ollama stop` or quit the app). Any AI request answers 503 `AI_UNAVAILABLE` "AI didn't answer. Fill this in by hand or try again." at once — not after a wait — and Settings › AI assistant › Monthly budget doesn't count it as tokens.
2. Point the provider at an address that accepts connections but never answers (for example `nc -l 9999` and `http://127.0.0.1:9999/v1`): the request gives up after 30 seconds with 504 `AI_TIMEOUT` and the same words. The audit log's AI request entry says "Didn't answer in 30 seconds".
3. Neither is retried: the provider (or `nc`) sees one request each time.
4. With the provider still down, Purchases › Vendor bills › New vendor bill: fill it in by hand and press "Save as draft" — it saves as normal, with no "filled in with AI" in its Activity. Same for New expense.
5. Once US-AI-08 is in: press "Read from document" with Ollama stopped — the red message by the header card reads "AI didn't answer. Fill this in by hand or try again. <file> is attached either way." with "Try again"; what you typed stays. Start Ollama and press "Try again": empty fields fill, typed ones don't. Press "Cancel" while it reads: nothing fills.
6. Regression: Settings › AI assistant, bills and expenses save, and "Test connection" behave as before.

## 240. Fill in a vendor bill from the vendor's PDF or photo (US-AI-08, Phase 10)

Use the owner from section 236 with AI on and Ollama running `qwen3-vl:8b` (reads images; Test connection says "reads images: yes"). Have a vendor's bill as a PDF with text (most emailed invoices), a scanned PDF, and a phone photo (JPEG). For a GST business, set the tax profile to India. Compare with the canvas "VendorBillBuilderAi" and "VendorBillBuilderAiDark".

1. Purchases › Vendor bills › New vendor bill: the top of the header card reads "Read the vendor's bill with AI" with "Read from document". With AI off, the feature off or a Staff member without "Use AI features", the strip isn't there.
2. Press "Read from document" and choose the PDF: "Reading <file>…" with "Cancel" while it works, and the form stays usable. Then "<file> · Read by AI in <n> seconds · attached to this bill · check what it filled in before you save" with "Read another document".
3. Vendor, Bill number, Currency, Bill date, Due date and (GST) Place of supply show "Suggested by AI"; the vendor reads "Matched to your vendor." when it's one of yours. Lines arrive as compact rows, tinted, each with "Suggested by AI"; below them "Accounts come from this vendor's last bill · rates matched to yours by percentage" (or only the rates part for a new vendor). Totals in the bar are Spine's.
4. Change any marked field or line: its mark goes, the others stay.
5. A due date written as terms reads `From the document: "Payment due within 30 days".` A bill with no due date: the vendor's usual terms as by hand ("Suggested: 20 days, as on this vendor's last bill"), else "The document has no due date — choose one."
6. A bill number this vendor already has shows the duplicate warning before saving (US-PUR-35).
7. A document whose printed total differs from the lines: "The document says ₹18,290.00; the lines add up to ₹18,172.00. Check the lines before saving." — it goes once the lines match.
8. A vendor that isn't in your contacts: "+ New vendor: <name> — added only if you choose it." Nothing is added until you press it and confirm "Add <name> as a vendor?"; then they're chosen and a toast says so. Staff without the right to add contacts see "Not one of your vendors: <name>".
9. "Save as draft" (or "Save and record", which asks "Record this bill?"): the bill saves as normal, the file is in its Attachments, and its Activity reads "Created as a draft · filled in with AI".
10. Open a draft bill's edit page and read another document: only empty fields fill; "Replace my entries (<n>)" offers AI's values for the rest and its lines for yours.
11. In Attachments on a draft, a PDF or photo offers "Read"; an HEIC photo doesn't.
12. The scanned PDF and the photo read too (sent as images). Switch to a text-only model (`qwen3:4b`, Test connection "reads images: no"): the photo says "Your AI model can't read images. Choose a model that can, or enter the bill by hand." and stays attached; a PDF with text still reads.
13. Dark mode: the strip, the marks, the tinted rows and the warnings read clearly.
14. Regression: a bill entered by hand, Duplicate, the due-date suggestion, the duplicate warning, place of supply and Attachments work as before.

## 241. Fill in an expense from a receipt (US-AI-09, Phase 10)

Use the owner from section 236 with AI on and Ollama running `qwen3-vl:8b`. Have a fuel receipt photo showing CGST + SGST, and a receipt with no tax. Make a category "Fuel & freight" ("Diesel, petrol and transport") and submit three expenses described "HP Fuel Centre — diesel" in it. Compare with the canvas "ExpenseFormAi".

1. Expenses › Submit expense, drop the fuel receipt: under the preview, "Read receipt". With AI off, the feature off or Staff without "Use AI features", it isn't there. Switch to "Headcount × day rate": it goes; back to Amount: it's back.
2. Press it: "Reading…" with "Cancel"; the form stays usable. Then "Filled in from the receipt. Check the fields marked Suggested by AI before you submit." above the form, and Category, Date, Currency, Amount, Tax rate, Tax amount and Description marked "Suggested by AI". Job and Paid by are untouched. The button reads "Read again" and the caption "<file> · the receipt · read by AI".
3. Category reads "As on your last 3 expenses from HP Fuel Centre."; Tax amount "From the receipt: CGST ₹369.92 + SGST ₹369.91."; Description "HP Fuel Centre — HSD diesel, 52.4 L". For a GST business the rate is the IGST rate of the same percentage (an expense takes one rate).
4. A receipt from a new shop: the category is the one whose name and "What it's for" fit, or empty if none does.
5. A receipt with no tax: the category's usual rate fills in and the tax amount reads "Worked out from <rate>, included in the amount."
6. Already submitted the same amount on the same day: the duplicate warning shows once Amount and Date fill.
7. Change a marked field: its mark goes. "Submit expense": it's waiting for approval as normal and its Activity reads "Submitted for approval · filled in with AI". "Submit and add another": the fresh form has no marks and no banner.
8. Reject an expense, then "Fix and resubmit" and read its receipt: only empty fields fill, with "Replace my entries (<n>)" for the rest.
9. Marcus (Field, no Team right): on his own new expense "Read receipt" works; he can't read anyone else's.
10. Stop Ollama and press "Read receipt": "AI didn't answer. Fill this in by hand or try again. The receipt stays on the expense." with "Try again"; the expense submits by hand.
11. Dark mode: the banner, marks and notes read clearly.
12. Regression: submitting by hand, the category's usual rate, tax worked out, more files, the duplicate warning, labour entries and Fix and resubmit work as before.

## 242. An expense's receipt is your own upload (D-250, security)

1. Submit an expense with a receipt on the web and on the phone: both save with the receipt as before.
2. Edit a waiting expense without changing its receipt, then swap in a new photo: both save.
3. Through the API as a Field user, `POST /expenses` with `receiptFileId` set to a file someone else uploaded (for example an Owner's upload): 400 "Upload the receipt first.", and `GET /files/<id>` stays 404 for them.
4. Through the API, reuse a receipt already on another expense, or a file attached to a bill: 400 "This file is already used elsewhere. Upload the receipt again to use it here."
5. The same rule everywhere (API as a Field user): `POST /jobs/<id>/photos` or a milestone completion with someone else's file → 400 "Upload the photo first."; your own job photo reused as a receipt or an attachment → 400; `PUT /users/me` (and `POST /api/auth/update-user`) with `image` set to another record's file → 400, and the file stays 404 for you.
6. Contacts: a new logo must be your own upload; saving a contact whose logo or people's photos someone else added still works.
7. Regression: Load demo data — its expenses have their receipts; attachments on bills and expenses, job photos from the phone (including a retried send), milestone completion with photos, accepting a quote in person, contact logos and changing your profile photo all work as before.

## 243. Fill in my expense from a receipt on the phone (US-AI-10, Phase 10)

On an iPhone and an Android phone, signed in as Marcus (Field). The owner has AI on with Ollama running `qwen3-vl:8b` (reads images), and a category "Fuel & Vehicle". Have a fuel receipt to photograph. Compare with the canvas "MobExpenseNewAi" and "MobExpenseNewAiAndroid".

1. Expenses › + (or Today › Scan receipt), take the receipt photo. Under it: "Read receipt" (tinted, sparkles), "Retake" (grey on iOS, outlined on Android) and "Remove". With AI off, the feature off, Staff without "Use AI features", or a text-only model (`qwen3:4b`), only "Retake receipt" and "Remove" show.
2. Tap "Read receipt": "Reading…" with "Cancel"; the form stays usable. Then the note "Filled in from your receipt. Check the amount, date and category before you submit." at the top; Amount, Category, Date and Description each "Suggested by AI" (iOS: under the amount, on the category row, beside the date, on the description; Android: under each field). Job and Paid by are untouched; there are no tax fields. The receipt line reads "receipt.jpg · read by AI" and the button "Read again".
3. Change the amount: its tag goes, the rest stay. Submit: it joins "Waiting to sync" and then "Submitted by you"; on the web its Activity reads "Submitted for approval · filled in with AI", and its receipt is the photo AI read (the server has it once — no second upload).
4. Type an amount before reading: it's kept, and the note offers "Replace my entries (1)"; tapping it fills AI's amount with its tag.
5. Turn on Airplane mode after taking the photo: "Read receipt" shows dimmed with "Needs a connection — fill it in, or read it later."; fill it in by hand and Submit — it queues and sends when back online exactly as before, with no "filled in with AI".
6. Switch to "Headcount × day rate": "Read receipt" goes.
7. Tap Cancel while it reads: nothing fills. Retake while it reads: nothing fills, and the new photo is unread.
8. Stop Ollama and tap "Read receipt": "AI didn't answer. Fill this in by hand or try again." with "Try again".
9. A receipt in another currency (e.g. EUR on a USD business): the amount stays empty and the note says "The receipt is in EUR, so the amount wasn't filled in — enter it in USD."
10. Owner sets the monthly budget below what's used: "Read receipt" is dimmed with "AI is paused until 1 November — this month's budget is used up." (check the date reads correctly on both phones).
11. VoiceOver / TalkBack: "Read receipt" (or the reason it's dimmed), "Reading…" as busy, "Cancel reading the receipt", each "Suggested by AI", "Try reading the receipt again"; when the read ends it's announced ("Filled in from your receipt…" or "AI didn't answer…"). Switching to Labour while reading stops it.
12. Dark mode and Reduce Motion (no spinner while reading).
13. Regression: New expense without AI, Scan receipt, retake/choose/remove, Fix → edit of a refused expense, labour entries and syncing work as before.
14. Automated on a simulator: `e2e/us-ai-10-receipt.yaml` (iOS and Android) does steps 1–3 with a photo from the library; `e2e/us-ai-10-offline.yaml` (Android) does step 5.
15. Android 13–15 (D-253): on an Android 15 phone or emulator, the back gesture and button go back a screen — from a job to Jobs, from Sync to Today, from New expense to Expenses — and close the app only from a tab's first screen. Same on Android 16+.

## 244. Draft a customer email with AI (US-AI-11, Phase 10)

As an Owner, with AI on against a model on your network (or the stub) and "Draft customer emails" on. Compare with `SendEmailDialogAi`, `SendEmailDialogAiSuggestion` and `SendEmailDialogAiUsed`. Use an overdue invoice with a balance (the demo data has one).

1. The invoice › Send reminder: the dialog opens with the reminder template filled in as before. In the Message, the customer's name, the invoice number and "is <n> days overdue" are highlighted (a tint with an underline); the helper text reads "Starts from your template in Settings › Emails. Highlighted words are this invoice's details — Spine fills them in. Changes here apply to this email only." Subject isn't highlighted.
2. "Draft with AI" sits between To and Subject with "Shows AI's draft first — your email stays as it is.". Press it: "Drafting…" with Cancel; the fields stay editable. Then a panel "AI's draft — check it, then use it. Your email below doesn't change until you do." shows a subject and message with the invoice's details highlighted; Subject and Message below are unchanged.
3. Every highlighted detail in the draft matches the invoice exactly (number, amounts, due date, days overdue, business name). "Try again" gives another draft; "Discard" closes the panel and nothing changed.
4. "Use this draft": Subject and Message take the draft, each tagged "Drafted by AI"; "Using AI's draft — check it before sending." with "Undo". Type in the Subject: its tag goes. "Undo": both fields are back as they were, with no tags.
5. Use a draft and press "Send reminder": "Reminder sent"; the email log shows it with the drafted subject, and the email received reads as the dialog did, with no highlights.
6. The same "Draft with AI" in: Email invoice, Send quote (a draft quote keeps `{document_number}` and `{link}` for the send), Email receipt (a payment), Email credit note, Receivables › Send reminder, and a contact's Send a statement (the draft follows the period shown; changing the period after using a draft doesn't overwrite it).
7. Hidden: AI off, "Draft customer emails" off, or a Staff member without "Use AI features". Staff with the right but without "Send a payment reminder" don't get the reminder dialog at all. With the monthly budget used up: the button is dimmed with "AI is paused until 1 <month> — this month's budget is used up."
8. With a "thinking" model (e.g. `qwen3.5:4b` on Ollama) the draft still arrives within a few seconds — Spine asks it not to think (D-255). Stop the model and press "Draft with AI": "AI didn't answer. Fill this in by hand or try again. Your email is as it was." with "Try again".
9. A model that makes up a number ("pay within 7 days", a different amount) gets the same "AI didn't answer…" — check with the stub's reply, or note it if your model never does it.
10. Type `{invoice_no}` in the statement dialog's Subject: "{invoice_no} isn't a placeholder Spine knows. Use one from the list." and "Send statement" is disabled.
11. Keyboard and screen reader: the suggestion is a region named "AI's draft"; its buttons are reachable by Tab; the tags read "Drafted by AI". Dark mode: the panel, highlights and tags use the dark tokens.
12. Regression: the send dialogs without AI send as before; Settings › Emails' editor and the quote notes editor show no highlights; the email template preview is unchanged.

## 245. A reminder or statement in a chosen tone (US-AI-12, Phase 10)

Same setup as section 244. Compare with `SendEmailDialogAi` and `SendEmailDialogAiSuggestion`.

1. An overdue invoice › Send reminder: "Tone" with Friendly, Formal and Firm sits beside "Draft with AI", Friendly chosen. Choose Firm, then "Draft with AI": the draft is direct about the payment being overdue, with no threats, fees, interest, legal action or new deadlines; the balance, number, due date and days overdue are the invoice's own, highlighted.
2. On the suggestion, choose Formal: it drafts again in that tone ("Drafting…" with Cancel while it does). "Try again" keeps Formal.
3. Receivables › an invoice's Actions › Send reminder: the same tone choice and drafts. A contact's Send a statement: the same.
4. Email invoice, Send quote, Email receipt and Email credit note: no tone.
5. Close the dialog and open it again: Friendly is chosen again.
6. Keyboard: Tab reaches the tone; arrow keys move between Friendly, Formal and Firm; a screen reader names the group "Tone" and says which is chosen.

## 246. Draft quote lines from an enquiry (US-AI-13, Phase 10)

As an Owner with AI on and "Draft quote lines" on, and a catalogue with a few items (one priced in another currency) and a bundle. Compare with `QuoteBuilderAi` and `QuoteBuilderAiDark`.

1. New quote: "Draft lines with AI" sits beside "Add item" (tinted, sparkles). Press it: a side panel "Draft lines with AI" — "Paste the enquiry or describe the work. Lines are matched to your catalogue; nothing changes until you add them." — with an Enquiry box. "Draft lines" is dimmed until there's text.
2. Paste an enquiry and press "Draft lines": "Drafting…" with Cancel; then "Proposed lines" (tagged "Suggested by AI"), every line ticked: catalogue items read "Catalogue item · per <unit>" with their price, a bundle "Bundle · <its items> · <n> lines" with its total, work not in the catalogue "Not in your catalogue" with "Add a price" in amber. "Draft again" and "Drafted from the enquiry and <n> catalogue items" show; the footer reads "<n> of <n> ticked".
3. Untick one: the count follows and "Add to quote (<n>)" with it. Press it: the panel closes and the ticked lines are rows after the last line (a new quote's empty first row is replaced). Each reads "Suggested by AI" on its tinted row; an item has its catalogue price and its tax for the place of supply (inter-state for another state), a bundle is its lines, and a line with no price says "Add a price — not in your catalogue." (or "…the catalogue price is in USD.").
4. Change a row's quantity: its tag and tint go. Give the unpriced row a price: its note goes. Totals follow as usual.
5. Close the panel without adding: the quote is unchanged; reopening shows the enquiry and proposal again.
6. Save as draft: the quote's activity says "Created … · filled in with AI". Edit a draft quote and draft lines there too.
7. Hidden for a Staff member without "Use AI features", and with "Draft quote lines" off. A sent quote has no builder. Stop the model: "AI didn't answer. Fill this in by hand or try again. The quote is as it was." with "Try again".
8. Keyboard: Tab through the panel; Space ticks a line; "Tick all lines" ticks or clears them all; Escape closes it. Dark mode: the panel, the tints and the amber note use the dark tokens.
9. Regression: Add item, picking an item or a bundle by hand, Add heading and Add text line, moving rows, Preview PDF and Save behave as before.

## 247. AI suggestions while reconciling (US-AI-14, Phase 10)

As an Owner with AI on and "Suggest bank matches" on. Import a statement where one line has two same-amount payments near it (the rules can't pick), one has nothing in Spine but looks like something filed before (e.g. bank charges), and one the rules settle. Compare with `ReconcileAiSuggestions`.

1. Start reconciling: the rules' line shows "Suggested match". Beside "Match all suggested (1)" is "Suggest with AI (2 lines)" (tinted, sparkles) — the lines the rules couldn't settle. Nothing runs until you press it.
2. Press it: "Suggesting…" with Cancel; the page stays usable. Then the Suggested tab opens and counts AI's lines too; its note reads "AI looked at the 2 lines the rules couldn't settle · <n> suggestions. AI suggestions aren't in Match all — check and match each one." "Match all suggested" still counts only the rules' line, and the button now reads "Suggest again".
3. The ambiguous line reads "AI suggests: Payment <number> · <customer>" with a reason ("same amount; the description mentions …"), Match and "Not this one". Select the line: in "Unreconciled in Spine" AI's entry comes first, marked "AI suggests", then the other same-amount payment ("Same amount"), then the nearest dates; the subtitle says so.
4. Press Match on it: it moves to Matched and reads "Matched · suggested by AI". "Not this one" on another removes AI's suggestion and nothing is matched.
5. The fee line reads "AI suggests creating: <category> · <contact>" with Create and Exclude. Create: the drawer has the suggested kind chosen (tagged "Suggested by AI") and "AI suggests creating: … — <reason>. Check it before you save."; Continue: the form starts with the category and contact, each "Suggested by AI" until changed. Record it: the line matches, as suggested by AI.
6. Leave the page and come back: the suggestions are still there — no second request (check Settings › AI assistant usage). "Suggest again" replaces them.
7. Hidden without "Use AI features" or with the feature off; dimmed with the date while the budget is used up. Stop the model: "AI didn't answer. Fill this in by hand or try again. Nothing was matched." with "Try again". A finished reconciliation shows none.
8. The audit log has "Suggested bank matches" for "Bank reconciliation · <account> to <end date>", linking to the reconcile page.
9. Keyboard and screen reader: the button and each Match / Not this one / Create are reachable and named; AI's text is read with the line. Dark mode: the tints and marks use the dark tokens.
10. Regression: matching by hand, several entries to one line, "Not this one" on a rule suggestion, Exclude / Include, Unmatch, "Match all suggested" (its confirm lists only the rules' pairs), Create without AI, Finish and Undo behave as before.

## 248. Spine on Better Auth 1.7 (US-MCP-01, Phase 11)

Nothing should look different. Before upgrading a test install, sign in on the web in one browser and on the phone; leave both signed in.

1. Upgrade and run the migrations (`0129` adds two columns to `jwks`). Reload the web app: still signed in, same page. Open the phone app: still on Today, no sign-in screen.
2. Sign out and in again on the web: "Log in" works; a wrong password says "Invalid email or password". Sign up on a new install: the first account becomes the Owner and lands in onboarding; a second sign-up without an invitation is refused ("This Spine is invite-only").
3. Invite a Staff member, accept the email link while signed in with that email: they join the business and its Teams.
4. Password reset: request a link, use it within the hour, then try it again ("This link can't be used" — "Reset links work once and expire after 1 hour."). Every other session — the other browser, the phone — is signed out. A common password like "password123" is refused at sign-up, reset and change.
5. Deactivate a member who is signed in on the phone: their next request shows "Your access to <Business> was removed." and the app signs out. Reactivate: they can sign in again.
6. Phone (iOS Simulator and an Android 15 emulator): `maestro test apps/mobile/e2e/us-mob-01-sign-in.yaml` passes (Android with `-e SERVER=http://10.0.2.2:4000` and the dev-client URL, as the flow's header says).
7. Regression: switching business on the web, "Not you?" on the accept-invite page, the session dialog after signing out in another tab (US-AUTH-12), and the 300-a-minute limit per session.

## 249. Switch connected agents on or off (US-MCP-02, Phase 11)

1. As an Owner, open Settings: "Connected agents" (Plug icon) sits in Business after AI assistant. Search settings for "MCP", "agent", "Claude" or "ChatGPT": it's found. As Staff or Field it isn't listed.
2. On a new install it's off: the pane says what agents do ("… they never issue, send, record or delete anything.") and "The address to add and everyone's connections appear once it's on."
3. Switch it on: "Turn on connected agents?" says an agent sees what its person can see and sends it to that agent's AI provider, with what agents can and can't do. "Go back" changes nothing; "Turn on connected agents" switches it on and the toast says "Connected agents are on".
4. On: "Connector address" shows the API's address + `/mcp` with "Copy" (pasting gives the address), and how to add it in Claude, ChatGPT and Claude Code. On an `http://` address that isn't `localhost` (e.g. `API_URL=http://192.168.1.10/api`), a warning says agents can only connect over https, or from the same computer at localhost.
5. "Agents can create drafts" switches without asking; the toast says "Agents can only read" (or "Agents can create drafts").
6. Settings › Modules lists "Connected agents" after AI assistant with "On" or "Off" and "Set up in Connected agents", which opens the pane.
7. Switch it off: "Turn off connected agents?" ("Every connected agent stops working at once. Connections are kept …"), then "Connected agents are off".
8. Team › Audit log, record type "Connected agents": each switch and the drafts change are there with who and when.
9. Keyboard and screen reader: both switches are named, the confirm traps focus, Copy says what it copies. Dark mode: the warning and cards use the dark tokens.
10. Regression: the AI assistant pane and its Modules row, the four Modules switches, settings search, and the generic settings (business profile, branding) still save.

## 250. Connect an AI agent to Spine (US-MCP-03, Phase 11)

Needs Connected agents on. A real hosted agent needs Spine on an `https` address reachable from the internet; on your own computer, Claude Code works against `http://localhost:4000/mcp`.

1. Claude Code (local): `claude mcp add --transport http spine http://localhost:4000/mcp`, then `/mcp` in Claude Code and choose to authenticate. The browser opens Spine's log-in with "<agent> is asking to connect to Spine. Log in to choose what it can do." and "Your password stays with Spine."
2. Log in: the consent page reads "localhost:<port> wants to use Spine as you" — Claude Code registers itself, so it shows "Calls itself “Claude Code”" with "Unverified name" — then who you're signed in as, what it can read, "Create drafts for you to check" (ticked), what it can't do and that what it reads goes to its AI provider.
3. Allow: the browser returns to Claude Code, which says it's connected. Team › Audit log, record type "Agent connection": "connected" with the agent and what it may do.
4. Claude (claude.ai › Settings › Connectors › Add custom connector) and ChatGPT (Settings › Connectors) with `https://<your-domain>/api/mcp`: the same pages. An agent that identifies itself by its https address (CIMD) shows its name, its host and "Verified address"; one that registers itself shows "Calls itself …" and "Unverified name". Note which each uses.
5. Untick "Create drafts" and Allow: the connection can only read (US-MCP-07 checks no draft tools are offered).
6. Cancel: the agent says access was denied; nothing is connected or audited.
7. As Field: the page lists only "Read your assigned jobs, contacts and the catalogue", "Add notes to your jobs", and "It can't see money or reports…".
8. "Not you?" signs out and returns to log-in for the same request.
9. Switch Connected agents off: the agent's next request is refused ("Connected agents are turned off for <Business>…"); a new consent page says agents are off. Back on: it works again without reconnecting.
10. Deactivate the member: their agent is refused at once; reactivate: it stays disconnected until they connect again. Reset a password: every agent of that person is disconnected.
11. On an `http` address that isn't localhost: the Settings pane warns, and an agent pointed at `/mcp` gets "Spine needs an https address before agents can connect…".
12. Keyboard and screen reader: the checkbox, Allow, Cancel and Not you? are reachable and named; the picture on the right is skipped. Dark mode: the page and the picture use the dark tokens.
13. Regression: ordinary log-in (no agent) lands on the dashboard; sign-up, invitations, password reset, the phone's sign-in.

## 251. See and disconnect connected agents (US-MCP-04, Phase 11)

1. With Connected agents on, every role has Settings › Your account › "Connected agents". With it off, the pane isn't listed and `?settings=my-connected-agents` opens the first pane.
2. Connect an agent (section 250). Your pane lists it: the agent and its host (a check for a verified address, or "Unverified name"), "Read" or "Read and create drafts" ("Read and add job notes" for Field), when it was connected and "Last used" ("Just now", "2 hours ago"…, or "Not used yet").
3. Disconnect: "Disconnect <Agent>?" ("It stops working at once. Drafts it created stay, marked with its name."), then the toast "<Agent> disconnected". The agent's next request is refused; it has to connect again. The audit log has "disconnected".
4. With none: "No agents connected" and the address with "Copy address".
5. As an Owner, Settings › Connected agents › Connections lists everyone's, with the person and their role. Disconnecting someone else's says they'll be told; they get "<Owner> disconnected <Agent> from your account." in their notifications and by email.
6. Leave a connection unused for 30 days (or set its last use back in the database): it disappears from the lists and its agent is refused.
7. Staff can't call `GET /org/agents/connections` (403). Disconnecting someone else's from your own pane isn't possible.
8. Keyboard and screen reader: each Disconnect says which agent (and whose, on the Owner's list). Dark mode: the badges and table use the dark tokens.
9. Regression: Settings deep links (`?settings=data-export`, `?settings=ai`), the Modules pane, notifications.

## 252. Ask an agent to find and read records (US-MCP-05, Phase 11)

Connect Claude Code (section 250) as each role in turn.

1. Ask "What tools do you have from Spine?": `search`, `list_records` and `get_record`, read-only.
2. "Find Harbour Road" (a contact you have): it uses `search` and finds the contact (and its documents).
3. "List my overdue invoices": it uses `list_records` with type invoice and status overdue; amounts come as "$1,250.00", each with a link that opens the invoice in Spine.
4. "Open invoice INV-0042": `get_record` by number, with its lines, tax, totals and balance. A number that doesn't exist: "No invoice INV-9999 that you can open."
5. As Staff whose Teams can't open invoices: invoices aren't among the types it can list, and asking for one by id is refused.
6. As Field: only contacts, catalogue items, jobs assigned to them (no contract value or costs) and their own expenses.
7. Settings › Your account › Password & security: the agent doesn't appear as a signed-in device, and "Sign out other devices" doesn't disconnect it.
8. Regression: the web's lists and pages for the same records show the same things.

## 253. Ask an agent who owes us and how the business is doing (US-MCP-06, Phase 11)

1. As an Owner's agent: "Who owes us money?" — it uses `receivables`; the totals and invoices match Receivables in Spine exactly, with formatted amounts and a link.
2. "What did we make last month?" — `profit_and_loss` for that month; the figures match the Profit & Loss report for the same dates and basis. Ask for cash basis: it matches the cash-basis report.
3. "What's our balance sheet at the end of September?", "How are our jobs doing?", "What's in the bank?", "How's the business doing?" — `balance_sheet`, `job_profitability`, `bank_balances`, `dashboard_summary`, each matching its page.
4. Dates the wrong way round: "Choose a From date on or before the To date."
5. As Staff whose Teams only read receivables: only `receivables` among the report tools; asking for profit and loss says it can't.
6. As Field: no report or bank tools at all; asking about money gets a refusal, never a figure.
7. Regression: the Reports pages themselves.

## 254. Have an agent start work as drafts (US-MCP-07, Phase 11)

1. With a connection that allowed drafts, ask "Draft a quote for Harbour Road for 20 m² of deck boards and two days of labour": `draft_quote` creates a draft (no number yet) with the catalogue item's price and tax and Spine's totals; the answer links to it and says to check and send it in Spine.
2. Open the quote: Activity's first entry reads "Created as a draft · via <Agent> for <you>". Nothing was emailed.
3. Ask for a line priced in another currency without a price: "<item> is priced in EUR. Give its price in USD."
4. "Draft the bill from Coastal Timber CT-8812": `draft_vendor_bill` makes a draft bill; Banking, the books and Payables don't change until you record it.
5. "Create a lead for Anika Shah, who wants her kitchen redone": a new contact (if she isn't one), the lead, and her enquiry as its first note.
6. "Add a note to the Harbour Road job": the note appears on the job. As Field: only jobs you're assigned to.
7. Ask it to send the quote, issue an invoice, record a payment, approve an expense or delete anything: it has no tool for that and says you'll need to do it in Spine.
8. A read-only connection, or drafts switched off for everyone: no draft tools.
9. After 30 drafts in an hour from one agent: "Too many drafts from this agent. Try again later."
10. Team › Audit log: the drafts' "created" entries name the agent (US-MCP-08 lists the agent's requests).
11. Regression: quotes, bills, leads and notes made in Spine itself show no "via".

## 255. See every agent request in the audit log (US-MCP-08, Phase 11)

1. With a connected agent, ask it to search for a customer, open a quote, read receivables and draft a quote.
2. As an Owner, open Team › Audit log and choose Record type "Agent request": one row per call, newest first, each with when, who (the person the agent acts for), the action ("Searched", "Read a quote", "Read receivables", "Drafted a quote"), the record it touched and "<Agent> · Worked" in Details.
3. Select the quote's record link: the quote opens. A search or a report has no record ("—").
4. Ask it for a quote number that doesn't exist: the row reads "Read a quote" with "<Agent> · Refused — No quote Q-9999 that you can open."
5. Nothing you typed to the agent, and nothing it was told, appears in the log or the CSV export — only the tool, the record and the outcome.
6. Record type "Agent connection": connecting and disconnecting are there. Record type "Connected agents": switching agents on or off, and allowing drafts, are there.
7. Make more than 120 calls in a minute from one agent (a script, or ask it to read many records quickly): it's told "Too many requests from this agent. Wait a minute and try again." and the log shows "Slowed down — over 120 calls a minute". After a minute it works again.
8. Regression: the audit log's other record types, the One record view and Export CSV read as before; AI request entries still read "AI request".

## 256. Start from a ready-made task (US-MCP-09, Phase 11)

1. In an agent that shows MCP prompts (Claude Desktop's "+" menu, Claude Code's `/` commands, VS Code's prompt list), connected as an Owner: it offers "Chase overdue invoices", "Summarise a job" and "This week in the business".
2. Run "Chase overdue invoices": the agent reads Receivables (overdue) and lists each customer's overdue invoices with amounts and days late, with a suggested reminder for each. It creates and sends nothing — Team › Audit log shows only "Read receivables" (and any "Read an invoice") for that agent.
3. Run "Summarise a job" and give a job's number or name: the agent finds and opens the job and says where it stands, with its profit so far; the job link opens it in Spine.
4. Run "This week in the business": a short briefing from the dashboard, receivables, payables, bank balances, jobs in progress and quotes waiting.
5. Connected as Staff whose Teams can't see money reports: no "Chase overdue invoices"; the briefing covers jobs and quotes only.
6. Connected as Field: "Summarise a job" (assigned jobs only, no money) and "This week in the business" (their jobs); no chasing.
7. Regression: tools, the audit log entries and drafts behave as in sections 252–255.

## 257. Report health and readiness (US-OPS-05, Phase 12)

1. With Spine running, open `<API>/health`: `{ "status": "ok", "service": "spine", … }`.
2. Open `<API>/health/ready` without signing in: 200 with `"database": "ok"`, `"queue": "ok"` and the storage driver.
3. Stop Postgres (`docker compose stop db`), then open `/health/ready` again: within about 3 seconds it answers 503 with `"database": "unreachable"` and "The database isn't reachable." Start Postgres again: it's back to 200 without restarting the API.
4. With Docker Compose (`--profile minimal up -d`), run `docker compose ps`: `api` shows `healthy` after start-up, and `web` starts only after that. If the API can't reach the database, `api` turns `unhealthy` and `web` doesn't start.
5. Regression: the field app's sign-in still finds the server by its address (it reads `/health`), and the storage banner (section on US-OPS-31) still shows when the files volume is nearly full.

## 258. Log every request with an id (US-OPS-07, Phase 12)

1. Run the API image (or the API with `LOG_FORMAT=json`) and follow its logs (`docker compose logs -f api`).
2. Open any page in the web app: each API request writes one JSON line with `time`, `level`, `requestId`, `method`, `path`, `status` and `durationMs`. A 4xx is `"level":"warn"` and a 5xx is `"level":"error"`.
3. In the browser's network tab, any API response has an `X-Request-Id` header, and the same id is on that request's log line.
4. Sign in with a wrong password, then a right one; open a public quote link and a file download. In the logs, search for the password, the quote link's token, `session_token=`, and the file link's `sig=`: none of them appear. Paths show `[token]` where a link's token was.
5. Without `LOG_FORMAT` and outside production (`pnpm dev`), logs are Nest's readable lines, and request lines read `GET /invoices 200 12ms [<id>]`.
6. Regression: the API's start-up lines, email worker lines and Better Auth warnings still appear (now through the same logger).

## 259. Publish a release with one tag (US-OPS-51, Phase 12)

1. `node scripts/release/version.mjs v1.0.0-beta.1` prints `version=1.0.0-beta.1` and `prerelease=true`. `node scripts/release/version.mjs v1.0.0` fails, saying the tag doesn't match the root `package.json` version.
2. `node scripts/release/release-compose.mjs 1.0.0-beta.1`: the api and web services read `image: ghcr.io/haribrothers/spine-api:1.0.0-beta.1` (and `spine-web`), there's no `build:`, and the Caddyfile mounts from `./Caddyfile`.
3. Build the web image (`docker build -f docker/Dockerfile.web .`) and run the stack: signing in works at `http://localhost`, and in the browser's network tab, API calls go to `http://localhost/api/...`, not port 4000.
4. When the first beta is tagged: the CI run on the tag runs every job including E2E, then "Release". GHCR has `spine-api` and `spine-web` tagged `1.0.0-beta.1` (no `latest`), and the GitHub release is marked "Pre-release", with the scripts, `docker-compose.yml`, `Caddyfile`, `.env.example` and `SHA256SUMS` (check with `sha256sum -c SHA256SUMS`).
5. Regression: pull requests still run only lint, typecheck, unit (now with script tests) and integration; "Release" doesn't appear on a PR.

## 260. Install Spine with one command (US-OPS-01, Phase 12)

Use a clean Linux or macOS machine (or Windows with WSL2) with Docker 24+ and nothing of Spine on it. Start a stopwatch.

1. Download the release's files (or clone the repo) and run `./install.sh` (`scripts/install.sh` in a clone). It checks Docker and Compose, asks "The address people will open Spine at [http://localhost]", and creates `.env` with a random `AUTH_SECRET` and database password. `.env` is readable only by you.
2. It pulls the images and waits until Spine is healthy, then prints "Spine is running at <address> — open it to create the first account." and the commands for logs, backup, upgrade and stop.
3. Open the address and sign up: the first account is the Primary Owner. Follow onboarding and issue a first invoice. Stop the stopwatch: under 5 minutes from download to issued invoice (NFR-MNT-01).
4. `docker compose logs api` shows "Applied 133 database migrations" on the first start, and "The database is up to date" after a restart.
5. Run `./install.sh` again: "Keeping your existing .env — nothing in it is changed.", and Spine starts as before with your data.
6. `APP_URL=https://spine.example.com ./install.sh` on a fresh folder asks nothing. So does `./install.sh --non-interactive` (address http://localhost).
7. With Docker stopped: "Docker is installed but isn't running…". Without Docker: "Docker isn't installed. Install Docker 24 or newer…". Both exit with an error.
8. `docker images`: `spine-api` and `spine-web` are a few hundred MB each, not several GB.
9. Regression: `pnpm dev` and `pnpm verify` work as before (the API now also applies migrations when it starts; `MIGRATE_ON_START=false` turns that off).

## 261. Back up everything into one file (US-OPS-03, Phase 12)

1. On a running install with some data, including an uploaded logo or receipt, run `./backup.sh` (`scripts/backup.sh` in a clone). It prints each step, then "Backup saved: backups/spine-backup-<YYYYMMDD-HHMMSS>.tar.gz (<size>)" and a reminder that it isn't encrypted. It exits 0.
2. `ls -l backups`: the file is `-rw-------`. `tar -tzf <file>` lists `manifest.json`, `database.dump` and `files/…`. The manifest has the Spine version, the dump's checksum and each file's checksum.
3. `./backup.sh --passphrase`: it asks twice, without echoing, and writes `….tar.gz.enc`. Mismatched passphrases stop it with "The two passphrases don't match." With `BACKUP_PASSPHRASE` in `.env`, it encrypts without asking.
4. Stop the database (`docker compose stop db`) and run `./backup.sh`: it fails with the reason, exits non-zero, and leaves no file in `backups/`. Start the database again.
5. Set `BACKUP_REMOTE` and its keys for a test bucket (R2 or B2) with no passphrase: it refuses, because only encrypted archives are copied off the machine. Add `BACKUP_PASSPHRASE`: the archive is uploaded. After backups across more than 7 days, at most 7 daily and 4 weekly copies remain.
6. As an Owner, with the last backup more than 2 days old (or none, on an install older than 2 days), every page shows "Your last backup was <n> days ago. Run a backup to keep your data safe." (or "Spine hasn't been backed up yet…"). It goes after a backup. Staff and Field never see it.
7. `./backup.sh --help` shows a nightly cron line and how to copy backups off the machine.
8. Regression: the storage banner (US-OPS-31) still shows alongside it when the files volume is nearly full.

## 262. Restore a backup into a clean install (US-OPS-04, Phase 12)

1. On an install with real data (some issued invoices, an uploaded logo), run `./backup.sh --passphrase`, and copy the archive and `.env` to another machine (or folder).
2. There: run `./install.sh --non-interactive`, replace its `.env` with the old install's (at least `AUTH_SECRET`), then `./restore.sh <archive>`. It asks for the passphrase, says it's stopping Spine, checks every file, replaces the database, puts the files back and prints "Restored. Spine is running at <address> with the backup's data — sign in as before."
3. Sign in with your old account: invoices, the trial balance, logos and PDFs are all there and open.
4. Run `./restore.sh <archive>` again: "This install already has data (1 organisation). Restore into a clean install, or pass --replace…". Nothing changes, and Spine keeps running. `--replace` restores over it.
5. Restore with the wrong passphrase: "The passphrase doesn't open this backup…", and nothing changes.
6. On a fresh install with its own new `AUTH_SECRET`: the restore refuses, explaining that two-factor and stored keys need the old secret. With `--new-secret` it restores, and two-factor users set it up again.
7. A backup from a newer Spine (for example a 1.1 archive on 1.0): "This backup is from Spine 1.1.0, which is newer than this install… Upgrade this install to 1.1.0 or later first". A backup from an older Spine restores, and the API brings it up to date on start ("Applied N database migrations").
8. `scripts/ci/restore-verify.sh` (with this version's images built) passes: "the trial balance and all <n> files match". CI runs it on every release tag before publishing.
9. Regression: `./backup.sh` and Spine's start-up behave as before.

## 263. Upgrade Spine with one command (US-OPS-50, Phase 12)

1. On an install of the previous release with data, run `./upgrade.sh --version <new>` (betas need the version; `./upgrade.sh` alone takes the latest release). It backs up ("Backup saved: …"), downloads the new version's files and checks them against `SHA256SUMS`, pulls the images and restarts, then prints "Spine is now <new>. Your backup is <file>."
2. `.env` keeps everything you set, with `SPINE_VERSION=<new>` added or changed. The old Compose file and scripts are in `.previous/`.
3. `docker compose logs api`: "Taking a snapshot of the database before <n> migrations…" and "Applied <n> database migrations … The snapshot from before is /data/snapshots/spine-snapshot-<time>-before-<n>-migrations.dump". At most 3 snapshots are kept.
4. Sign in: everything is there, and the trial balance and documents are unchanged.
5. `./upgrade.sh --version <the same>`: "Spine is already <version>." `./upgrade.sh --version <older>`: refused ("can't go back a version").
6. Change a byte in a downloaded file (or use `--files` with a folder whose files don't match `SHA256SUMS`): it stops with "… don't match their checksums, so nothing was changed."
7. Offline: download the release's files into a folder and run `./upgrade.sh --version <new> --files <folder>`.
8. From a clone: `git checkout v<new>` first, then `./scripts/upgrade.sh --version <new>`. Without the checkout it says so.
9. Regression: `./install.sh`, `./backup.sh` and `./restore.sh` work as before. A fresh install takes no snapshot (there's no data yet).

## 264. Run a beta for testers (US-OPS-52, Phase 12)

1. Follow `docs/beta.md` on a fresh VPS: Docker, `docker login ghcr.io` and `gh auth login` with the token, `gh release download v1.0.0-beta.1`, then `./install.sh --app-url https://beta.h4loom.com`. The address opens over HTTPS with a valid certificate.
2. Sign up first: you're the Owner. A second person who tries to sign up is told Spine is invite-only.
3. With SMTP set in `.env`, invite a tester from Team › Users. They get the email, join, and sign in.
4. Settings › Your account › About Spine shows "Spine 1.0.0-beta.1" with a "Beta" label and the note about the beta. Everyone sees it, Field included.
5. Add the nightly backup line to the crontab. The next morning `backups/` has an encrypted backup, and `backup.log` shows "Backup saved".
6. When `v1.0.0-beta.2` is tagged, `./upgrade.sh --version 1.0.0-beta.2` keeps everyone's data, and About Spine shows the new version.
7. Send testers the "Reporting a problem" section. A report with the version and a screenshot is enough to act on.
8. The accountant has `docs/accounting-review.md`. Their findings go in its table, and their sign-off at the end.
9. Regression: on a release (not a pre-release), About Spine shows only the version, with no "Beta".

## 265. Give testers the field app through TestFlight and an APK (US-MOB-28, Phase 12)

1. Do the one-time setup in `docs/beta.md` › The phone app:
   - the tools (Xcode signed in, the Android SDK, JDK 17, `gh`);
   - the app in App Store Connect with `com.h4loom.spine`;
   - a release keystore;
   - a TestFlight external group.
2. From the beta's tag, with the variables set, run `scripts/mobile/build-beta.sh --upload`. It prints the version and build number, uploads to App Store Connect, and prints "Built: …/spine-<version>.apk" and "Attached to the v<version> release."
3. iPhone: once the build is processed, add it to the external group. Accept the TestFlight invitation (or open the public link), install Spine, type the beta's address and sign in. Profile shows "Spine 1.0.0-beta.1 (<build>) · Beta".
4. Android: open the APK link from the release on the phone, allow the install, then sign in the same way. Profile shows the same. The APK is about 55 MB.
5. Build the next beta the same way: TestFlight offers the update, and the new APK installs over the old one. That works because it's signed with the same keystore and has a higher build number. The signed-in account and anything waiting to send are kept.
6. Without the keystore variables, or without `SPINE_APPLE_TEAM_ID`, the script stops before building and says which one to set. `--android` and `--ios` build one platform.
7. Regression: the field app still sends `X-Spine-Client-Version: 1.0.0`, and the server's minimum version check (`MOBILE_MIN_VERSION`) behaves as before. Maestro flows run against the new id `com.h4loom.spine`.

## 266. Run Spine on Coolify (US-OPS-52, Phase 12)

1. On a Coolify v4 server, run `docker login ghcr.io` with a token that can read packages. Add a Docker Compose Empty resource and paste the release's `docker-compose.coolify.yml`.
2. Give the `caddy` service the domain `https://beta.h4loom.com`. Coolify lists the settings, with `SERVICE_PASSWORD_64_AUTH` and `SERVICE_PASSWORD_POSTGRES` already generated. Fill in SMTP and `BACKUP_PASSPHRASE`, then deploy.
3. Every service turns healthy. `https://beta.h4loom.com` opens with a valid certificate from Coolify's proxy, sign-up works, and Settings › About Spine shows the version.
4. Sign in from two different networks, then check Settings › Password & security: each session shows its own address, not the proxy's. Sign-in rate limits apply per visitor.
5. With `BACKUP_REMOTE` and its keys set, add the scheduled task `node apps/api/dist/scripts/backup.js --remote-only` in the `api` container. Run it now: its log ends "Backup saved: s3://…", the bucket has a `.tar.gz.enc`, and the Owners' backup banner clears. Without `BACKUP_REMOTE` or `BACKUP_PASSPHRASE` it refuses and says which is missing.
6. Set `SPINE_VERSION` to the next beta and redeploy: the data stays, and About Spine shows the new version.
7. Regression: the plain-Docker install (section 260) still gets its own certificate, because `SITE_ADDRESS` defaults to `APP_URL`.

## Known gaps — don't file these as bugs

- On iOS 27 the field app's Search tab reads "search" in lower case and its field sits under the large title rather than in the tab bar; the upgrade to Expo SDK 58 after 1.0 fixes it (R-25, D-261).

- A Staff member who signs in to the phone app while their Teams close Jobs or Meetings sees that tab's error message, not a no-access screen; sections a Team can open (section 232) are shaped for the web app, and the phone app is built for Field.
- The app's left navigation has no phone layout yet; on a phone, collapse it to use the calendar (section 204).
- The field app's App Store link is a placeholder until the listing exists. Demo data doesn't put a quote to present on any job; add a variation order as in section 195.
- Set up Spine's Email sending and Backups cards link to the README's self-hosting section until the docs site ships (Q-15); Backups isn't checked or counted until Phase 12 (D-194).
- India's demo businesses don't release retention: GSTR-1 would count a retention-release invoice as a supply of its own ([Q-21](prd/13-risks-open-questions.md)). Every demo shares the same two demo people (Sarah Mendes, Staff; Marcus Webb, Field), whatever the country.
- No AI control shows in a form until US-AI-08 onwards, so the budget, the 30-requests-in-10-minutes limit and "AI didn't answer" are checked through the API until then. The Model picker offers to "Create" a typed model name. Expenses already waiting when Approvals is switched off stay waiting until it's back on (D-190).

- The Tally export hasn't yet been imported into a real TallyPrime or Tally.ERP 9 here. Section 179 step 8 is the check (R-16). Customer advances (2200) and retention (1150) stay as their own ledgers rather than on the party ledger.
- Cash-basis Profit & Loss (US-RPT-35, [D-178](prd/12-decisions.md)): retention released on its own invoice and advance invoices offset on a final invoice count only in proportion to payments on the invoice that carries the income lines.
- Session-less signed file links (`/files/<id>?exp=&sig=`) work, but no screen creates one yet; they arrive with the stories that need them.
- GSTR-1's units of measure, shipping bill details, advances (Tables 11A/11B) and amendments are planned work, not gaps: see [16-roadmap](prd/16-roadmap.md).

## By design in v1 — don't file these as bugs

- A variation order's acceptance doesn't fold its value into the job's contract value. "Apply to job" (§5.11) is a deliberate, separate step; an in-app and email notification fires when one is accepted.
- Meeting invites (§6.1) have two visibility tiers, `private` and `org`; there's no "visible to a specific Team" tier.
- Recurring meetings apply the invite list to the whole series; you can't invite someone to one occurrence.
- The "starting soon" reminder polls every 5 minutes, so it can fire up to about 5 minutes after its configured lead time.
- Multi-org (one Owner account across several organisations) is out of scope for v1; don't test for it.
