# 03 · Contacts & CRM

The customers and vendors a business deals with, the people and addresses behind each one, a timeline of everything that happened with them, logged activities with follow-ups, and a pipeline board of leads. Contacts are read by everyone; who may edit or delete them is controlled per Team.

**Screens:** `ContactsList` (P1), `ContactsCards` (P3), `ContactsEmpty` (P1), `ContactCreateDrawer` (P1), `ContactTimeline` (P1), `ContactPersons` (P1), `ContactPersonDialog` (P1), `ContactAddresses` (P1), `AddressDialog` (P1), `ContactActivities` (P1), `ActivityDialog` (P1), `ContactLeads` (P2), `ContactDeleteConfirm` (P2), `ImportContactsDialog` (P2), `LeadsBoard` (P1), `LeadsBoardEmpty` (P1), `LeadDialog` (P1), `LeadStagesSettings` (P2), `ContactsCardsPolish` (P2), `ContactsCardsPolishDark` (P2), `ContactsTablePolish` (P2), `PipelineBoard` (P2), `PipelineBoardDark` (P2), `PipelineClosedOpen` (P2), `LeadWonDialog` (P2), `LeadLostDialog` (P2), `LeadDrawer` (P2)
**Depends on:** 15 Team (capabilities), 06 Quotes / 08 Invoicing / 09 Payments (timeline entries), 04 Meetings (timeline entries).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-CRM-01 | Contacts: add, find, view, archive and delete | P1 | 1 | `ContactsList`, `ContactsCards`, `ContactsEmpty`, `ContactCreateDrawer`, `ContactDeleteConfirm` |
| F-CRM-02 | Contact persons and addresses | P1 | 1 | `ContactPersons`, `ContactPersonDialog`, `ContactAddresses`, `AddressDialog` |
| F-CRM-03 | Contact timeline | P1 | 1 | `ContactTimeline` |
| F-CRM-04 | Activities and follow-ups | P1 | 1 | `ContactActivities`, `ActivityDialog` |
| F-CRM-05 | Leads and pipeline board | P1 | 1 | `LeadsBoard`, `LeadsBoardEmpty`, `LeadDialog`, `ContactLeads` |
| F-CRM-06 | Import contacts from CSV | P2 | 1 | `ImportContactsDialog` |
| F-CRM-07 | Own/others edit and delete rights for CRM records | P1 | 4 | `ContactsList`, `ContactPersons`, `LeadsBoard`, `ContactActivities` |
| F-CRM-08 | Configurable pipeline stages | P2 | 7 | `LeadStagesSettings`, `LeadsBoard` |
| F-CRM-09 | Contacts list polish: names that fit, refresh, search in every view, filters that stay | P2 | Refinements | `ContactsCardsPolish`, `ContactsCardsPolishDark`, `ContactsTablePolish` |
| F-CRM-10 | A pipeline that works: a board that fits, cards that show what needs doing, won and lost with a purpose, a lead drawer, filters that stay | P2 | Refinements | `PipelineBoard`, `PipelineBoardDark`, `PipelineClosedOpen`, `LeadWonDialog`, `LeadLostDialog`, `LeadDrawer` |

## User stories

### US-CRM-01 · Add a customer or vendor
**Feature:** F-CRM-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `ContactCreateDrawer`
**As** office staff, **I want** to add a company or person with their contact details, **so that** I can quote them.

Legacy: S-01.1

**Acceptance criteria**
- **Given** I'm on Contacts, **when** I press "Add contact", **then** a drawer opens with "Type" (Customer, Vendor, Customer & vendor), a company/individual switch, "Company name" or "Full name", "Email", "Phone", "Tax ID" (helper "Useful for invoicing a business contact.") and "Website".
- **Given** the name is empty, **when** I press "Save contact", **then** the name field shows an error and nothing is saved.
- **Given** valid details, **when** I press "Save contact", **then** the drawer closes, a "Contact created" toast shows, and the contact appears in the list.
- **Given** another contact already has the same email or phone, **when** I save, **then** I see a warning naming the existing contact and can still save (duplicates warn, never block).
- **Given** saving fails, **when** the error returns, **then** I see "Could not create contact." and my input stays in the drawer.

**Implementation notes**
- API: `POST /contacts` (`contacts.edit_own`).
- Data: `contacts` (`type`, `is_company`, `created_by_user_id`).
- UI: `contact-create-drawer.tsx`, `contact-form.tsx` (`Drawer`, `FormField`).
- Edge: Field users never see "Add contact".

### US-CRM-02 · Mark a contact as both customer and vendor
**Feature:** F-CRM-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `ContactCreateDrawer`, `ContactsList`
**As** office staff, **I want** one record for a business that both buys from and sells to us, **so that** I don't duplicate it.

Legacy: S-01.2

**Acceptance criteria**
- **Given** I'm adding or editing a contact, **when** I choose type "Customer & vendor", **then** the contact is saved with type `both`.
- **Given** a `both` contact, **when** I create a quote or invoice, **then** it appears in the customer picker.
- **Given** a `both` contact, **when** I record a vendor bill, **then** it appears in the vendor picker.
- **Given** the list, **when** I filter by "Customer", **then** `both` contacts are included.

**Implementation notes**
- API: `POST/PUT /contacts`.
- Data: `contact_type` enum (`customer`, `vendor`, `both`).
- Edge: changing a contact from `both` to `customer` is blocked while it has vendor bills.

### US-CRM-03 · Find contacts and switch views
**Feature:** F-CRM-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `ContactsList`, `ContactsCards`, `ContactsEmpty`
**As** office staff, **I want** to search and filter contacts and choose a view, **so that** I find the right one quickly.

**Acceptance criteria**
- **Given** Contacts has records, **when** I open it, **then** I see the counters "Total contacts", "Customers", "Vendors" and "Active leads" above a table with Name, Type, Email, Phone and Status.
- **Given** I type in "Search contacts", **when** I pause typing, **then** the table shows only contacts whose name, email or phone matches.
- **Given** I choose a type or status filter, **when** it applies, **then** only matching contacts show; if none match I see "No contacts match these filters" and "Try adjusting or clearing the filters above.".
- **Given** I use the view switcher, **when** I choose "Table view", "List view" or "Card view", **then** the contacts render in that layout and the choice is remembered on this device.
- **Given** the organisation has no contacts, **when** I open Contacts, **then** I see "No contacts yet" with "Add contact".

**Implementation notes**
- API: `GET /contacts?search=&type=&includeArchived=`.
- UI: `contacts-explorer.tsx`, `contacts-view-switcher.tsx` (`ToggleGroup` with aria-labels), `EmptyState`.
- Edge: archived contacts show only with the "Archived" status filter.
- Extended by US-CRM-23 (D-210): search in every view, filters and page in the address, stat cards that filter.

### US-CRM-04 · Archive or delete a contact
**Feature:** F-CRM-01 · **Priority:** P2 · **Phase:** 1 · **Screens:** `ContactDeleteConfirm`, `ContactsList`
**As** office staff, **I want** to archive contacts I no longer use and delete ones created by mistake, **so that** lists stay clean without losing history.

**Acceptance criteria**
- **Given** a contact row menu, **when** I choose "Archive", **then** the contact is hidden from active lists and a toast shows "Contact archived" / "<contact name> has been archived.".
- **Given** an archived contact (shown with "Include archived"), **when** I choose "Restore", **then** it returns to the active list.
- **Given** a contact with no financial documents, **when** I choose "Delete", **then** a confirmation "Delete <contact name>?" explains it can't be undone and offers "Cancel" and "Delete".
- **Given** a contact linked to quotes, invoices, payments or bills, **when** I try to delete it, **then** deletion is refused with "Could not delete contact." and a suggestion to archive it instead.
- **Given** I confirm deletion, **when** it succeeds, **then** its persons and addresses are removed too and a "Contact deleted" toast shows.

**Implementation notes**
- API: `POST /contacts/:id/archive`, `POST /contacts/:id/restore`, `DELETE /contacts/:id` (`contacts.delete_own`/`delete_others`).
- UI: `contact-row-actions.tsx` (`AlertDialog`, danger action).
- Edge: deletion of a contact referenced by `journal_lines` is always blocked.

### US-CRM-05 · Add the people at a company
**Feature:** F-CRM-02 · **Priority:** P1 · **Phase:** 1 · **Screens:** `ContactPersons`, `ContactPersonDialog`
**As** office staff, **I want** to store several people for one company, **so that** I know who to call about what.

Legacy: S-01.1

**Acceptance criteria**
- **Given** a contact's "Contact persons" tab, **when** I press "Add contact person", **then** a dialog asks for "Name" (required), "Title", "Email" and "Phone".
- **Given** I save, **when** it succeeds, **then** the person appears in the list with their title and details.
- **Given** an existing person, **when** I edit or remove them, **then** the change saves; removing asks "Remove <name>?" first.
- **Given** I lack `contacts.manage_persons`, **when** I open the tab, **then** I can read the people but see no add, edit or remove controls.

**Implementation notes**
- API: `PUT /contacts/:id` with the full `contactPersons` array.
- Data: `contact_persons`.
- UI: `contact-persons-section.tsx`.
- Edge: the array is replaced as a whole; concurrent edits are last-write-wins.

### US-CRM-06 · Add billing, shipping and site addresses
**Feature:** F-CRM-02 · **Priority:** P1 · **Phase:** 1 · **Screens:** `ContactAddresses`, `AddressDialog`
**As** office staff, **I want** several addresses per contact, **so that** invoices go to the billing address and crews go to the site.

**Acceptance criteria**
- **Given** the "Addresses" tab, **when** I press "Add address", **then** a dialog asks for "Type" (Billing, Shipping, Site, Other), "Address line" (required), "City" and the rest of the address.
- **Given** I save, **when** it succeeds, **then** the address shows with its type label.
- **Given** an address, **when** I choose remove, **then** I'm asked "Remove this address?" before it goes.
- **Given** I lack `contacts.manage_addresses`, **when** I open the tab, **then** I see addresses read-only.

**Implementation notes**
- API: `PUT /contacts/:id` with the full `addresses` array.
- Data: `addresses` (`address_type` enum).
- UI: `addresses-section.tsx`.

### US-CRM-07 · See everything about a contact on one timeline
**Feature:** F-CRM-03 · **Priority:** P1 · **Phase:** 1 · **Screens:** `ContactTimeline`
**As** an owner, **I want** every quote, invoice, payment, activity and meeting for a contact in one list, **so that** I know where we stand before I call them.

Legacy: S-01.3

**Acceptance criteria**
- **Given** a contact with history, **when** I open its "Timeline" tab, **then** events are listed newest first, each with its type, a short description and a relative time.
- **Given** an entry for a quote, invoice or payment, **when** I click it, **then** I go to that document.
- **Given** a recurring meeting with a cancelled occurrence, **when** I view the timeline, **then** the cancelled occurrence isn't listed and a modified one shows its new time.
- **Given** a contact with no history, **when** I open the tab, **then** I see "Nothing yet" and "Quotes, logged activities, and scheduled meetings for this contact will show up here.".

**Implementation notes**
- API: assembled from `GET /quotes?contactId=`, `GET /invoices?contactId=`, `GET /payments?contactId=`, `GET /activities?contactId=`, `GET /meetings?contactId=`.
- Data: merged read of quotes, invoices, payments, activities, meetings (+ exceptions).
- UI: `timeline-section.tsx` (`Timeline`).
- Edge: Staff see entries for documents they can read; private meetings they're not on are excluded.

### US-CRM-08 · Log a call, meeting, note or task with a follow-up date
**Feature:** F-CRM-04 · **Priority:** P1 · **Phase:** 1 · **Screens:** `ContactActivities`, `ActivityDialog`
**As** office staff, **I want** to log what happened with a contact and when to follow up, **so that** nothing is forgotten.

Legacy: S-01.6

**Acceptance criteria**
- **Given** the "Activities" tab, **when** I press "Log activity", **then** a dialog asks for "Type" (Call, Meeting, Note, Task), "Notes" and "Follow-up date" (helper "Leave blank if there's nothing to follow up on.").
- **Given** I save, **when** it succeeds, **then** the activity appears at the top of the list with its type and follow-up date.
- **Given** a follow-up date in the past and the activity not done, **when** I view it, **then** it shows an "Overdue" chip.
- **Given** an activity with a follow-up, **when** its date passes, **then** it appears in "My overdue follow-ups" on the dashboard of the person it's assigned to (US-DASH-04).
- **Given** a contact with no activities, **when** I open the tab, **then** I see "No activities logged.".

**Implementation notes**
- API: `POST /activities`, `PUT /activities/:id`.
- Data: `activities` (`activity_type`, `due_at`, `done_at`, `assigned_to_user_id`, `created_by_user_id`).
- UI: `activities-section.tsx`. The dialog has no assignee field: an activity is assigned to the person who logs it (`assigned_to_user_id` defaults to the creator).

### US-CRM-09 · Mark a follow-up done
**Feature:** F-CRM-04 · **Priority:** P1 · **Phase:** 1 · **Screens:** `ContactActivities`
**As** office staff, **I want** to tick off a follow-up when I've done it, **so that** my overdue list stays honest.

**Acceptance criteria**
- **Given** an open activity, **when** I mark it done, **then** it shows as done with the time and leaves my overdue list.
- **Given** a done activity, **when** I mark it not done, **then** its follow-up returns, overdue again if the date has passed.
- **Given** I may not edit this activity (own/others rights), **when** I view it, **then** the done toggle is disabled.

**Implementation notes**
- API: `POST /activities/:id/done`, `POST /activities/:id/undone` (gated like editing, `activities.edit_own`/`edit_others`).
- Edge: toggling never changes who created or is assigned the activity.

### US-CRM-10 · Create a lead with a value and stage
**Feature:** F-CRM-05 · **Priority:** P1 · **Phase:** 1 · **Screens:** `LeadDialog`
**As** office staff, **I want** to record a potential job with its estimated value, **so that** the pipeline reflects reality.

Legacy: S-01.4

**Acceptance criteria**
- **Given** the pipeline or a contact's Leads tab, **when** I press "Add lead", **then** a dialog asks for "Contact" (placeholder "Select a contact…"), "Title", "Stage", "Estimated value", "Currency" and "Source" (placeholder "Select or type a source…").
- **Given** I save, **when** it succeeds, **then** the lead appears in its stage column with title, contact and value.
- **Given** a lead, **when** I edit it and press "Save changes", **then** the card updates.
- **Given** I'm the lead's creator or have `leads.edit_others`, **when** I reassign its owner, **then** the owner changes but its creator (and therefore edit rights) doesn't.

**Implementation notes**
- API: `POST /leads`, `PUT /leads/:id`.
- Data: `leads` (`value_amount`, `owner_user_id`, `created_by_user_id`, `stage` → `stage_id` in Phase 7, US-CRM-19).
- UI: `lead-dialog.tsx`.

### US-CRM-11 · See the pipeline by stage with totals
**Feature:** F-CRM-05 · **Priority:** P1 · **Phase:** 1 · **Screens:** `LeadsBoard`, `LeadsBoardEmpty`
**As** an owner, **I want** a board of leads by stage with the total value per stage, **so that** I can forecast.

Legacy: S-01.5

**Acceptance criteria**
- **Given** leads exist, **when** I open Pipeline, **then** I see one column per stage with the count and the summed estimated value at the top.
- **Given** I drag a card to another column, **when** I drop it, **then** the lead's stage changes and both column totals update.
- **Given** I search ("Search leads or contacts…"), filter by stage or choose a sort ("Value: high to low", "Value: low to high", "Newest first", "Oldest first", "Title (A–Z)"), **when** it applies, **then** the board shows matching cards in that order.
- **Given** no leads exist, **when** I open Pipeline, **then** I see "No leads yet", "Add your first lead to start tracking your pipeline." and "Add lead".
- **Given** a keyboard user, **when** they focus a card, **then** they can move it to another stage without a mouse.

**Implementation notes**
- API: `GET /leads`, `PUT /leads/:id`, `GET /leads/summary-by-stage` (no capability).
- UI: `leads-board.tsx` (`Kanban`).
- Edge: values in different currencies don't occur (single currency).
- Extended by US-CRM-24 and US-CRM-25 (D-211): the keyboard move is the card's "Move to…" menu.

### US-CRM-12 · See a contact's leads
**Feature:** F-CRM-05 · **Priority:** P2 · **Phase:** 1 · **Screens:** `ContactLeads`
**As** office staff, **I want** the leads for one contact on its page, **so that** I see open opportunities in context.

**Acceptance criteria**
- **Given** a contact's "Leads" tab, **when** it opens, **then** its leads are listed with title, stage and value.
- **Given** I may edit leads, **when** I press "Add lead", **then** the lead dialog opens with the contact preselected.
- **Given** I lack lead edit rights, **when** I view the tab, **then** add, edit and delete controls are hidden (finding from the 2026-08-29 audit).

**Implementation notes**
- API: `GET /leads?contactId=`.
- UI: `leads-section.tsx` must use `useCapability` / `useCanEditOwnership`.

### US-CRM-13 · Delete a lead
**Feature:** F-CRM-05 · **Priority:** P2 · **Phase:** 1 · **Screens:** `LeadDialog`
**As** office staff, **I want** to delete a lead entered by mistake, **so that** the pipeline stays accurate.

**Acceptance criteria**
- **Given** an existing lead, **when** I choose delete, **then** I see "Delete this lead?" and "This can't be undone. The contact itself is not affected." with "Cancel" and "Delete".
- **Given** I confirm, **when** it succeeds, **then** the card disappears and stage totals update.
- **Given** I lack the matching delete capability, **when** I open the lead, **then** no delete control is shown.

**Implementation notes**
- API: `DELETE /leads/:id` (`leads.delete_own`/`delete_others`).

### US-CRM-14 · Import contacts from a spreadsheet
**Feature:** F-CRM-06 · **Priority:** P2 · **Phase:** 1 · **Screens:** `ImportContactsDialog`
**As** an owner, **I want** to import contacts from a CSV, **so that** moving off a spreadsheet takes minutes.

Legacy: S-01.8

**Acceptance criteria**
- **Given** Contacts, **when** I press "Import CSV", **then** a dialog "Import contacts from CSV" says "Upload a CSV exported from a spreadsheet or another CRM." with "Click to choose a CSV file" or drag and drop.
- **Given** I pick a CSV, **when** it's read, **then** I see "Match your file's columns to Spine's contact fields." with a dropdown per column, pre-matched by header name.
- **Given** a file with no columns, **when** it's read, **then** I see "No columns found — the file may be empty or not a CSV.".
- **Given** mapped rows, **when** I start the import, **then** a preview lists Row, Name, Type, Email, Phone and Status ("Ready"), then progress "Importing…" and finally "Import complete.".

**Implementation notes**
- API: `POST /contacts/import` (batch, one idempotency key per import).
- UI: `import/import-contacts-dialog.tsx`, `build-rows.ts`.
- Edge: 1,000-row files finish without the browser freezing.

### US-CRM-15 · Review duplicates and failed rows after an import
**Feature:** F-CRM-06 · **Priority:** P2 · **Phase:** 1 · **Screens:** `ImportContactsDialog`
**As** an owner, **I want** to see which imported rows look like duplicates or failed, **so that** I can fix them.

**Acceptance criteria**
- **Given** an import created contacts matching existing emails or phones, **when** it finishes, **then** I see "Created, but possible duplicates — worth reviewing:" with those rows.
- **Given** some rows failed validation, **when** it finishes, **then** I see "Rows that failed:" with each row number and reason.
- **Given** the import stopped part-way, **when** it ends, **then** I see "Import failed — some rows may have already been created. Review the list below before retrying.".
- **Given** I press "Done", **when** the dialog closes, **then** the contact list includes the new contacts.

**Implementation notes**
- Edge: re-running the same file warns about rows matching existing contacts rather than silently duplicating them.

### US-CRM-16 · Let a Team edit only its own contacts
**Feature:** F-CRM-07 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ContactsList`
**As** an owner, **I want** to grant a Team edit/delete rights on contacts they created, separately from everyone's, **so that** juniors can help without altering colleagues' records.

Legacy: S-01.15

**Acceptance criteria**
- **Given** a Staff user with `contacts.edit_own` but not `contacts.edit_others`, **when** they open a contact someone else created, **then** "Edit" is hidden and a direct `PUT` returns 403.
- **Given** the same user, **when** they create a contact, **then** they can edit it afterwards.
- **Given** a Team with neither `contacts.edit_own` nor `contacts.edit_others`, **when** its members open Contacts, **then** "Add contact" is hidden and creating returns 403.
- **Given** a contact with no recorded creator (legacy row), **when** a user with only `edit_own` tries to edit it, **then** it's treated as someone else's.
- **Given** any Staff or Field user, **when** they open Contacts, **then** they can read every contact regardless of these grants.

**Implementation notes**
- API: service-layer `requireOwnershipCapability` on update/archive/restore/delete.
- Data: `contacts.created_by_user_id`.
- UI: `useCanEditOwnership(record.createdByUserId, { own, others })`.

### US-CRM-17 · Set lead and activity rights separately from contacts
**Feature:** F-CRM-07 · **Priority:** P1 · **Phase:** 4 · **Screens:** `LeadsBoard`, `ContactActivities`
**As** an owner, **I want** separate own/others rights for leads and for activities, **so that** pipeline access is tuned independently of contacts.

Legacy: S-01.16

**Acceptance criteria**
- **Given** a Team with full contact rights and only `leads.edit_own`, **when** a member opens a lead created by someone else, **then** they can't edit or move it.
- **Given** a lead reassigned to another owner, **when** its creator opens it, **then** the creator keeps their edit rights (ownership follows the creator, not the assigned owner).
- **Given** a Team with `activities.edit_own` only, **when** a member tries to mark a colleague's activity done, **then** the toggle is disabled and the API returns 403.
- **Given** any member, **when** they open the pipeline-by-stage widget, **then** it loads without any capability.

**Implementation notes**
- API: `leads.*` and `activities.*` capability groups (07-security).
- Data: `leads.created_by_user_id`, `activities.created_by_user_id`.

### US-CRM-18 · Control who manages a contact's people and addresses
**Feature:** F-CRM-07 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ContactPersons`
**As** an owner, **I want** people and addresses editing granted separately, **so that** a Team can enter contact details without full contact rights, or the reverse.

Legacy: S-01.18

**Acceptance criteria**
- **Given** a user with contact edit rights but not `contacts.manage_persons`, **when** they save a contact, **then** a change to its people is rejected with 403 and other fields still save if sent alone.
- **Given** a user with `contacts.manage_addresses` but not the contact's edit right, **when** they edit addresses, **then** the request is rejected (both checks are required).
- **Given** a user with `contacts.manage_persons` only, **when** they open Addresses, **then** it's read-only.

**Implementation notes**
- API: `ContactsService.update` checks the extra capability only when `contactPersons` / `addresses` are present.

### US-CRM-19 · Rename, reorder and add pipeline stages
**Feature:** F-CRM-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `LeadStagesSettings`, `LeadsBoard`
**As** an owner, **I want** my own pipeline stages, **so that** the board matches how my business sells.

Gap: G1 · Decision: D-062

**Acceptance criteria**
- **Given** Settings › Pipeline stages, **when** it opens, **then** I see "Pipeline stages", "The columns on your pipeline board. Rename, reorder or add stages. Won and Lost always stay last so reports can tell a closed lead from an open one." and one row per stage with its name, kind and lead count.
- **Given** I rename "Proposal" to "Quote sent" and press "Save", **when** I open the pipeline, **then** the column is titled "Quote sent" and keeps its leads.
- **Given** I press "+ Add stage", name it "Site visit booked" and drag it above "Proposal", **when** I save, **then** the board shows the new column in that position.
- **Given** 12 stages exist, **when** I look for "+ Add stage", **then** it's disabled with "Up to 12 stages.".
- **Given** the Won or Lost row, **when** I try to delete or move it, **then** it can't be deleted or moved; only renamed.

**Implementation notes**
- API: `GET/PUT /org/lead-stages` (contract addition).
- Data: new `lead_stages` table; `leads.stage_id` (04-data-model additions).
- UI: Settings pane with `ReorderableList`.
- Edge: migration maps existing enum values to the five seeded stages.

### US-CRM-20 · Delete a stage and move its leads
**Feature:** F-CRM-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `LeadStagesSettings`
**As** an owner, **I want** deleting a stage to ask where its leads go, **so that** no lead disappears.

Gap: G1

**Acceptance criteria**
- **Given** a stage with no leads, **when** I delete it and save, **then** it's removed.
- **Given** a stage with 3 leads, **when** I delete it, **then** I'm asked "Move 3 leads to:" with a stage picker before it can be removed.
- **Given** I choose a target and save, **when** it completes, **then** the leads appear in the target column.
- **Given** a Staff user, **when** they call `PUT /org/lead-stages`, **then** they get 403.

**Implementation notes**
- API: `PUT /org/lead-stages` with `{ stages, moves }`.
- Edge: a reporting snapshot of won/lost uses `kind`, so renaming Won never breaks reports.

### US-CRM-21 · Read long names and emails in every contacts view
**Feature:** F-CRM-09 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ContactsCardsPolish`, `ContactsTablePolish`
**As** office staff, **I want** long company names and emails to stay inside their card or row, **so that** the list stays readable with real Indian and UK business names.

Decision: D-210

**Acceptance criteria**
- **Given** the Card view, **when** a contact has a long name ("H2Z Facades and Interiors Factory Private Limited"), **then** the name wraps to two lines at most and ends with "…", and the full name shows on hover; nothing crosses the card's edge.
- **Given** a long email or phone, **when** it shows in a card or a List row, **then** it stays on one line, ends with "…" when it doesn't fit, and shows in full on hover.
- **Given** the "⋯" menu in a card's corner, **when** the name is long, **then** the name never runs under the menu.
- **Given** the Table view at 1280 px or wider, **when** a contact has a long email, **then** the email is cut short with "…" (full on hover) and every column, Status included, fits without scrolling sideways. Narrower than that, the table scrolls sideways inside its own frame, never the page.
- **Given** the type badges, **when** a card is narrow, **then** they wrap onto a second line rather than being clipped.

**Implementation notes**
- UI: `contacts-card-view.tsx`, `contacts-list-view.tsx`, `contacts-table.tsx`: `min-w-0` on each flexible child, `line-clamp-2` and `break-words` on card names, `truncate` with `title` on emails, phones and names; the Email column gets a maximum width.
- No API change.

### US-CRM-22 · Refresh the contacts list to see changes
**Feature:** F-CRM-09 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ContactsCardsPolish`
**As** office staff sharing contacts with my team, **I want** to refresh the list without reloading the page, **so that** I see contacts others have just added or changed.

Decision: D-210

**Acceptance criteria**
- **Given** the contacts toolbar, **when** it shows, **then** there's a "Refresh" icon button beside the view switcher with the tooltip "Refresh list", and "Updated just now" (then "Updated 2 min ago", and so on) beside it.
- **Given** I press Refresh, **when** the list reloads, **then** the contacts, the stat cards and the active-lead count reload together; the current list stays on screen (no grey placeholder), the icon turns while it loads (not with Reduce Motion) and the button can't be pressed twice.
- **Given** a contact someone else added, **when** the refresh finishes, **then** it appears in its place for the current filters, search and sort, and a screen reader hears "Contacts updated".
- **Given** I come back to the browser tab after 30 seconds or more away, **when** the tab is shown again, **then** the list refreshes the same quiet way.
- **Given** the refresh fails, **when** the error returns, **then** the list I had stays, and a message says "Couldn't refresh the list. Check your connection and try again." with "Try again".

**Implementation notes**
- UI: `contacts-explorer.tsx` keeps the last list while reloading (`refreshing` state, separate from the first load); `visibilitychange` triggers a refresh when the tab was hidden 30 s or more. "Updated …" uses `formatDistanceToNow`, re-rendered every 30 s.
- No API change: the same `GET /contacts` and `GET /leads`.

### US-CRM-23 · Search, filter and come back to the same contacts list
**Feature:** F-CRM-09 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ContactsCardsPolish`, `ContactsTablePolish`
**As** office staff, **I want** search in every view, filters that stay when I come back, and stat cards I can click, **so that** I find a contact quickly and don't lose my place.

Decision: D-210

**Acceptance criteria**
- **Given** any view (Table, List or Card), **when** I type in "Search contacts", on its own row under the filters (with "Columns" on the right in the Table view), **then** the list narrows to contacts whose name, email or phone matches, as I type. With no match it says "No contacts match "<text>"" with "Clear search".
- **Given** a type, status or search, or a page other than the first, **when** I set it, **then** the address keeps it (for example `/contacts?type=vendor&q=steel&page=2`). Opening a contact and pressing Back, or opening that address later, shows the same list.
- **Given** the stat cards, **when** they show, **then** they count all active contacts whatever the filters (they no longer change when I filter), and "Customers" and "Vendors" are buttons: pressing one filters to that type (customers include "Customer & vendor", and so do vendors) and shows as pressed; pressing it again clears the filter. "Total contacts" clears the type filter, and "Active leads" opens the pipeline.
- **Given** a filter, search or page from the address that matches nothing, **when** the list loads, **then** it shows the "No contacts match these filters" state with "Clear filters", which also clears the search.
- **Given** a keyboard or screen reader, **when** I use the stat cards, **then** each says what it does ("Show customers, 8"), with its pressed state announced.

**Implementation notes**
- UI: pagination stays the existing `PaginationBar` / `Table` pager. The search moves from `DataTable` (Table view only) into `contacts-explorer.tsx`, which filters the loaded list for all three views; `DataTable` gets the search from its parent and hides its own box (`searchValue` prop). URL state through `useSearchParams` and `router.replace` (no extra history entry per keystroke). Stat counts come from a separate unfiltered active list.
- No API change.

### US-CRM-24 · See the whole pipeline at a glance
**Feature:** F-CRM-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `PipelineBoard`, `PipelineBoardDark`, `PipelineClosedOpen`
**As** an owner, **I want** the open pipeline to fit the screen with its key figures above it, **so that** I can see what's in play without scrolling sideways.

Decision: D-211

**Acceptance criteria**
- **Given** the board at 1280 px or wider, **when** it shows, **then** the open stages share the width (no sideways scroll for up to 6 open stages), and Won and Lost are slim columns at the right with their name, count and total for the last 30 days.
- **Given** a slim Won or Lost column, **when** I press it, **then** it opens to full width and lists the leads won (or lost) in the last 30 days, newest first; pressing its header again closes it. Older closed leads stay reachable by choosing that stage in the stage filter.
- **Given** more open stages than fit, **when** the board scrolls sideways, **then** a shadow at the edge shows there's more, and the column headers stay in view while the cards scroll.
- **Given** the board, **when** it shows, **then** a strip above it shows "Open pipeline" (the open leads' total per currency, and how many), "Won this month" (total and count), "Win rate" (won ÷ won and lost, closed in the last 90 days) and "Overdue follow-ups" (open leads with a follow-up past due); pressing "Overdue follow-ups" filters the board to those leads.
- **Given** each column, **when** it shows, **then** its header has the stage's colour dot, name, count and total, and every column (Won and Lost included) runs the full height of the page, with a long column scrolling on its own; an empty open column says "No leads in this stage" at its top.
- **Given** the page header, **when** it shows, **then** it says "Your open leads by stage, and what you've won and lost lately."

**Implementation notes**
- UI: `leads-board.tsx`; columns use the stage `color` (category tokens). Figures come from the leads already loaded (closed leads by `stage_changed_at`), no new endpoint.
- Data: `leads.stage_changed_at` (US-CRM-25).

### US-CRM-25 · Spot leads going cold, and move a lead without dragging
**Feature:** F-CRM-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `PipelineBoard`
**As** office staff, **I want** each card to show who owns it, how long it's sat and when I next follow up, and a menu to move it, **so that** nothing goes cold and I can move leads by keyboard or touch.

Decision: D-211

**Acceptance criteria**
- **Given** a lead card, **when** it shows, **then** it has the title (or the contact's name, once, when there's no title), the contact, the value, the owner's initials (with their name on hover; "Unassigned" when none), and "12 days in stage".
- **Given** a lead with an open follow-up, **when** its card shows, **then** it shows the next one ("Call · Fri 16 Oct"), in the overdue colour with "Overdue" when it's past due; with none it shows nothing extra.
- **Given** an open lead with no activity and no change for 14 days or more, **when** its card shows, **then** it carries "No activity for 14 days" (the overdue colour is not used; it's a nudge, not an alarm).
- **Given** a card, **when** I open its "⋯" menu (or focus the card and press the menu key), **then** I can "Move to…" any other stage, "Open", or "Delete" (if allowed); moving updates the counts and totals and announces "Moved to Proposal".
- **Given** a keyboard, **when** I Tab to a card and press Enter, **then** the lead drawer opens (US-CRM-27); dragging with a mouse still works.

**Implementation notes**
- Data: `leads.stage_changed_at` (set when the stage changes; backfilled from `updated_at`).
- API: `GET /leads` adds `stageChangedAt`, `nextFollowUp` (`{ id, type, dueAt }` or null, the earliest open activity on the lead) and `lastActivityAt`; owners' names come from `GET /org/members`.
- UI: `leads-board.tsx`, `KanbanCard` (a menu slot; the card is focusable).

### US-CRM-26 · Say why a lead was lost, and quote a lead that's won
**Feature:** F-CRM-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `LeadLostDialog`, `LeadWonDialog`, `LeadDrawer`
**As** an owner, **I want** to record why a lead was lost and to start a quote from a won lead, **so that** I learn from losses and don't retype a winning job.

Decision: D-211

**Acceptance criteria**
- **Given** I move a lead to a Lost stage (by drag, menu or the drawer), **when** it moves, **then** a dialog asks "Why was it lost?" with Price, Timing, Went with a competitor, No response and Other, and an optional note; "Save" records it and "Skip" moves it without one. The reason shows on the card and in the drawer.
- **Given** a lost lead moves back to an open or won stage, **when** it moves, **then** its lost reason is cleared.
- **Given** I move a lead to a Won stage and may create quotes, **when** it moves, **then** a dialog says "Won — {title}" and offers "Create quote" and "Not now".
- **Given** I press "Create quote" (from that dialog or the drawer), **when** the new quote opens, **then** it has the lead's contact and currency and says which lead it's for ("For lead <title>"), and the quote is linked to the lead (a quote has no reference field, so the title isn't copied onto it); the drawer lists the lead's quotes with number, status and total, each opening the quote.
- **Given** I lack the right to create quotes, **when** a lead is won, **then** no quote offer is shown.

**Implementation notes**
- Data: `leads.lost_reason` (`price`, `timing`, `competitor`, `no_response`, `other`, or null) and `leads.lost_note`; `quotes.lead_id uuid → leads (set null)`.
- API: `PUT /leads/:id` accepts `lostReason`, `lostNote` (kept only while the stage is a Lost stage); `POST /quotes` accepts `leadId` (the same organisation and the same contact, else 400 "Choose a lead for this contact."); `GET /quotes?leadId=`. `/quotes/new?leadId=` starts the quote from the lead; a revision keeps the link, and changing a draft's contact drops a link that no longer matches.
- Security: creating the quote needs the quote create capability as before; `leadId` is checked in the service.

### US-CRM-27 · Work a lead from one drawer
**Feature:** F-CRM-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `LeadDrawer`
**As** office staff, **I want** one place for a lead's details, follow-ups, quotes and history, **so that** I can work it without hunting around.

Decision: D-211

**Acceptance criteria**
- **Given** I open a lead (card, Enter, or "Open"), **when** the drawer opens, **then** it shows the title, contact (opens the contact), stage, value, currency, source, owner and expected close date, editable with the same rights as before; "Save changes" saves and the card updates.
- **Given** the drawer, **when** I choose an owner, **then** I can pick any active member or "Unassigned"; the creator (and edit rights) doesn't change.
- **Given** the drawer's "Follow-ups" section, **when** it shows, **then** it lists the lead's activities (open ones first, by due date), and I can "Log activity" or "Add follow-up" for this lead and mark one done, as on the contact page.
- **Given** the drawer's "Quotes" and "History" sections, **when** they show, **then** Quotes lists the linked quotes (US-CRM-26) and History lists when the lead was created and each stage change, with who and when.
- **Given** a new lead ("Add lead"), **when** the drawer opens, **then** it has the same fields, with the stage of the column I pressed it from; follow-ups, quotes and history appear once it's saved.

**Implementation notes**
- Data: `leads.expected_close_date date`.
- API: `PUT /leads/:id` accepts `ownerUserId` (an active member, else 400 "Choose someone in your organisation.") and `expectedCloseDate`; `GET /leads/:id/history` → `[{ at, actorName, kind: "created" | "stage", fromStage, toStage }]` from the audit log; activities use `GET /activities?leadId=` and `POST /activities` with `leadId`.
- UI: `lead-drawer.tsx` (`Drawer`) replaces `lead-dialog.tsx` on the board; the contact page's Leads tab keeps its own dialog. Follow-ups reuse the contact page's `ActivitiesSection` (`leadId`, `followUps`). History is newest first; leads made before this change show what's been recorded since (their creation wasn't logged with a stage).

### US-CRM-28 · Filter the pipeline by owner and source, and come back to it
**Feature:** F-CRM-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `PipelineBoard`
**As** office staff, **I want** to see just my leads or one source, keep my filters when I come back, and refresh the board, **so that** it works like Contacts.

Decision: D-210, D-211

**Acceptance criteria**
- **Given** the toolbar, **when** it shows, **then** it has search, the stage filter, an owner filter ("My leads", each member, "Unassigned"), a source filter (the sources in use), sort and View; the filters combine.
- **Given** a search, filter or sort, **when** I set it, **then** the address keeps it (for example `/leads?owner=me&source=Referral`), so Back and bookmarks return to the same board.
- **Given** the toolbar, **when** it shows, **then** Refresh and "Updated … ago" work as on Contacts (US-CRM-22): the board reloads in place, and also when the tab is shown again after 30 seconds away.

**Implementation notes**
- UI: `leads-board.tsx`; the contacts list-state pattern (`contacts-list-state.ts`) for the address. No API change beyond US-CRM-25.
