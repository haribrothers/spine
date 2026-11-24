# Roadmap

What Spine plans to build after 1.0, in order of intent, and what stays out. Nothing here is promised for a date. If you'd like something sooner, or think something belongs here, [open a feature request](https://github.com/haribrothers/spine/issues/new/choose).

## v1.1 — next after 1.0

Small, accounting-first gaps that 1.0 users and their accountants will ask for first.

| Area | Item | What it is | Why it waits |
|---|---|---|---|
| Field app | Expo SDK 58 | Move the field app to SDK 58: the iOS scene lifecycle in Expo's template instead of the current switch, and the iOS 27 Search tab fix | 1.0 ships on SDK 57 with the scene switch; the upgrade is large (Jest 30, expo-router 58, React Native 0.88) |
| Accounting | Employee reimbursements | Expenses paid personally credit an "Employee reimbursements payable" account; a "Reimburse" action pays the employee back from a money account | Needs an accountant's view on the account and flow |
| Accounting | Recurring expenses | Scheduled expenses (e.g. a monthly phone bill paid by card), on the recurring-bills engine | Recurring bills cover most cases in 1.0 |
| Accounting | Recurring journals | Scheduled adjusting journals (monthly depreciation, prepaid rent release) | Manual journals arrive in 1.0; schedules after they're proven |
| Accounting | Year-end closing entry | Post the closing entry that moves the year's profit into Retained Earnings instead of computing it on the Balance Sheet | The computed line works in 1.0 |
| Accounting | Un-allocate a payment | Move a payment's allocation off an invoice without deleting the payment | Credit notes cover corrections in 1.0 |
| Banking | OFX and QIF statement import | Statement formats beyond CSV | CSV covers Indian banks; OFX/QIF matter more abroad |
| Banking | Bank rules | "When a statement line's description contains X, suggest category Y" while reconciling | Matching and create-from-line come first |
| Tax, India | Reverse charge | Bills and expenses under reverse charge: self-assessed output tax with matching input credit; GSTR-1 flag | Needs posting rules and an accountant's review |
| Tax, India | Composition scheme | Bill of supply only, no tax collected, composition tax on turnover | Few target users are on it |
| Tax, India | TDS and TCS | Tax deducted at source on vendor payments and collected on receipts; certificates and reports | Separate law and returns |
| Tax, India | MSME vendors and the 45-day rule | Tag MSME vendors (Udyam number) and watch bills unpaid near 45 days (Income Tax s.43B(h)) | Nice-to-have once vendor data is clean |
| Tax, India | Scheduled rate changes by HSN | Change the GST rate of every item with an HSN code from a date, previewing affected items and recurring documents | Rates change rarely; 1.0 edits rates by hand |
| Tax, India | Cess on items | Compensation cess amounts on items that carry it | Rare for service businesses |
| Tax, India | GSTR-3B worksheet | A summary laid out like GSTR-3B, from the Tax Summary | GSTR-1 first; 3B is mostly totals |
| Tax, India | Units of measure | A unit (GST UQC: NOS, KGS, MTR, SQM…) on catalogue items and document lines, printed on documents and used in GSTR-1's HSN summary instead of `OTH` | The portal accepts `OTH`; units touch every line editor |
| Tax, India | Shipping bill details | Shipping bill number, date and port code on export invoices, written into GSTR-1's exports table | They can be added on the portal once customs issues them |
| Tax, India | Advances in GSTR-1 | Tax on advances received and adjusted (Tables 11A and 11B), from deposits received before the invoice | Deposits carry no tax in 1.0; needs an accountant's review |
| Tax, India | GSTR-1 amendments | Amended tables (B2BA, CDNRA…) for changes to documents from earlier returns | Spine never edits issued documents; corrections go through credit notes, which 1.0 reports |
| Exports | Tally JSON | TallyPrime 7.0's JSON data exchange as an alternative to Tally XML | XML works with every Tally version |
| Documents | More Indian scripts on PDFs | Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi and Odia fonts | Devanagari and Latin ship in 1.0 |
| Documents | Documents inbox | Upload or forward bills and receipts by email into an inbox, then turn one into a bill or expense | Attachments on records come first |
| Reports | Scheduled report emails | Email a chosen report as PDF or Excel on a schedule | Export arrives in 1.0 |
| Platform | Two-factor sign-in | TOTP for Owners, then everyone | Not in 1.0 |
| Notifications | Notification email preferences | Let each member choose which notification emails they get | Footer explains why they get them in 1.0 |
| Notifications | Discount approval notification | Notify Owners when a quote needs discount approval, besides the banner | The banner is the signal in 1.0 |

## v1.1 — AI features

1.0 ships the AI foundation and four form-filling features. These build on it in v1.1, under the same rules: off unless the Owner switches them on, the Owner's own provider, redaction, permission-scoped, people confirm.

| Item | What it is | Why it waits |
|---|---|---|
| Ask your books | Plain-English questions ("Which jobs lost money this quarter?") answered by calling the report services, quoting their figures and linking to them | Needs the 1.0 safeguards proven first; figures must come from reports, never the model |
| Natural-language search | "Unpaid invoices for Maple Ridge over 30 days" turned into a search with filters | Global search covers names and numbers in 1.0 |
| Contact and job summaries | A short summary of a contact's timeline or a job's state, risks and next steps | Nice-to-have once people trust AI suggestions |
| HSN/SAC suggestions | Suggest HSN or SAC codes for catalogue items from their names | Needs care: a wrong code changes GST reporting |
| Voice and site notes | Turn a field voice memo or note into a milestone note or variation-order description on the phone | Mobile AI starts with receipts in 1.0 |
| Onboarding helper | "I'm a kitchen fit-out firm in Bengaluru" proposes template, tax preset, accounts and modules | Setup page arrives in 1.0 |
| Collections assistant | Flag customers likely to pay late and suggest who to chase first | Needs payment history across a few months |
| AI-created drafts | AI may create draft bills, expenses or quotes that wait in lists for review (e.g. from the documents inbox), still never issued, recorded, sent or posted by AI | 1.0 only fills forms a person has open |
| Read the documents inbox | Read bills and receipts arriving in the documents inbox and prepare drafts | Needs the inbox (v1.1) and AI-created drafts |
| Expense review help | Suggest category and flag unusual amounts when approving expenses | Approval flow first |
| Learned bank rules | Turn accepted AI bank suggestions into rules ("Bank rules" above) | Bank rules arrive in v1.1 |
| More languages | AI replies in Hindi and other languages, following the person's language | English only in 1.0 |
| More email drafts | AI drafts for lead and activity follow-ups and meeting invitations | Customer document emails first |
| Per-Team budgets and troubleshooting retention | Budgets per Team; an Owner option to keep AI request text for 30 days for troubleshooting | 1.0 keeps one organisation budget and stores no text |

## Later — v1.2 and beyond

Valuable, but bigger, or wanted by fewer of Spine's users.

| Area | Item | What it is | Why it waits |
|---|---|---|---|
| Accounting | Fixed asset register | Assets with cost, life and method; monthly depreciation posted automatically; disposal | Manual journals cover depreciation in 1.0 |
| Accounting | Budgets vs actuals | Yearly budget per account with monthly variance, beyond job budgets | Job budgets cover the construction need |
| Reports | Saved custom reports | Save a report with its filters, columns and comparison under a name | Fixed reports first |
| Reports | Reporting tags | Tag lines with a dimension (e.g. branch, project type) and filter reports by it | Jobs already act as a tag |
| Reports | Business ratios | Current ratio, gross and net margin, debtor and creditor days | Statements first |
| Reports | Statement of changes in equity | Opening equity, profit, capital in, drawings, closing equity | Balance Sheet covers it in 1.0 |
| Reports | Time to get paid | How long each customer takes to pay | Aging covers it in 1.0 |
| Reports | Exception report | Unusual entries: negative balances, back-dated documents, large journals | Integrity check and audit log first |
| Reports | Sales by salesperson | Sales by the member who owns the quote or invoice | Few target firms pay commission |
| Dashboard | Account watchlist | Pin chosen accounts' balances to the dashboard | Account balances card covers money accounts |
| Dashboard | Cash forecast | Expected cash from due invoices, bills and recurring documents over the next weeks | Needs a few months of real data to be trusted |
| Documents | More PDF layouts | Two or three layouts per document type (e.g. Compact, Spreadsheet) | Options on one layout in 1.0 |
| Documents | Several email templates per type | Named templates per email type, picked when sending | One editable template per type in 1.0 |
| Documents | Text recognition (OCR) | Read vendor, date and amount from an uploaded bill, as an optional add-on service | Heavy to self-host; must stay optional |
| Data | Custom fields | Extra fields on contacts, items and documents, optionally printed on PDFs | Adds complexity everywhere |
| Payments | Payment gateway links | Razorpay, Cashfree or Stripe payment links on invoices with automatic payment recording | Needs keys and an outside service; UPI QR covers India in 1.0 |
| Purchases | Purchase orders | Orders to vendors that convert into bills | Construction firms use them; not core to the books |
| Tax | More country presets | US state sales tax, Canada GST/HST, Singapore GST, Malaysia SST, South Africa VAT, EU VAT | Six presets in 1.0; add on demand |
| Platform | More languages | Translations beyond English, starting with Hindi | English only in 1.0; the app's text is ready for translation |
| Platform | External calendar sync | Google and Outlook calendar sync for meetings | Needs OAuth and outside services |
| Mobile | Native push notifications | Push to the field app | Email and next sync in 1.0 |
| Mobile | Universal links and app links | Open links straight in the field app | Each install has its own domain |

## v2 — deferred by decision

| Item | What it is |
|---|---|
| Several businesses per owner account | One sign-in managing several separate organisations or instances |
| Cross-owner content ownership | One Owner restricting another Owner's access to records they created |

## Not planned

These stay out of Spine:

- Multi-tenant SaaS hosting.
- Payroll, HR and attendance.
- Inventory with stock valuation, warehouses or manufacturing.
- Marketing automation, email campaigns and lead scoring.
- Filing returns or connecting to tax portals; e-invoicing and e-way bills.
- Customer or vendor self-service portals with accounts.
- Multi-currency.
- Live bank feeds (statement import and reconciliation are in 1.0).
- A native desktop app.
- Timesheets, a plugin API and a public REST API for third parties. (AI agents reach Spine through its MCP server, as the person who connected them.)
- Offline creation of quotes or invoices on mobile.
- From the competitor review, not copied: sales orders, delivery challans and packing slips; price lists; salesperson commissions; custom modules or scripting; a workflow-rule engine; several branches or companies in one install; Tally-style optional, memorandum and post-dated vouchers and scenarios; cost-centre hierarchies (jobs do this); an HTML template editor; a built-in OCR engine.
