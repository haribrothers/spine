# 05 · Catalogue

The goods and services a business quotes and invoices, each with a unit, default price, default tax and the income and expense accounts it posts to. Items speed up document lines; documents copy the item's values at the time so later catalogue changes never alter them.

**Screens:** `CatalogList` (P1), `CatalogEmpty` (P1), `CatalogItemDrawer` (P1), `CatalogDeleteConfirm` (P2), `QuoteBuilder` (P1), `TeamPrivilegesExpanded` (P1), `QuoteLinePicker` (P2), `ImportCatalogDialog` (P2), `CatalogListRefined` (P2), `CatalogListRefinedDark` (P2), `CatalogBulkSelect` (P2), `CatalogMakeBundle` (P2), `CatalogBundlesEmpty` (P2), `CatalogItemDrawerRefined` (P2)
**Depends on:** 11 Tax (rates and groups), 12 Reports (accounts), 06 Quotes / 08 Invoicing (line editors).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-CAT-01 | Catalogue items | P1 | 1 | `CatalogList`, `CatalogEmpty`, `CatalogItemDrawer`, `CatalogDeleteConfirm` |
| F-CAT-02 | Items on document lines | P1 | 1 | `QuoteBuilder` |
| F-CAT-03 | Own/others catalogue rights | P1 | 4 | `CatalogList`, `TeamPrivilegesExpanded` |
| F-CAT-04 | Import items from CSV | P2 | 8 | `ImportCatalogDialog` |
| F-CAT-05 | A catalogue that's easy to keep: setup gaps you can act on, a table that says more, many items at once, export, bundles from items, and an item's use | P2 | Refinements | `CatalogListRefined`, `CatalogListRefinedDark`, `CatalogBulkSelect`, `CatalogMakeBundle`, `CatalogBundlesEmpty`, `CatalogItemDrawerRefined`, `CatalogBulkConfirm` |

## User stories

### US-CAT-01 · Save a service or material with a default price
**Feature:** F-CAT-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `CatalogItemDrawer`
**As** office staff, **I want** to save what we sell with a unit, price and tax, **so that** quoting is fast.

Legacy: S-02.1

**Acceptance criteria**
- **Given** Catalogue ("Goods and services you quote, invoice and sell."), **when** I press "Add item", **then** a drawer "Add item" opens with "Goods or services with a default price and tax rate — you can override the price on a quote later.".
- **Given** the drawer, **when** I view it, **then** I see "Name" (required), "Description", "Unit" (helper "e.g. hour, sq ft, each"; type to create a new unit), "Category" (helper "Free text, optional"), "Default price", "Currency" and "Default tax" (placeholder "No tax", helper "Pre-fills a new quote/invoice line for this item; editable per line.").
- **Given** valid input, **when** I press "Save item", **then** an "Item created" toast shows and the item is listed with its default price.
- **Given** saving fails, **when** the error returns, **then** I see "Could not save item." and my input stays.
- **Given** a negative price, **when** I save, **then** the price field shows an error.

**Implementation notes**
- API: `POST /catalog-items` (`catalog.edit_own`).
- Data: `catalog_items` (`unit`, `default_price_amount`, `tax_rate_id`/`tax_group_id`, `created_by_user_id`).
- UI: `catalog-item-drawer.tsx`, `catalog-form.tsx`.

### US-CAT-02 · Map an item to income and expense accounts
**Feature:** F-CAT-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `CatalogItemDrawer`
**As** an owner, **I want** each item to post to a chosen income account, **so that** revenue reports break down meaningfully.

Legacy: S-02.3

**Acceptance criteria**
- **Given** the item drawer, **when** I open "Default income account" (helper "Used when this item appears on an invoice line."), **then** I can choose any income account or "None".
- **Given** an item mapped to "Sales — Goods", **when** an invoice with that item is issued, **then** its line's revenue credits "Sales — Goods".
- **Given** an item with no income account, **when** it's invoiced, **then** revenue posts to 4100 "Sales — Services".
- **Given** "Default expense account", **when** I choose one, **then** vendor-bill lines using this item default to it.

**Implementation notes**
- Data: `catalog_items.income_account_id`, `expense_account_id`.
- Edge: posting split per line account (06-ledger-posting-rules P1).

### US-CAT-03 · Find items and spot missing setup
**Feature:** F-CAT-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `CatalogList`, `CatalogEmpty`
**As** office staff, **I want** to search and filter the catalogue and see which items lack tax or accounts, **so that** documents come out right.

**Acceptance criteria**
- **Given** items exist, **when** I open Catalogue, **then** I see "Total items", "Categories", "Missing tax rate" and "Missing account mapping" above a table of name, category, unit, default price, tax and status.
- **Given** I type in "Search items" or filter by status, category or "Min price"/"Max price", **when** it applies, **then** only matching items show; with none I see "No items match these filters".
- **Given** no items exist, **when** I open Catalogue, **then** I see an empty state with "Add item".
- **Given** I click "Missing tax rate", **when** it applies, **then** the table shows only items with no default tax.

**Implementation notes**
- API: `GET /catalog-items?search=&category=&includeArchived=`.
- UI: `catalog-explorer.tsx`, `catalog-table.tsx`.

### US-CAT-04 · Archive or delete an item
**Feature:** F-CAT-01 · **Priority:** P2 · **Phase:** 1 · **Screens:** `CatalogDeleteConfirm`
**As** office staff, **I want** to retire items we no longer sell, **so that** pickers stay short.

**Acceptance criteria**
- **Given** an item's row menu, **when** I choose "Archive", **then** it disappears from pickers and active lists; "Restore" brings it back.
- **Given** I choose "Delete", **when** the confirmation "Delete <item name>?" appears, **then** it explains existing quotes and invoices keep their own copy of the line.
- **Given** I confirm, **when** it succeeds, **then** an "Item deleted" toast shows and documents that used it are unchanged.

**Implementation notes**
- API: `POST /catalog-items/:id/archive`, `/restore`, `DELETE /catalog-items/:id`.
- Edge: deleting a referenced item is allowed because lines store a snapshot (`quote_lines.catalog_item_id` is set null).

### US-CAT-05 · Change a line's price without changing the catalogue
**Feature:** F-CAT-02 · **Priority:** P1 · **Phase:** 1 · **Screens:** `QuoteBuilder`
**As** office staff, **I want** to adjust a price on one quote, **so that** I can negotiate without touching the catalogue.

Legacy: S-02.2

**Acceptance criteria**
- **Given** I pick a catalogue item on a quote line, **when** it's added, **then** name, description, unit price and default tax are copied onto the line.
- **Given** I edit the line's price, **when** I save the quote, **then** the catalogue item's default price is unchanged.
- **Given** a catalogue price changes later, **when** I open an existing quote or invoice, **then** its lines still show the old price.
- **Given** an issued invoice, **when** I reprint its PDF a year later, **then** it's identical to the original.

**Implementation notes**
- Data: `quote_lines` / `invoice_lines` snapshot columns (I11).
- Edge: D-006.

### US-CAT-06 · Add a new item while building a quote
**Feature:** F-CAT-02 · **Priority:** P2 · **Phase:** 7 · **Screens:** `QuoteLinePicker`
**As** office staff, **I want** to type a line that isn't in the catalogue, **so that** I'm not interrupted mid-quote.

Legacy: S-02.4

**Acceptance criteria**
- **Given** a quote line, **when** I type a name that matches no item, **then** the picker's footer offers "Use “<name>” as a one-off line".
- **Given** that footer, **when** I tick "Also save to catalogue" and choose the one-off line, **then** an item is created with that name, unit, price and tax once the line has a price.
- **Given** I lack `catalog.edit_own`, **when** I build a quote, **then** one-off lines still work but "Also save to catalogue" is hidden.

**Implementation notes**
- API: `POST /catalog-items` from the line editor.
- Built in Phase 7: the item field is one picker (`apps/web/src/components/line-item-picker.tsx`) — catalogue matches with price and unit, then the one-off footer. A marked line becomes an item when the quote is saved and it has a price (unit "each", tax from the line), and the quote line links to it; a line without a price stays one-off.
- UI: `quote-line-editor.tsx` item `Combobox`.

### US-CAT-07 · Let a Team edit only the items it created
**Feature:** F-CAT-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `CatalogList`
**As** an owner, **I want** own/others rights for catalogue items, **so that** juniors can add items without changing colleagues' pricing.

Legacy: S-02.5

**Acceptance criteria**
- **Given** a member with `catalog.edit_own` only, **when** they open an item someone else created, **then** "Edit" is hidden and `PUT` returns 403.
- **Given** a member with `catalog.delete_others`, **when** they delete a colleague's item, **then** it's deleted.
- **Given** a Team with neither edit right, **when** its members open Catalogue, **then** "Add item" is hidden.
- **Given** any member, **when** they open Catalogue, **then** they can read every item.

**Implementation notes**
- API: service-layer ownership check on `catalog_items.created_by_user_id`.

### US-CAT-08 · Grant catalogue rights independently of contacts
**Feature:** F-CAT-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `TeamPrivilegesExpanded`
**As** an owner, **I want** catalogue and contact rights as separate groups, **so that** I can give one without the other.

**Acceptance criteria**
- **Given** a Team's Privileges tab, **when** I expand "Manage Catalogue", **then** it lists only the four catalogue capabilities with their own "grant all" switch.
- **Given** I grant all catalogue rights, **when** I look at "Manage Contacts", **then** it's unchanged.
- **Given** the change, **when** a member next acts, **then** the API enforces the new grants without them signing out.

**Implementation notes**
- Data: `team_privileges`; groups from `CAPABILITY_LABELS[*].group`.

### US-CAT-09 · Import catalogue items from a spreadsheet
**Feature:** F-CAT-04 · **Priority:** P2 · **Phase:** 8 · **Screens:** `ImportCatalogDialog`
**As** an owner moving from other software, **I want** to import my items, **so that** I don't type hundreds of them.

Decision: D-161

**Acceptance criteria**
- **Given** Catalogue › "Import", **when** I choose a CSV file, **then** I map "Name", "Description", "Unit", "Price", "Tax", "Income account", "Expense account" (and "HSN/SAC" from Phase 9) and see a preview of the first rows.
- **Given** a tax or account that doesn't match one in Spine by name or code, **when** I preview, **then** the row is flagged "Unknown tax <name>" or "Unknown account <code>" and I can skip it or fix the file.
- **Given** an item name already in the catalogue, **when** I import, **then** it's skipped as a duplicate and listed.
- **Given** the import finishes, **when** the summary shows, **then** it reads "Imported <n> items · skipped <m> duplicates · <k> rows failed" with a download of the failed rows.

**Implementation notes**
- API: `POST /catalog-items/import` (`catalog.edit_own`), same pattern as `POST /contacts/import` (US-CRM-14).

### US-CAT-10 · Spot items that need setup from the stat cards
**Feature:** F-CAT-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `CatalogListRefined`
**As** an owner, **I want** the stat cards to say what needs fixing and take me to it, **so that** documents come out right.

Decision: D-213

**Acceptance criteria**
- **Given** Catalogue › Items, **when** it shows, **then** the cards read "Total items", "Categories", "Missing tax rate" and "No income account" (with "Posts to 4100 Sales — Services" under it), counting active items. "Missing tax rate" counts taxable items with no default tax; exempt and non-taxable items don't count, and for a GST business zero-rated items don't either (it's a supply type chosen on the form). Elsewhere "zero-rated" is just what an untaxed item defaults to, so any untaxed item that isn't exempt or non-taxable counts.
- **Given** "Missing tax rate" or "No income account", **when** I press it, **then** the table shows just those items, the card shows pressed ("Showing these · press again to clear") and the address keeps it; pressing it again clears it. "Total items" clears every filter.
- **Given** a keyboard or screen reader, **when** I reach a card, **then** it's a button that says what it does ("Show items missing a tax rate, 3") with its pressed state.

**Implementation notes**
- UI: `catalog-list-state.ts` (`catalogStats`, `isMissingTax`), `catalog-explorer.tsx`; filters from the items already loaded. Closes the US-CAT-03 gap (its last criterion).
- No API change.

### US-CAT-11 · Read an item's tax, HSN/SAC and description in the list
**Feature:** F-CAT-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `CatalogListRefined`, `CatalogListRefinedDark`
**As** office staff, **I want** the table to show which tax an item carries and what it is, **so that** I can check the catalogue without opening each item.

Decision: D-213

**Acceptance criteria**
- **Given** the table, **when** a row shows, **then** "Tax" names the default tax ("GST 18%"); a zero-rated, exempt or non-taxable item says so; a taxable item with no tax says "No tax" in the due-soon colour with a warning icon (not colour alone).
- **Given** the organisation uses GST, **when** the table shows, **then** an "HSN/SAC" column shows each item's code ("—" when none); it's in Columns and hidden by default for other organisations.
- **Given** an item with a description, **when** its row shows, **then** the description is a muted line under the name, cut short with the full text on hover; long names wrap to two lines.
- **Given** archived items are shown, **when** an archived row shows, **then** it carries an "Archived" badge beside its name; active rows carry nothing (the Status column goes).

**Implementation notes**
- UI: `catalog-table.tsx`; tax names from the tax rates and groups the drawer already loads.
- No API change.

### US-CAT-12 · Duplicate, change many items at once, and export
**Feature:** F-CAT-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `CatalogBulkSelect`
**As** an owner, **I want** to copy an item, change several at once and export the list, **so that** keeping the catalogue tidy doesn't take an afternoon.

Decision: D-213

**Acceptance criteria**
- **Given** a row's menu, **when** I choose "Duplicate", **then** the Add item drawer opens filled from that item with the name "<name> (copy)"; saving creates a new item and the original is unchanged.
- **Given** the table, **when** I tick rows (or the header box for every row on the page), **then** a bar shows "<n> selected" with "Set category", "Set tax", "Set income account", "Archive" (or "Restore"), "Make a bundle" (US-CAT-14) and "Clear"; changing filters or the page clears the selection.
- **Given** a GST business, **when** I set a GST group for the selection, **then** each item's inter-state tax becomes the one active IGST rate at the same total ("IGST 18%" with "GST 18%"); "No tax" clears both; without exactly one matching IGST rate the inter-state tax stays as it was. The menu says so.
- **Given** I set a category, tax or income account for the selection, **when** I save, **then** every selected item changes in one save and a toast says "Updated <n> items"; if I may not change some of them (own/others rights), nothing changes and it says "You can't change <k> of these items. Unselect them and try again."
- **Given** I archive or restore the selection, **when** it succeeds, **then** a toast says "Archived <n> items" (or "Restored"); the same all-or-nothing rule applies, with the delete rights.
- **Given** "Export", **when** I press it, **then** `catalogue-<date>.csv` downloads with the items in the list as filtered, in the columns Import reads (Name, Description, Unit, Price, Tax, HSN/SAC code, Income account, Expense account) plus Category; Import reads Category too, so an exported file imports back.

**Implementation notes**
- API: `POST /catalog-items/bulk` `{ ids (1–200), action: "update" | "archive" | "restore", changes? }`; the import field `category`.
- Security: each item's own/others check runs before any change (edit rights for update, delete rights for archive and restore); one transaction.

### US-CAT-13 · Search, filter and come back to the same catalogue
**Feature:** F-CAT-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `CatalogListRefined`
**As** office staff, **I want** the catalogue to keep my search and filters and refresh on request, **so that** it works like Contacts and the pipeline.

Decision: D-210, D-213

**Acceptance criteria**
- **Given** the toolbar, **when** it shows, **then** it has Status, Category and a "Price" button (Min and Max in a popover; it reads "₹100 – ₹5,000" once set), with search on its own row beside Columns.
- **Given** a search, filter, setup card, sort or page, **when** I set it, **then** the address keeps it (for example `/catalog?category=Labour&setup=tax`), so Back and bookmarks return to the same list; "Clear filters" clears them.
- **Given** the toolbar, **when** it shows, **then** Refresh and "Updated … ago" work as on Contacts (US-CRM-22), including a refresh when the tab is shown again after 30 seconds.

**Implementation notes**
- UI: the contacts list-state pattern (`contacts-list-state.ts`); `DataTable` with a controlled page and search (US-CRM-23).
- No API change.

### US-CAT-14 · Make a bundle from items, and see bundles at a glance
**Feature:** F-CAT-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `CatalogMakeBundle`, `CatalogBundlesEmpty`
**As** an owner, **I want** to group items into a bundle without building a quote first, **so that** packages I sell together are one pick away.

Decision: D-213

**Acceptance criteria**
- **Given** the tabs, **when** they show, **then** they read "Items <n>" and "Bundles <n>" (active ones).
- **Given** items selected (US-CAT-12), **when** I choose "Make a bundle", **then** a dialog asks for a name and an optional description and lists the items with a quantity each (1 to start) and the total; "Save bundle" saves it with each item's default price and tax, a toast says "Bundle saved" and it's listed under Bundles.
- **Given** items in more than one currency, **when** I choose "Make a bundle", **then** it says "Choose items in one currency." and nothing is saved.
- **Given** no bundles, **when** Bundles shows, **then** an empty state with an icon says "No bundles yet" and "Group what you quote together. Select items and choose Make a bundle, or save a quote's lines from its More menu.", with "Choose items" (opens Items).

**Implementation notes**
- API: `POST /catalog-bundles` accepts `items: [{ catalogItemId, quantity }]` (1–50, same organisation, active, one currency) in place of `sourceQuoteId`; exactly one of the two.
- Security: `catalog.edit_own`, as saving a bundle from a quote.

### US-CAT-15 · See where an item is used, in a drawer that's easy to scan
**Feature:** F-CAT-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `CatalogItemDrawerRefined`
**As** an owner, **I want** the item drawer grouped and to say where the item is used, **so that** I know what a change or a delete touches.

Decision: D-213

**Acceptance criteria**
- **Given** the item drawer, **when** it opens, **then** its fields sit under "Details" (name, description, unit, category), "Price and tax" (price, currency, HSN/SAC, taxes, supply type) and "Accounts" (income and expense), with Save always in view.
- **Given** an existing item, **when** the drawer opens, **then** it says "Used on 4 quotes and 2 invoices · last quoted 3 Oct 2026", or "Not used on a quote or invoice yet."; counts include drafts and reflect what I may read.
- **Given** I delete an item that's been used, **when** the confirmation shows, **then** it says how many documents used it and that they keep their own copy of the line.

**Implementation notes**
- API: `GET /catalog-items/:id/usage` → `{ quotes, invoices, lastQuotedAt }` (distinct documents with a line from the item); Owner and Staff only.
- UI: `catalog-form.tsx`, `catalog-item-drawer.tsx`, `catalog-row-actions.tsx`.

### US-CAT-16 · Confirm a change to many items before it happens
**Feature:** F-CAT-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `CatalogBulkConfirm`
**As** an owner, **I want** to be asked before a bulk change to tax or category, **so that** a slip on the selection doesn't re-tax half the catalogue.

Decision: D-218, D-223

**Acceptance criteria**
- **Given** items ticked, **when** I choose a tax rate or group (or "No tax") from "Set tax", **then** "Change the tax on 12 items?" says the new tax, that it applies to new quotes and invoices only (issued documents keep theirs), and offers "Change tax" and "Go back".
- **Given** items ticked, **when** I set a category, **then** "Move 12 items to “Labour”?" asks first, with "Move items" and "Go back".
- **Given** I confirm, **when** it finishes, **then** the toast says how many changed, as today; Go back changes nothing and keeps the selection.
- **Given** bulk Archive or Restore, **when** I choose it, **then** it doesn't ask (Restore undoes it, D-218) and toasts as today.

**Implementation notes**
- UI: `catalog-bulk-bar.tsx` asks with `useConfirm()` before `POST /catalog-items/bulk`.
- No API change.

