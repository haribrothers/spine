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
   data**. Confirm it seeds contacts, catalogue items, leads, quotes,
   invoices, and payments without error.
8. Confirm the **dashboard setup checklist** reflects real completion
   state (e.g. "add a contact" flips to done once you have contacts from
   the demo seed, not just because you dismissed it).

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

---

## 5. Meetings (S-01.9)

1. Go to **Meetings**. Confirm an Outlook-style calendar (day/week/month
   views) renders.
2. Create a meeting linked to a contact. Confirm it shows on the
   calendar and, if you check that contact's Timeline (§2.2), the
   meeting appears there too (once wired) or at least on the contact's
   own meetings list.
3. Create a recurring meeting, then edit a single later occurrence's
   time — confirm this does NOT move the whole series' start date (this
   was a real bug fixed earlier).

---

## 6. Invoices (FEAT-05)

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
     **Apply credit** on that payment (§7 below) to offset it against
     the real invoice — confirm this works normally.

---

## 7. Payments (FEAT-06)

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

---

## 8. Receivables / AR aging (S-06.7 / S-09.5)

1. Go to **Receivables**.
2. Confirm five stat cards: Current, 1–30, 31–60, 61–90, 90+ days, plus
   a Total outstanding figure.
3. Confirm the table below lists every outstanding **issued** invoice,
   oldest-overdue first, each tagged with the correct aging bucket.
4. Cross-check: pick one row, open that invoice directly, confirm its
   own **Balance due** matches exactly what Receivables showed.
5. Confirm invoices that are **draft**, **void**, or **fully paid/
   credited** do NOT appear here.
6. After issuing a credit note against an invoice (§6.8) or applying
   credit to it (§7.4), reload Receivables and confirm the balance there
   reflects the change with no double-counting.

---

## 9. Notifications (S-10.11 / S-10.12)

1. Trigger a notification-worthy event (e.g. a quote gets viewed on its
   public link, or a payment is recorded).
2. Click the notification bell — confirm a right-side panel opens
   listing the event, and it's marked read once opened.
3. If your browser prompts for notification permission, accept it, then
   trigger another event — confirm a native OS/browser push notification
   appears (this only works over a real trigger, not a manual test
   button, so pick a real action like recording a payment).

---

## 10. Users, Teams & Permissions (§2.1 permission model)

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

---

## 11. Design system spot-check

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
  (§6.2) today is by inspecting the ledger directly, not through a UI
  report.
- Jobs, vendor bills/expenses, and mobile (`apps/mobile`) don't exist
  yet — demo data intentionally doesn't include them.
- No standalone `/credit-notes` list page — credit notes are only
  reachable from the invoice they correct.
- Multi-org (one Owner account across several orgs) is explicitly out of
  scope for v1 — don't test for it.
