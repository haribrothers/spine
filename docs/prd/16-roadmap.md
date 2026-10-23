# 16 · Roadmap after 1.0

What Spine plans to build after 1.0 (Phases 0–10), in order of intent, and what stays out. Nothing here is a story yet: when an item is picked up, it gets a decision in [12-decisions](12-decisions.md), stories in the right feature file and a phase in [10-phases](10-phases.md). Don't build any of it early — "Don't build beyond the story" still applies ([CLAUDE.md](../../CLAUDE.md)).

Sources: the Zoho Books and TallyPrime comparison ([research](../research/competitor-analysis-zoho-books-tallyprime.md)), the V1 scope decision ([D-133](12-decisions.md)) and items the spec had already deferred.

## v1.1 — next after 1.0

Small, accounting-first gaps that 1.0 users and their accountants will ask for first.

| Area | Item | What it is | Why it waits | Source |
|---|---|---|---|---|
| Accounting | Employee reimbursements | Expenses paid personally credit an "Employee reimbursements payable" account; a "Reimburse" action pays the employee back from a money account | Needs an accountant's view on the account and flow | [Q-05](13-risks-open-questions.md) |
| Accounting | Recurring expenses | Scheduled expenses (e.g. a monthly phone bill paid by card), on the recurring-bills engine | Recurring bills cover most cases in 1.0 | Research |
| Accounting | Recurring journals | Scheduled adjusting journals (monthly depreciation, prepaid rent release) | Manual journals arrive in 1.0; schedules after they're proven | Research |
| Accounting | Year-end closing entry | Post the closing entry that moves the year's profit into Retained Earnings instead of computing it on the Balance Sheet | The computed line works in 1.0 | [D-030](12-decisions.md) |
| Accounting | Un-allocate a payment | Move a payment's allocation off an invoice without deleting the payment | Credit notes cover corrections in 1.0 | [D-074](12-decisions.md) |
| Banking | OFX and QIF statement import | Statement formats beyond CSV | CSV covers Indian banks; OFX/QIF matter more abroad | [D-157](12-decisions.md) |
| Banking | Bank rules | "When a statement line's description contains X, suggest category Y" while reconciling | Matching and create-from-line come first | Research (Zoho transaction rules) |
| Tax, India | Reverse charge | Bills and expenses under reverse charge: self-assessed output tax with matching input credit; GSTR-1 flag | Needs posting rules and an accountant's review | Research |
| Tax, India | Composition scheme | Bill of supply only, no tax collected, composition tax on turnover | Few target users are on it | Research |
| Tax, India | TDS and TCS | Tax deducted at source on vendor payments and collected on receipts; certificates and reports | Separate law and returns | Research |
| Tax, India | MSME vendors and the 45-day rule | Tag MSME vendors (Udyam number) and watch bills unpaid near 45 days (Income Tax s.43B(h)) | Nice-to-have once vendor data is clean | Research (Zoho, TallyPrime 6.1) |
| Tax, India | Scheduled rate changes by HSN | Change the GST rate of every item with an HSN code from a date, previewing affected items and recurring documents | Rates change rarely; 1.0 edits rates by hand | Research (Zoho GST rate update) |
| Tax, India | Cess on items | Compensation cess amounts on items that carry it | Rare for service businesses | US-TAX-10 (cess type exists) |
| Tax, India | GSTR-3B worksheet | A summary laid out like GSTR-3B, from the Tax Summary | GSTR-1 first; 3B is mostly totals | Research |
| Tax, India | Units of measure | A unit (GST UQC: NOS, KGS, MTR, SQM…) on catalogue items and document lines, printed on documents and used in GSTR-1's HSN summary instead of `OTH` | The portal accepts `OTH`; units touch every line editor | [D-184](12-decisions.md) |
| Tax, India | Shipping bill details | Shipping bill number, date and port code on export invoices, written into GSTR-1's exports table | They can be added on the portal once customs issues them | [D-184](12-decisions.md) |
| Tax, India | Advances in GSTR-1 | Tax on advances received and adjusted (Tables 11A and 11B), from deposits received before the invoice | Deposits carry no tax in 1.0 ([D-075](12-decisions.md)); needs an accountant's review | [D-184](12-decisions.md) |
| Tax, India | GSTR-1 amendments | Amended tables (B2BA, CDNRA…) for changes to documents from earlier returns | Spine never edits issued documents; corrections go through credit notes, which 1.0 reports | [D-184](12-decisions.md) |
| Exports | Tally JSON | TallyPrime 7.0's JSON data exchange as an alternative to Tally XML | XML works with every Tally version | [D-149](12-decisions.md) |
| Documents | More Indian scripts on PDFs | Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi and Odia fonts | Devanagari and Latin ship in 1.0 | [D-151](12-decisions.md) |
| Documents | Documents inbox | Upload or forward bills and receipts by email into an inbox, then turn one into a bill or expense | Attachments on records come first | Research (Zoho Documents) |
| Reports | Scheduled report emails | Email a chosen report as PDF or Excel on a schedule | Export arrives in 1.0 | Research |
| Platform | Two-factor sign-in | TOTP for Owners, then everyone | Not in 1.0 | [Q-08](13-risks-open-questions.md), [07-security](07-security.md) |
| Notifications | Notification email preferences | Let each member choose which notification emails they get | Footer explains why they get them in 1.0 | US-NTF-11 |
| Notifications | Discount approval notification | Notify Owners when a quote needs discount approval, besides the banner | The banner is the signal in 1.0 | US-QUO-12 |

## v1.1 — AI features

V1 ships the AI foundation and four form-filling features (D-162–D-173). These build on it in v1.1, under the same rules: off unless the Owner switches them on, the Owner's own provider, redaction, permission-scoped, people confirm.

| Item | What it is | Why it waits | Source |
|---|---|---|---|
| Ask your books | Plain-English questions ("Which jobs lost money this quarter?") answered by calling the report services, quoting their figures and linking to them | Needs the V1 safeguards proven first; figures must come from reports, never the model | D-162 |
| Natural-language search | "Unpaid invoices for Maple Ridge over 30 days" turned into a search with filters | Global search (US-OPS-22) covers names and numbers in 1.0 | D-162 |
| Contact and job summaries | A short summary of a contact's timeline or a job's state, risks and next steps | Nice-to-have once people trust AI suggestions | D-162 |
| HSN/SAC suggestions | Suggest HSN or SAC codes for catalogue items from their names | Needs care: a wrong code changes GST reporting | US-TAX-14 |
| Voice and site notes | Turn a field voice memo or note into a milestone note or variation-order description on the phone | Mobile AI starts with receipts in 1.0 | US-AI-10 |
| Onboarding helper | "I'm a kitchen fit-out firm in Bengaluru" proposes template, tax preset, accounts and modules | Setup page arrives in 1.0 | US-ONB-15 |
| Collections assistant | Flag customers likely to pay late and suggest who to chase first | Needs payment history across a few months | D-162 |
| AI-created drafts | AI may create draft bills, expenses or quotes that wait in lists for review (e.g. from the documents inbox), still never issued, recorded, sent or posted by AI | V1 only fills forms a person has open (D-166) | D-166 |
| Read the documents inbox | Read bills and receipts arriving in the documents inbox and prepare drafts | Needs the inbox (v1.1) and AI-created drafts | 16-roadmap (Documents inbox) |
| Expense review help | Suggest category and flag unusual amounts when approving expenses | Approval flow first | US-PUR-08 |
| Learned bank rules | Turn accepted AI bank suggestions into rules ("Bank rules" above) | Bank rules arrive in v1.1 | D-173 |
| More languages | AI replies in Hindi and other languages, following the person's language | English only in 1.0 (D-168); i18n extraction in Phase 12 | D-168 |
| More email drafts | AI drafts for lead and activity follow-ups and meeting invitations | Customer document emails first | US-AI-11 |
| Per-Team budgets and troubleshooting retention | Budgets per Team; an Owner option to keep AI request text for 30 days for troubleshooting | V1 keeps one organisation budget and stores no text (D-168, D-169) | D-168, D-169 |

## Later — v1.2 and beyond

Valuable, but bigger, or wanted by fewer of Spine's users.

| Area | Item | What it is | Why it waits | Source |
|---|---|---|---|---|
| Accounting | Fixed asset register | Assets with cost, life and method; monthly depreciation posted automatically; disposal | Manual journals cover depreciation in 1.0 | Research |
| Accounting | Budgets vs actuals | Yearly budget per account with monthly variance, beyond job budgets | Job budgets cover the construction need | Research |
| Reports | Saved custom reports | Save a report with its filters, columns and comparison under a name | Fixed reports first | Research |
| Reports | Reporting tags | Tag lines with a dimension (e.g. branch, project type) and filter reports by it | Jobs already act as a tag | Research |
| Reports | Business ratios | Current ratio, gross and net margin, debtor and creditor days | Statements first | Research (Zoho, TallyPrime) |
| Reports | Statement of changes in equity | Opening equity, profit, capital in, drawings, closing equity | Balance Sheet covers it in 1.0 | Research (Zoho "Movement of Equity") |
| Reports | Time to get paid | How long each customer takes to pay | Aging covers it in 1.0 | Research |
| Reports | Exception report | Unusual entries: negative balances, back-dated documents, large journals | Integrity check and audit log first | Research (TallyPrime) |
| Reports | Sales by salesperson | Sales by the member who owns the quote or invoice | Few target firms pay commission | Research |
| Dashboard | Account watchlist | Pin chosen accounts' balances to the dashboard | Account balances card covers money accounts | Research (Zoho) |
| Dashboard | Cash forecast | Expected cash from due invoices, bills and recurring documents over the next weeks | Needs a few months of real data to be trusted | Research |
| Documents | More PDF layouts | Two or three layouts per document type (e.g. Compact, Spreadsheet) | Options on one layout in 1.0 | [D-152](12-decisions.md) |
| Documents | Several email templates per type | Named templates per email type, picked when sending | One editable template per type in 1.0 | [D-153](12-decisions.md) |
| Documents | Text recognition (OCR) | Read vendor, date and amount from an uploaded bill, as an optional add-on service | Heavy to self-host; must stay optional ([D-015](12-decisions.md)) | Research (Zoho autoscan) |
| Data | Custom fields | Extra fields on contacts, items and documents, optionally printed on PDFs | Adds complexity everywhere | Research |
| Payments | Payment gateway links | Razorpay, Cashfree or Stripe payment links on invoices with automatic payment recording | Needs keys and an outside service; UPI QR covers India in 1.0 | [D-150](12-decisions.md) |
| Purchases | Purchase orders | Orders to vendors that convert into bills | Construction firms use them; not core to the books | [00-overview](00-overview.md), research |
| Tax | More country presets | US state sales tax, Canada GST/HST, Singapore GST, Malaysia SST, South Africa VAT, EU VAT | Six presets in 1.0; add on demand | [D-145](12-decisions.md) |
| Platform | More languages | Translations beyond English, starting with Hindi | English only in 1.0; strings are extracted in Phase 12 | US-OPS-16 |
| Platform | External calendar sync | Google and Outlook calendar sync for meetings | Needs OAuth and outside services | [D-028](12-decisions.md) |
| Mobile | Native push notifications | Push to the field app | Email and next sync in 1.0 | [15-mobile-release](15-mobile-release.md) |
| Mobile | Universal links and app links | Open links straight in the field app | Each install has its own domain | [15-mobile-release](15-mobile-release.md) |

## v2 — deferred by decision

| Item | What it is | Source |
|---|---|---|
| Several businesses per owner account | One sign-in managing several separate organisations or instances | [D-001](12-decisions.md), [07-security](07-security.md) |
| Cross-owner content ownership | One Owner restricting another Owner's access to records they created | [00-overview](00-overview.md), [07-security](07-security.md) |

## Not planned

These stay out of Spine; see [00-overview](00-overview.md) for the full non-goals:

- Multi-tenant SaaS hosting.
- Payroll, HR and attendance.
- Inventory with stock valuation, warehouses or manufacturing.
- Marketing automation, email campaigns and lead scoring.
- Filing returns or connecting to tax portals; e-invoicing and e-way bills.
- Customer or vendor self-service portals with accounts.
- Multi-currency.
- Live bank feeds (statement import and reconciliation are in 1.0, [D-135](12-decisions.md)).
- A native desktop app.
- Timesheets, a plugin API and a public REST API for third parties. (AI agents reach Spine through its MCP server, as the person who connected them — [D-256](12-decisions.md).)
- Offline creation of quotes or invoices on mobile.
- From the competitor review, not copied: sales orders, delivery challans and packing slips; price lists; salesperson commissions; custom modules or scripting; a workflow-rule engine; several branches or companies in one install; Tally-style optional, memorandum and post-dated vouchers and scenarios; cost-centre hierarchies (jobs do this); an HTML template editor; a built-in OCR engine.
