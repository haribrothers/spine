# 11 · Tax

Named tax rates an owner defines for their country, groups of rates applied together (e.g. CGST + SGST, or a state surcharge compounded on a sales tax), and tax-inclusive or tax-exclusive pricing by default with a per-line override. Tax is computed per line. The Tax Summary report is in 12 Reports. Spine produces the numbers; it never files returns.

**Screens:** `SettingsTax` (P1), `TaxRateDialog` (P1), `TaxGroupDialog` (P1), `QuoteBuilder` (P1)
**Depends on:** 16 Settings (pane), 06 Quotes / 08 Invoicing / 10 Purchases (line editors), `@spine/shared` tax engine.

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-TAX-01 | Named tax rates | P1 | 4 | `SettingsTax`, `TaxRateDialog` |
| F-TAX-02 | Tax groups | P1 | 4 | `TaxGroupDialog`, `QuoteBuilder` |
| F-TAX-03 | Tax-inclusive and tax-exclusive pricing | P1 | 4 | `SettingsTax`, `QuoteBuilder` |

## User stories

### US-TAX-01 · Define my own named tax rates
**Feature:** F-TAX-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `SettingsTax`, `TaxRateDialog`
**As** an owner, **I want** to create the tax rates my country uses, **so that** Spine works where I am.

Legacy: S-08.1

**Acceptance criteria**
- **Given** Settings › Tax, **when** it opens, **then** I see "Named tax rates, combined into groups for split taxes (e.g. CGST + SGST). A quote, invoice, or catalogue item picks one rate or one group per line." and a "Tax rates" list.
- **Given** "Add rate", **when** I enter "Name" (placeholder "e.g. GST") and "Rate (%)" and save, **then** the rate is listed as "<name> <rate>%".
- **Given** I tick "Compound", **when** the rate is used in a group, **then** it's calculated on the subtotal plus the earlier rates.
- **Given** no rates, **when** I open the pane, **then** I see "No tax rates yet.".
- **Given** saving fails, **when** the error returns, **then** I see "Could not save tax rate.".

**Implementation notes**
- API: `POST /tax-rates`, `PUT /tax-rates/:id` (Owner).
- Data: `tax_rates` (`rate` is `real` today; `numeric(9,4)` after US-TAX-07, `is_compound`).
- Edge: a 0% rate is how zero-rated sales are entered; exempt vs zero-rated reporting is open (Q-09).

### US-TAX-02 · Change or retire a tax rate safely
**Feature:** F-TAX-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `SettingsTax`
**As** an owner, **I want** to edit or archive a rate without changing old documents, **so that** past invoices stay correct.

**Acceptance criteria**
- **Given** a rate used on issued invoices, **when** I change its percentage, **then** existing documents keep the percentage they were issued with.
- **Given** a rate, **when** I choose "Archive", **then** it's hidden from line pickers but still shown on old documents; "Restore" brings it back.
- **Given** a Staff user, **when** they try to change a rate, **then** the API returns 403.

**Implementation notes**
- API: `POST /tax-rates/:id/archive`, `/restore`.
- Data: lines store `tax_rate_percentage` snapshot (I11).

### US-TAX-03 · Combine rates into a group for split taxes
**Feature:** F-TAX-02 · **Priority:** P1 · **Phase:** 4 · **Screens:** `TaxGroupDialog`
**As** an owner, **I want** to group several rates under one name, **so that** a split tax is one choice on a line.

Legacy: S-08.3

**Acceptance criteria**
- **Given** at least one rate exists, **when** I press "Add group", **then** a dialog asks for "Name" and the rates to include.
- **Given** no rates exist, **when** I open Tax groups, **then** I see "Add at least one tax rate before creating a group.".
- **Given** a group "Sales Tax + Surcharge" of 15% and 2.5% compound, **when** it's saved, **then** it's listed as "Sales Tax (15%) + State Surcharge (2.5%)".
- **Given** no groups, **when** I open the section, **then** I see "No tax groups yet.".

**Implementation notes**
- API: `POST /tax-groups`, `PUT /tax-groups/:id`, `/archive`, `/restore`.
- Data: `tax_groups`, `tax_group_rates`.

### US-TAX-04 · Apply a group on a line and get the right total
**Feature:** F-TAX-02 · **Priority:** P1 · **Phase:** 4 · **Screens:** `QuoteBuilder`
**As** office staff, **I want** a line with a tax group to compute each part correctly, **so that** documents are right without a calculator.

**Acceptance criteria**
- **Given** a 1,000.00 line with a group of 15% + 2.5% compound, **when** totals compute, **then** tax is 150.00 + 28.75 = 178.75 and the line total is 1,178.75.
- **Given** a line, **when** I choose a rate, **then** I can't also choose a group (one or the other).
- **Given** rounding, **when** each part computes, **then** the line tax is rounded once, half-up, in minor units.

**Implementation notes**
- `@spine/shared` `computeLineTax`; `TaxResolverService` resolves `tax_rate_id` xor `tax_group_id`. Unit tests are mandatory here.

### US-TAX-05 · Choose whether my prices include tax
**Feature:** F-TAX-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `SettingsTax`
**As** an owner, **I want** to say whether my prices include tax, **so that** quotes match how I sell.

Legacy: S-08.2

**Acceptance criteria**
- **Given** Settings › Tax, **when** I turn on "Prices include tax by default", **then** the helper reads "New quote/invoice lines default to tax-inclusive pricing. Each line can still override this.".
- **Given** the setting is on, **when** I add a line priced 115.00 at 15%, **then** the line shows net 100.00, tax 15.00, total 115.00.
- **Given** the setting is off, **when** I add the same line, **then** it shows net 115.00, tax 17.25, total 132.25.

**Implementation notes**
- API: `GET/PUT /org/tax/prices-include-tax`.
- Data: `settings.prices_include_tax`; `*_lines.is_tax_inclusive`.

### US-TAX-06 · Override tax-inclusive pricing on one line
**Feature:** F-TAX-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `QuoteBuilder`
**As** office staff, **I want** to switch one line between inclusive and exclusive pricing, **so that** exceptions are possible.

Legacy: S-08.5

**Acceptance criteria**
- **Given** a line, **when** I tick or untick "Price includes tax", **then** that line's net, tax and total recompute and other lines don't change.
- **Given** a line's tax defaulted from a catalogue item, **when** I pick a different rate, **then** the line uses the new rate and the item is unchanged.
- **Given** the document is saved, **when** I reopen it, **then** each line keeps its own inclusive flag.

**Implementation notes**
- UI: line editors in quotes, invoices, vendor bills and variation orders all expose the flag and the rate/group picker.

### US-TAX-07 · Store rates, quantities and percentages exactly
**Feature:** F-TAX-01 · **Priority:** P1 · **Phase:** 6 · **Screens:** `TaxRateDialog`, `QuoteBuilder`
**As** an owner, **I want** rates and quantities stored as exact decimals, **so that** a line total never drifts by a cent because of floating-point storage.

Review finding: Stage 5 #22 · Decision: D-004

**Acceptance criteria**
- **Given** a tax rate of 8.875%, **when** it's saved and read back, **then** it is exactly 8.875.
- **Given** a line with quantity 0.1 × 3 at 33.33, **when** its total is computed, **then** the result matches the decimal calculation rounded half-up once at line level.
- **Given** the migration runs on an existing database, **when** it finishes, **then** every `real` rate, quantity, percentage, retention and milestone-amount column is `numeric` and every issued document's stored totals are unchanged.
- **Given** the money unit tests, **when** they run, **then** a test fails if any schema column used in a money calculation is `real` or `double precision`.

**Implementation notes**
- Data: `tax_rates.rate`, `*_lines.quantity`, `*_lines.discount_percentage`, `*_lines.tax_rate_percentage`, `catalog_items.default_tax_rate_percentage`, `jobs.retention_pct`, `milestones.amount` → `numeric(18,4)` (04 "Columns added"). Drizzle returns `numeric` as string; parse with the shared decimal helper.
- Totals already stored in minor units (`bigint`) are not recomputed.
