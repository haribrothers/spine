# 11 · Tax

Named tax rates an owner defines for their country, groups of rates applied together (e.g. CGST + SGST, or a state surcharge compounded on a sales tax), and tax-inclusive or tax-exclusive pricing by default with a per-line override. Tax is computed per line. The Tax Summary report is in 12 Reports. Phase 8 adds recording tax payments; Phase 9 adds country presets, tax types, supply classes and, for India, GST registration, place of supply, HSN/SAC, GST invoices and a GSTR-1 export. Spine produces the numbers and files to upload; it never files returns or connects to a tax portal (D-148).

**Screens:** `SettingsTax` (P1), `TaxRateDialog` (P1), `TaxGroupDialog` (P1), `QuoteBuilder` (P1), `TaxPaymentDialog` (P1), `OnbTaxCountry` (P1), `SettingsTaxCountry` (P1), `TaxRateDialogType` (P1), `SettingsTaxGst` (P1), `ContactGstDialog` (P1), `CatalogItemDrawerGst` (P1), `InvoiceBuilderGst` (P1), `InvoicePdfGst` (P1), `Gstr1Export` (P1)
**Depends on:** 16 Settings (pane), 06 Quotes / 08 Invoicing / 10 Purchases (line editors), `@spine/shared` tax engine, 20 Banking (tax payments), 03 CRM (contact GST details), 05 Catalogue (HSN/SAC).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-TAX-01 | Named tax rates | P1 | 4 | `SettingsTax`, `TaxRateDialog` |
| F-TAX-02 | Tax groups | P1 | 4 | `TaxGroupDialog`, `QuoteBuilder` |
| F-TAX-03 | Tax-inclusive and tax-exclusive pricing | P1 | 4 | `SettingsTax`, `QuoteBuilder` |
| F-TAX-04 | Paying tax | P1 | 8 | `TaxPaymentDialog` |
| F-TAX-05 | Country tax presets | P1 | 9 | `OnbTaxCountry`, `SettingsTaxCountry` |
| F-TAX-06 | Tax types and supply classes | P1 | 9 | `TaxRateDialogType`, `InvoiceBuilderGst`, `CatalogItemDrawerGst` |
| F-TAX-07 | GST registration and place of supply | P1 | 9 | `SettingsTaxGst`, `ContactGstDialog`, `InvoiceBuilderGst` |
| F-TAX-08 | HSN/SAC and GST documents | P1 | 9 | `CatalogItemDrawerGst`, `InvoiceBuilderGst`, `InvoicePdfGst` |
| F-TAX-09 | GSTR-1 export | P1 | 9 | `Gstr1Export` |

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
- Edge: a 0% rate is how zero-rated sales are entered; from Phase 9 each line also carries a supply class (US-TAX-11, D-147, closes Q-09).

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

### US-TAX-08 · Record paying tax and using input tax credit
**Feature:** F-TAX-04 · **Priority:** P1 · **Phase:** 8 · **Screens:** `TaxPaymentDialog`
**As** an owner, **I want** to record the tax I pay to the authority, **so that** Output Tax Payable goes back to zero after I file.

Decision: D-143

**Acceptance criteria**
- **Given** Reports › Tax Summary › "Record tax payment", **when** the dialog opens, **then** it shows the period's "Tax collected", "Input tax available" and "Net payable", and asks for "Period", "Input tax used" (default: the smaller of input tax available and tax collected), "Amount paid" (default: net payable), "Paid from" (money account), "Date" and "Reference" (e.g. the challan number).
- **Given** I save, **when** it posts, **then** P26 debits Output Tax Payable by paid + input tax used, credits Input Tax Receivable by input tax used and the money account by the amount paid.
- **Given** input tax used larger than input tax available, **when** I save, **then** I see "You have <amount> of input tax to use. Lower the amount.".
- **Given** "Record tax refund", **when** I enter an amount and the money account, **then** P27 posts.
- **Given** a tax payment, **when** it's not reconciled, **then** an Owner can delete it and a reversing entry posts.
- **Given** a Staff user, **when** they call the route, **then** the API returns 403.

**Implementation notes**
- API: `POST /tax-payments`, `GET /tax-payments`, `DELETE /tax-payments/:id` (roles: owner); `POST /tax-refunds` (roles: owner).
- Data: `tax_payments` (new; `kind` payment/refund, period, input_used, amount, money account, reference, entry_id).

### US-TAX-09 · Start with my country's tax rates
**Feature:** F-TAX-05 · **Priority:** P1 · **Phase:** 9 · **Screens:** `OnbTaxCountry`, `SettingsTaxCountry`
**As** a new owner, **I want** to pick my country and get its taxes set up, **so that** I don't type rates I don't understand.

Decision: D-145

**Acceptance criteria**
- **Given** the setup wizard's Tax step, **when** it opens, **then** it asks "Where is your business registered for tax?" with "India (GST)", "United Kingdom (VAT)", "Australia (GST)", "New Zealand (GST)", "United Arab Emirates (VAT)", "Saudi Arabia (VAT)" and "Another country — I'll add my own rates".
- **Given** India, **when** I continue, **then** GST rates at 0, 0.25, 3, 5, 12, 18, 28 and 40% are created as CGST and SGST halves (and UTGST), grouped as "GST 5%", "GST 18%"… with inter-state counterparts "IGST 5%", "IGST 18%"…, plus a cess type with no rates; the 12% and 28% groups are created archived when the law no longer uses them; GST settings open next (US-TAX-12).
- **Given** the UK, **when** I continue, **then** "VAT 20%", "VAT 5%", "VAT 0%" (zero-rated) and "Exempt" are created and the document title becomes "VAT invoice".
- **Given** Australia, New Zealand, the UAE or Saudi Arabia, **when** I continue, **then** their standard rate (10%, 15%, 5%, 15%), a zero rate and an exempt class are created and the title becomes "Tax invoice".
- **Given** "Another country", **when** I continue, **then** the step works as today (US-ONB-06).
- **Given** Settings › Tax › "Country", **when** I change the country later, **then** the new preset's rates are added (existing rates are kept, never deleted) and I'm told "Added <n> rates. Your existing rates are unchanged — archive the ones you no longer use.".

**Implementation notes**
- API: `PUT /org/tax/profile { country }` (roles: owner) seeds idempotently from `packages/shared/src/tax/presets/*.ts`.
- Data: `settings` key `tax_profile` `{ country, registrationNumber?, legalName?, stateCode?, registeredOn? }`.
- Rates follow the law current when the story is built; a preset never edits an existing rate.

### US-TAX-10 · Give each rate a tax type
**Feature:** F-TAX-06 · **Priority:** P1 · **Phase:** 9 · **Screens:** `TaxRateDialogType`
**As** an owner, **I want** each rate to say what kind of tax it is, **so that** reports and returns split CGST, SGST and IGST.

**Acceptance criteria**
- **Given** "Add rate" or "Edit rate", **when** the dialog opens, **then** it has "Tax type": for India "CGST", "SGST", "UTGST", "IGST", "Cess"; elsewhere "VAT", "GST", "Sales tax" or "Other".
- **Given** existing rates from before the upgrade, **when** the migration runs, **then** they get type "Other" and keep working.
- **Given** a group, **when** it's saved for India, **then** it may combine CGST with SGST or UTGST of equal rates (plus cess), or be a single IGST rate; any other mix shows "A GST group is CGST + SGST (or UTGST) at the same rate, optionally with cess.".

**Implementation notes**
- Data: `tax_rates.tax_type` enum `tax_type`; `tax_groups.scope` (`intra`/`inter`/`any`). API: `POST/PUT /tax-rates` and `/tax-groups` accept them.

### US-TAX-11 · Mark supplies as zero-rated, exempt or outside tax
**Feature:** F-TAX-06 · **Priority:** P1 · **Phase:** 9 · **Screens:** `InvoiceBuilderGst`, `CatalogItemDrawerGst`
**As** an owner, **I want** to say why a line has no tax, **so that** my return reports exempt and zero-rated sales correctly.

Decision: D-147 · Closes: Q-09

**Acceptance criteria**
- **Given** a catalogue item, **when** I edit it, **then** "Supply type" offers "Taxable", "Zero-rated", "Exempt" and "Non-taxable (outside GST/VAT)".
- **Given** a document line, **when** its tax is 0%, **then** it shows the supply type from the item (else "Zero-rated") and I can change it.
- **Given** an exempt or non-taxable line, **when** I pick a non-zero rate, **then** I see "An exempt line has no tax. Change the supply type to Taxable to add tax.".
- **Given** issued documents, **when** the supply type is shown later, **then** it's the one snapshotted at issue.

**Implementation notes**
- Data: `catalog_items.supply_class`, `*_lines.supply_class` enum `supply_class` (`taxable`, `zero_rated`, `exempt`, `non_taxable`); migration sets `taxable` where tax > 0, else `zero_rated`.

### US-TAX-12 · Record my GSTIN and state, and each customer's
**Feature:** F-TAX-07 · **Priority:** P1 · **Phase:** 9 · **Screens:** `SettingsTaxGst`, `ContactGstDialog`
**As** an owner in India, **I want** my GST registration and my customers' details recorded, **so that** Spine knows which GST applies.

Decision: D-146

**Acceptance criteria**
- **Given** Settings › Tax › "GST", **when** it opens, **then** it asks for "GSTIN", "Legal name", "Trade name", "State" and "Registered on".
- **Given** a GSTIN, **when** I enter it, **then** it's checked for format and checksum ("This GSTIN isn't valid — check the 15 characters.") and its first two digits must match the state ("This GSTIN belongs to <state>.").
- **Given** a contact, **when** I edit it, **then** "GST treatment" offers "Registered business", "Unregistered business", "Consumer", "Overseas" and "Special economic zone", with "GSTIN" required for registered and SEZ, and "State" on each address.
- **Given** contact import, **when** a file has GSTIN and state columns, **then** they're mapped too.
- **Given** a registered contact with a GSTIN, **when** it's saved, **then** the state is filled from the GSTIN when blank.

**Implementation notes**
- Data: `settings.tax_profile` (as US-TAX-09), `contacts.gst_treatment`, `contacts.tax_id` (exists, used as GSTIN), `addresses.state_code` (two-digit GST state code). API: `PUT /org/tax/profile`, `PUT /contacts/:id`.

### US-TAX-13 · Pick intra- or inter-state GST automatically
**Feature:** F-TAX-07 · **Priority:** P1 · **Phase:** 9 · **Screens:** `InvoiceBuilderGst`, `CatalogItemDrawerGst`
**As** office staff, **I want** the right GST chosen from where the customer is, **so that** I never pick CGST + SGST for an out-of-state sale.

Decision: D-146

**Acceptance criteria**
- **Given** a catalogue item, **when** GST is on, **then** it has "Intra-state tax" and "Inter-state tax" (e.g. "GST 18%" and "IGST 18%"), defaulting from Settings › Tax › "Default tax preference".
- **Given** a quote, invoice or credit note, **when** the customer and address are chosen, **then** "Place of supply" shows the state (from the site or shipping address, else billing) and can be changed.
- **Given** place of supply in my state, **when** I add an item, **then** its intra-state tax is used; in another state, overseas or SEZ, its inter-state tax.
- **Given** I change the place of supply on a draft, **when** it changes between intra and inter, **then** every line that still uses the item's default switches, and lines I changed by hand stay and show a warning icon ("Check this line's tax — the place of supply changed.").
- **Given** vendor bills, **when** a vendor's state differs from mine, **then** the same rule picks inter-state tax.
- **Given** an issued document, **when** I open it, **then** its place of supply and supply type are the ones snapshotted at issue.

**Implementation notes**
- Data: `catalog_items.inter_tax_rate_id` / `inter_tax_group_id` (the existing default becomes intra); `quotes`/`invoices`/`credit_notes`/`vendor_bills` gain `place_of_supply` (state code) and `supply_type` (`intra`/`inter`/`export`). `TaxResolverService` picks per line; unit tests in `@spine/shared`.

### US-TAX-14 · Add HSN or SAC codes to items and lines
**Feature:** F-TAX-08 · **Priority:** P1 · **Phase:** 9 · **Screens:** `CatalogItemDrawerGst`, `InvoiceBuilderGst`
**As** an owner in India, **I want** HSN and SAC codes on what I sell and buy, **so that** invoices and GSTR-1 have them.

**Acceptance criteria**
- **Given** a catalogue item, **when** GST is on, **then** it has "HSN/SAC code" (4, 6 or 8 digits; "Enter 4, 6 or 8 digits.").
- **Given** a line from that item, **when** it's added, **then** it copies the code and I can change it on the line.
- **Given** a line without a code on an invoice for a registered business, **when** I issue it, **then** I'm warned "<n> lines have no HSN/SAC code. GSTR-1 needs them." and can issue anyway.
- **Given** catalogue import (US-CAT-09), **when** the file has an HSN/SAC column, **then** it's mapped.

**Implementation notes**
- Data: `catalog_items.hsn_sac`, `*_lines.hsn_sac` (snapshot).

### US-TAX-15 · Print GST details on invoices and credit notes
**Feature:** F-TAX-08 · **Priority:** P1 · **Phase:** 9 · **Screens:** `InvoicePdfGst`
**As** an owner in India, **I want** my invoices to meet GST rules, **so that** customers can claim input tax.

**Acceptance criteria**
- **Given** GST is on, **when** an invoice PDF renders, **then** it's titled "Tax Invoice" (or "Bill of Supply" when every line is exempt or non-taxable), and shows my GSTIN and state, the customer's GSTIN (when registered), "Place of supply: <state> (<code>)", HSN/SAC per line, and tax split as CGST and SGST (or IGST) per line with rates.
- **Given** an export invoice, **when** it renders, **then** it shows "Supply meant for export" and the overseas address.
- **Given** a credit note, **when** it renders, **then** it shows the same GST details and the original invoice's number and date.
- **Given** a total, **when** it renders, **then** an HSN-wise tax summary table follows the lines (when the layout option is on, US-SET-17).
- **Given** no GST profile, **when** a PDF renders, **then** none of this shows and documents look as before.

**Implementation notes**
- `invoice-pdf.template.tsx` and `credit-note-pdf.template.tsx` read the snapshot fields; PDF snapshot tests for intra, inter, export and bill-of-supply cases.

### US-TAX-16 · Export GSTR-1 for the GST portal
**Feature:** F-TAX-09 · **Priority:** P1 · **Phase:** 9 · **Screens:** `Gstr1Export`
**As** an owner or my accountant, **I want** a GSTR-1 file I can upload, **so that** filing doesn't mean retyping every invoice.

Decision: D-148

**Acceptance criteria**
- **Given** Reports › Tax › "GSTR-1", **when** I choose "Monthly" or "Quarterly" and the period, **then** I see counts and values for B2B, B2CL, B2CS, CDNR, CDNUR, Exports, Nil/exempt/non-GST, HSN summary and Documents issued.
- **Given** "Download JSON", **when** it downloads, **then** the file follows the GST portal's GSTR-1 upload format with my GSTIN and the period, and its schema version is written in it.
- **Given** a credit note in the period against an invoice from an earlier period, **when** the file is built, **then** it's in CDNR/CDNUR with the original invoice's number and date.
- **Given** "Documents issued", **when** it's built, **then** it lists invoice and credit note number ranges with totals and voided counts.
- **Given** the export, **when** I read the footer, **then** it says "Spine prepares this file; it doesn't file your return. Check it, then upload it on the GST portal.".

**Implementation notes**
- API: `GET /exports/gstr1?period=YYYY-MM|YYYY-Qn&format=json|xlsx` (`reports.view_financial_statements`). Mapping lives in one module (`apps/api/src/modules/tax/gstr1/`) with fixture tests per table.

### US-TAX-17 · Check GSTR-1 figures before uploading
**Feature:** F-TAX-09 · **Priority:** P1 · **Phase:** 9 · **Screens:** `Gstr1Export`
**As** an accountant, **I want** to see problems before I upload, **so that** the portal doesn't reject the file.

**Acceptance criteria**
- **Given** the GSTR-1 page, **when** problems exist, **then** they're listed before the download buttons: registered customers with no GSTIN, lines with no HSN/SAC, invoices with no place of supply, and totals that don't match the Tax Summary — each with a link to fix it.
- **Given** "Download Excel", **when** it opens, **then** it has one sheet per GSTR-1 table plus "Problems", with the same figures as the JSON.
- **Given** the totals, **when** they're compared, **then** total tax in the file equals the Tax Summary's tax collected for the period (tested).

**Implementation notes**
- Same route with `format=xlsx` (`exceljs`, D-144).
