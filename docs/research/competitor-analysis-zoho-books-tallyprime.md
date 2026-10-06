# Competitor analysis · Zoho Books and TallyPrime

**Date:** 2026-10-06 · **Status:** Research, now acted on.

**Outcome (2026-10-06):** the owner took every "V1" item below, plus the setup page, accountant access, recurring bills, Settings › Modules, the cash-basis P&L, email and PDF options, the Tally export, the GSTR-1 export and the UPI QR, into 1.0 as **Phase 8 · Books completeness** and **Phase 9 · Tax, documents and setup**; Packaging & 1.0 is now Phase 10 ([D-133](../prd/12-decisions.md)–[D-161](../prd/12-decisions.md), [10-phases](../prd/10-phases.md)). Everything else from this review is in [16-roadmap](../prd/16-roadmap.md). The "Decisions this needs" table at the end was answered by D-134–D-138, D-145–D-154. Where this document and the spec differ, the spec wins.

This compares Spine as built (Phases 0–7 merged into `main`) with Zoho Books (India edition) and TallyPrime (releases 6.x–7.0). It answers one question: **can Spine be positioned as a full-fledged accounting tool for small businesses, and what would it take?**

## How this was done

| Source | Method |
|---|---|
| Spine | The spec in `docs/` and the code in `apps/api` and `apps/web`, checked on 2026-10-05 |
| Zoho Books | The public [live demo](https://www.zoho.com/in/books/accounting-software-demo/), looked at without saving anything (Getting Started, Dashboard, Reports Center, a report's export and customise options, Configure Features, Recurring Bills, Vendor Credits, Documents, Settings › Taxes, PDF Templates and Email Notifications), plus Zoho's help pages |
| TallyPrime | Tally's help pages and release notes (no hands-on session) |

**Limits:** the demo account blocks the PDF template gallery and the Opening Balances settings page, so those points rest on Zoho's help pages.

## Verdict

**Not yet — but close, for Spine's own niche.**

Spine's operations flow (enquiry → quote → job → invoice → payment, with books derived from those events) is stronger than either competitor for project businesses. Progress claims, retention, variation orders and ledger-based job costing have no equivalent in Zoho or Tally.

An accountant could not close a financial year in Spine today, though. Six gaps block it:

1. **No opening balances.** A business can't move from Tally, Zoho or spreadsheets ([Q-03](../prd/13-risks-open-questions.md) is still open).
2. **No adjusting journals.** Goal G2 rules out hand-entered journal entries. That leaves no way to record depreciation, accruals, the owner putting money in or taking it out, loans, payroll from an outside provider, or year-end adjustments.
3. **Effectively one bank account.** Customer payments, vendor payments and expenses all post to 1010 Bank. The API accepts a different account, but no screen offers one. 1000 Cash in Hand is never used, and there are no transfers between accounts.
4. **No bank reconciliation** (a non-goal today).
5. **No vendor credits and no refunds.** Spine can't record a credit from a vendor or refund a customer's credit or overpayment. The only correction is voiding the document.
6. **No attachment on vendor bills,** which is the source document an auditor asks for first. Only expenses carry a receipt, and only one each.

Closing these six, plus the reports and export work below, makes "complete accounting for service and project businesses" a fair claim. Spine would still not be general small-business accounting: inventory, multi-currency, payroll and statutory filing stay out ([00-overview](../prd/00-overview.md) non-goals). The website and README should say so plainly.

## Findings by category

### Already supported

| Area | Spine | Compared with competitors |
|---|---|---|
| Quotes: versions, discount approval, public accept link, on-site signature | Built (signature in Phase 5) | Better than Zoho's estimates; Tally has nothing similar |
| Advance, progress and retention-release invoices; retention in 1150; variation orders; progress-claim numbers | Built | **Spine's biggest strength.** Zoho has retainer invoices only; Tally has neither |
| Job costing, budget, billed to date and margin, all read from `journal_lines` | Built | Zoho's projects are timesheet-based; Tally uses cost centres |
| Credit notes, void with a reason, issued documents that can't be edited, gapless numbers | Built | Stricter than Zoho, which allows editing issued documents; similar in spirit to Tally's Edit Log |
| Payments split across invoices, customer credit, receipts, customer statements | Built | On par |
| Vendor bills, vendor payments, expenses with approval, billable expenses, site labour | Built | On par; the approval flow is better than Tally's |
| AR and AP aging; Receivables and Payables pages | Built | On par |
| P&L, Balance Sheet, Trial Balance, Tax Summary, drill-down to source documents | Built | Core statements present |
| Period close and reopen | Built | Same as Zoho's Transaction Locking |
| Recurring invoices, automatic and bulk reminders, bulk PDFs | Built | On par |
| Organisation audit log and per-record history | Built | Same as Zoho's Activity Logs and Tally 6.1's Edit Log. Helps with India's rule that accounting software keep an audit trail |
| Owner, Staff and Field roles; Teams with a privilege matrix | Built | Finer-grained than Zoho |
| Daily check that the books balance | Built | Neither competitor shows this |
| Full data export, global search, organisation themes and branding | Built | On par |

### Partially supported

| Area | What's there | What's missing |
|---|---|---|
| Tax | Named rates, groups, compound rates, prices including or excluding tax, rate kept on each line | No tax type (CGST/SGST/IGST/cess); no place of supply or automatic intra/inter-state choice; no HSN/SAC codes; no exempt or zero-rated classification ([Q-09](../prd/13-risks-open-questions.md)); no reverse charge; Tax Summary breaks down collected tax only, not purchase tax |
| Report export | CSV for P&L, Balance Sheet, Trial Balance, job profitability, receivables and payables | No PDF, XLSX or print; Tax Summary has no export |
| PDF and email templates | One fixed layout with logo, brand colour, footer and payment instructions | No show/hide of fields, paper size, terms, document title options ("Tax Invoice") or signature. Email text is fixed in code. PDFs use built-in Helvetica ([D-123](../prd/12-decisions.md)), which **can't draw ₹** or non-Latin names |
| Onboarding | 8-step wizard and a 3-item dashboard checklist | No opening balances, bank accounts, branding or templates step; no setup page to come back to |
| Documents | Storage driver, job photos, one receipt per expense, issued PDFs kept | No attachments on bills, invoices, quotes, credit notes, payments or contacts; no inbox |
| Cash and bank | 1000 and 1010 in the chart; the API accepts a bank account | No account picker in the UI, no transfers, no credit-card accounts, no balance per account |
| Chart of accounts | Seeded chart; owners add accounts | No sub-accounts. Owner's Capital, Drawings, Loans Payable and Fixed Assets exist, but nothing can post to them |
| Imports | Contacts from CSV | No import for items, open invoices and bills, or the chart of accounts |
| Reports access | P&L, Balance Sheet, Trial Balance and Tax Summary are Owner-only | An outside accountant must be made an Owner to see them |

### Missing but important for V1

| # | Feature | Why | Effort |
|---|---|---|---|
| 1 | **Opening balances:** account balances at a cutover date, plus open customer invoices and vendor bills | Nobody can migrate without it. Zoho puts it on its Getting Started page | M |
| 2 | **Manual journals:** Owner-only, reason required, audited, and blocked from the AR, AP and tax control accounts | Depreciation, accruals, capital and drawings, loans, outside payroll. The normal workflow still never needs one, which keeps G2's intent | M |
| 3 | **Several bank, cash and card accounts:** choose the account on every payment and expense, transfer between accounts, show balance per account | Every competitor has it, and reconciliation depends on it | M |
| 4 | **Vendor credits** (apply to bills, refund) and **customer refunds** (from a credit note or an overpayment) | Lets mistakes be corrected without voiding | M |
| 5 | **Attachments:** several files on bills, invoices, quotes, credit notes, payments and contacts, served only after checking the owning record ([D-117](../prd/12-decisions.md)) | Source documents for the accountant and for audit | S–M |
| 6 | **Bank reconciliation:** match against an imported CSV statement (no live bank feeds) | An accountant's first question. Banking and reconciliation were the headline of TallyPrime 6.0 | M–L |
| 7 | **Core reports** (see [Reports](#4-reports)) | Seven reports aren't enough for an accounting product | M |
| 8 | **PDF, XLSX and print** on every report | Accountants work in Excel; owners print | S–M |
| 9 | **Tax model upgrade** (see [Tax configuration](#6-tax-configuration)) | Needed for India and anywhere taxes are split | M |
| 10 | **Unicode PDF font**, e.g. Noto Sans, bundled | ₹, Indian-language names, other scripts | S |
| 11 | **Recurring bills,** reusing the recurring-invoice engine | Rent, subscriptions and retainers are common | S |
| 12 | **Settings › Modules** (see [Feature enablement](#3-feature-enablement)) | Spine serves firms of 1 to 20 people with different needs | M |
| 13 | **Setup page** (see [Getting started](#2-getting-started-and-onboarding)) | A guided place to finish setup after the wizard | S |
| 14 | **Accountant access:** read-only access to every financial report and journal without being an Owner | Owners shouldn't have to hand over full control to their accountant | S |
| 15 | **Cash-basis P&L** ([Q-04](../prd/13-risks-open-questions.md)) | Zoho shows the toggle on its dashboard; many small firms think in cash | M |

### Missing; for later versions

- Recurring expenses and recurring journals.
- An "employee reimbursements payable" account and a reimburse action ([Q-05](../prd/13-risks-open-questions.md)).
- A documents inbox with email-in, turning an upload into a bill or expense. Text recognition (OCR) only as an optional add-on.
- Saved custom reports, scheduled report emails, reporting tags, custom fields.
- Budget vs actual (beyond job budgets), business ratios, statement of changes in equity, "time to get paid".
- A fixed asset register with automatic depreciation. Manual journals cover depreciation in V1.
- **Tally voucher export (XML or JSON)** so an accountant who uses Tally can import Spine's books. High value in India, where most accountants use Tally.
- A UPI QR code or payment link on the invoice PDF; payment gateways after that.
- India TDS/TCS; MSME supplier tagging with the 45-day payment watch (Zoho and TallyPrime 6.1 both have it).
- Purchase orders, which construction firms do use.
- A GSTR-1-ready data export. This is data only; Spine still doesn't file.
- Two-factor sign-in ([Q-08](../prd/13-risks-open-questions.md)).

### Out of scope for Spine's users

Inventory and stock valuation (FIFO, godowns, bills of materials) · payroll · multi-currency (state this as a known limit, because Indian studios that bill overseas clients will ask) · e-invoicing, e-way bills and filing GST returns · customer and vendor portals · sales orders, delivery challans and packing slips · price lists · salesperson commissions · custom modules or scripting · a workflow-rule engine · several companies or branches in one install · Tally's optional, memorandum and post-dated vouchers and scenarios · cost-centre hierarchies (jobs already do this) · live bank feeds.

## The ten areas in detail

### 1. Dashboard

**Zoho:** the demo dashboard shows Total Receivables and Total Payables (current vs overdue, with a quick "New" action), Cash Flow (opening cash + incoming − outgoing = closing, by month), Income and Expense with an Accrual/Cash toggle, Top Expenses as a pie chart, Projects (unbilled hours and expenses), Bank and Credit Cards balances, and an Account Watchlist. Getting Started, Announcements and Recent Updates are tabs beside it.

**Spine:** the action-first dashboard ([D-087](../prd/12-decisions.md)) already does more for an owner than Zoho's. It has a "Needs your attention" list with one-click actions, KPIs with trends, money in vs out, AR aging, job winners and losers, and retention held.

| V1 | Later | Skip |
|---|---|---|
| Payables card (current vs overdue) · top expenses by category · balance per bank, cash and card account (after V1 item 3) · "unbilled work" card (completed milestones not invoiced, approved billable expenses not billed) · tax payable this period | Account watchlist · cash forecast from due invoices and bills · cash/accrual toggle on charts | Announcements and Recent Updates tabs (Spine's update banner covers this) |

### 2. Getting started and onboarding

**Zoho:** Getting Started is a page of cards, each with "Configure" and "Watch & Learn": chart of accounts, opening balances, payment gateways, customer and vendor portals, payment reminders, roles and permissions, GST settings. Below them are advanced items: custom fields, approvals, tags, workflow rules, email alerts and template branding.

**Recommendation:** add a **Set up Spine** page that Owners can return to at any time. Keep the wizard as the fast path. The dashboard checklist then points to this page.

- **Cards:** business profile and logo · tax (country preset) · chart of accounts · opening balances · bank, cash and card accounts · payment instructions · branding and PDF options · document numbering · payment reminders · invite the team · email (SMTP) status · backups · field app.
- **Each card:** done or not done, a "Configure" button, and a link to its page in the user guide.

### 3. Feature enablement

**Zoho:** "Configure Features" switches modules on or off: Estimates, Retainer Invoices, Timesheet, Price List, Sales Orders, Delivery Challans, Purchase Orders, Inventory. The dialog says invoices, credit notes, expenses, bills and recurring invoices are always available. **TallyPrime** does the same through F11 company features (bill-wise details, cost centres, interest, GST, TDS and others).

**Recommendation:** an Owner-only **Settings › Modules** page.

| Optional | Always on |
|---|---|
| Leads and pipeline · Meetings · Jobs and milestones · Retention · Variation orders · Expense approval · Recurring invoices and bills · Discount approval · Field app | Contacts · Catalogue · Invoices and credit notes · Payments · Vendor bills and payments · Chart of accounts · Reports |

- **When a module is off:** it leaves the menu, dashboard widgets, search, notifications and the Teams privilege matrix, and its API routes refuse with a clear error code.
- **Data is never deleted.** Turning a module back on brings everything back.
- **Industry templates set the defaults:** Construction turns on retention and variation orders; a design studio leaves them off.
- **Keep this separate from `feature-flags.ts`.** Those flags hide controls until a later phase ships, and they're the same for every install. Modules are per-business settings that change at runtime. The capability list must still come from one source ([07-security](../prd/07-security.md)).

### 4. Reports

**Zoho:** the demo's Reports Center has about 60 reports in 13 categories: Business Overview, Sales, Inventory, Receivables, Payments Received, Recurring Invoices, Payables, Purchases and Expenses, Taxes, Projects and Timesheet, Accountant, Currency and Activity. The Accountant category holds Account Transactions, Account Type Summary, General Ledger, Detailed General Ledger, Journal Report and Trial Balance. Each report can be customised: date range, cash or accrual basis, filter accounts, compare with previous periods or years, advanced filters (reporting tags, branches, projects) and show/hide columns.

**TallyPrime** adds Day Book, Cash and Bank Books, Funds Flow, Ratio Analysis, bill-wise Outstandings, interest calculations, cost-centre reports, exception reports and the Edit Log.

**Spine has seven:** P&L, Balance Sheet, Trial Balance, Tax Summary, job profitability, receivables and payables. That isn't enough for an accounting product.

| Group | V1 | Later |
|---|---|---|
| Statements | P&L with comparison columns (previous period, previous year, monthly) · Balance Sheet · Trial Balance · Cash Flow statement | Ratios · statement of changes in equity · budget vs actual |
| Ledger | General Ledger / Account Transactions (the drill-down as a full page) · Journal report / Day Book | Exception report |
| Receivables | Customer balances · AR aging summary and detail · payments received · credit note details | Time to get paid · refund history |
| Payables | Vendor balances · AP aging · payments made · vendor credit details | — |
| Sales and spending | Sales by customer · sales by item · expenses by category · purchases by vendor | Sales by person |
| Tax | Tax Summary covering collected **and** paid, by rate and by tax type | HSN summary · GSTR-1-ready export |
| Jobs | Job profitability (built) | — |
| Tools | Same toolbar on every report: date range, compare, basis, export, print | Saved custom reports · scheduled emails |

Everything still reads `journal_lines` ([06](../prd/06-ledger-posting-rules.md) invariant 7), so most of this is query and screen work, not new postings.

### 5. Report export

| Format | Zoho Books | TallyPrime | Spine today | Recommendation |
|---|---|---|---|---|
| CSV | On detail reports | Comma-separated text | Some reports | **V1:** every report |
| XLSX | Yes (and XLS) | Excel | No | **V1:** real numeric cells, one sheet per report. The library choice needs a decision entry |
| PDF | Yes | Yes, with digital signature | No | **V1:** react-pdf (already in the stack), always light, business name and range in the header |
| Print | Print and print preferences | Yes | No | **V1:** print stylesheet |
| Other | Zoho Sheet; scheduled reports | JPEG, HTML, XML, JSON; WhatsApp sharing | — | **Later:** scheduled email; Tally XML. **Skip:** XLS, JPEG, HTML |

### 6. Tax configuration

**Zoho (India):**
- Each rate has a **tax type** (CGST, SGST, IGST). Groups come ready-made, e.g. GST18 = CGST9 + SGST9.
- **Default Tax Preference** sets separate intra-state and inter-state defaults, so the right tax is chosen from where the supply goes.
- **GST Settings:** GSTIN with a taxpayer-details lookup, legal and trade name, registration date, composition scheme, and tracking of digital services sold overseas.
- Tax exemptions with reasons, HSN/SAC codes on items, and scheduled bulk rate changes by HSN code for the September 2025 GST rate changes.

**Spine:** the rate-and-group model can already *represent* GST. What's missing is classification and automatic selection.

**V1:**
- A **tax type** on each rate, so reports split CGST, SGST, IGST and cess.
- The **business's state and each contact's state**, with automatic intra/inter-state selection from the item's GST rate.
- **HSN/SAC** on catalogue items and document lines, printed on the PDF.
- A **classification:** taxable, zero-rated, exempt, non-taxable. This closes Q-09.
- **Tax IDs on the PDF** (`contacts.tax_id` exists) and a **document title** choice ("Tax Invoice", "Bill of Supply").
- **Purchase-side tax by rate** in Tax Summary.

**Other countries:** use **country tax presets** chosen during onboarding and seeded as data only: India GST, Australia and New Zealand GST, UK VAT, UAE VAT, US sales tax entered by hand. No per-country code. This is the "country packs" extension point already named in [R-06](../prd/13-risks-open-questions.md).

**Later:** reverse charge, composition scheme, TDS/TCS, cess, scheduled rate changes by HSN code.

### 7. PDF and email templates

**Zoho:**
- **PDF templates:** a gallery for about 17 document types. The editor covers paper size, orientation, margins, fonts, header and footer images, column labels and widths, amount in words, tax summary table, bank details, QR code, signature and terms. HTML templates are an option.
- **Email templates:** several named templates per type (invoice, credit note, payment thank-you, statement and others), each with subject, body and placeholders, plus sender preferences.

**TallyPrime:** seven invoice templates (including multi-logo and multi-location), watermarks, custom fields and header/footer images. Documents can be sent over WhatsApp as PDF, JPEG or Excel.

**V1 should offer options, not an editor:**
- A4 or Letter.
- Show or hide columns: quantity and unit, discount, HSN/SAC, tax breakdown.
- Default terms and notes per document type.
- Document title.
- Signature image.
- Amount in words.
- Tax summary table.
- The Unicode font.

**Emails:** an editable subject and body per document type, with placeholders and "Reset to default", inside the existing branded layout ([D-067](../prd/12-decisions.md)).

**Later:** two or three layouts per document type. **Avoid:** an HTML template editor. It is a support burden and can't keep the guarantee that an issued PDF never changes ([D-083](../prd/12-decisions.md)).

### 8. Document management

**Zoho Documents:**
- All Documents, inboxes (including one for bank statements), folders and trash.
- Upload, or forward by email.
- Automatic scanning that pulls out vendor, amount, date and reference number, with a status per file: Processed, Scan in progress or Unreadable.

**TallyPrime** has little built in.

**Spine:** the storage driver, checksums and upload checks ([D-104](../prd/12-decisions.md)) are a sound base. Only job photos, expense receipts, logos, avatars and issued PDFs use them.

- **V1:** attachments on every financial record (V1 item 5).
- **Later:** an inbox where people upload or forward bills and receipts, then turn one into a bill or expense.
- **OCR only as an optional add-on.** A built-in OCR engine would break the rule that Spine boots with three environment variables ([D-015](../prd/12-decisions.md)).

### 9. Recurring bills and vendor credits

**Zoho:**
- **Recurring Bills:** vendor, profile name, frequency, last and next bill date, and a status of Active, Stopped or Expired.
- **Vendor Credits:** Draft, Open and Void, with Apply to Bills, Refund, Void, Clone and View Journal.

**TallyPrime** records purchase returns as Debit Note vouchers, once "Use debit and credit notes" is turned on in F11.

**Recommendations:**
- **Vendor credits — V1.** They're about correct books. They need new posting rules in [06](../prd/06-ledger-posting-rules.md):

  | Event | Debit | Credit |
  |---|---|---|
  | Vendor credit recorded | AP | Expense per line, input tax |
  | Credit applied to a bill | — (moves the open amount between documents) | — |
  | Vendor refund received | Bank | AP |

- **Customer refunds — V1.** Refunding a credit note or an overpayment posts Dr Customer Advances or AR / Cr Bank.
- **Recurring bills — V1, small.** They run on the same scheduler and rules as recurring invoices ([D-092](../prd/12-decisions.md)); a bill posts P11 when recorded.
- **Recurring expenses — later.**

### 10. Other things worth knowing

- **Out-of-date spec:** [00-overview](../prd/00-overview.md) still lists recurring invoices as a non-goal, but US-INV-20–22 have shipped.
- **Year-end:** with no closing entry ([D-030](../prd/12-decisions.md)), check that retained earnings carry forward correctly across several financial years before 1.0.
- **Accountant review:** no practising accountant has reviewed the posting rules yet ([Q-02](../prd/13-risks-open-questions.md), [R-01](../prd/13-risks-open-questions.md)). That is the biggest risk to an accounting positioning.

## Recommendations

### V1 priorities

| Order | Work | Gap closed |
|---|---|---|
| 1 | Opening balances, plus CSV import of items and open invoices and bills | Migration |
| 2 | Several bank, cash and card accounts; transfers | Cash and bank |
| 3 | Manual journals (Owner-only, restricted) | Adjustments |
| 4 | Vendor credits and customer refunds | Corrections |
| 5 | Attachments on financial records | Source documents |
| 6 | V1 reports and PDF, XLSX and print export | Reporting |
| 7 | Tax upgrade and Unicode PDF font | Tax, India |
| 8 | Bank reconciliation from a CSV statement | Reconciliation |
| 9 | Set up Spine page and Settings › Modules | Onboarding, fit |
| 10 | Recurring bills, accountant access, cash-basis P&L | Completeness |

Items 1–6 are what make Spine credible as accounting. Build them as a **"Books completeness" phase before Phase 8 (packaging and 1.0)**: migration and reconciliation shape the install guide and user guide that Phase 8 writes.

### Worth taking from Zoho Books

- The Getting Started card page.
- Configure Features.
- The Reports Center layout, with favourites.
- The compare, basis and columns options on reports.
- The dashboard's cash-flow and top-expenses cards.
- The vendor credit actions.
- Intra-state and inter-state tax defaults.
- Email templates per document type.

### Worth taking from TallyPrime

- The Day Book.
- Bill-wise outstandings.
- The Edit Log mindset (Spine already has it).
- Reconciliation against a bank statement.
- F11's idea of switching on only what you use.
- Sending documents as PDF or Excel through the channels customers use.
- MSME 45-day payment tracking.
- A data format accountants can import.

### Don't copy

- **Zoho's sprawl:** overlapping sales documents (estimates, sales orders, delivery challans, retainer invoices), custom functions and modules, HTML templates, the workflow-rule engine, about 60 reports at launch.
- **Tally's voucher-type, keyboard-first model:** optional, memorandum and post-dated vouchers, scenarios and cost-centre trees.
- **OCR and live bank feeds in the core product.**

### UX and workflow

- Keep "accounting is an output" for the everyday flow. Manual journals, opening balances and reconciliation sit in an **Accountant** area that Staff never need.
- Every report gets the same toolbar: date range, compare, basis, export, print.
- The account picker on payments and expenses defaults to the last account used.
- Tax is picked automatically from the item and the customer's state; the person can still override it.

### What it takes to compete

1. Close V1 items 1–8.
2. Get a practising accountant to sign off [06-ledger-posting-rules](../prd/06-ledger-posting-rules.md) (Q-02).
3. Offer migration from Tally and Zoho: opening balances plus CSV imports.
4. Position Spine honestly: *self-hosted operations and accounting for service and project firms — not for inventory, payroll or multi-currency.*

On that ground, progress billing, retention, ledger-based job costing and the offline field app are things neither Zoho Books nor TallyPrime offers.

## Decisions this needs

Nothing above should be built until these are settled and recorded in [12-decisions](../prd/12-decisions.md):

| Topic | Conflicts with | Question |
|---|---|---|
| Manual journals | Goal G2 ("No screen in v1 creates a journal entry by hand") | Allow Owner-only adjusting journals, kept away from control accounts? |
| Opening balances | [Q-03](../prd/13-risks-open-questions.md) (open) | Balances only, or balances plus open invoices and bills? |
| Bank reconciliation | Non-goal "Bank feeds or statement import; bank reconciliation" | Allow CSV statement import and reconciliation, keeping live feeds out? |
| Accountant access | [07-security](../prd/07-security.md): P&L, Balance Sheet, Trial Balance and Tax Summary are Owner-only | Add a read-only financial-reports capability for a Team? |
| Cash-basis P&L | [Q-04](../prd/13-risks-open-questions.md) (open) | Add it in V1? |
| Tax classification | [Q-09](../prd/13-risks-open-questions.md) (open) | Add taxable / zero-rated / exempt / non-taxable? |
| GSTR-ready export, Tally export | Non-goal "Country-specific statutory filing" | Is a data export (no filing) inside the line? |
| Vendor credits, refunds, transfers | [06-ledger-posting-rules](../prd/06-ledger-posting-rules.md) | New posting rules, each needing a ledger-integrity test |
| Modules | [D-068](../prd/12-decisions.md) (phase flags) | Runtime per-business module switches, separate from build flags? |
| Recurring invoices in non-goals | [00-overview](../prd/00-overview.md) | Remove from the non-goals list now that it has shipped |

## Sources

- [Zoho Books live demo (India)](https://www.zoho.com/in/books/accounting-software-demo/)
- [Zoho Books help: dashboard](https://www.zoho.com/in/books/help/dashboard/)
- [Zoho Books help: reports](https://www.zoho.com/in/books/help/reports/)
- [Zoho Books help: PDF templates](https://www.zoho.com/in/books/help/settings/templates.html)
- [Zoho Books help: taxes](https://www.zoho.com/in/books/help/settings/taxes.html)
- [Zoho Books help: preferences](https://www.zoho.com/in/books/help/settings/preferences.html)
- [Zoho Books knowledge base: reports](https://www.zoho.com/books/kb/reports/)
- [TallyPrime 6.0 launch: connected banking](https://www.mediainfoline.com/brand/tally-solutions-launches-tallyprime-6-0-revolutionizing-financial-operations-for-smes-with-connected-banking)
- [TallyPrime 6.1 product update](https://tallysolutions.com/darpan/product-update-tallyprime-6-1-your-business-now-smarter-than-ever)
- [TallyPrime 7.0 product update](https://tallysolutions.com/darpan/product-update-tallyprime-7-0/)
- [TallyPrime help: accounting and financial reports](https://help.tallysolutions.com/accounting-financial-reports-tally/)
- [TallyPrime help: export data](https://help.tallysolutions.com/tally-prime/data-management/export-data-in-tally/)
- [TallyPrime help: purchase returns](https://help.tallysolutions.com/tally-prime/purchase-process/purchase-returns-tally/)
- [TallyPrime invoice templates](https://tallysolutions.com/tally/custom-invoice-templates-in-tally-prime/)
- [TallyPrime with WhatsApp](https://help.tallysolutions.com/?p=169230)
