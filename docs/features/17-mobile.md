# 17 · Mobile field companion

A native iOS and Android app for field crew: sign in once, see today's assigned jobs with addresses and tap-to-call, capture site photos and receipts with no signal, complete milestones, present a quote and take the customer's signature on site, and see what's still waiting to sync. It never shows invoices, payments or reports. It carries the Spine brand — the layered mark on its icon, splash, Welcome and Sign in ([D-203](../prd/12-decisions.md)). Designed native-first (expo-router native tabs, `@expo/ui` SwiftUI and Jetpack Compose controls) for both platforms, and built from scratch on that stack ([D-196](../prd/12-decisions.md)). The designs are in the Claude Design project "Spine Field — mobile app (Phase 5)"; the exported artboards are in `docs/design/screens/Mob*.webp`.

**Throughout the app:** money is shown in the business currency and formatted for the business locale ("$64.20", "₹1,250.00"), never with a trailing currency code. Native tabs Today, Jobs and Expenses plus Search (iOS `role="search"`, a fourth tab on Android); the person's avatar at the top right of every tab opens Profile, and the bell on Today opens Notifications ([D-197](../prd/12-decisions.md)). When the **Jobs & field** module is off, the Jobs tab, job pickers, job cards and job KPIs are hidden and the app is for expenses ([D-198](../prd/12-decisions.md)); when **Leads & meetings** is off, the next meeting is hidden. While a section's first data loads, it shows a skeleton in its own shape; there's no full-page loader, and anything saved on the phone shows at once ([D-201](../prd/12-decisions.md)).

**Screens:** `MobSignIn` (P1), `MobSignInAndroid` (P1), `MobHome` (P1), `MobHomeAndroid` (P1), `MobHomeOffline` (P1), `MobHomeOfflineAndroid` (P1), `MobJobsList` (P1), `MobJobsListAndroid` (P1), `MobJobsEmpty` (P2), `MobJobsEmptyAndroid` (P2), `MobJobDetail` (P1), `MobJobDetailAndroid` (P1), `MobMilestoneComplete` (P1), `MobMilestoneCompleteAndroid` (P1), `MobCameraPermission` (P2), `MobCameraPermissionAndroid` (P2), `MobPhotoCapture` (P1), `MobPhotoCaptureAndroid` (P1), `MobPhotoReview` (P1), `MobPhotoReviewAndroid` (P1), `MobExpensesList` (P1), `MobExpensesListAndroid` (P1), `MobExpenseNew` (P1), `MobExpenseNewAndroid` (P1), `MobReceiptCapture` (P1), `MobReceiptCaptureAndroid` (P1), `MobQuotePresent` (P1), `MobQuotePresentAndroid` (P1), `MobQuoteAccept` (P1), `MobQuoteAcceptAndroid` (P1), `MobQuoteAccepted` (P1), `MobQuoteAcceptedAndroid` (P1), `MobQuoteNeedsConnection` (P2), `MobQuoteNeedsConnectionAndroid` (P2), `MobSyncQueue` (P1), `MobSyncQueueAndroid` (P1), `MobProfile` (P2), `MobProfileAndroid` (P2), `MobError` (P2), `MobErrorAndroid` (P2), `MobSignOutConfirm` (P1), `MobSignOutConfirmAndroid` (P1), `MobJobPhotos` (P2), `MobJobPhotosAndroid` (P2), `MobQuoteDecline` (P2), `MobQuoteDeclineAndroid` (P2), `MobUpdateRequired` (P2), `MobUpdateRequiredAndroid` (P2), `MobSyncFix` (P1), `MobSyncFixAndroid` (P1), `MobHomeDark` (P1), `MobJobDetailDark` (P1), `MobHomeAndroidDark` (P1), `MobJobDetailAndroidDark` (P1), `MobHomeJobs` (P1), `MobHomeJobsAndroid` (P1), `MobSearch` (P1), `MobSearchAndroid` (P1), `MobSearchResults` (P1), `MobSearchResultsAndroid` (P1), `MobExpenseLabour` (P1), `MobExpenseLabourAndroid` (P1), `MobNotifications` (P1), `MobNotificationsAndroid` (P1), `MobNotificationsEmpty` (P2), `MobNotificationsEmptyAndroid` (P2), `MobSearchEmpty` (P2), `MobSearchEmptyAndroid` (P2), `MobSignInDark` (P1), `MobSignInAndroidDark` (P1), `MobSignInKeyboard` (P1), `MobSignInKeyboardAndroid` (P1), `MobSignInError` (P1), `MobSplash` (P1), `MobSplashDark` (P1), `MobSplashAndroid` (P1), `MobSplashAndroidDark` (P1), `MobWelcome` (P1), `MobWelcomeAndroid` (P1), `MobWelcomeDark` (P1), `MobWelcomeAndroidDark` (P1)
**Depends on:** 02 Sign-in (accounts), 07 Jobs (crew, milestones, photos), 10 Purchases (expenses), 06 Quotes (in-person acceptance), `packages/ui-native`, [15-mobile-release](../prd/15-mobile-release.md).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-MOB-01 | Sign in and session | P1 | 5 | `MobSignIn`, `MobSignInAndroid`, `MobSignInDark`, `MobSignInAndroidDark`, `MobSignInKeyboard`, `MobSignInKeyboardAndroid`, `MobSignInError`, `MobProfile`, `MobProfileAndroid` |
| F-MOB-02 | Today, jobs and job detail | P1 | 5 | `MobHome`, `MobHomeAndroid`, `MobJobsList`, `MobJobsListAndroid`, `MobJobsEmpty`, `MobJobsEmptyAndroid`, `MobJobDetail`, `MobJobDetailAndroid` |
| F-MOB-03 | Offline use and sync | P1 | 5 | `MobHomeOffline`, `MobHomeOfflineAndroid`, `MobSyncQueue`, `MobSyncQueueAndroid`, `MobError`, `MobErrorAndroid` |
| F-MOB-04 | Photos and milestone completion | P1 | 5 | `MobPhotoCapture`, `MobPhotoCaptureAndroid`, `MobPhotoReview`, `MobPhotoReviewAndroid`, `MobCameraPermission`, `MobCameraPermissionAndroid`, `MobMilestoneComplete`, `MobMilestoneCompleteAndroid` |
| F-MOB-05 | Expenses with receipts | P1 | 5 | `MobExpensesList`, `MobExpensesListAndroid`, `MobExpenseNew`, `MobExpenseNewAndroid`, `MobReceiptCapture`, `MobReceiptCaptureAndroid` |
| F-MOB-06 | On-site quote acceptance | P1 | 5 | `MobQuotePresent`, `MobQuotePresentAndroid`, `MobQuoteAccept`, `MobQuoteAcceptAndroid`, `MobQuoteAccepted`, `MobQuoteAcceptedAndroid`, `MobQuoteNeedsConnection`, `MobQuoteNeedsConnectionAndroid` |
| F-MOB-07 | Native app foundation | P1 | 5 | `MobHome`, `MobHomeAndroid` |
| F-MOB-09 | Search | P1 | 5 | `MobSearch`, `MobSearchAndroid`, `MobSearchResults`, `MobSearchResultsAndroid`, `MobSearchEmpty`, `MobSearchEmptyAndroid` |
| F-MOB-08 | Notifications on the phone | P1 | 5 | `MobNotifications`, `MobNotificationsAndroid`, `MobNotificationsEmpty`, `MobNotificationsEmptyAndroid` |
| F-MOB-10 | Brand and first run | P1 | 5 | `MobSplash`, `MobSplashDark`, `MobSplashAndroid`, `MobSplashAndroidDark`, `MobWelcome`, `MobWelcomeAndroid`, `MobWelcomeDark`, `MobWelcomeAndroidDark` |

## User stories

### US-MOB-01 · Sign in to my company's Spine on my phone
**Feature:** F-MOB-01 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobSignIn`, `MobSignInAndroid`, `MobSignInDark`, `MobSignInAndroidDark`, `MobSignInKeyboard`, `MobSignInKeyboardAndroid`, `MobSignInError`
**As** a field user, **I want** to sign in with my server address, email and password, **so that** the app connects to my company's Spine.

Legacy: S-11.1 · Decisions: D-049, [D-203](../prd/12-decisions.md), [D-204](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** I tapped "Get started" on Welcome (US-MOB-26), or I'm signed out, **when** Sign in opens, **then** I see the Spine logo (mark over the wordmark) on an illustration — the brand glow, dashed orbits and three faded cards (today's job, photos, a milestone) fading into the page — then "Sign in", "Use the email your office invited you with.", "Server", "Email", "Password" and "Sign in".
- **Given** a server address that isn't a Spine server or is unreachable, **when** I sign in, **then** I see "Can't reach that server. Check the address — it's the link you open Spine with on a computer.".
- **Given** wrong credentials, **when** I sign in, **then** I see "That email and password don't match. Check both, or reset your password." under the fields, and what I typed stays.
- **Given** I tap "Forgot password?", **when** it opens, **then** the server's reset page (US-AUTH-09) opens in the phone's browser (D-052).
- **Given** an error, **when** it shows, **then** it sits under the field it's about (the server error under "Server").
- **Given** the keyboard opens, **when** I type, **then** the illustration folds away to the horizontal logo so the fields and "Sign in" stay above the keyboard, and it comes back when the keyboard closes.
- **Given** Sign in, **when** it's on screen, **then** only the orbits drift and the sparkles twinkle, slowly, with no intro animation; with Reduce Motion (iOS) or Remove animations (Android) nothing moves.
- **Given** VoiceOver or TalkBack, **when** Sign in opens, **then** the logo is read as "Spine" and the rest of the illustration is skipped.
- **Given** dark mode, **when** Sign in opens, **then** it matches `MobSignInDark` / `MobSignInAndroidDark`, with the light-text wordmark.
- **Given** valid details, **when** I sign in, **then** I land on Today.

**Implementation notes**
- API: Better Auth sign-in (`POST <api>/api/auth/sign-in/email`), keeping the bearer token from `set-auth-token`; stored with expo-secure-store; sent as Bearer (D-016). The typed address is checked with `GET /health` at `<address>/api`, then at `<address>` (`service: "spine"`); "Forgot password?" opens `<appUrl>/forgot-password`.
- UI: `FloatingLabelField` rows in a `FormSection` on iOS, `OutlinedTextField`s on Android; the password uses its `secureTextEntry` (always the RN text field — `@expo/ui`'s field has no secure mode). The logo is `SpineLogo` (US-MOB-27); the header illustration shares its parts with Welcome's (US-MOB-26).

### US-MOB-02 · Stay signed in and sign out safely
**Feature:** F-MOB-01 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobProfile`, `MobProfileAndroid`, `MobSignOutConfirm`, `MobSignOutConfirmAndroid`
**As** a field user, **I want** to stay signed in until I sign out, **so that** I'm not typing passwords on site.

Legacy: S-11.1

**Acceptance criteria**
- **Given** I signed in, **when** I reopen the app days later within the session lifetime, **then** I'm on Today without signing in again.
- **Given** I tap my avatar at the top right of any tab, **when** Profile opens (a sheet on iOS, a page on Android), **then** it shows my name, "Field · <Business>", email, server, appearance, sync status, "Field accounts don't show invoices, payments or reports. Ask your office if you need something changed on your account." and "Sign out".
- **Given** items are waiting to sync, **when** I tap "Sign out", **then** I'm warned "<N> items haven't reached your office yet. Sign out anyway?" before anything is discarded.
- **Given** my membership is deactivated, **when** the app next calls the server, **then** I'm signed out with "Your access to <Business> was removed.".
- **Given** the sign-out warning, **when** it shows, **then** it explains "<n> site photos and <n> expense are still waiting to sync. Signing out deletes them from this phone." and offers "Send them first" (opens Sync), "Sign out anyway" (destructive) and "Cancel"; Android shows a Material dialog with "Cancel", "Send first" and "Sign out".

**Implementation notes**
- API: Better Auth sign-out (revokes the session). A deactivated member's requests answer 403 `ACCESS_REMOVED` everywhere (`ActiveMemberGuard`), and the app signs out with that message. `GET /org/members/me` gives `organizationName` for "Field · <Business>".

### US-MOB-03 · See today's jobs with addresses and tap-to-call
**Feature:** F-MOB-02 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobHome`, `MobHomeAndroid`, `MobHomeJobs`, `MobHomeJobsAndroid`
**As** a field user, **I want** today's assigned jobs on the home screen with directions and a call button, **so that** I can just go.

Legacy: S-11.2

**Acceptance criteria**
- **Given** Today, **when** it opens, **then** a welcome card shows "Good morning, <first name>", the business and date, and a gauge of the milestones completed this month on my jobs ("3 of 5 done"), as in the showcase-native home.
- **Given** the "This week" / "This month" / "This year" switch, **when** I change it, **then** the KPI cards and the gauge follow it. The swipeable KPI cards are milestones due, milestones overdue, photos taken (with how many are waiting) and my own expenses (total, and how many wait for approval); there are no other money figures (D-048).
- **Given** Today's header, **when** it renders, **then** it shows the sync pill, the bell with the unread count, and my avatar.
- **Given** Today, **when** it opens, **then** "Add photo" and "Log expense" sit under the KPI cards as action tiles on both platforms, with "Scan receipt" and "Directions" (to the first of today's sites) beside them as drawn, above the jobs and the next meeting ([D-197](../prd/12-decisions.md)).
- **Given** an assigned job, **when** Today decides what to show, **then** it lists the job only if its status is "Active" and it has a pending milestone that is overdue or due within the next 7 days; other assigned jobs are only on the Jobs tab.
- **Given** I'm on two such jobs, **when** Today opens, **then** I see the date, "Today", my next meeting, "YOUR JOBS TODAY · 2" and a card per job with name, customer, site address and its next milestone with a due chip ("Due Sat", or "<n> days late" in the overdue colour). "NEXT MEETING" is my next meeting in the next 7 days, and is hidden when there is none or Leads & meetings is off.
- **Given** a job card, **when** I tap "Call <contact name>" inside the card (iOS: full name, "Call Alan Reyes"; Android: first name, "Call Alan"), **then** the phone dialler opens with the job contact's number.
- **Given** a job card, **when** I tap "Directions", **then** the maps app opens at the site address.
- **Given** the header, **when** everything has synced, **then** a pill reads "All synced".

**Implementation notes**
- API: `GET /mobile/today?period=` (gauge and KPI figures, built), `GET /jobs?assignedToMe=true&include=next_milestone,site_contact,milestone_counts` (job cards; who to call is `siteContact`), `GET /meetings/upcoming?attending=true&withinDays=7`, `GET /org/modules`, `GET /notifications/unread-count`; `GET /org/members/me` gives the business currency and locale.
- UI: expo-router native tabs Today · Jobs · Expenses, Profile from the avatar ([D-197](../prd/12-decisions.md)); `GaugeIndicator`, `SegmentedControl`, `KpiCard`, `ActionTile`, `StatusChip` from `@spine/ui-native`. Every read is cached on the phone (SQLite) and shown first.
- The Add photo, Log expense and Scan receipt tiles open their flows once US-MOB-11 and US-MOB-13 land; until then they say the feature arrives in the next update.

### US-MOB-04 · Browse my assigned jobs
**Feature:** F-MOB-02 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobJobsList`, `MobJobsListAndroid`, `MobJobsEmpty`, `MobJobsEmptyAndroid`
**As** a field user, **I want** a list of every job I'm on, **so that** I can find one that isn't today's.

**Acceptance criteria**
- **Given** the Jobs tab, **when** it opens, **then** I see "ASSIGNED TO YOU · <n>" with each job's name, customer, town and milestone status.
- **Given** I want a job that isn't on the list's first screen, **when** I look for it, **then** I use the Search tab (US-MOB-23); the Jobs list has no search field of its own.
- **Given** I pull down, **when** I release, **then** the list refreshes.
- **Given** I'm on no jobs, **when** I open the tab, **then** I see "No jobs assigned to you yet", "When your office adds you to a job's crew, it shows up here with its address and contact." and "Check again".

**Implementation notes**
- API: `GET /jobs?assignedToMe=true&include=next_milestone,site_contact,milestone_counts` ("All milestones complete" from `milestoneCounts`; the town is read from the site address).
- Demo data: the demo Field user (Marcus Webb) is put on the crew of the demo's jobs, so the app has something to show after loading a demo business (the seeder adds `job_assignments`); the first demo job's first milestone is due within the week, so Today has a job.

### US-MOB-05 · Open a job's details on site
**Feature:** F-MOB-02 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobJobDetail`, `MobJobDetailAndroid`, `MobJobPhotos`, `MobJobPhotosAndroid`
**As** a field user, **I want** a job's address, contact, milestones, photos and quotes to present, **so that** I have what I need on site.

**Acceptance criteria**
- **Given** I open a job, **when** it loads, **then** I see its name, "<job number> · <customer>", status, the site address with "Directions", the contact with a call button, "MILESTONES", "PHOTOS · <n>" with "See all" and "QUOTES TO PRESENT". "Add photos" is the camera button in the toolbar on iOS and a floating button on Android.
- **Given** a pending milestone, **when** I view it, **then** it shows its due date and "Mark complete"; a completed one shows "Completed" and a queued completion "Completion waiting".
- **Given** a quote waiting for the customer, **when** I view it, **then** it shows "Present".
- **Given** the job's contract value, milestone amounts or invoices, **when** I look anywhere on the screen, **then** none are shown (D-048).
- **Given** "PHOTOS · <n>", **when** I tap "See all", **then** "Photos · <n>" opens with the job name and number, photos grouped by day newest first, a "Waiting" badge on photos not yet sent, and "Add photos".

**Implementation notes**
- API: `GET /jobs/:id` (with `siteContact`), `GET /jobs/:id/milestones`, `GET /jobs/:id/photos`, `GET /jobs/:id/quotes` (built, [D-073](../prd/12-decisions.md)); photos load from `GET /files/:id` with the bearer token. Field gets assigned jobs only, without money fields (US-JOB-19).
- "Mark complete" (US-MOB-15), "Add photos" (US-MOB-11) and "Present" (US-MOB-16) are drawn now and open their flows when those stories land.
- The subtitle shows the job number next to the customer ("JOB-007 · Alan Brooks", US-JOB-22).

### US-MOB-06 · Keep financial reports off phones
**Feature:** F-MOB-02 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobProfile`, `MobJobDetail`
**As** an owner, **I want** the mobile app to show no financial reports, **so that** sensitive figures aren't on every phone.

Legacy: S-11.8 · Decision: D-048

**Acceptance criteria**
- **Given** any user signs in on mobile (Owner, Staff or Field), **when** they use the app, **then** there are no screens for invoices, payments, receivables, payables or reports.
- **Given** the app's API calls, **when** inspected, **then** it never requests report or invoice endpoints.
- **Given** money shown on mobile, **when** it appears, **then** it's only the user's own expenses or the quote being presented, in the business currency and locale.

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
- SQLite cache + outbox (02-architecture §Offline sync); airplane-mode end-to-end test (`e2e/us-mob-07-offline.yaml`, Android).
- The banner follows the phone's own connection (expo-network); back online, every screen showing saved data fetches again and the outbox sends.
- Photos, expenses and completions go in through `outbox.addPhotos`, `addExpense` and `addCompletion` (`apps/mobile/src/lib/outbox`); the screens that call them are US-MOB-11, US-MOB-13 and US-MOB-15.

### US-MOB-08 · See what's waiting to sync
**Feature:** F-MOB-03 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobSyncQueue`, `MobSyncQueueAndroid`
**As** a field user, **I want** to see how many items are waiting and what they are, **so that** I know when I'm safe.

Legacy: S-11.4

**Acceptance criteria**
- **Given** waiting items, **when** I look at the header, **then** the pill reads "<n> waiting to sync" in the due-soon colour.
- **Given** I tap the pill on Today (or the sync row in Profile), **when** Sync opens, **then** I see "<n> items waiting" with the reason (e.g. "You're offline · sends automatically when you reconnect"), "NEEDS FIXING · <n>" when something was rejected, a "WAITING" list (what, which job, when), and "SENT TODAY".
- **Given** I tap "Try sending now", **when** I'm online, **then** waiting items send immediately.
- **Given** everything sent, **when** I view the pill, **then** it reads "All synced".

**Implementation notes**
- Outbox status per item: `waiting`, `sending`, `sent`, `failed`. The pill counts items not yet sent (a batch of photos is one item), including those needing fixing; "SENT TODAY" keeps today's sent items and drops older ones.
- Sync is a page sheet on iOS (Close) and a page on Android, opened from the pill, Profile's Sync row and the sign-out warning's "Send them first".

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
- Each outbox item's id is its `Idempotency-Key`; each step uses a key derived from it, and progress is saved after every step. Photos are compressed before queueing (long edge at most 2048 px, JPEG 70%, D-053) and checked against 10 MB on the phone before upload.
- A milestone someone else completed first is "sent" and reads "Already completed by <name>" (first write wins, 02-architecture).
- Fix uses the camera or photo library (`expo-image-picker`); without permission it offers Settings. US-MOB-14 adds the explanation before the first request.

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
- API: `POST /files` then `POST /jobs/:id/photos` (outbox), with the photo's caption and optional `milestoneId`.
- The in-app camera is `expo-camera` behind the camera explainer (US-MOB-14); photos are compressed (D-053) and kept in the app's own folder until sent. Closing with photos taken asks "Discard <n> photos?". iOS's "Retake" drops the photo shown and goes back to the camera; "+" takes more.
- Opened from "Add photos" on a job and its Photos, and from Today's "Add photo" (today's first job, changeable).

### US-MOB-12 · See my expenses and their status
**Feature:** F-MOB-05 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobExpensesList`, `MobExpensesListAndroid`
**As** a field user, **I want** a list of the expenses I've submitted, **so that** I know what's approved, rejected or still waiting.

**Acceptance criteria**
- **Given** the Expenses tab, **when** it opens, **then** I see "WAITING TO SYNC" (if any) and "SUBMITTED BY YOU" with category, date, job, amount and status ("Submitted", "Approved", "Rejected").
- **Given** a rejected expense, **when** it's listed, **then** the reviewer's reason shows in red under it.
- **Given** the add button ("+" in the toolbar on iOS, a floating "Log expense" button on Android), **when** I tap it, **then** "New expense" opens.
- **Given** the Approvals module is off, **when** an expense reaches the server, **then** it's listed as "Approved" straight away.
- **Given** another person's expenses, **when** I look, **then** they're never listed.

**Implementation notes**
- API: `GET /expenses?mine=true` (rows carry `reviewerName` for "— Sarah Mendes"); waiting rows come from the outbox, and a refused one opens Fix.

### US-MOB-13 · Submit an expense with a receipt photo
**Feature:** F-MOB-05 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobExpenseNew`, `MobExpenseNewAndroid`, `MobReceiptCapture`, `MobReceiptCaptureAndroid`, `MobExpenseLabour`, `MobExpenseLabourAndroid`
**As** a field user, **I want** to photograph a receipt and submit the expense on the spot, **so that** it isn't lost and I'm reimbursed.

Legacy: S-11.5, S-07.2 (mobile), S-07.3

**Acceptance criteria**
- **Given** "New expense", **when** it opens, **then** I see "Amount (<business currency code>)", "Category", "Job" (hidden when Jobs & field is off), "Date", "Paid by" ("Me — pay me back" / "Company"), "Description" and "RECEIPT". It doesn't ask which account paid: that's the organisation's default, and the approver can change it (US-BANK-03).
- **Given** I tap the receipt camera, **when** it opens, **then** a frame guides "Fit the whole receipt inside the frame" with a gallery option.
- **Given** I tap "Submit", **when** it saves, **then** it appears under "WAITING TO SYNC" if offline or "Submitted" once sent.
- **Given** no category or a zero amount, **when** I tap "Submit", **then** the field shows "Choose a category." or "Enter an amount above zero." under it.
- **Given** a receipt photo over 10 MB after compression, **when** I attach it, **then** the phone says so before it's queued.
- **Given** the "Amount" / "Headcount × day rate" switch ([D-199](../prd/12-decisions.md), US-PUR-23), **when** I choose "Headcount × day rate", **then** the amount is replaced by "TRADES" rows of trade, workers and day rate with each row's total, "Add trade" and "Total for the day"; "Job" becomes required ("Labour is always for a job — choose one."); the category posting to 5200 Direct Labour is preselected; a trade I've used before is suggested with its last day rate; and a row with no trade, workers or day rate shows "Every row needs a trade, at least one worker and a day rate.". It never asks for names, attendance or hours, and it queues offline like any expense (`entryMode: "labour"`, `labourLines`).
- **Given** the note "Your office approves it before it's paid back. No signal? It's saved and sent later.", **when** I read it, **then** it's shown on every new expense.

**Implementation notes**
- API: `POST /files`, `POST /expenses` (outbox); Field always passes own-expense capabilities. `GET /expense-categories` (Direct Labour preselected by `accountCode` 5200), `GET /expenses/labour-trades` (Field: their own trades only).
- The receipt camera is the same in-app camera with the frame; "Scan receipt" on Today opens New expense straight into it. A receipt photo is "Take a photo" or "Choose a photo" (expo-image-picker).
- Fix's "Edit expense" opens this form on the refused item; "Send" saves the change and sends it again (US-MOB-09).

### US-MOB-14 · Ask for camera access with a reason
**Feature:** F-MOB-04 · **Priority:** P2 · **Phase:** 5 · **Screens:** `MobCameraPermission`, `MobCameraPermissionAndroid`
**As** a field user, **I want** to know why the app needs the camera before the system asks, **so that** I'm comfortable allowing it.

**Acceptance criteria**
- **Given** the camera hasn't been allowed, **when** I first tap "Add photos" or the receipt camera, **then** I see "Allow camera access", "Spine uses the camera for site photos and receipt pictures. Photos go only to your company's Spine server — never anywhere else." and three reasons.
- **Given** I tap "Continue", **when** the system prompt appears and I allow, **then** the camera opens.
- **Given** I tap "Not now", **when** it closes, **then** I return to where I was.
- **Given** I denied before, **when** the explainer shows, **then** it tells me where to turn it on (iOS "Settings › Spine › Camera"; Android "Settings › Apps › Spine › Permissions").

**Implementation notes**
- Purpose strings in app config ([15-mobile-release](../prd/15-mobile-release.md)): `expo-camera` and `expo-image-picker` plugins in `apps/mobile/app.json`, no microphone.
- Where to turn it on is shown under the buttons, as drawn; once refused for good, "Continue" reads "Open Settings" and opens them.

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
- API: `POST /jobs/:id/milestones/:milestoneId/complete` (outbox). Completing an already-completed milestone returns 201 with `alreadyCompleted: true` and `completedBy`, and changes nothing (first completion wins; 02 "Conflicts"; built with the outbox in Group 3).
- A sheet on both platforms; "Add" opens the in-app camera, which hands the photos back.

### US-MOB-16 · Present a quote to the customer on my phone
**Feature:** F-MOB-06 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobQuotePresent`, `MobQuotePresentAndroid`, `MobQuoteDecline`, `MobQuoteDeclineAndroid`
**As** a field user, **I want** to show a quote full-screen to the customer, **so that** we can close on the spot.

Legacy: S-11.7, S-03.12

**Acceptance criteria**
- **Given** a job's quote to present, **when** I tap "Present", **then** the quote opens full-screen with "Hand the phone to your customer", the business, "QUOTE <number>", "Prepared for <customer>", valid-until date, lines, Subtotal, each tax line as on the PDF (e.g. "Sales Tax (15%)", or CGST and SGST in India), Total and notes.
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
- **Given** the app, **when** it launches, **then** navigation uses the platform's native tab bar (iOS Liquid Glass tab bar with SF Symbols; Android Material navigation bar with Material Symbols) for Today, Jobs and Expenses plus Search (the iOS search role, an ordinary fourth tab on Android), and Profile opens from the avatar in each tab's header ([D-197](../prd/12-decisions.md)).
- **Given** a top-level screen on iOS, **when** I scroll, **then** the large title collapses and the system blur appears under the bar.
- **Given** `apps/mobile`, **when** this story is done, **then** it is a new expo-router app built on `@spine/ui-native` the way `apps/showcase-native` is, and the old React Navigation app is gone ([D-196](../prd/12-decisions.md)).
- **Given** dark mode on the phone, **when** the app opens, **then** every screen, including native chrome, follows it.
- **Given** dark mode on iOS, **when** Today and a job open, **then** they match `MobHomeDark` and `MobJobDetailDark`: grouped background `#121110`, cards `#191815`, primary `#6B8AFF` with dark text on filled buttons ([D-099](../prd/12-decisions.md)).

**Implementation notes**
- Rebuild `apps/mobile` from scratch with `node scripts/create-native-app.mjs mobile --router=expo-router` on expo-router `unstable-native-tabs` (see [native notes](../design/native-notes.md) for the large-title `contentInsetAdjustmentBehavior` rule and the Trigger `name="(group)"` rule).

### US-MOB-20 · Give Android users a designed Material 3 app
**Feature:** F-MOB-07 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobHomeAndroid`, `MobHomeAndroidDark`, `MobJobDetailAndroidDark`
**As** an Android field user, **I want** the app to follow Android conventions, **so that** it doesn't feel like an iPhone app.

Decision: D-051

**Acceptance criteria**
- **Given** every `Mob…Android` artboard, **when** the Android build runs, **then** each screen matches it: top app bar with back arrow, outlined text fields, pill buttons, floating action buttons ("Add photos" on a job and its photos, "Log expense" on Expenses), bottom sheets and alert dialogs as drawn.
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

### US-MOB-22 · See my notifications on the phone
**Feature:** F-MOB-08 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobNotifications`, `MobNotificationsAndroid`, `MobNotificationsEmpty`, `MobNotificationsEmptyAndroid`
**As** a field user, **I want** a list of what happened to my expenses, crews and meetings, **so that** I don't miss a rejection or a new job.

**Acceptance criteria**
- **Given** unread notifications, **when** Today renders, **then** the bell in the header shows the unread count ("9+" above nine).
- **Given** I tap the bell, **when** Notifications opens, **then** I see "NEW" and "EARLIER", each item with an icon, a message, a detail line and a time; unread items carry a dot (iOS) or a tinted row (Android).
- **Given** a Field user, **when** notifications are created, **then** they get their expense approved ("Sarah Mendes approved your expense") or rejected (with the reason), being added to or removed from a job's crew, and meeting invitations, changes and starting-soon reminders — never anything about money they can't see.
- **Given** I tap a notification, **when** it opens, **then** I land on the expense, job or meeting and it's marked read; "Read all" marks every one read.
- **Given** no notifications, **when** I open the list, **then** I see "You're all caught up" and "Expense decisions, crew changes and meeting invitations show up here."
- **Given** a module is switched off, **when** something in it happens, **then** no notification is sent (US-SET-24).

**Implementation notes**
- API: the web bell's notification routes, read with the bearer session; rows carry `detail` (the second line). New in-app types: `expense_rejected`, `crew_assigned`, `crew_removed`; `expense_approved` now also goes to the submitter ("Sarah Mendes approved your expense").
- A notification opens its job (`/jobs/<id>`), expense (`/expenses/<id>`, read-only) or meeting (`/meetings?id=<id>` → the meeting, read-only); other links just mark it read.
- No push to the lock screen in 1.0 ([D-200](../prd/12-decisions.md)): the list refreshes when the app opens or comes back to the foreground, and on pull to refresh.

### US-MOB-23 · Search my jobs and my expenses
**Feature:** F-MOB-09 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobSearch`, `MobSearchAndroid`, `MobSearchResults`, `MobSearchResultsAndroid`, `MobSearchEmpty`, `MobSearchEmptyAndroid`
**As** a field user, **I want** one place to find a job or an expense by typing, **so that** I don't scroll through lists on site.

Decision: [D-197](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** the app, **when** it renders the tabs, **then** Search sits beside Today, Jobs and Expenses: on iOS as the tab bar's search button (`role="search"`), on Android as a fourth tab labelled "Search".
- **Given** the Search tab, **when** it opens with nothing typed, **then** I see "Search jobs and expenses", my recent searches (up to 10, newest first, kept only on this phone) and "Find a job by name, customer or address, or one of your expenses by category or description."; iOS offers "Edit" and Android "Clear" to remove them.
- **Given** I type, **when** I pause, **then** results appear grouped as "JOBS · <n>" (my assigned jobs matching name, customer, job number or site address) and "YOUR EXPENSES · <n>" (my own expenses matching category, description or job), with the matching text highlighted; a group with no matches is left out.
- **Given** a result, **when** I tap it, **then** the job opens in the Jobs tab or the expense opens in the Expenses tab, and the search is added to my recent searches.
- **Given** nothing matches, **when** the results would be empty, **then** I see "No results for “<query>”" and "Search covers the jobs you're on and your own expenses. Try a customer name, a street or an expense category."
- **Given** I'm offline, **when** I search, **then** it searches the phone's cache, including expenses still waiting to sync (shown with "Waiting").
- **Given** a Field user, **when** they search, **then** other people's expenses, unassigned jobs, invoices and money figures other than their own expenses never appear (D-048).
- **Given** Jobs & field is off, **when** I search, **then** only my expenses are searched and the jobs group is hidden (D-198).

**Implementation notes**
- Searches the local SQLite cache (jobs and expenses already synced plus the outbox) — no new API; matching is case- and accent-insensitive and runs as you type with a short debounce. Opening Search refreshes the cached jobs and expenses when there's a connection.
- Recent searches live in the same per-device storage as the appearance setting, never on the server.

### US-MOB-24 · Recognise Spine on my home screen
**Feature:** F-MOB-10 · **Priority:** P1 · **Phase:** 5 · **Screens:** —
**As** a field user, **I want** the Spine icon on my phone, **so that** I find the app at a glance.

Decision: [D-203](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** an iPhone, **when** the app is installed, **then** its icon is the layered mark on the teal-to-blue gradient, edge to edge (iOS rounds the corners), as drawn on the canvas "10 Brand and app icon".
- **Given** iOS 18 or later with dark or tinted icons, **when** the home screen draws the app, **then** it uses the dark version (the mark on iOS's dark backdrop) or the tinted one (a greyscale silhouette iOS colours).
- **Given** an Android phone, **when** the app is installed, **then** the launcher shows an adaptive icon — the gradient as the background layer and the mark as the foreground, inside the 66 dp safe circle — so a circle, squircle, rounded square or teardrop never clips the mark.
- **Given** Android 13 or later with themed icons on, **when** the launcher draws the app, **then** it shows the one-colour silhouette in the phone's colours.
- **Given** the store listings, **when** the app is published, **then** the App Store uses the 1024 px master and Google Play the 512 px full-bleed version.
- **Given** `apps/mobile/assets`, **when** this story is done, **then** Expo's placeholder icon and splash images are gone.

**Implementation notes**
- Source art: `docs/logos/spine-app-icon-ios.svg` and `spine-app-icon-android.svg`, made full bleed (no baked-in corners or circle); the adaptive foreground is the mark at 62% of the 108 dp canvas and the monochrome silhouette (from `spine-logo-black.svg`) at 37.5%. The derived SVGs are committed next to the PNGs so they can be exported again.
- `app.json`: `ios.icon` `{ light, dark, tinted }`, `android.adaptiveIcon` `{ foregroundImage, backgroundImage, monochromeImage }`; needs a native rebuild. No notification icon — the app doesn't push ([D-200](../prd/12-decisions.md)).

### US-MOB-25 · See Spine while the app opens
**Feature:** F-MOB-10 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobSplash`, `MobSplashDark`, `MobSplashAndroid`, `MobSplashAndroidDark`
**As** a field user, **I want** a clean branded screen while the app starts, **so that** I know it's opening and never see a blank or white flash.

Decision: [D-204](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** a cold start, **when** the app launches, **then** the splash shows the gradient mark, 96 dp, centred on the page colour — `#F7F6F3` in light mode, `#121110` in dark — and nothing else (no wordmark, spinner or tagline).
- **Given** Android 12 or later, **when** the app launches, **then** the system splash shows the same mark and colour, with no second splash after it.
- **Given** the app is restoring the session, **when** the first screen isn't ready, **then** the splash stays and hides as soon as Today, Welcome or Sign in has drawn; it never waits on the network.
- **Given** the first launch, **when** the splash hides, **then** Welcome's mark starts from the same place and size, so the hand-off doesn't jump.

**Implementation notes**
- `expo-splash-screen` config plugin: `splash-mark.png`, `imageWidth: 96`, `backgroundColor` light and `dark.backgroundColor`. The root layout calls `SplashScreen.preventAutoHideAsync()` and `hideAsync()` once the session state is known and the first screen has laid out. Needs a native rebuild.

### US-MOB-26 · Get a welcome the first time I open the app
**Feature:** F-MOB-10 · **Priority:** P1 · **Phase:** 5 · **Screens:** `MobWelcome`, `MobWelcomeAndroid`, `MobWelcomeDark`, `MobWelcomeAndroidDark`
**As** a new field user, **I want** to see what the app is for before I sign in, **so that** I know why my office asked me to install it.

Decision: [D-204](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** the first launch after install, **when** the splash hides, **then** I see Welcome: an illustration, "Today's jobs, in your pocket", "Photos, expenses and sign-offs reach your office — even when there's no signal.", "Get started" and "Your office sets up your account — you'll sign in next."
- **Given** Welcome opens, **when** it animates, **then** the mark rises from the splash and its three layers breathe apart and settle; five cards — today's job, "3 photos saved", a fuel receipt, a signed quote and a completed milestone — slide out from behind it; then the words and the button fade up. It's still within about 1.4 seconds, after which the cards float gently while Welcome is on screen.
- **Given** the animation is running, **when** I tap "Get started", **then** it works straight away.
- **Given** I tap "Get started", **when** it responds, **then** Sign in opens and Welcome isn't shown again on this phone — not after signing out, not after an update.
- **Given** I'm already signed in when this version is installed, **when** the app opens, **then** I go straight to Today and Welcome is skipped for good.
- **Given** Reduce Motion (iOS) or Remove animations (Android), **when** Welcome opens, **then** it appears already in its final state and nothing moves.
- **Given** VoiceOver or TalkBack, **when** Welcome opens, **then** the illustration is skipped and I hear the headline (a heading), the sentence, "Get started" (a button) and the footer.
- **Given** Android back on Welcome, **when** I press it, **then** the app closes.
- **Given** dark mode, **when** Welcome opens, **then** it matches `MobWelcomeDark` / `MobWelcomeAndroidDark`: the brand colours stay, the cards use the dark surface with a hairline border.
- **Given** large text, **when** Welcome opens, **then** the illustration shrinks first and the words scroll; "Get started" stays reachable.

**Implementation notes**
- Route `app/welcome.tsx`, shown by the root layout when nobody is signed in and the "Welcome seen" flag isn't set; the flag lives in the app's own key-value store (`expo-sqlite/kv-store`), not the keychain, so deleting the app and installing it again shows Welcome again.
- Motion with Reanimated 4 shared values on the UI thread and `react-native-svg` for the orbits and signature; `useReducedMotion()` turns it off. The idle loop stops when Welcome loses focus or the app goes to the background. Timings and easing are on the canvas "11 Splash and Welcome" (Welcome A storyboard).
- The cards are drawn with `@spine/ui-native` tokens; brand colours only in the mark, glow, orbits and sparkles (US-MOB-27).

### US-MOB-27 · Use the Spine brand the same way everywhere in the app
**Feature:** F-MOB-10 · **Priority:** P1 · **Phase:** 5 · **Screens:** —
**As** a developer, **I want** the brand colours as tokens and the logo as one component, **so that** every screen draws the same logo the same way.

Decision: [D-203](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** `docs/design/tokens.json`, **when** this story is done, **then** `color.brand` holds teal `#04E9BC`, sky `#51A5F8` and deep `#054DC1`, and `color.gradients.brand` holds the icon gradient (teal → deep) and the three layer gradients (top `#5DF3BD` → `#10A9C2`, middle `#A8E1E3` → `#63A4E0`, base `#69AAE1` → `#0545AF`) — the same in light and dark — and `packages/ui-native/src/tokens` exposes them.
- **Given** a screen needs the logo, **when** it renders `SpineLogo` from `@spine/ui-native`, **then** it draws the mark, the horizontal lockup or the vertical lockup from the supplied SVG paths, with the wordmark in primary in light mode and the light-text wordmark in dark mode.
- **Given** `SpineLogo`, **when** a screen reader reaches it, **then** it's read as "Spine", unless the screen marks it decorative.
- **Given** a size below the minimum (20 dp for the mark, 96 dp wide for a lockup), **when** asked for, **then** `SpineLogo` draws it at the minimum.
- **Given** text, buttons and status, **when** they're drawn, **then** they keep the primary and status tokens; brand colours appear only in the logo, the app icon, the splash and illustrations.
- **Given** `SpineLogo`, **when** this story is done, **then** it has a doc screen in `apps/design-system-native` and an accessibility test.
- **Given** the web app and the web design system, **when** they draw the logo, **then** they use the same artwork through `@spine/ui`'s own `SpineLogo` (US-SET-26, [D-206](../prd/12-decisions.md)).

**Implementation notes**
- The logo SVGs are `docs/logos/spine-logo*.svg`; `SpineLogo` renders their paths with `react-native-svg` (no image files), so it stays sharp at every size and follows dark mode.

