# 17 · Mobile field companion

A native iOS and Android app for field crew: sign in once, see today's assigned jobs with addresses and tap-to-call, capture site photos and receipts with no signal, complete milestones, present a quote and take the customer's signature on site, and see what's still waiting to sync. It never shows invoices, payments or reports. Designed native-first (expo-router native tabs, `@expo/ui` SwiftUI and Jetpack Compose controls) for both platforms.

**Screens:** `MobSignIn` (P1), `MobSignInAndroid` (P1), `MobHome` (P1), `MobHomeAndroid` (P1), `MobHomeOffline` (P1), `MobHomeOfflineAndroid` (P1), `MobJobsList` (P1), `MobJobsListAndroid` (P1), `MobJobsEmpty` (P2), `MobJobsEmptyAndroid` (P2), `MobJobDetail` (P1), `MobJobDetailAndroid` (P1), `MobMilestoneComplete` (P1), `MobMilestoneCompleteAndroid` (P1), `MobCameraPermission` (P2), `MobCameraPermissionAndroid` (P2), `MobPhotoCapture` (P1), `MobPhotoCaptureAndroid` (P1), `MobPhotoReview` (P1), `MobPhotoReviewAndroid` (P1), `MobExpensesList` (P1), `MobExpensesListAndroid` (P1), `MobExpenseNew` (P1), `MobExpenseNewAndroid` (P1), `MobReceiptCapture` (P1), `MobReceiptCaptureAndroid` (P1), `MobQuotePresent` (P1), `MobQuotePresentAndroid` (P1), `MobQuoteAccept` (P1), `MobQuoteAcceptAndroid` (P1), `MobQuoteAccepted` (P1), `MobQuoteAcceptedAndroid` (P1), `MobQuoteNeedsConnection` (P2), `MobQuoteNeedsConnectionAndroid` (P2), `MobSyncQueue` (P1), `MobSyncQueueAndroid` (P1), `MobProfile` (P2), `MobProfileAndroid` (P2), `MobError` (P2), `MobErrorAndroid` (P2), `MobSignOutConfirm` (P1), `MobSignOutConfirmAndroid` (P1), `MobJobPhotos` (P2), `MobJobPhotosAndroid` (P2), `MobQuoteDecline` (P2), `MobQuoteDeclineAndroid` (P2), `MobUpdateRequired` (P2), `MobUpdateRequiredAndroid` (P2), `MobSyncFix` (P1), `MobSyncFixAndroid` (P1), `MobHomeDark` (P1), `MobJobDetailDark` (P1), `MobHomeAndroidDark` (P1), `MobJobDetailAndroidDark` (P1)
**Depends on:** 02 Sign-in (accounts), 07 Jobs (crew, milestones, photos), 10 Purchases (expenses), 06 Quotes (in-person acceptance), `packages/ui-native`, [15-mobile-release](../prd/15-mobile-release.md).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-MOB-01 | Sign in and session | P1 | 5 | `MobSignIn`, `MobSignInAndroid`, `MobProfile`, `MobProfileAndroid` |
| F-MOB-02 | Today, jobs and job detail | P1 | 5 | `MobHome`, `MobHomeAndroid`, `MobJobsList`, `MobJobsListAndroid`, `MobJobsEmpty`, `MobJobsEmptyAndroid`, `MobJobDetail`, `MobJobDetailAndroid` |
| F-MOB-03 | Offline use and sync | P1 | 5 | `MobHomeOffline`, `MobHomeOfflineAndroid`, `MobSyncQueue`, `MobSyncQueueAndroid`, `MobError`, `MobErrorAndroid` |
| F-MOB-04 | Photos and milestone completion | P1 | 5 | `MobPhotoCapture`, `MobPhotoCaptureAndroid`, `MobPhotoReview`, `MobPhotoReviewAndroid`, `MobCameraPermission`, `MobCameraPermissionAndroid`, `MobMilestoneComplete`, `MobMilestoneCompleteAndroid` |
| F-MOB-05 | Expenses with receipts | P1 | 5 | `MobExpensesList`, `MobExpensesListAndroid`, `MobExpenseNew`, `MobExpenseNewAndroid`, `MobReceiptCapture`, `MobReceiptCaptureAndroid` |
| F-MOB-06 | On-site quote acceptance | P1 | 5 | `MobQuotePresent`, `MobQuotePresentAndroid`, `MobQuoteAccept`, `MobQuoteAcceptAndroid`, `MobQuoteAccepted`, `MobQuoteAcceptedAndroid`, `MobQuoteNeedsConnection`, `MobQuoteNeedsConnectionAndroid` |
| F-MOB-07 | Native app foundation | P1 | 5 | `MobHome`, `MobHomeAndroid` |

## User stories

### US-MOB-01 · Sign in to my company's Spine on my phone
**Feature:** F-MOB-01 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobSignIn`, `MobSignInAndroid`
**As** a field user, **I want** to sign in with my server address, email and password, **so that** the app connects to my company's Spine.

Legacy: S-11.1 · Decision: D-049

**Acceptance criteria**
- **Given** the app's first launch, **when** it opens, **then** I see "Sign in to Spine", "Use the email your office invited you with.", "Server", "Email", "Password" and "Sign in".
- **Given** a server address that isn't a Spine server or is unreachable, **when** I sign in, **then** I see "Can't reach that server. Check the address — it's the link you open Spine with on a computer.".
- **Given** wrong credentials, **when** I sign in, **then** I see "Invalid email or password.".
- **Given** I tap "Forgot password?", **when** it opens, **then** the server's reset page opens in the phone's browser (D-052). The link is hidden until the reset page ships in Phase 6 (US-AUTH-09).
- **Given** valid details, **when** I sign in, **then** I land on Today.

**Implementation notes**
- API: Better Auth sign-in; session token stored with expo-secure-store; sent as Bearer (D-016).
- UI: `@expo/ui` text fields; Android uses outlined Material fields.

### US-MOB-02 · Stay signed in and sign out safely
**Feature:** F-MOB-01 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobProfile`, `MobProfileAndroid`, `MobSignOutConfirm`, `MobSignOutConfirmAndroid`
**As** a field user, **I want** to stay signed in until I sign out, **so that** I'm not typing passwords on site.

Legacy: S-11.1

**Acceptance criteria**
- **Given** I signed in, **when** I reopen the app days later within the session lifetime, **then** I'm on Today without signing in again.
- **Given** Profile, **when** it opens, **then** it shows my name, "Field · <Business>", email, server, appearance, sync status, "Field accounts don't show invoices, payments or reports. Ask your office if you need something changed on your account." and "Sign out".
- **Given** items are waiting to sync, **when** I tap "Sign out", **then** I'm warned "<N> items haven't reached your office yet. Sign out anyway?" before anything is discarded.
- **Given** my membership is deactivated, **when** the app next calls the server, **then** I'm signed out with "Your access to <Business> was removed.".
- **Given** the sign-out warning, **when** it shows, **then** it explains "<n> site photos and <n> expense are still waiting to sync. Signing out deletes them from this phone." and offers "Send them first" (opens Sync), "Sign out anyway" (destructive) and "Cancel"; Android shows a Material dialog with "Cancel", "Send first" and "Sign out".

**Implementation notes**
- API: Better Auth sign-out (revokes the session).

### US-MOB-03 · See today's jobs with addresses and tap-to-call
**Feature:** F-MOB-02 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobHome`, `MobHomeAndroid`
**As** a field user, **I want** today's assigned jobs on the home screen with directions and a call button, **so that** I can just go.

Legacy: S-11.2

**Acceptance criteria**
- **Given** an assigned job, **when** Today decides what to show, **then** it lists the job only if its status is "Active" and it has a pending milestone that is overdue or due within the next 7 days; other assigned jobs are only on the Jobs tab.
- **Given** I'm on two such jobs, **when** Today opens, **then** I see the date, "Today", my next meeting, "YOUR JOBS TODAY · 2" and a card per job with name, customer, site address and its next milestone with a due chip.
- **Given** a job card, **when** I tap "Call <contact name>" (iOS: full name, "Call Alan Reyes"; Android: first name, "Call Alan"), **then** the phone dialler opens with the job contact's number.
- **Given** a job card, **when** I tap "Directions", **then** the maps app opens at the site address.
- **Given** iOS, **when** Today renders, **then** "Add photos" and "Log expense" buttons sit under the jobs; on Android a floating "Add photos" button is shown instead (D-051).
- **Given** the header, **when** everything has synced, **then** a pill reads "All synced".

**Implementation notes**
- API: `GET /jobs?assignedToMe=true`, `GET /jobs/milestones/due`, `GET /meetings/upcoming`.
- UI: expo-router native tabs Today · Jobs · Expenses · Profile (D-047).

### US-MOB-04 · Browse my assigned jobs
**Feature:** F-MOB-02 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobJobsList`, `MobJobsListAndroid`, `MobJobsEmpty`, `MobJobsEmptyAndroid`
**As** a field user, **I want** a list of every job I'm on, **so that** I can find one that isn't today's.

**Acceptance criteria**
- **Given** the Jobs tab, **when** it opens, **then** I see a search field ("Search jobs") and "ASSIGNED TO YOU · <n>" with each job's name, customer, town and milestone status.
- **Given** I type in search, **when** I pause, **then** the list filters by job or customer name.
- **Given** I pull down, **when** I release, **then** the list refreshes.
- **Given** I'm on no jobs, **when** I open the tab, **then** I see "No jobs assigned to you yet", "When your office adds you to a job's crew, it shows up here with its address and contact." and "Check again".

**Implementation notes**
- API: `GET /jobs?assignedToMe=true`.

### US-MOB-05 · Open a job's details on site
**Feature:** F-MOB-02 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobJobDetail`, `MobJobDetailAndroid`, `MobJobPhotos`, `MobJobPhotosAndroid`
**As** a field user, **I want** a job's address, contact, milestones, photos and quotes to present, **so that** I have what I need on site.

**Acceptance criteria**
- **Given** I open a job, **when** it loads, **then** I see its name, customer, status, the site address with "Directions", the contact with a call button, "MILESTONES", "PHOTOS · <n>" with "See all" and "QUOTES TO PRESENT".
- **Given** a pending milestone, **when** I view it, **then** it shows its due date and "Mark complete".
- **Given** a quote waiting for the customer, **when** I view it, **then** it shows "Present".
- **Given** the job's contract value, milestone amounts or invoices, **when** I look anywhere on the screen, **then** none are shown (D-048).
- **Given** "PHOTOS · <n>", **when** I tap "See all", **then** "Photos · <n>" opens with the job name and number, photos grouped by day newest first, a "Waiting" badge on photos not yet sent, and "Add photos".

**Implementation notes**
- API: `GET /jobs/:id`, `GET /jobs/:id/milestones`, `GET /jobs/:id/photos`, `GET /jobs/:id/quotes` (contract addition, [D-073](../prd/12-decisions.md)). Field gets assigned jobs only, without money fields (US-JOB-19).
- The subtitle shows the job number once jobs are numbered (US-JOB-22); until then only the customer.

### US-MOB-06 · Keep financial reports off phones
**Feature:** F-MOB-02 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobProfile`, `MobJobDetail`
**As** an owner, **I want** the mobile app to show no financial reports, **so that** sensitive figures aren't on every phone.

Legacy: S-11.8 · Decision: D-048

**Acceptance criteria**
- **Given** any user signs in on mobile (Owner, Staff or Field), **when** they use the app, **then** there are no screens for invoices, payments, receivables, payables or reports.
- **Given** the app's API calls, **when** inspected, **then** it never requests report or invoice endpoints.
- **Given** money shown on mobile, **when** it appears, **then** it's only the user's own expenses or the quote being presented.

**Implementation notes**
- Enforced by app scope plus server-side Field restrictions (07-security).

### US-MOB-07 · Keep working when there's no signal
**Feature:** F-MOB-03 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobHomeOffline`, `MobHomeOfflineAndroid`
**As** a field user, **I want** the app to work offline from what it last downloaded, **so that** bad signal doesn't stop me.

Legacy: S-07.3, §6.6

**Acceptance criteria**
- **Given** I go offline, **when** I open Today, **then** a banner reads "You're offline" and "Photos, expenses and milestone updates are saved on this phone and sync when you're back online. Showing jobs as of <time>."
- **Given** offline, **when** I open a job I've seen before, **then** its details, milestones and contact load from the cache.
- **Given** offline, **when** I add photos, an expense or complete a milestone, **then** each saves locally and its card shows a "waiting" chip (e.g. "2 photos waiting", "Completion waiting").
- **Given** I come back online, **when** the app notices, **then** the banner disappears and waiting items start sending automatically.

**Implementation notes**
- SQLite cache + outbox (02-architecture §Offline sync); airplane-mode end-to-end test.

### US-MOB-08 · See what's waiting to sync
**Feature:** F-MOB-03 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobSyncQueue`, `MobSyncQueueAndroid`
**As** a field user, **I want** to see how many items are waiting and what they are, **so that** I know when I'm safe.

Legacy: S-11.4

**Acceptance criteria**
- **Given** waiting items, **when** I look at the header, **then** the pill reads "<n> waiting to sync" in the due-soon colour.
- **Given** I tap the pill, **when** Sync opens, **then** I see "<n> items waiting" with the reason (e.g. "You're offline · sends automatically when you reconnect"), a "WAITING" list (what, which job, when), and "SENT TODAY".
- **Given** I tap "Try sending now", **when** I'm online, **then** waiting items send immediately.
- **Given** everything sent, **when** I view the pill, **then** it reads "All synced".

**Implementation notes**
- Outbox status per item: `waiting`, `sending`, `sent`, `failed`.

### US-MOB-09 · Send each item exactly once and fix failures
**Feature:** F-MOB-03 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobSyncQueue`, `MobSyncQueueAndroid`, `MobSyncFix`, `MobSyncFixAndroid`
**As** a field user, **I want** retries never to create duplicates and failures to tell me what to do, **so that** I trust the app.

Decisions: D-009, D-053

**Acceptance criteria**
- **Given** an item sent but the response was lost, **when** it's retried, **then** the server returns the original result and no duplicate is created.
- **Given** an item the server rejects, **when** it fails, **then** it shows in red with the reason (e.g. "Didn't send: the receipt photo is over 10 MB") and "Fix".
- **Given** I tap "Fix", **when** it opens, **then** I can retake or remove the photo or edit the item and resend it.
- **Given** a network error, **when** it fails, **then** it retries automatically with back-off and stays "Waiting", not "Failed".
- **Given** the "Fix" screen for a rejected expense, **when** it opens, **then** it shows the reason in red ("Didn't send: the receipt photo is over 10 MB."), the expense details, the photo with its size, "Retake photo", "Choose a different photo", "Remove photo", "Send again" and "Delete this expense".

**Implementation notes**
- Each outbox item's id is its `Idempotency-Key`; photos compressed before queueing.

### US-MOB-10 · Show a clear error when the server can't be reached
**Feature:** F-MOB-03 · **Priority:** P2 · **Phase:** 5 · **Screens:** `MobError`, `MobErrorAndroid`, `MobUpdateRequired`, `MobUpdateRequiredAndroid`
**As** a field user, **I want** a clear message when the app can't load, **so that** I know whether to wait or use saved data.

**Acceptance criteria**
- **Given** I'm online but the server doesn't answer, **when** Today loads, **then** I see "Couldn't load your jobs", "The Spine server didn't answer. You're online, so it may be restarting — try again in a minute.", "Try again" and "Show jobs saved at <time>".
- **Given** I tap "Show jobs saved at <time>", **when** it opens, **then** I see the offline view from the cache.
- **Given** there's no cache yet, **when** the error shows, **then** the saved-jobs link is hidden.
- **Given** the server answers `426 CLIENT_TOO_OLD`, **when** any request fails this way, **then** the app shows "Update Spine to keep going" with a button opening the store listing, and queued items stay in the outbox.
- **Given** the update screen, **when** it shows, **then** it reads "Update Spine to keep going", "Your company's Spine server needs a newer version of this app. It only takes a minute." and "<n> items waiting to send are kept on this phone and sent after you update.", with "Open App Store" (iOS) or "Open Google Play" (Android).

**Implementation notes**
- Distinguish no network (offline banner) from server errors (this screen).
- The app sends `X-Spine-Client-Version` on every request ([D-071](../prd/12-decisions.md)); server minimum from `MOBILE_MIN_VERSION`.

### US-MOB-11 · Take site photos tagged to a job, even offline
**Feature:** F-MOB-04 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobPhotoCapture`, `MobPhotoCaptureAndroid`, `MobPhotoReview`, `MobPhotoReviewAndroid`
**As** a field user, **I want** to capture photos against a job with no signal, **so that** I never lose evidence.

Legacy: S-11.3, S-04.10 (mobile)

**Acceptance criteria**
- **Given** "Add photos", **when** the camera opens, **then** the job is shown at the top ("Marina office fit-out" with a picker to change it), with flash, shutter and "Done".
- **Given** I take photos, **when** I look at the bottom, **then** I see "<n> taken · saved on this phone" and a thumbnail with the count.
- **Given** I tap "Done", **when** the review opens, **then** I can add a "Caption" per photo, confirm the job, optionally pick a milestone, and tap "Save <n> photos".
- **Given** I saved them offline, **when** I'm back online, **then** they upload and appear on the job's Photos tab on the web.

**Implementation notes**
- API: `POST /files` then `POST /jobs/:id/photos` (outbox).

### US-MOB-12 · See my expenses and their status
**Feature:** F-MOB-05 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobExpensesList`, `MobExpensesListAndroid`
**As** a field user, **I want** a list of the expenses I've submitted, **so that** I know what's approved, rejected or still waiting.

**Acceptance criteria**
- **Given** the Expenses tab, **when** it opens, **then** I see "WAITING TO SYNC" (if any) and "SUBMITTED BY YOU" with category, date, job, amount and status ("Submitted", "Approved", "Rejected").
- **Given** a rejected expense, **when** it's listed, **then** the reviewer's reason shows in red under it.
- **Given** the add button, **when** I tap it, **then** "New expense" opens.
- **Given** another person's expenses, **when** I look, **then** they're never listed.

**Implementation notes**
- API: `GET /expenses?mine=true`.

### US-MOB-13 · Submit an expense with a receipt photo
**Feature:** F-MOB-05 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobExpenseNew`, `MobExpenseNewAndroid`, `MobReceiptCapture`, `MobReceiptCaptureAndroid`
**As** a field user, **I want** to photograph a receipt and submit the expense on the spot, **so that** it isn't lost and I'm reimbursed.

Legacy: S-11.5, S-07.2 (mobile), S-07.3

**Acceptance criteria**
- **Given** "New expense", **when** it opens, **then** I see "Amount (USD)", "Category", "Job", "Date", "Paid by" ("Me — pay me back" / "Company"), "Description" and "RECEIPT".
- **Given** I tap the receipt camera, **when** it opens, **then** a frame guides "Fit the whole receipt inside the frame" with a gallery option.
- **Given** I tap "Submit", **when** it saves, **then** it appears under "WAITING TO SYNC" if offline or "Submitted" once sent.
- **Given** no category or a zero amount, **when** I tap "Submit", **then** the field shows an error.
- **Given** the note "Your office approves it before it's paid back. No signal? It's saved and sent later.", **when** I read it, **then** it's shown on every new expense.

**Implementation notes**
- API: `POST /files`, `POST /expenses` (outbox); Field always passes own-expense capabilities.

### US-MOB-14 · Ask for camera access with a reason
**Feature:** F-MOB-04 · **Priority:** P2 · **Phase:** 5 · **Screens:** `MobCameraPermission`, `MobCameraPermissionAndroid`
**As** a field user, **I want** to know why the app needs the camera before the system asks, **so that** I'm comfortable allowing it.

**Acceptance criteria**
- **Given** the camera hasn't been allowed, **when** I first tap "Add photos" or the receipt camera, **then** I see "Allow camera access", "Spine uses the camera for site photos and receipt pictures. Photos go only to your company's Spine server — never anywhere else." and three reasons.
- **Given** I tap "Continue", **when** the system prompt appears and I allow, **then** the camera opens.
- **Given** I tap "Not now", **when** it closes, **then** I return to where I was.
- **Given** I denied before, **when** the explainer shows, **then** it tells me where to turn it on (iOS "Settings › Spine › Camera"; Android "Settings › Apps › Spine › Permissions").

**Implementation notes**
- Purpose strings in app config ([15-mobile-release](../prd/15-mobile-release.md)).

### US-MOB-15 · Mark a milestone complete from the phone
**Feature:** F-MOB-04 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobMilestoneComplete`, `MobMilestoneCompleteAndroid`
**As** a field user, **I want** to mark a milestone done with photos and a note, **so that** billing can proceed.

Legacy: S-11.6, S-04.4 (mobile)

**Acceptance criteria**
- **Given** a pending milestone, **when** I tap "Mark complete", **then** a sheet shows the milestone and job, "PHOTOS OF THE FINISHED WORK", "NOTE FOR THE OFFICE (OPTIONAL)" and "Mark complete".
- **Given** I complete it, **when** it saves, **then** the job shows it completed (or "Completion waiting" offline) and the office is notified once it reaches the server.
- **Given** the note "Your office is told straight away so they can bill this stage. No signal? It's saved and sent when you're back online.", **when** the sheet opens, **then** it's shown.
- **Given** two people complete the same milestone offline, **when** both sync, **then** it's completed once; the later request gets a success response marked "already completed", its outbox item shows as sent with "Already completed by <name>", and the attempt is recorded in history only.

**Implementation notes**
- API: `POST /jobs/:id/milestones/:milestoneId/complete` (outbox). Completing an already-completed milestone returns 200 with `alreadyCompleted: true` and changes nothing (first completion wins; 02 "Conflicts").

### US-MOB-16 · Present a quote to the customer on my phone
**Feature:** F-MOB-06 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobQuotePresent`, `MobQuotePresentAndroid`, `MobQuoteDecline`, `MobQuoteDeclineAndroid`
**As** a field user, **I want** to show a quote full-screen to the customer, **so that** we can close on the spot.

Legacy: S-11.7, S-03.12

**Acceptance criteria**
- **Given** a job's quote to present, **when** I tap "Present", **then** the quote opens full-screen with "Hand the phone to your customer", the business, "QUOTE <number>", "Prepared for <customer>", valid-until date, lines, Subtotal, Tax, Total and notes.
- **Given** the bottom bar, **when** it renders, **then** it offers "Decline" and "Accept quote".
- **Given** the customer taps "Decline", **when** I'm online, **then** the quote is recorded as declined with an optional comment and the office is notified.
- **Given** I tap "Done", **when** it closes, **then** I'm back on the job.
- **Given** "Decline", **when** it's tapped, **then** a sheet titled "Decline quote" says "<customer> is declining <number> for <total>. <Business>'s office is told straight away.", with "Reason (optional)", a destructive "Decline quote" button and "Cancel"; offline it notes "Needs a connection — declining can't be saved offline."

**Implementation notes**
- API: `GET /jobs/:id/quotes` lists the quotes to present: variation-order quotes on the job and the job's source quote, while `sent` ([D-073](../prd/12-decisions.md)). `GET /quotes/:id` is readable by Field for exactly those quotes. `POST /quotes/:id/reject-in-person` (`quotes.accept_in_person`, body `{ comment? }`) records the decline — contract additions in 05.

### US-MOB-17 · Capture the customer's acceptance and signature
**Feature:** F-MOB-06 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobQuoteAccept`, `MobQuoteAcceptAndroid`, `MobQuoteAccepted`, `MobQuoteAcceptedAndroid`
**As** a field user, **I want** the customer to type their name and sign on my screen, **so that** the acceptance is recorded with proof.

Legacy: S-11.7 · Decision: D-054

**Acceptance criteria**
- **Given** "Accept quote", **when** it opens, **then** I see the customer and total, "Your name", "SIGN BELOW" with "Clear", the statement "By signing, I accept this quote for <total> on behalf of <customer>. Spine records your signature, the time and the <Business> staff member present (<my name>)." and "Accept and sign".
- **Given** no name or no signature, **when** "Accept and sign" is tapped, **then** it stays disabled with a hint.
- **Given** both, **when** it succeeds, **then** "Quote accepted", "<number> · <total>", "Signed by <name> at <time>. <Business>'s office has been told and the quote is now locked." and "Back to job" are shown.
- **Given** the office, **when** it's accepted, **then** Owners and office staff get the in-app notification "Quote <number> was accepted in person." immediately.

**Implementation notes**
- API: `POST /files` (signature PNG), `POST /quotes/:id/accept-in-person` with `signerName` (US-QUO-19).

### US-MOB-18 · Require a connection to accept a quote
**Feature:** F-MOB-06 · **Priority:** P2 · **Phase:** 5 · **Screens:** `MobQuoteNeedsConnection`, `MobQuoteNeedsConnectionAndroid`
**As** an owner, **I want** on-site acceptance to need a live connection, **so that** a price is never locked twice or out of date.

Decision: D-050

**Acceptance criteria**
- **Given** I'm offline, **when** I tap "Present", **then** I see "Quotes need a connection" and "Accepting a quote locks the price, so it has to reach your office straight away. Move somewhere with signal or Wi-Fi, then try again." with "Try again" and "Back to job".
- **Given** I regain signal, **when** I tap "Try again", **then** the quote opens.
- **Given** the screen, **when** it shows, **then** it adds "Photos, expenses and milestone updates still work offline.".

**Implementation notes**
- Android shows this as an alert dialog over the job.

### US-MOB-19 · Run the field app on native tabs
**Feature:** F-MOB-07 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobHome`, `MobHomeAndroid`, `MobHomeDark`, `MobJobDetailDark`
**As** a field user, **I want** the app to feel native on my phone, **so that** it's fast and familiar.

Decision: D-022

**Acceptance criteria**
- **Given** the app, **when** it launches, **then** navigation uses the platform's native tab bar (iOS floating tab bar with SF Symbols; Android Material navigation bar with Material Symbols) for Today, Jobs, Expenses and Profile.
- **Given** a top-level screen on iOS, **when** I scroll, **then** the large title collapses and the system blur appears under the bar.
- **Given** `apps/mobile`, **when** this story is done, **then** it uses expo-router, and `FloatingTabBar` and React Navigation are no longer used by it.
- **Given** dark mode on the phone, **when** the app opens, **then** every screen, including native chrome, follows it.
- **Given** dark mode on iOS, **when** Today and a job open, **then** they match `MobHomeDark` and `MobJobDetailDark`: grouped background `#121110`, cards `#191815`, primary `#6B8AFF` with dark text on filled buttons ([D-099](../prd/12-decisions.md)).

**Implementation notes**
- Migrate `apps/mobile` to expo-router `unstable-native-tabs` (see [native notes](../design/native-notes.md) for the large-title `contentInsetAdjustmentBehavior` rule and the Trigger `name="(group)"` rule).

### US-MOB-20 · Give Android users a designed Material 3 app
**Feature:** F-MOB-07 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobHomeAndroid`, `MobHomeAndroidDark`, `MobJobDetailAndroidDark`
**As** an Android field user, **I want** the app to follow Android conventions, **so that** it doesn't feel like an iPhone app.

Decision: D-051

**Acceptance criteria**
- **Given** every `Mob…Android` artboard, **when** the Android build runs, **then** each screen matches it: top app bar with back arrow, outlined text fields, pill buttons, floating action buttons, bottom sheets and alert dialogs as drawn.
- **Given** Android back gestures, **when** used on any screen, **then** they behave like the drawn back arrow.
- **Given** dark mode on Android, **when** Today and a job open, **then** they use the Material 3 dark roles (`android-dark` in tokens.json) as drawn in `MobHomeAndroidDark` and `MobJobDetailAndroidDark`.
- **Given** a reviewer, **when** they open the app with TalkBack, **then** every control has a spoken label.

**Implementation notes**
- `@expo/ui/jetpack-compose` controls; Material roles from `tokens.json › color.android`.

### US-MOB-21 · Document every native component in a showcase app
**Feature:** F-MOB-07 · **Priority:** P2 · **Phase:** 5 · **Screens:** —
**As** a developer, **I want** each native component shown in a doc app, **so that** I can build screens without reading source.

Finding: C24 · Decision: D-034

**Acceptance criteria**
- **Given** an `@expo/ui`-backed component in `packages/ui-native`, **when** I open `apps/showcase-native`, **then** it has a screen with live examples on iOS and Android.
- **Given** a NativeWind component, **when** I open `apps/design-system-native`, **then** it has a doc screen.
- **Given** the 15 components without a screen today (action-tile, bottom-sheet, context-menu, divider, floating-label-field, form-row, full-width-button, gauge-indicator, kpi-card, scroll-edge-mask, segmented-control, select-list-field, slider, stepper, switch), **when** this story is done, **then** each is documented in one of the two apps.

**Implementation notes**
- Add a coverage check like `check-a11y-coverage.mjs` that fails when a component has no doc screen.
