# 06 · Quotes

Multi-line quotes with sections, discounts and per-line tax; a branded PDF; email with a secure public link the customer can read, accept or decline on any device; versions that supersede instead of edit; a discount approval gate; expiry; and one-click conversion to a job or invoice.

**Screens:** `QuotesList` (P1), `QuotesEmpty` (P1), `QuoteBuilder` (P1), `QuoteBuilderDraft` (P1), `QuoteDetail` (P1), `QuoteDetailAccepted` (P1), `QuoteDetailRejected` (P2), `QuoteDetailApproval` (P2), `QuoteDeleteConfirm` (P2), `QuoteConvertWarning` (P2), `EmailQueueDialog` (P3), `QuotePdf` (P1), `EmailQuote` (P2), `PublicQuote` (P1), `PublicQuotePhone` (P1), `PublicQuoteResult` (P1), `PublicQuoteDeclined` (P1), `PublicQuoteUnavailable` (P1), `JobFromQuote` (P1), `SettingsQuoteConversion` (P2), `MobQuoteAccept` (P1), `QuoteActionsMenu` (P2), `CatalogBundleDialog` (P2), `QuoteLinePicker` (P2), `QuoteDetailInPerson` (P1)
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
