# 14 · Notifications

How Spine tells people something happened: an in-app bell with a drawer of recent notifications, optional browser push to each device, emails, meeting invitations and starting-soon reminders. All channels share one trigger and respect who's allowed to see the underlying record. Every outgoing email uses one branded layout.

**Screens:** `NotificationDrawer` (P1), `NotificationDrawerEmpty` (P1), `SettingsPush` (P2), `SettingsMeetingReminders` (P2), `ProfilePreferences` (P1), `EmailMeetingInvite` (P2), `EmailMilestoneCompleted` (P3), `EmailExpenseApproved` (P3), `EmailBrandedQuote` (P2), `AppShellPhone` (P1), `EmailDailyDigest` (P2), `ProfileNotifications` (P2)
**Depends on:** every module that emits events; 18 Self-hosting (SMTP, VAPID keys).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-NTF-01 | In-app notification centre | P1 | 1 | `NotificationDrawer`, `NotificationDrawerEmpty`, `AppShellPhone` |
| F-NTF-02 | Browser push notifications | P2 | 1 | `SettingsPush` |
| F-NTF-03 | Meeting invitation notifications | P2 | 1 | `EmailMeetingInvite`, `NotificationDrawer` |
| F-NTF-04 | Meeting starting-soon reminders | P2 | 1 | `SettingsMeetingReminders`, `ProfilePreferences` |
| F-NTF-05 | Branded email layout and per-user push opt-in | P2 | 6 | `EmailBrandedQuote`, `EmailMilestoneCompleted`, `EmailExpenseApproved`, `ProfilePreferences` |
| F-NTF-06 | Daily digest | P2 | 7 | `EmailDailyDigest`, `ProfileNotifications` |

## User stories

### US-NTF-01 · See recent notifications from the bell
**Feature:** F-NTF-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `NotificationDrawer`, `NotificationDrawerEmpty`
**As** an owner or staff member, **I want** a bell with an unread count and a panel of recent notifications, **so that** I don't rely on email to notice things.

Legacy: S-10.11

**Acceptance criteria**
- **Given** unread notifications, **when** I look at the sidebar footer, **then** the bell shows the unread count ("9+" above nine).
- **Given** I press the bell, **when** the drawer opens from the right, **then** it's titled "Notifications" with "Recent activity across the org." and lists items newest first, each with a message, time and link.
- **Given** I click an item, **when** it opens, **then** I'm taken to its record and the item is marked read.
- **Given** none, **when** I open the drawer, **then** I see "No notifications yet" and "You'll see updates here as they happen.".
- **Given** a phone-width browser, **when** I open the bell from the top bar, **then** the drawer fills the screen width.

**Implementation notes**
- API: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:id/read`.
- Data: `notifications` (`recipient_user_id`, `type`, `message`, `link`, `read_at`).
- UI: `notification-bell.tsx`, `notification-drawer.tsx`.

### US-NTF-02 · Mark notifications as read everywhere
**Feature:** F-NTF-01 · **Priority:** P2 · **Phase:** 1 · **Screens:** `NotificationDrawer`
**As** a member, **I want** read state to persist and a "mark all read", **so that** the count stays meaningful on every device.

**Acceptance criteria**
- **Given** unread items, **when** I choose "Mark all read", **then** the count goes to zero and stays zero after a reload.
- **Given** I read an item on my laptop, **when** I open Spine on another browser, **then** it's read there too.
- **Given** a new notification arrives, **when** I'm on any page, **then** the count increases within 20 seconds without a reload.

**Implementation notes**
- API: `POST /notifications/read-all`.

### US-NTF-03 · Only get notifications about things I can see
**Feature:** F-NTF-01 · **Priority:** P1 · **Phase:** 1 · **Screens:** `NotificationDrawer`
**As** an owner, **I want** notifications delivered by permission, **so that** nobody learns about records they can't open.

**Acceptance criteria**
- **Given** a quote is accepted, **when** notifications are created, **then** every user who can read quotes gets one, not only Owners.
- **Given** a Field user, **when** a payment is received, **then** they get no notification about it.
- **Given** a private meeting, **when** it changes, **then** only its organiser and attendees are notified.

**Implementation notes**
- `NotificationsService.notify({ recipientRoles | recipientUserIds })` (D-027).

### US-NTF-04 · Turn on browser notifications for this device
**Feature:** F-NTF-02 · **Priority:** P2 · **Phase:** 1 · **Screens:** `SettingsPush`
**As** an owner, **I want** to opt this browser in to push notifications, **so that** I'm alerted even when Spine isn't the open tab. (Staff and Field get the same control on their profile in Phase 6, US-NTF-12.)

Legacy: S-10.12

**Acceptance criteria**
- **Given** "Browser notifications", **when** push isn't enabled here, **then** it reads "Not enabled on this device" / "Turn this on to receive push notifications on this device." with "Turn on".
- **Given** I press "Turn on", **when** the browser asks and I allow, **then** it reads "Enabled on this device" / "This device will receive push notifications." with "Turn off".
- **Given** I blocked notifications in the browser, **when** I open the pane, **then** it reads "Blocked by the browser" and "You've blocked notifications for Spine — re-enable them from your browser's site settings to turn this on.".
- **Given** the browser lacks push support, **when** I open the pane, **then** I see "This browser doesn't support push notifications.".
- **Given** no VAPID keys are configured, **when** anyone opens the pane, **then** push is shown as not configured and nothing errors.

**Implementation notes**
- API: `GET /notifications/push/public-key`, `POST/DELETE /notifications/push/subscribe`, `GET /notifications/push/subscriptions`.
- Data: `push_subscriptions` (one per device).

### US-NTF-05 · Get a push notification when the tab is closed
**Feature:** F-NTF-02 · **Priority:** P2 · **Phase:** 1 · **Screens:** `SettingsPush`
**As** a member who opted in, **I want** pushes to arrive even with Spine closed, **so that** I don't keep the app in view.

**Acceptance criteria**
- **Given** I opted in and closed the tab, **when** a notification is created for me, **then** the operating system shows it with its message.
- **Given** I click the push, **when** it opens, **then** Spine opens at the record's link.
- **Given** I opted in on two browsers, **when** I turn off one, **then** the other keeps receiving pushes.

**Implementation notes**
- Service worker + Web Push; delivery via `push.service.ts`.

### US-NTF-06 · Be told when I'm invited to, removed from or uninvited from a meeting
**Feature:** F-NTF-03 · **Priority:** P2 · **Phase:** 1 · **Screens:** `EmailMeetingInvite`, `NotificationDrawer`
**As** a member, **I want** to know the moment my calendar changes because of someone else, **so that** I don't keep re-checking it.

Legacy: S-10.20

**Acceptance criteria**
- **Given** I'm added to a meeting, **when** it saves, **then** I get an email with subject "You've been invited: <meeting title>" and body "You've been invited to "<meeting title>".", and an in-app notification with that body text.
- **Given** I'm removed from a meeting or it's deleted, **when** it saves, **then** I'm notified that it was removed or cancelled.
- **Given** I'm the organiser, **when** an invitee changes an earlier response, **then** I'm notified; their first response doesn't notify me.

**Implementation notes**
- Types `meeting_invited`, `meeting_removed`, `meeting_cancelled`, `meeting_response_changed` targeted by user id.

### US-NTF-07 · Notify the right people about job and expense events
**Feature:** F-NTF-03 · **Priority:** P3 · **Phase:** 1 · **Screens:** `EmailMilestoneCompleted`, `EmailExpenseApproved`
**As** an owner, **I want** emails and in-app notices when milestones complete or expenses are approved, **so that** billing and reimbursement happen promptly.

**Acceptance criteria**
- **Given** a milestone is completed, **when** it saves, **then** Owners and office staff get "Milestone completed — <milestone>".
- **Given** an expense is approved, **when** it saves, **then** its submitter gets "Expense approved — <category>".
- **Given** a notification email fails to send, **when** SMTP recovers, **then** it's retried and the in-app notice was already delivered.

**Implementation notes**
- Queue `notify-email`; types `milestone_completed`, `expense_approved`.

### US-NTF-08 · Get a reminder before a meeting starts
**Feature:** F-NTF-04 · **Priority:** P2 · **Phase:** 1 · **Screens:** `SettingsMeetingReminders`
**As** an attendee, **I want** a reminder shortly before a meeting, **so that** I don't miss it.

Legacy: S-10.21

**Acceptance criteria**
- **Given** I organise or accepted/tentatively accepted a meeting, **when** my lead time before its start arrives, **then** I get one "starting soon" notification by every channel I have.
- **Given** I declined, **when** the time arrives, **then** I get no reminder.
- **Given** a recurring meeting, **when** each occurrence approaches, **then** I'm reminded once per occurrence; cancelled occurrences send nothing.
- **Given** a meeting's time changes after a reminder was sent, **when** the new lead time arrives, **then** I'm reminded again for the new time.

**Implementation notes**
- Queue `meeting-starting-soon-poll` every few minutes; reminder state per attendee per occurrence.

### US-NTF-09 · Set the reminder lead time for the org and for myself
**Feature:** F-NTF-04 · **Priority:** P2 · **Phase:** 1 · **Screens:** `SettingsMeetingReminders`, `ProfilePreferences`
**As** an owner, **I want** an org default reminder time, and as any member a personal override, **so that** timing suits both the business and me.

Legacy: S-10.22

**Acceptance criteria**
- **Given** Settings › Meeting reminders, **when** an Owner picks "5 minutes before", "15 minutes before", "30 minutes before" or "60 minutes before" and saves, **then** it becomes the default (15 minutes initially).
- **Given** Profile & Preferences › Meeting reminders, **when** I choose "5 min", "15 min", "30 min" or "60 min" instead of "Org default", **then** my reminders use it.
- **Given** I choose "Org default", **when** a reminder fires, **then** the org setting applies; with no org setting, 15 minutes applies.

**Implementation notes**
- API: `PUT /org/settings/meeting_reminder_lead_minutes`, `PUT /users/me/meeting-reminder-lead-minutes`.

### US-NTF-10 · Send every email in one branded layout
**Feature:** F-NTF-05 · **Priority:** P2 · **Phase:** 6 · **Screens:** `EmailBrandedQuote`
**As** an owner, **I want** Spine's emails to look like they come from my business, **so that** customers trust them.

Findings: C2, C9 · Decision: D-067

**Acceptance criteria**
- **Given** any outgoing email, **when** it renders, **then** it has a 6px bar in the document colour, the business logo and name, a heading, a short body, an optional key-facts box, at most one primary button, and the business footer.
- **Given** the quote email, **when** it's sent, **then** it reads "Your quote is ready", "Hi <first name>, …", shows Quote, Total and Valid until, and a "View quote" button.
- **Given** an email client that blocks images, **when** it opens, **then** the business name still shows as text and the message makes sense.
- **Given** every email, **when** it's sent, **then** a plain-text alternative is included.

**Implementation notes**
- One email layout component in `apps/api/src/modules/email`; reads `business_profile` and `settings.branding`.

### US-NTF-11 · Use the branded layout for every email type
**Feature:** F-NTF-05 · **Priority:** P2 · **Phase:** 6 · **Screens:** `EmailMilestoneCompleted`, `EmailExpenseApproved`
**As** a member, **I want** notification and account emails to be clear and consistent, **so that** one-line plain emails don't look like spam.

Findings: C22

**Acceptance criteria**
- **Given** invitation, password reset, quote, invoice, reminder, receipt, payment notice, meeting invite, meeting reminder, milestone and expense emails, **when** each is sent, **then** it uses the shared layout with a heading and a button to the record (invoice, reminder, receipt and payment notice emails have no button: customers have no page to open them on, so the attached PDF is the record, [D-121](../prd/12-decisions.md)).
- **Given** the invitation email, **when** it's sent, **then** it names the business from the business profile, not "<Owner>'s Organisation" (US-TEAM-15).
- **Given** a notification email, **when** I read its footer, **then** it says "You're getting this because you're a member of <Business>." (email preferences are not in v1).

**Implementation notes**
- Snapshot tests per email template.

### US-NTF-12 · Turn on push from my own profile
**Feature:** F-NTF-05 · **Priority:** P2 · **Phase:** 6 · **Screens:** `ProfileNotifications`
**As** a staff or field member, **I want** to enable browser notifications myself, **so that** I don't need an owner to open Settings for me.

Finding: C27

**Acceptance criteria**
- **Given** any member, **when** they open Profile & Preferences › "Notifications", **then** a "Browser notifications" section shows the same states and buttons as US-NTF-04 for this device.
- **Given** an Owner, **when** they open organisation Settings, **then** "Browser notifications" is no longer listed there.
- **Given** a member enables push on their profile, **when** a notification is created for them, **then** it's delivered to that device.

**Implementation notes**
- Move `push-pane.tsx` into `profile-view.tsx`; routes are already per-user.

### US-NTF-13 · Get a daily digest by email
**Feature:** F-NTF-06 · **Priority:** P2 · **Phase:** 7 · **Screens:** `EmailDailyDigest`
**As** an owner, **I want** one email each morning with what needs me, **so that** I know my day before I open Spine.

Decision: D-093

**Acceptance criteria**
- **Given** the digest is on for me, **when** my chosen time arrives on a chosen day, **then** I get one email with subject "Your Spine day: <n> things need you · <weekday> <day> <month>".
- **Given** the email, **when** it opens, **then** it shows the same attention counts as my dashboard (US-DASH-12), "Today" (meetings and milestones) and "Yesterday" (money received, quotes accepted, quotes viewed), with "Open dashboard".
- **Given** nothing needs me and nothing happened yesterday, **when** the time arrives, **then** no email is sent.
- **Given** the footer, **when** it renders, **then** it reads "You get this daily digest because you're an owner of <business>. Turn it off or change the time in Profile › Notifications." (or "a member of" for others).
- **Given** a Field user, **when** their digest is built, **then** it contains no money figures (D-048).

**Implementation notes**
- Queue: `daily-digest` (pg-boss, every 15 minutes, sends to users whose local time matches their setting); reuses `GET /dashboard/attention` logic server-side.
- Data: `user.digest_enabled`, `user.digest_time`, `user.digest_days` (04 "Columns added"); default on for Owners at 07:00 Mon–Fri, off for others.

### US-NTF-14 · Choose when my digest arrives
**Feature:** F-NTF-06 · **Priority:** P3 · **Phase:** 7 · **Screens:** `ProfileNotifications`
**As** any member, **I want** to turn the digest on or off and pick its time and days, **so that** it fits my routine.

**Acceptance criteria**
- **Given** Profile & Preferences › "Notifications", **when** it opens, **then** "Daily digest" shows "Email me a summary each morning" with a switch, "Send at" and "Days" (Every day, Monday to Friday).
- **Given** I turn it off and save, **when** tomorrow's time arrives, **then** no digest is sent to me.
- **Given** I change "Send at" to 6:30 AM, **when** it saves, **then** the next digest arrives at 6:30 AM in the organisation's timezone.
- **Given** the same tab, **when** it renders, **then** it also holds "Browser notifications" (US-NTF-12) and "Meeting reminders" (US-NTF-09).

**Implementation notes**
- API: `PUT /users/me/notification-preferences { digestEnabled, digestTime, digestDays }` (contract addition, self only).
