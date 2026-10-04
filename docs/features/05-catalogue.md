# 05 · Catalogue

The goods and services a business quotes and invoices, each with a unit, default price, default tax and the income and expense accounts it posts to. Items speed up document lines; documents copy the item's values at the time so later catalogue changes never alter them.

**Screens:** `CatalogList` (P1), `CatalogEmpty` (P1), `CatalogItemDrawer` (P1), `CatalogDeleteConfirm` (P2), `QuoteBuilder` (P1), `TeamPrivilegesExpanded` (P1), `QuoteLinePicker` (P2)
**Depends on:** 11 Tax (rates and groups), 12 Reports (accounts), 06 Quotes / 08 Invoicing (line editors).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-CAT-01 | Catalogue items | P1 | 1 | `CatalogList`, `CatalogEmpty`, `CatalogItemDrawer`, `CatalogDeleteConfirm` |
| F-CAT-02 | Items on document lines | P1 | 1 | `QuoteBuilder` |
| F-CAT-03 | Own/others catalogue rights | P1 | 4 | `CatalogList`, `TeamPrivilegesExpanded` |

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
- Status: one-off lines are built; "save to catalogue" is not, so this story moved to Phase 6.
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
