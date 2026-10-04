# 02 · Sign-in & account

How people get into Spine and look after their own account: the single-use first sign-up that creates the Primary Owner, sign-in and sign-out, joining by invitation, password reset, and the personal Profile & Preferences page every role has.

**Screens:** `SignUp` (P1), `SignIn` (P1), `AcceptInvite` (P1), `EmailInvite` (P2), `ProfilePreferences` (P1), `UserMenu` (P1), `SignUpClosed` (P2), `ForgotPassword` (P2), `ForgotPasswordSent` (P2), `ResetPassword` (P2), `InviteInvalid` (P2), `SessionExpired` (P2)
**Depends on:** 15 Team (invitations are created there), 14 Notifications (email delivery), 18 Self-hosting (SMTP).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-AUTH-01 | First account, sign-in and sign-out | P1 | 0 | `SignUp`, `SignIn`, `UserMenu` |
| F-AUTH-02 | Join by invitation | P1 | 0 | `AcceptInvite`, `EmailInvite`, `SignUp` |
| F-AUTH-03 | Profile & Preferences | P1 | 0 | `ProfilePreferences`, `UserMenu` |
| F-AUTH-04 | Account recovery and access states | P2 | 6 | `SignUpClosed`, `ForgotPassword`, `ForgotPasswordSent`, `ResetPassword`, `InviteInvalid`, `SessionExpired` |

## User stories

### US-AUTH-01 · Create the first account on a new install
**Feature:** F-AUTH-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `SignUp`
**As** the person installing Spine, **I want** to create the first account, **so that** I become the owner of this business's Spine.

Legacy: S-10.16 (Primary Owner)

**Acceptance criteria**
- **Given** the instance has no users, **when** I open `/signup`, **then** I see "Create your account" with "Sets up a new organisation with you as the owner." and the fields "Name", "Email" and "Password", all required.
- **Given** I submit valid details, **when** the account is created, **then** an organisation is created, I become its Owner with the Primary Owner flag, and I land on `/onboarding`.
- **Given** the password is shorter than 8 characters, **when** I submit, **then** the form shows an error and no account is created.
- **Given** account creation fails part-way, **when** the error returns, **then** I see "Could not create your account. Please try again." and no half-created user or organisation is left behind.
- **Given** the first account exists, **when** anyone posts to the sign-up endpoint without an invitation, **then** the request is rejected (see US-AUTH-08 for the page).

**Implementation notes**
- API: Better Auth `/api/auth/sign-up/email`; `user.create.after` hook creates the organisation and Primary Owner membership.
- Data: `user`, `account`, `organization`, `member.is_primary_owner` (partial unique index).
- UI: `apps/web/src/app/signup/page.tsx`.
- Edge: two simultaneous first sign-ups — only one becomes Primary Owner (index enforces it).

### US-AUTH-02 · Log in with email and password
**Feature:** F-AUTH-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `SignIn`
**As** a member, **I want** to log in with my email and password, **so that** I can work in Spine.

**Acceptance criteria**
- **Given** I'm signed out, **when** I open `/login`, **then** I see "Log in", "Welcome back to Spine.", "Email" and "Password".
- **Given** correct credentials, **when** I submit, **then** I land on `/dashboard` (or the `next` page I was sent from).
- **Given** a wrong email or password, **when** I submit, **then** I see "Invalid email or password." and the message doesn't say which one was wrong.
- **Given** my membership was deactivated, **when** I log in, **then** every organisation page shows the no-access page and every organisation API call returns 403.
- **Given** I'm signed out and open a deep link, **when** I log in, **then** I'm returned to that link.

**Implementation notes**
- API: Better Auth `/api/auth/sign-in/email`.
- Data: `session`; `member.is_active`.
- UI: `apps/web/src/app/login/page.tsx`; a "Forgot password?" link is added in Phase 6 (US-AUTH-09).
- Edge: repeated failures are rate-limited by Better Auth.

### US-AUTH-03 · Sign out from the user menu
**Feature:** F-AUTH-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `UserMenu`
**As** a member, **I want** to sign out, **so that** nobody else can use my session on a shared computer.

**Acceptance criteria**
- **Given** I'm signed in, **when** I open the user menu at the bottom of the sidebar, **then** I see my name and email, "Profile & Preferences", a theme choice, and "Sign out" (Owners also see "Settings").
- **Given** I choose "Sign out", **when** it completes, **then** my session is revoked and I'm on `/login`.
- **Given** I signed out, **when** I press the browser back button, **then** no app page is shown.

**Implementation notes**
- API: Better Auth `/api/auth/sign-out`.
- UI: `components/app-user-menu.tsx` (`DropdownMenu`).
- Edge: "Settings" is hidden for Staff and Field (and the API rejects them anyway).

### US-AUTH-04 · Accept an invitation while signed in
**Feature:** F-AUTH-02 · **Priority:** P1 · **Phase:** 0 · **Screens:** `AcceptInvite`, `EmailInvite`
**As** an invited colleague, **I want** to accept the invitation from my email, **so that** I join the business with the role I was given.

Legacy: S-10.2

**Acceptance criteria**
- **Given** an Owner invited me, **when** the email arrives, **then** it says "<Inviter> invited you to join <Business name> as <role>." with a link "Accept the invitation".
- **Given** I open the link while signed in with the invited email, **when** the page loads, **then** I see "You've been invited", the business name and role, and "Accept" and "Decline".
- **Given** I press "Accept", **when** it succeeds, **then** I become a member with the invited role and land on the dashboard.
- **Given** I press "Decline", **when** it succeeds, **then** the invitation is marked declined and I'm not added.
- **Given** I'm signed in with a different email, **when** I open the link, **then** I'm told to sign in with the email the invitation was sent to.

**Implementation notes**
- API: Better Auth `getInvitation`, `acceptInvitation`, `rejectInvitation`; `GET /public/invitations/:id`.
- Data: `invitation`, `member`.
- UI: `apps/web/src/app/accept-invite/[id]`.
- Edge: invited Staff get no Team until an Owner assigns one (07-security appendix).

### US-AUTH-05 · Create my account from an invitation
**Feature:** F-AUTH-02 · **Priority:** P1 · **Phase:** 0 · **Screens:** `AcceptInvite`, `SignUp`
**As** an invited person without an account, **I want** to create one from the invite link, **so that** I can join without asking anyone for help.

**Acceptance criteria**
- **Given** I open an invite link while signed out, **when** the page loads, **then** I see "Sign in or create an account as <email> to accept this invitation." with "Create account" and "Log in".
- **Given** I choose "Create account", **when** the sign-up page opens, **then** my email is filled in and locked, and the subtitle reads "Finish creating your account to accept the invitation.".
- **Given** I complete sign-up, **when** it succeeds, **then** I'm returned to the invitation and can accept it.
- **Given** I choose "Log in", **when** I sign in, **then** I'm returned to the invitation page.

**Implementation notes**
- API: `GET /public/invitations/:id` (email and status only), Better Auth sign-up with `inviteId`.
- UI: `/signup?inviteId=…&email=…`, `/login?next=/accept-invite/…`.
- Edge: invite-based sign-up works even though open sign-up is closed (US-AUTH-08).

### US-AUTH-06 · Edit my name, email, password and avatar
**Feature:** F-AUTH-03 · **Priority:** P1 · **Phase:** 0 · **Screens:** `ProfilePreferences`
**As** any user, **I want** a personal page for my own account, **so that** I can keep it up to date without an admin.

Legacy: S-10.17

**Acceptance criteria**
- **Given** I'm signed in with any role, **when** I choose "Profile & Preferences" in the user menu, **then** `/profile` shows "Avatar", "Name & email", "Change password", "Theme" and "Meeting reminders".
- **Given** I change my name and press "Save", **when** it succeeds, **then** I see "Profile updated." and the sidebar shows the new name.
- **Given** I enter my current password and a new one and press "Change password", **when** it succeeds, **then** I see "Password changed.".
- **Given** the current password is wrong, **when** I press "Change password", **then** I see "Could not change password." and nothing changes.
- **Given** I upload an avatar image up to 10 MB, **when** it succeeds, **then** I see "Avatar updated." and it replaces my initials everywhere.

**Implementation notes**
- API: `PUT /users/me`, `PUT /users/me/password`, `POST /files`.
- Data: `user`.
- UI: `apps/web/src/app/(app)/profile/profile-view.tsx`.
- Edge: these routes must accept `Idempotency-Key` (finding C26, US-OPS-08).

### US-AUTH-07 · Choose light, dark or system theme
**Feature:** F-AUTH-03 · **Priority:** P1 · **Phase:** 0 · **Screens:** `ProfilePreferences`, `UserMenu`
**As** any user, **I want** to pick light, dark or follow-my-system, **so that** Spine is comfortable in a bright office or a dim site cabin.

Legacy: S-00.2, S-00.3

**Acceptance criteria**
- **Given** I open Theme on my profile or in the user menu, **when** I pick "Light", "Dark" or "System", **then** the whole app switches immediately without a reload.
- **Given** I picked a theme, **when** I sign in on another device, **then** the same theme applies.
- **Given** I picked "System", **when** my operating system switches to dark mode, **then** Spine follows without a reload.
- **Given** saving fails, **when** the error returns, **then** I see "Could not save theme preference." and the theme still applies on this device.

**Implementation notes**
- API: `PUT /users/me/preferences`.
- Data: user theme preference.
- UI: `next-themes` (`data-theme`), `theme-toggle.tsx`.
- Edge: every status colour keeps 4.5:1 contrast in both themes (design README).

### US-AUTH-08 · See that sign-up is invite-only
**Feature:** F-AUTH-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `SignUpClosed`
**As** someone who finds the sign-up page of an existing install, **I want** to be told it's invite-only, **so that** I don't fill in a form that can't work.

Finding: C1

**Acceptance criteria**
- **Given** the instance already has an owner, **when** I open `/signup` without an invitation, **then** I see "This Spine is invite-only" and "<Business name> already has an owner, so new accounts are created by invitation. Ask an owner to invite you — you'll get an email with a link to join." and no form.
- **Given** that page, **when** I press "Log in", **then** I go to `/login`.
- **Given** I open `/signup` from a valid invitation link, **when** the page loads, **then** the normal form shows with my email locked (US-AUTH-05).
- **Given** the instance has no users yet, **when** I open `/signup`, **then** the normal first-account form shows (US-AUTH-01).
- **Given** sign-up is closed, **when** I open `/login`, **then** the "Don't have an account? Sign up" link isn't shown.

**Implementation notes**
- API: `GET /public/signup-status` → `{ open, businessName }` (contract addition).
- UI: `apps/web/src/app/signup/page.tsx` branches on status.
- Edge: the business name comes from the business profile, not `organization.name`. It's the only instance detail shown to anonymous visitors ([D-084](../prd/12-decisions.md)); no email or configuration hints.

### US-AUTH-09 · Ask for a password reset link
**Feature:** F-AUTH-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `ForgotPassword`, `ForgotPasswordSent`
**As** a member who forgot my password, **I want** a reset link by email, **so that** I can get back in without the owner.

Gap: G7 · Decision: D-056

**Acceptance criteria**
- **Given** I'm on `/login`, **when** I choose "Forgot password?", **then** `/forgot-password` shows "Reset your password", an "Email" field and "Send reset link".
- **Given** I submit any email, **when** the request completes, **then** I see "Check your email" with "If an account exists for <email>, we've sent a link to reset its password. The link works once and expires in 1 hour." whether or not the account exists.
- **Given** I just requested a link, **when** I look at the resend button, **then** it reads "Resend link in 0:45" counting down and is disabled until 60 seconds have passed.
- **Given** the forgot-password page, **when** it renders, **then** it shows "Reset your password", "Enter the email you sign in with and we'll send you a link to choose a new password.", "Back to log in" and "The link works once and expires in 1 hour.", and the same text whether or not email (SMTP) is configured ([D-084](../prd/12-decisions.md)).
- **Given** I'm on the mobile app, **when** I tap "Forgot password?", **then** this page opens in the phone's browser (D-052).

**Implementation notes**
- API: Better Auth `request-password-reset` (contract addition); email through the branded layout (US-NTF-11).
- Data: Better Auth `verification`.
- UI: new routes `/forgot-password`, `/forgot-password/sent`.
- Edge: rate-limit requests per email and per IP.

### US-AUTH-10 · Choose a new password from the reset link
**Feature:** F-AUTH-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `ResetPassword`
**As** a member with a reset link, **I want** to set a new password, **so that** I can log in again.

Gap: G7 · Decision: D-056

**Acceptance criteria**
- **Given** a valid link, **when** I open it, **then** I see "Choose a new password", "For <email>. You'll be signed out on your other devices.", "New password" (helper "At least 8 characters.") and "Confirm new password".
- **Given** the two passwords differ, **when** I submit, **then** "Confirm new password" shows "The passwords don't match." and nothing changes.
- **Given** valid matching passwords, **when** I press "Save password", **then** the password changes.
- **Given** the password just changed, **when** my other devices make their next request, **then** their sessions are rejected.
- **Given** the password just changed, **when** the page finishes, **then** I'm signed in and taken to the dashboard.
- **Given** the link is expired or already used, **when** I open it, **then** I see that it can't be used with a link "Request a new one".

**Implementation notes**
- API: Better Auth `reset-password` (contract addition).
- UI: new route `/reset-password?token=…`.
- Edge: a used token can't be replayed (single-use).

### US-AUTH-11 · See why an invitation can't be used
**Feature:** F-AUTH-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `InviteInvalid`
**As** someone with an old or wrong invite link, **I want** a clear message, **so that** I know to ask for a new one.

Finding: C3

**Acceptance criteria**
- **Given** an invitation id that doesn't exist, has expired, was cancelled or was already accepted, **when** I open its link signed in or out, **then** I see "This invitation can't be used" and "It may have expired, been cancelled, or already been accepted. Ask whoever invited you to send a new one.".
- **Given** that page, **when** I press "Log in instead", **then** I go to `/login`.
- **Given** a valid pending invitation, **when** I open it, **then** the normal invitation page shows instead (US-AUTH-04/05).

**Implementation notes**
- API: `GET /public/invitations/:id` returns 404 for unknown ids and `status` otherwise.
- UI: `accept-invite-view.tsx` adds the unusable state for signed-out visitors (today only signed-in visitors get "This invitation could not be found or has expired.").
- Edge: the page never reveals the business name for an unknown id.

### US-AUTH-12 · Keep my unsaved work when my session expires
**Feature:** F-AUTH-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `SessionExpired`
**As** a member editing something, **I want** to be told my session ended instead of losing my work, **so that** I can log in again and save.

**Acceptance criteria**
- **Given** my session expired while a form was open, **when** I save, **then** a dialog shows "You've been signed out" and "Your session ended, so this change wasn't saved yet. Log in again to save it — the draft stays open in this tab." with "Log in again".
- **Given** I press "Log in again", **when** I sign in in the dialog's flow, **then** I'm returned to the same page with my unsaved input still there.
- **Given** a background request gets 401 while I'm only reading, **when** it happens, **then** I'm sent to `/login?next=<current page>`.

**Implementation notes**
- UI: a shared API-client interceptor; draft kept in component state/sessionStorage.
- Edge: never retries the mutation automatically after re-login; the user presses save again.
