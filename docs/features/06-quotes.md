# 06 · Quotes

Multi-line quotes with sections, discounts and per-line tax; a branded PDF; email with a secure public link the customer can read, accept or decline on any device; versions that supersede instead of edit; a discount approval gate; expiry; and one-click conversion to a job or invoice.

**Screens:** `QuotesList` (P1), `QuotesEmpty` (P1), `QuoteBuilder` (P1), `QuoteBuilderDraft` (P1), `QuoteDetail` (P1), `QuoteDetailAccepted` (P1), `QuoteDetailRejected` (P2), `QuoteDetailApproval` (P2), `QuoteDeleteConfirm` (P2), `QuoteConvertWarning` (P2), `EmailQueueDialog` (P3), `QuotePdf` (P1), `EmailQuote` (P2), `PublicQuote` (P1), `PublicQuotePhone` (P1), `PublicQuoteResult` (P1), `PublicQuoteDeclined` (P1), `PublicQuoteUnavailable` (P1), `JobFromQuote` (P1), `SettingsQuoteConversion` (P2), `MobQuoteAccept` (P1), `QuoteActionsMenu` (P2), `CatalogBundleDialog` (P2), `QuoteLinePicker` (P2), `QuoteDetailInPerson` (P1), `QuotesListRefined` (P2), `QuotesListRefinedDark` (P2), `QuoteDetailRefined` (P2), `QuoteDetailAcceptedRefined` (P2), `QuoteBuilderCompact` (P2), `QuoteBuilderCompactDark` (P2)
**Depends on:** 03 Contacts, 05 Catalogue, 11 Tax, 14 Notifications, 07 Jobs and 08 Invoicing (conversion).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-QUO-01 | Build and manage quotes | P1 | 1 | `QuoteBuilder`, `QuoteBuilderDraft`, `QuotesList`, `QuotesEmpty`, `QuoteDeleteConfirm` |
| F-QUO-02 | PDF and email | P1 | 1 | `QuotePdf`, `EmailQuote`, `QuoteDetail`, `EmailQueueDialog` |
| F-QUO-03 | Customer response by link | P1 | 1 | `PublicQuote`, `PublicQuotePhone`, `PublicQuoteResult`, `PublicQuoteDeclined`, `QuoteDetailAccepted`, `QuoteDetailRejected` |
| F-QUO-04 | Versions, discount approval and expiry | P1 | 1 | `QuoteDetail`, `QuoteDetailApproval`, `QuotesList` |
| F-QUO-05 | Convert to invoice | P1 | 2 | `QuoteDetailAccepted` |
| F-QUO-06 | Convert to job, with repeat guard | P1 | 3 | `QuoteDetailAccepted`, `JobFromQuote`, `QuoteConvertWarning`, `SettingsQuoteConversion` |
| F-QUO-07 | Own/others and workflow rights | P1 | 4 | `QuotesList`, `QuoteDetail` |
| F-QUO-08 | Record on-site acceptance | P1 | 5 | `MobQuoteAccept`, `QuoteDetailAccepted` |
| F-QUO-09 | Customer-facing fixes | P1 | 6 | `PublicQuoteUnavailable`, `PublicQuote`, `QuoteConvertWarning` |
| F-QUO-10 | Quote speed-ups: duplicate and bundles | P2 | 7 | `QuoteActionsMenu`, `CatalogBundleDialog`, `QuoteLinePicker` |
| F-QUO-11 | A quotes list you can work from: cards that filter, the list in the address, progress in each row, a title | P2 | Refinements | `QuotesListRefined`, `QuotesListRefinedDark` |
| F-QUO-12 | A quote page that says what's next: one next step, a lines table, activity with customer views, related records | P2 | Refinements | `QuoteDetailRefined`, `QuoteDetailAcceptedRefined` |
| F-QUO-13 | A faster builder: compact rows, a bar that stays in view, a default validity | P2 | Refinements | `QuoteBuilderCompact`, `QuoteBuilderCompactDark` |

## User stories

### US-QUO-01 · Build a multi-line quote
**Feature:** F-QUO-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `QuoteBuilder`, `QuoteBuilderDraft`
**As** office staff, **I want** a quote with quantity, rate, discount and tax per line, **so that** it reflects the real scope.

Legacy: S-03.1, S-08.5

**Acceptance criteria**
- **Given** I press "New quote", **when** the builder opens, **then** I see "Contact" (required), "Currency", "Valid until" (helper "Quote shows as expired after this date."), a lines editor, "Notes" (helper "Visible to the customer on the quote.") and "Terms & conditions".
- **Given** a line, **when** I enter quantity, unit price, discount % and choose a tax rate or group, **then** the line total and the Subtotal, Tax and Total update immediately.
- **Given** a line picked from the catalogue, **when** it's added, **then** its tax defaults from the item and I can override it on the line.
- **Given** no contact is chosen, **when** I press "Save as draft", **then** I see "Select a contact before saving." and nothing saves.
- **Given** a valid quote, **when** I press "Save as draft", **then** it's saved as a draft without a number and I'm on its detail page; editing that draft later shows "Save draft".

**Implementation notes**
- API: `POST /quotes`, `PUT /quotes/:id` (draft only).
- Data: `quotes`, `quote_lines` (snapshot, `discount_percentage`, `tax_rate_id` xor `tax_group_id`, `is_tax_inclusive`).
- UI: `quote-builder.tsx`, `quote-line-editor.tsx`; totals from `@spine/shared` money/tax engine.
- Edge: rounding once per line, half-up (D-004); lines reorder with up/down buttons.

### US-QUO-02 · Add section headings and text lines
**Feature:** F-QUO-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `QuoteBuilder`
**As** office staff, **I want** headings and free-text lines between items, **so that** a construction quote reads clearly.

Legacy: S-03.2

**Acceptance criteria**
- **Given** the lines editor, **when** I press "+ Add heading" or "+ Add text line", **then** a heading or text line is inserted with no quantity or price.
- **Given** headings and text lines, **when** totals compute, **then** they contribute nothing.
- **Given** the PDF and public page, **when** they render, **then** headings appear bold as section titles and text lines as paragraphs in order.

**Implementation notes**
- Data: `quote_line_type` (`item`, `heading`, `text`).

### US-QUO-03 · Find quotes by status and contact
**Feature:** F-QUO-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `QuotesList`, `QuotesEmpty`
**As** office staff, **I want** a list of quotes with filters, **so that** I can see what's out and what's won.

**Acceptance criteria**
- **Given** quotes exist, **when** I open Quotes, **then** I see "Total quotes", "Draft", "Sent" and "Accepted" counters and a table of number, contact, status, valid until and total.
- **Given** I filter by status or contact, **when** it applies, **then** only matching quotes show; with none I see "No quotes match these filters".
- **Given** no quotes exist, **when** I open Quotes, **then** I see "No quotes yet" and "Build a multi-line quote for a customer — save it as a draft, then send when it's ready." with "New quote".
- **Given** a draft quote, **when** it's listed, **then** it shows "— (unsent draft)" instead of a number.

**Implementation notes**
- API: `GET /quotes?status=&contactId=`.
- UI: `quotes-explorer.tsx`, `StatusChip`.

### US-QUO-04 · Delete a draft quote
**Feature:** F-QUO-01 · **Priority:** P2 · **Phase:** 1 · **Screens:** `QuoteDeleteConfirm`
**As** office staff, **I want** to delete a draft I don't need, **so that** the list stays tidy.

**Acceptance criteria**
- **Given** a draft quote, **when** I choose delete, **then** I see "Delete this draft quote?" and that it can't be undone.
- **Given** I confirm, **when** it succeeds, **then** a "Quote deleted" toast shows and it's gone.
- **Given** a sent, accepted or rejected quote, **when** I look for delete, **then** there is none and the API refuses it.

**Implementation notes**
- API: `DELETE /quotes/:id` (draft only; `quotes.delete_own`/`delete_others`, ownership checked before status).

### US-QUO-05 · Preview and download a branded PDF
**Feature:** F-QUO-02 · **Priority:** P1 · **Phase:** 1 · **Screens:** `QuoteDetail`, `QuotePdf`
**As** office staff, **I want** a PDF of the quote with our branding, **so that** I can share it any way the customer prefers.

Legacy: S-03.3, S-10.4

**Acceptance criteria**
- **Given** a quote, **when** I press "Preview PDF", **then** the PDF opens showing the business name, address and logo, "QUOTE", the number (or "Draft"), date issued, "Prepared for" with the customer, lines with quantity, unit price, tax and total, Subtotal, Tax, Total and notes.
- **Given** I press "Download PDF", **when** it completes, **then** a file named after the quote number downloads.
- **Given** the same quote, **when** its PDF is generated on two different installs, **then** the bytes are identical.
- **Given** a brand document colour is set (Phase 7, US-SET-10), **when** the PDF renders, **then** it uses that colour as its single accent.

**Implementation notes**
- API: `GET /quotes/:id/pdf`.
- UI: `@react-pdf/renderer` template in `apps/api/src/modules/pdf`.
- Edge: payment-instructions block is not on quotes.

### US-QUO-06 · Email a quote with a secure link
**Feature:** F-QUO-02 · **Priority:** P1 · **Phase:** 1 · **Screens:** `QuoteDetail`, `EmailQuote`
**As** office staff, **I want** to email the quote with a link, **so that** the customer can act without an account.

Legacy: S-03.4

**Acceptance criteria**
- **Given** a draft quote with a contact email, **when** I press "Send Quote", **then** it gets a permanent number, becomes `sent`, and a "Quote marked as sent" toast shows.
- **Given** a sent quote, **when** the email goes, **then** the customer receives "<Business> sent you a quote (<number>)" with the PDF attached and a "View and respond to the quote online" link.
- **Given** the email was sent, **when** I view the quote, **then** it shows "Emailed to <contact> on <date and time>".
- **Given** SMTP is down, **when** I send, **then** the quote still becomes `sent`, the email is queued and retried, and the quote shows the pending state.
- **Given** sending fails for a business reason, **when** the error returns, **then** I see "Could not mark this quote as sent." with the reason.

**Implementation notes**
- API: `POST /quotes/:id/send` (`quotes.send`); queue `quote-send-email`.
- Data: `quotes.number`, `sent_at`, `email_status`, `quote_public_tokens`.
- Edge: numbering in-transaction (D-007).

### US-QUO-07 · See emails waiting to go out
**Feature:** F-QUO-02 · **Priority:** P3 · **Phase:** 1 · **Screens:** `EmailQueueDialog`
**As** office staff, **I want** to see quote emails still queued or retrying, **so that** I know if a customer hasn't received one.

**Acceptance criteria**
- **Given** Quotes, **when** I press "Email queue", **then** a dialog shows "Quote emails that are queued, retrying, or still in flight." and "Refreshes automatically every 10 seconds.".
- **Given** queued emails exist, **when** it lists them, **then** each row shows Quote, Contact, Status ("Sending" or "Retrying"), Attempts and Queued time.
- **Given** nothing is pending, **when** it opens, **then** I see "Nothing pending" with "Every recently sent quote's email has either delivered or permanently failed — check the quote itself for the outcome.".

**Implementation notes**
- API: `GET /quotes/email-queue`.

### US-QUO-08 · Read a quote on my phone from the link
**Feature:** F-QUO-03 · **Priority:** P1 · **Phase:** 1 · **Screens:** `PublicQuote`, `PublicQuotePhone`
**As** a customer, **I want** to open the link and read the quote anywhere, **so that** I don't need to download or sign up.

Legacy: S-03.5

**Acceptance criteria**
- **Given** a valid link, **when** I open it, **then** I see the business name, quote number, "Awaiting your response", "Prepared for <customer>", every line, Subtotal, Tax, Total, Notes and Terms & conditions.
- **Given** a 390px-wide phone, **when** the page loads, **then** it fits without horizontal scrolling and the buttons are at least 44px tall.
- **Given** I open the link, **when** it loads, **then** the quote records a `viewed` event and the office is notified at most once per hour per quote.
- **Given** the server can't be reached, **when** the page loads, **then** I see "Could not reach the server. Check your connection and try again.".

**Implementation notes**
- API: `GET /public/quotes/:token` (Public, 20/min/IP).
- Data: `quote_events` (`viewed`).
- UI: `apps/web/src/app/quote/[token]/public-quote-view.tsx`.

### US-QUO-09 · Accept or decline a quote with a comment
**Feature:** F-QUO-03 · **Priority:** P1 · **Phase:** 1 · **Screens:** `PublicQuote`, `PublicQuoteResult`, `PublicQuoteDeclined`
**As** a customer, **I want** to accept or decline online with an optional note, **so that** my decision is recorded.

Legacy: S-03.6

**Acceptance criteria**
- **Given** a sent quote, **when** I view "Your decision", **then** I see a comment box ("Add an optional comment…"), "Accept quote" and "Decline".
- **Given** I press "Accept quote", **when** it succeeds, **then** the page shows "Accepted" and the quote becomes read-only.
- **Given** I press "Decline", **when** it succeeds, **then** the page shows "Declined" with my comment.
- **Given** the quote was already answered or replaced, **when** I try to respond, **then** I see "This quote could not be updated. It may have already been responded to or the link may have expired.".
- **Given** I click repeatedly, **when** the limit is hit, **then** I see "Too many attempts — please wait a minute and try again.".

**Implementation notes**
- API: `POST /public/quotes/:token/accept`, `POST /public/quotes/:token/reject`.
- Data: `quotes.status`, `responded_at`, `response_comment`, `acceptance_method = public_link`.
- Edge: accepting a superseded version is blocked.

### US-QUO-10 · Get told when a customer views or answers a quote
**Feature:** F-QUO-03 · **Priority:** P1 · **Phase:** 1 · **Screens:** `QuoteDetailAccepted`, `QuoteDetailRejected`
**As** an owner, **I want** a notification the moment a quote is viewed, accepted or declined, **so that** I follow up while it's warm.

Legacy: S-03.7

**Acceptance criteria**
- **Given** a customer accepts, **when** it's recorded, **then** Owners get an email with subject "<customer> accepted quote <number>".
- **Given** a customer accepts, **when** it's recorded, **then** everyone who can read quotes gets the in-app notification "<customer> accepted quote <number>.".
- **Given** a customer declines, **when** it's recorded, **then** the same people are notified with "<customer> rejected quote <number>.".
- **Given** the quote page, **when** I open an accepted or declined quote, **then** its status chip and the customer's comment are shown.
- **Given** a customer opens the link five times in an hour, **when** notifications send, **then** only one "viewed" notification goes out.

**Implementation notes**
- API: `NotificationsService.notify` types `quote_viewed`, `quote_accepted`, `quote_rejected`.
- The dashboard activity feed words the same events differently (US-DASH-08); this story fixes the notification and email text only.

### US-QUO-11 · Revise a sent quote into a new version
**Feature:** F-QUO-04 · **Priority:** P1 · **Phase:** 1 · **Screens:** `QuoteDetail`
**As** office staff, **I want** to revise a sent quote, **so that** the history of what was offered is kept.

Legacy: S-03.8

**Acceptance criteria**
- **Given** a sent, accepted or rejected quote, **when** I press "Revise", **then** a new draft is created with the same lines, `version` + 1 and a link to the original.
- **Given** the new version is sent, **when** the customer opens the old link, **then** the old version can't be accepted.
- **Given** a sent quote, **when** anyone tries to edit it directly, **then** editing is refused.
- **Given** revising fails, **when** the error returns, **then** I see "Could not revise this quote.".
- **Given** a draft quote, **when** `POST /quotes/:id/revise` is called, **then** it's refused with "A draft quote has no history to revise — edit it directly instead".

**Implementation notes**
- API: `POST /quotes/:id/revise` (`quotes.revise`).
- Data: `quotes.parent_quote_id`, `version` (D-013).

### US-QUO-12 · Require owner approval for big discounts
**Feature:** F-QUO-04 · **Priority:** P2 · **Phase:** 1 · **Screens:** `QuoteDetailApproval`
**As** an owner, **I want** quotes with a discount at or above my threshold to need my approval, **so that** margins are protected.

Legacy: S-03.9

**Acceptance criteria**
- **Given** a draft whose overall discount is at or above the threshold (default 20%), **when** I view it, **then** a banner says "This quote's discount is above the org's approval threshold and needs owner sign-off before it can be sent.".
- **Given** that draft, **when** anyone without approval rights tries to send it, **then** sending is refused with "This quote's discount requires owner approval before it can be sent".
- **Given** I'm an Owner (or hold `quotes.approve_discount`), **when** I press "Approve discount", **then** I see "Discount approved" / "This quote can now be sent." and sending is allowed.
- **Given** the draft is edited after approval so the discount grows, **when** it's saved, **then** approval is cleared.

**Implementation notes**
- API: `POST /quotes/:id/approve-discount`.
- No notification is sent when a quote needs approval in v1; the banner on the draft is the signal.
- Data: `quotes.discount_requires_approval`, `approved_by_user_id`, `approved_at`; `settings.discount_approval_threshold`.

### US-QUO-13 · Show quotes as expired after their validity date
**Feature:** F-QUO-04 · **Priority:** P1 · **Phase:** 1 · **Screens:** `QuotesList`, `QuoteDetail`
**As** office staff, **I want** quotes past their validity date marked expired, **so that** old prices aren't honoured by accident.

Legacy: S-03.11

**Acceptance criteria**
- **Given** a sent quote whose "Valid until" has passed, **when** I view the list or the quote, **then** it shows "Expired".
- **Given** the status filter, **when** I choose "Expired", **then** only expired quotes show.
- **Given** an expired quote, **when** I press "Revise", **then** I can issue a fresh version with a new date.

**Implementation notes**
- Expired is computed, not stored. Whether the public link should refuse acceptance after expiry is open (R-08).

### US-QUO-14 · Turn an accepted quote into an invoice
**Feature:** F-QUO-05 · **Priority:** P1 · **Phase:** 2 · **Screens:** `QuoteDetailAccepted`
**As** office staff, **I want** to convert an accepted quote into a draft invoice, **so that** nothing is retyped.

Legacy: S-03.10 (invoice half)

**Acceptance criteria**
- **Given** an accepted quote, **when** I press "Convert to invoice", **then** a draft invoice is created for the same contact with the same lines, and I land on it.
- **Given** the draft invoice, **when** I view it, **then** it links back to the quote.
- **Given** conversion fails, **when** the error returns, **then** I see "Could not convert this quote to an invoice.".

**Implementation notes**
- API: `POST /invoices/from-quote/:quoteId` (guard applies, US-QUO-16).

### US-QUO-15 · Turn an accepted quote into a job
**Feature:** F-QUO-06 · **Priority:** P1 · **Phase:** 3 · **Screens:** `QuoteDetailAccepted`, `JobFromQuote`
**As** office staff, **I want** to start a job from an accepted quote, **so that** the job begins with the real contract value.

Legacy: S-03.10 (job half), S-04.1

**Acceptance criteria**
- **Given** an accepted quote, **when** I press "Convert to job", **then** a job "Job for <quote number>" is created for the contact with the quote total as contract value, and I land on it.
- **Given** the job, **when** I view it, **then** it links to the source quote.
- **Given** conversion fails, **when** the error returns, **then** I see "Could not convert this quote to a job.".
- **Given** I press "Convert to job", **when** it runs, **then** no confirmation is asked first (D-060).

**Implementation notes**
- API: `POST /jobs/from-quote/:quoteId`.

### US-QUO-16 · Warn before converting the same quote twice
**Feature:** F-QUO-06 · **Priority:** P2 · **Phase:** 3 · **Screens:** `QuoteConvertWarning`, `SettingsQuoteConversion`
**As** an owner, **I want** a guard against converting a quote twice by accident, **so that** amounts aren't doubled.

Decision: D-026

**Acceptance criteria**
- **Given** the setting "Repeat quote conversion" is "warn" (default) and the quote was converted before, **when** I convert again, **then** "This quote has already been converted before" lists the existing jobs or invoices with "Cancel" and "Convert to job anyway" (or "Convert to invoice anyway").
- **Given** I confirm, **when** it proceeds, **then** a second job or invoice is created.
- **Given** the setting is "block", **when** I convert again, **then** it's refused.
- **Given** the setting is "off", **when** I convert again, **then** no warning shows.

**Implementation notes**
- API: 409 with `existing` in warn mode; retry with `confirm: true`. Setting at `PUT /org/settings/quote_conversion_guard`.

### US-QUO-17 · Let a Team edit only its own quotes
**Feature:** F-QUO-07 · **Priority:** P1 · **Phase:** 4 · **Screens:** `QuotesList`, `QuoteDetail`
**As** an owner, **I want** own/others rights for drafting quotes, **so that** juniors can draft without changing colleagues' quotes.

Legacy: S-03.13

**Acceptance criteria**
- **Given** a member with `quotes.edit_own` only, **when** they open a colleague's draft, **then** "Edit" is hidden and `PUT` returns 403.
- **Given** a non-owner of a sent quote, **when** they try to delete it, **then** they get 403 (not 400), because ownership is checked first.
- **Given** a Team without either edit right, **when** its members open Quotes, **then** "New quote" is hidden.

**Implementation notes**
- API: `QuotesService.update`/`delete` ownership check before status check.

### US-QUO-18 · Grant sending and revising separately from drafting
**Feature:** F-QUO-07 · **Priority:** P1 · **Phase:** 4 · **Screens:** `QuoteDetail`
**As** an owner, **I want** "send" and "revise" as their own rights, **so that** juniors can draft but not issue quotes on my behalf.

**Acceptance criteria**
- **Given** a member without `quotes.send`, **when** they open their own draft, **then** "Send Quote" is hidden and `POST /quotes/:id/send` returns 403.
- **Given** a member with `quotes.send` but not `quotes.edit_others`, **when** they open a colleague's draft, **then** they can send it but not edit it.
- **Given** a member without `quotes.revise`, **when** they open a sent quote, **then** "Revise" is hidden.

**Implementation notes**
- API: `@RequireCapability("quotes.send")`, `("quotes.revise")`.

### US-QUO-19 · Store the signature from an on-site acceptance
**Feature:** F-QUO-08 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobQuoteAccept`, `QuoteDetailAccepted`
**As** an owner, **I want** an in-person acceptance to keep the signature and signer's name, **so that** I have proof if it's ever disputed.

Legacy: S-03.12 · Decision: D-054

**Acceptance criteria**
- **Given** a field user captures a signature and name on the phone, **when** `POST /quotes/:id/accept-in-person` succeeds, **then** the quote stores the signature file, the signer's name, the accepting user and the time, with method "in person".
- **Given** the request has no signer name, **when** it's sent, **then** it's rejected with 400.
- **Given** the signature file belongs to another organisation or doesn't exist, **when** the request is sent, **then** it's rejected.
- **Given** the quote isn't `sent`, **when** acceptance is attempted, **then** it's refused.

**Implementation notes**
- API: `POST /quotes/:id/accept-in-person` gains `signerName` (contract addition); `quotes.accept_in_person` (Field always passes).
- Data: new `quotes.signature_file_id`, `accepted_signer_name` (04-data-model additions).
- Edge: today the signature file is validated but not stored — this story fixes that.

### US-QUO-20 · Show how a quote was accepted
**Feature:** F-QUO-08 · **Priority:** P1 · **Phase:** 5 · **Screens:** `QuoteDetailAccepted`, `QuoteDetailInPerson`
**As** office staff, **I want** the quote page to show whether it was accepted online or on site, and by whom, **so that** I can answer questions about it.

**Acceptance criteria**
- **Given** a quote accepted by link, **when** I open it, **then** it shows "Accepted online by the customer on <date>".
- **Given** a quote accepted on site, **when** I open it, **then** it shows "Accepted on site", "Signed by <signer name> on <date> at <time>, witnessed by <name of the user who recorded it>", a signature preview and "View signature full size".
- **Given** the quote's history, **when** I open it, **then** the acceptance entry names the method.

**Implementation notes**
- UI: `quote-detail.tsx` acceptance panel; signature via authorised file proxy.

### US-QUO-21 · Show a branded page for an expired or invalid link
**Feature:** F-QUO-09 · **Priority:** P1 · **Phase:** 6 · **Screens:** `PublicQuoteUnavailable`
**As** a customer with an old link, **I want** to see whose quote it was and how to reach them, **so that** I'm not stuck on a blank error.

Finding: C7

**Acceptance criteria**
- **Given** an expired, replaced or invalid link, **when** I open it, **then** I see the business logo and name, "This quote link has expired" and "The link you opened is no longer active — the quote may have been updated or replaced. Contact <Business> and they'll send you the latest version.".
- **Given** that page, **when** it renders, **then** it shows the business's address, email and phone from the business profile.
- **Given** a token that matches nothing at all, **when** I open it, **then** the page shows a generic "This quote link isn't valid" without any business details.

**Implementation notes**
- API: `GET /public/quotes/:token` returns `{ status: "expired" | "invalid", business? }` instead of only an error.

### US-QUO-22 · Keep emailed links working until the quote is replaced
**Feature:** F-QUO-09 · **Priority:** P1 · **Phase:** 6 · **Screens:** `PublicQuote`
**As** office staff, **I want** the link in a sent email to keep working while that quote is current, **so that** customers don't hit "expired" for no reason.

Finding: C8

**Acceptance criteria**
- **Given** a sent quote that hasn't been revised, **when** the customer opens any link emailed for it within 30 days, **then** the quote loads.
- **Given** the quote was emailed twice, **when** the customer opens the first email's link, **then** the quote loads (resending never invalidates an earlier link).
- **Given** the quote was revised, **when** the old link is opened, **then** the branded unavailable page shows (US-QUO-21).
- **Given** the demo data, **when** seeded, **then** every sent demo quote's emailed link opens.

**Implementation notes**
- Investigate token rotation on resend vs demo seeding (finding C8: QUO-0003's link reported invalid while `sent`).

### US-QUO-23 · Explain a repeat conversion clearly
**Feature:** F-QUO-09 · **Priority:** P2 · **Phase:** 6 · **Screens:** `QuoteConvertWarning`
**As** office staff, **I want** the repeat-conversion warning to read clearly, **so that** I understand what I'm about to do.

Finding: C11

**Acceptance criteria**
- **Given** the warning, **when** it lists existing jobs, **then** each is a separate link on its own line, not run into the sentence.
- **Given** the warning text, **when** it renders, **then** it reads "Converting again creates a separate job. The amount isn't split between them. Only do this if you mean to bill or track this quote's work more than once." in sentence case.
- **Given** the confirm button, **when** it renders, **then** it's labelled "Convert to job anyway" and styled primary, not danger (D-058).

**Implementation notes**
- UI: `quote-detail.tsx` `AlertDialog` content.

### US-QUO-24 · Duplicate a quote as a new draft
**Feature:** F-QUO-10 · **Priority:** P2 · **Phase:** 7 · **Screens:** `QuoteActionsMenu`
**As** office staff, **I want** to start a new quote from an existing one, **so that** similar jobs take seconds to quote.

Decision: D-096

**Acceptance criteria**
- **Given** any quote, **when** I open "More ▾", **then** the menu lists "Duplicate as new draft", "Save lines as a bundle…", "Email again" and "View history".
- **Given** I choose "Duplicate as new draft", **when** it completes, **then** a new draft opens with the same contact, lines, notes and terms, no number, today's date and a fresh validity date.
- **Given** the duplicate, **when** its lines are copied, **then** prices and tax come from the original quote's lines, not the current catalogue.
- **Given** the new draft, **when** I view its history, **then** the first entry reads "Duplicated from QUO-<number>".
- **Given** I lack `quotes.edit_own`, **when** I open the menu, **then** "Duplicate as new draft" isn't listed.

**Implementation notes**
- API: `POST /quotes/:id/duplicate` (contract addition, `quotes.edit_own`, idempotent); the copy has `parent_quote_id = null` (it isn't a revision).

### US-QUO-25 · Save quote lines as a reusable bundle
**Feature:** F-QUO-10 · **Priority:** P2 · **Phase:** 7 · **Screens:** `CatalogBundleDialog`
**As** office staff, **I want** to save a group of lines as a bundle, **so that** I can add them in one go next time.

Decision: D-096

**Acceptance criteria**
- **Given** "Save lines as a bundle…", **when** the dialog opens, **then** it shows "Bundle name", a summary of the lines and "Description", with "Cancel" and "Save bundle".
- **Given** no name, **when** I press "Save bundle", **then** I see "Give the bundle a name.".
- **Given** a valid bundle, **when** it saves, **then** a toast reads "Bundle saved" and it appears in the catalogue under a "Bundles" tab.
- **Given** a bundle, **when** its source quote changes later, **then** the bundle is unchanged.
- **Given** the catalogue, **when** I edit or archive a bundle, **then** the own/others rules of catalogue items apply (`catalog.*`).

**Implementation notes**
- API: `GET/POST /catalog-bundles`, `PUT/DELETE /catalog-bundles/:id`, `/archive` (contract additions, `catalog.edit_own`/`edit_others`/`delete_*`).
- Data: `catalog_bundles`, `catalog_bundle_lines` (04 "Columns added").

### US-QUO-26 · Add a bundle while building a quote
**Feature:** F-QUO-10 · **Priority:** P2 · **Phase:** 7 · **Screens:** `QuoteLinePicker`
**As** office staff, **I want** bundles in the line picker, **so that** a standard package goes in with one click.

**Acceptance criteria**
- **Given** I type in a line's item field, **when** matches exist, **then** the picker shows "BUNDLES" first, each with its total and "Adds <n> lines: …", then "ITEMS".
- **Given** I choose a bundle, **when** it's added, **then** its lines are inserted in order at that position with the bundle's prices and tax, each editable like any line.
- **Given** the same picker on invoices and vendor bills, **when** I type, **then** bundles appear there too (invoices only; vendor bills show items only).
- **Given** a bundle line's catalogue item was archived, **when** the bundle is added, **then** the line is still added as a one-off line.

**Implementation notes**
- UI: `quote-line-editor.tsx` picker; the "Use … as a one-off line" footer with "Also save to catalogue" is US-CAT-06.

### US-QUO-27 · See open, expiring and won quotes at a glance
**Feature:** F-QUO-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuotesListRefined`
**As** an owner, **I want** the cards to say what's in play and what needs chasing, **so that** I follow up before quotes go cold.

Decision: D-214

**Acceptance criteria**
- **Given** Quotes, **when** it shows, **then** the cards read "Open" (sent, not expired or superseded, with their total value), "Expiring in 7 days" (open quotes whose validity ends within 7 days), "Won this month" (accepted this calendar month, with their value) and "Win rate" (accepted ÷ answered or expired in the last 90 days; "—" with "None closed in the last 90 days" when there are none).
- **Given** the counts, **when** a quote has versions, **then** it counts once, as its newest version (the list shows one row per quote, so the numbers match what I see).
- **Given** "Open", "Expiring in 7 days" or "Won this month", **when** I press it, **then** the table shows just those quotes, the card shows pressed ("Showing these · press again to clear") and the address keeps it; pressing it again clears it. With a keyboard or screen reader each is a button ("Show quotes expiring in 7 days, 2") with its pressed state.
- **Given** values in more than one currency, **when** a card shows a value, **then** it sums the business's currency and says "+ other currencies" when some quotes are in another.

**Implementation notes**
- UI: `quotes-list-state.ts` (`quoteStats`, filters), `quotes-explorer.tsx`; from the quotes already loaded. Replaces `use-quote-stats.ts`. The dashboard's "Quotes won this month" link (`?status=accepted`) keeps working.

### US-QUO-28 · Search, filter and come back to the same quotes list
**Feature:** F-QUO-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuotesListRefined`
**As** office staff, **I want** the quotes list to keep my search and filters and refresh on request, **so that** it works like Contacts, the pipeline and the catalogue.

Decision: D-210, D-214

**Acceptance criteria**
- **Given** the toolbar, **when** it shows, **then** it has Status and Contact filters (Contact lists only contacts with a quote), "Updated … ago", Refresh, "Email queue" and "New quote", with search on its own row beside Columns.
- **Given** a search, filter, card, sort or page, **when** I set it, **then** the address keeps it (for example `/quotes?status=sent&contact=<id>&q=villa`), so Back and bookmarks return to the same list; "Clear filters" clears them.
- **Given** a search, **when** I type, **then** it matches the number, title, contact and line names.
- **Given** no sort chosen, **when** the list shows, **then** the newest quote is first.
- **Given** Refresh, **when** I press it or come back to the tab after 30 seconds, **then** the list reloads in place (US-CRM-22).

**Implementation notes**
- UI: the list-state pattern (`catalog-list-state.ts`), `replaceQuery`; `DataTable` with a controlled page, sort and search.

### US-QUO-29 · Read a quote's progress in the list, and act on it from the row
**Feature:** F-QUO-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuotesListRefined`
**As** office staff, **I want** each row to say when the quote was sent, how long it has left and whether the customer has looked, **so that** I know whom to call.

Decision: D-214

**Acceptance criteria**
- **Given** the table, **when** a row shows, **then** it reads Number (with the title under it, US-QUO-30), Contact, Status, Sent ("12 Oct"; "—" for a draft), Valid until (with "in 3 days", "today" or "Expired 2 days ago" under the date) and Total.
- **Given** the customer opened the link, **when** the row shows, **then** the status has "Viewed 2×" beside it, with the last view on hover ("Last viewed 14 Oct, 3:20 PM").
- **Given** a draft, **when** its number shows, **then** it reads "Draft" in muted italics, not "— (unsent draft)".
- **Given** a row's "…" menu, **when** I open it, **then** it offers what I may do: View, Edit and Send (a draft), Copy customer link (a sent quote), Download PDF, Duplicate, Convert to invoice and Convert to job (accepted), and Delete (a draft).
- **Given** dates, **when** they show, **then** they follow the business's locale, not the browser's default.

**Implementation notes**
- API: `GET /quotes` rows gain `viewCount` and `lastViewedAt` (from `quote_events`).
- UI: `quotes-table.tsx`, `quote-row-actions.tsx`.

### US-QUO-30 · Give a quote a title
**Feature:** F-QUO-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuoteBuilderCompact`, `QuotesListRefined`, `QuoteDetailRefined`
**As** office staff, **I want** to name a quote ("Bathroom refit — 2nd floor"), **so that** I can tell a customer's quotes apart without opening them.

Decision: D-214

**Acceptance criteria**
- **Given** the builder, **when** it opens, **then** it has an optional "Title" field first, with "For example, Bathroom refit — 2nd floor"; over 120 characters says "Keep the title under 120 characters.".
- **Given** a title, **when** the quote shows in the list, on its page, on the PDF and on the customer's page, **then** the title shows under the number; without one nothing extra shows.
- **Given** a quote with a title, **when** I duplicate or revise it, **then** the copy keeps the title; a quote from a lead starts with the lead's title.
- **Given** search, **when** I type part of a title, **then** the quote is found.

**Implementation notes**
- Data: `quotes.title text?` (≤ 120). API: `POST/PUT /quotes` accept `title`; `GET` returns it; duplicate and revise copy it. PDF and public page show it.

### US-QUO-31 · See a quote at a glance, with one next step
**Feature:** F-QUO-12 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuoteDetailRefined`, `QuoteDetailAcceptedRefined`
**As** office staff, **I want** the quote page to show what the customer gets and what to do next, **so that** I don't hunt through buttons.

Decision: D-214

**Acceptance criteria**
- **Given** a quote, **when** its page opens, **then** the page title is its number ("Draft quote" for a draft) with the status, the title, the contact as a link, "Sent 12 Oct" and "Valid until 9 Nov · in 30 days" (or "Expired 2 days ago"); there's no separate "Back to quotes" link (the breadcrumb has it).
- **Given** its status, **when** the page shows, **then** one primary button offers the next step: Send quote (a draft), Copy customer link (sent), Convert to invoice (accepted), Revise (declined or expired); Edit, Preview or Download PDF, Email again, Convert to job, Duplicate, Save lines as a bundle, View history and Delete draft sit in a secondary row and under More, each only when I may do it.
- **Given** "Copy customer link", **when** I press it, **then** the link to the customer's page is copied and a toast says "Link copied — it works for 30 days, or until you revise the quote."; earlier links keep working.
- **Given** the lines, **when** they show, **then** they're a table: Item (with its description), Qty, Rate, Discount and Tax (only when any line has them), Amount; headings span the row in bold and text lines in muted text; totals sit under the table, with Discount only when there is one.
- **Given** a GST quote, **when** the tax shows, **then** the totals list CGST and SGST (or IGST) by name, as on the PDF.

**Implementation notes**
- API: `POST /quotes/:id/link` → `{ url, expiresAt }` mints a fresh customer link without emailing (`quotes.send`; only a sent, current quote, else 400 "Only a sent quote has a customer link."); audited `link_copied`. `GET /quotes/:id` already returns `taxLines`.
- UI: `quote-detail.tsx` split into header, lines and totals components.

### US-QUO-32 · Follow what happened to a quote
**Feature:** F-QUO-12 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuoteDetailRefined`
**As** an owner, **I want** a quote's whole story in one place, including when the customer looked, **so that** I call at the right moment.

Decision: D-214

**Acceptance criteria**
- **Given** a quote's page, **when** it shows, **then** an "Activity" panel lists, newest first: created, edited, discount approved, sent, emailed (or "Email failed: <reason>"), link copied, viewed by the customer, revised, accepted or declined (with the comment, online or in person), converted to an invoice or a job, with who did it and when.
- **Given** several views in a row, **when** they show, **then** they're one entry: "Viewed by the customer 3 times · last 14 Oct, 3:20 PM".
- **Given** a version 2, **when** its activity shows, **then** it starts with "Revised from v1" linking to v1.
- **Given** no customer activity yet on a sent quote, **when** the panel shows, **then** it ends with "Not viewed yet".

**Implementation notes**
- API: `GET /quotes/:id/activity` → `[{ at, type, actorName?, detail? }]` merging the quote's audit entries, its `quote_events` and its email status (roles: owner, staff). "View history" stays for field-level changes.

### US-QUO-33 · Get to a quote's lead, versions, job and invoices
**Feature:** F-QUO-12 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuoteDetailAcceptedRefined`
**As** office staff, **I want** what a quote is connected to beside it, **so that** I move between them without searching.

Decision: D-214

**Acceptance criteria**
- **Given** a quote's page, **when** it shows, **then** a "Related" panel lists the lead it's for, every version ("v1 · Declined", "v2 · Sent · this one") and any job or invoice made from it with its number and status, each a link; with none it isn't shown.
- **Given** a quote with versions, **when** I press another version, **then** its page opens; a superseded version says "Superseded by v2" with a link at the top.
- **Given** Jobs & field is off, **when** the panel shows, **then** it lists no jobs.

**Implementation notes**
- API: `GET /quotes/:id/related` → `{ lead, versions, jobs, invoices }` (roles: owner, staff; the same lookup as the conversion guard).

### US-QUO-34 · Build a quote in compact rows
**Feature:** F-QUO-13 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuoteBuilderCompact`, `QuoteBuilderCompactDark`
**As** office staff, **I want** each line on one row, **so that** I see the whole quote while I build it.

Decision: D-214

**Acceptance criteria**
- **Given** the builder, **when** lines show, **then** each item is one row: a drag handle, Item (the catalogue picker), Qty, Rate, Discount %, Tax and Amount, with "Remove line"; the description (and HSN/SAC for a GST business) sits in a second, lighter row under it, shown when it has text or I press "Add description".
- **Given** a heading or text line, **when** it shows, **then** it's one wide field across the row.
- **Given** a row, **when** I drag its handle, or press "Move up"/"Move down" in its menu (or Alt + ↑/↓), **then** it moves; screen readers announce "Moved to position 3 of 8".
- **Given** the last row, **when** I press Enter in its Amount or Tax field, or "Add item", **then** a new row starts with its Item field focused.
- **Given** a window under 1024 px, **when** the builder shows, **then** each row wraps into two lines rather than scrolling sideways.

**Implementation notes**
- UI: `quote-line-editor.tsx` only; invoices, credit notes and variation orders keep their editors.

### US-QUO-35 · Save, preview and send from a bar that stays in view
**Feature:** F-QUO-13 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuoteBuilderCompact`
**As** office staff, **I want** the totals and actions always in view, **so that** I don't scroll to save.

Decision: D-214

**Acceptance criteria**
- **Given** the builder, **when** I scroll, **then** a bar stays at the bottom with Subtotal, Tax and Total, "Cancel", "Preview PDF", "Save draft" and "Save and send" (the last only with `quotes.send` and when no discount needs approval).
- **Given** "Save and send", **when** I press it, **then** the draft saves and the send dialog opens on the quote's page.
- **Given** "Preview PDF", **when** I press it, **then** the quote as it is on screen opens as a PDF in a new tab, and nothing is saved: the draft, its history and "Unsaved changes" stay as they were.
- **Given** a quote that hasn't been sent, **when** its PDF opens (the builder's preview or a draft's "Preview PDF"), **then** every page has a faint diagonal "DRAFT — Preview only — not a valid quote" watermark behind the content; a sent quote's PDF has none.
- **Given** unsaved changes, **when** I press Cancel, go Back or close the tab, **then** it asks "Leave without saving? Your changes to this quote will be lost." with "Keep editing" and "Leave".
- **Given** Notes or Terms is empty, **when** it shows, **then** its placeholder sits inside the box (it showed at the bottom of the page in every empty rich-text editor).

**Implementation notes**
- UI: `quote-builder.tsx`; the placeholder fix is in `@spine/ui`'s `RichTextEditor` (every screen that uses it).
- API: `POST /quotes/preview-pdf` renders the unsaved quote (`quotes.edit_own`); nothing is written.

### US-QUO-36 · Start a quote valid for my usual number of days
**Feature:** F-QUO-13 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `QuoteBuilderCompact`
**As** an owner, **I want** new quotes to start with my usual validity, **so that** none goes out without an end date.

Decision: D-214

**Acceptance criteria**
- **Given** Settings › Documents › Quote, **when** it shows, **then** it has "Quotes valid for" in days (1–365, 30 to start).
- **Given** a new quote, **when** the builder opens, **then** "Valid until" is today plus that many days, with quick picks "+15 days", "+30 days" and "+60 days" beside it; I can still clear it.
- **Given** a duplicated quote, **when** the original had no validity date, **then** the copy uses the setting.

**Implementation notes**
- Data: `document_layout.quote.validDays` (integer 1–365; `resolveDocumentLayout` fills 30). No new endpoint.
