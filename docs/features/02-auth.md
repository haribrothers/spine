# 02 · Sign-in & account

How people get into Spine and look after their own account: the single-use first sign-up that creates the Primary Owner, sign-in and sign-out, joining by invitation, password reset, and their own account — Profile & Preferences, which from US-SET-30 is the "Your account" group of Settings every role has.

**Screens:** `SignUp` (P1), `SignIn` (P1), `AcceptInvite` (P1), `EmailInvite` (P2), `ProfilePreferences` (P1), `UserMenu` (P1), `SignUpClosed` (P2), `ForgotPassword` (P2), `ForgotPasswordSent` (P2), `ResetPassword` (P2), `InviteInvalid` (P2), `SessionExpired` (P2), `AuthWelcome` (P2), `AuthWelcomeDark` (P2), `AuthLogin` (P2), `AuthLoginDark` (P2), `AuthLoginError` (P2), `AuthSignUp` (P2), `AuthSignUpStrength` (P2), `AuthInvite` (P2), `AuthNarrow` (P2)
**Depends on:** 15 Team (invitations are created there), 14 Notifications (email delivery), 18 Self-hosting (SMTP).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-AUTH-01 | First account, sign-in and sign-out | P1 | 0 | `SignUp`, `SignIn`, `UserMenu` |
| F-AUTH-02 | Join by invitation | P1 | 0 | `AcceptInvite`, `EmailInvite`, `SignUp` |
| F-AUTH-03 | Profile & Preferences | P1 | 0 | `ProfilePreferences`, `UserMenu` |
| F-AUTH-04 | Account recovery and access states | P2 | 6 | `SignUpClosed`, `ForgotPassword`, `ForgotPasswordSent`, `ResetPassword`, `InviteInvalid`, `SessionExpired` |
| F-AUTH-05 | Welcome, login and passwords that feel like Spine | P2 | Refinements | `AuthWelcome`, `AuthWelcomeDark`, `AuthLogin`, `AuthLoginDark`, `AuthLoginError`, `AuthSignUp`, `AuthSignUpStrength`, `AuthNarrow` |
| F-AUTH-06 | Your account in Settings: one theme, signed-in devices, safe email change | P2 | Refinements | `UserMenuRefined`, `SettingsAccountProfile`, `SettingsSecurity`, `SettingsAccountNotifications`, `ChangeEmailDialog`, `EmailChangedNotice`, `SignOutOtherDevicesConfirm` |

## User stories

### US-AUTH-01 · Create the first account on a new install
**Feature:** F-AUTH-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `SignUp`
**As** the person installing Spine, **I want** to create the first account, **so that** I become the owner of this business's Spine.

Legacy: S-10.16 (Primary Owner)

**Acceptance criteria**
- **Given** the instance has no users, **when** I open `/signup`, **then** I see "Create your account" with "Sets up a new organisation with you as the owner." and the fields "Name", "Email", "Password" and "Confirm password", all required (US-AUTH-15).
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
- **Given** a wrong email or password, **when** I submit, **then** I see "That email and password don't match. Check both, or reset your password." (US-AUTH-14) and the message doesn't say which one was wrong.
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
- From US-SET-30 (D-236), these live in Settings › Your account (Profile; Password & security); `/profile` opens it. Email changes move to US-AUTH-18 and the Theme tab goes (US-AUTH-16).
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
- US-AUTH-16 (D-236) makes the user menu the one place to choose, saved to the account and applied at sign-in — the second criterion above wasn't met before it.
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

### US-AUTH-13 · See a welcome page on a new install
**Feature:** F-AUTH-05 · **Priority:** P2 · **Phase:** Refinements (before Phase 10) · **Screens:** `AuthWelcome`, `AuthWelcomeDark`, `AuthNarrow`
**As** the person who just installed Spine, **I want** a welcome page that tells me what Spine is and how to start, **so that** I don't land on a login form for an account that doesn't exist yet.

Decision: [D-207](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** a new install with no accounts, **when** anyone opens `/` or `/login`, **then** they land on `/welcome`.
- **Given** `/welcome`, **when** it opens, **then** one side shows:
  - the Spine logo;
  - "Run your business on Spine";
  - "Quotes, jobs, invoices and your books in one place — on your own server.";
  - three next steps: "Create your account", "Set up your business in a few minutes", "Invite your team";
  - **Create your account** (to `/signup`).

  The other side shows an animated illustration.
- **Given** the illustration, **when** it plays, **then** three people (a tradesperson, the owner and a customer) rise into place and the story plays above them: the quote turns Accepted, the invoice turns Paid and a payment arrives. Its cards are drawn from Spine's own components with placeholder lines — no names, document numbers or amounts — and it settles within about 3 seconds, then drifts gently.
- **Given** Reduce Motion, **when** the page opens, **then** the illustration shows its final frame and nothing moves.
- **Given** a screen reader, **when** it reads the page, **then** it skips the illustration.
- **Given** an install that already has an owner, **when** someone opens `/welcome`, **then** they go to `/login`.
- **Given** a window narrower than 1024 px, **when** the page opens, **then** the illustration is left out and the content is centred.
- **Given** the page, **when** it loads, **then** it asks the server only whether sign-up is open, and shows nothing else about the install ([D-084](../prd/12-decisions.md)).

**Implementation notes**
- UI: new route `/welcome`. `AuthFrame` (`apps/web/src/components/auth-frame.tsx`) is the split frame every signed-out page uses: the form side and the illustration side, side by side from `lg`. The middleware sends `/` and `/login` to `/welcome` while `GET /public/signup-status` says `open` because no account exists.
- Motion: CSS keyframes with the motion tokens, under `prefers-reduced-motion: no-preference` only.

### US-AUTH-14 · Log in on a page that feels like Spine
**Feature:** F-AUTH-05 · **Priority:** P2 · **Phase:** Refinements (before Phase 10) · **Screens:** `AuthLogin`, `AuthLoginDark`, `AuthLoginError`, `AuthNarrow`
**As** a member, **I want** a clear, branded login page, **so that** signing in is quick and I know I'm in the right place.

Decision: [D-207](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** `/login`, **when** it opens, **then** the form side shows:
  - "Log in" and "Welcome back to Spine.";
  - "Email", focused;
  - "Password" with a show/hide eye;
  - "Forgot password?" and **Log in**.

  The illustration side shows a calmer scene: one person with a coffee beside today's jobs and a quote just accepted. Like the welcome page, its cards show placeholder lines and statuses, never names, amounts or the install's data.
- **Given** Caps Lock is on, **when** I type in Password, **then** "Caps Lock is on." shows under the field.
- **Given** a wrong email or password, **when** I log in, **then** I see "That email and password don't match. Check both, or reset your password.". It doesn't say which one was wrong, and what I typed stays.
- **Given** too many attempts, **when** the server refuses, **then** I see "Too many sign-in attempts. Wait a minute, then try again.".
- **Given** I press **Log in**, **when** it's working, **then** the button reads "Logging in…" and is disabled.
- **Given** forgot password, reset password, invite-only, an invitation and the invitation sign-up, **when** they open, **then** they use the same frame: their own form, with the illustration side and the logo.
- **Given** a window narrower than 1024 px, **when** the page opens, **then** only the form shows, with the logo above it.
- **Given** dark mode or Reduce Motion, **when** the page opens, **then** it follows them, as on `/welcome`.

**Implementation notes**
- UI: `apps/web/src/app/login/page.tsx` on `AuthFrame`; the password field is US-AUTH-15's `PasswordInput` without the meter. The wrong-password wording is the same as the phone's (US-MOB-01). Better Auth's 429 maps to the attempts message.

### US-AUTH-15 · Choose a strong password I can see
**Feature:** F-AUTH-05 · **Priority:** P2 · **Phase:** Refinements (before Phase 10) · **Screens:** `AuthSignUp`, `AuthSignUpStrength`
**As** someone setting a password, **I want** to see what I typed, confirm it and know how strong it is, **so that** I pick one I can remember and others can't guess.

Decision: [D-207](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** sign-up (the first account or an invitation), **when** it opens, **then** it asks for "Name", "Email", "Password" and "Confirm password", with a show/hide eye on both password fields (labelled "Show password" / "Hide password").
- **Given** I type a password, **when** it changes, **then** a four-part meter shows "Too short", "Weak", "Fair", "Good" or "Strong". Beneath it a checklist ticks off each item:
  - "At least 8 characters" (required);
  - "12 or more characters";
  - "Letters, numbers and symbols";
  - "Not a common password";
  - "No repeats or sequences like aaaa or 1234".
- **Given** a screen reader, **when** the strength changes, **then** it announces "Password strength: <level>" (polite).
- **Given** fewer than 8 characters, **when** I submit, **then** Password shows "Use at least 8 characters." and nothing is sent.
- **Given** a password on Spine's common-passwords list, **when** I submit, **then** Password shows "That password is too common. Choose another one.". The server refuses it too, for sign-up, reset and change password.
- **Given** the two passwords differ, **when** I leave Confirm password or submit, **then** it shows "The passwords don't match.".
- **Given** reset password (US-AUTH-10) and Profile › Password (US-AUTH-06), **when** I choose a new password, **then** they use the same fields, meter and rules. Profile also asks to confirm the new password.
- **Given** a password manager, **when** it offers a password, **then** it fills both fields (`autocomplete="new-password"`), and pasting works.
- **Given** I press **Create account**, **when** it's working, **then** the button reads "Creating your account…", and a failure keeps what I typed.

**Implementation notes**
- `packages/shared/src/password.ts`: `passwordStrength(password)` gives the level, the checklist and the common-password check (a short built-in list, no dependency). It's used by the web and by the API's Better Auth `before` hook on `/sign-up/email`, `/reset-password` and `/change-password`, which answers 400 `PASSWORD_TOO_COMMON`.
- `PasswordInput` and `PasswordStrengthMeter` in `@spine/ui`, with doc pages and accessibility tests. The existing `PasswordToggleField` is the base for the eye.


### US-AUTH-16 · One theme, wherever I sign in
**Feature:** F-AUTH-06 · **Priority:** P2 · **Phase:** Refinements (before Phase 10) · **Screens:** `UserMenuRefined`
**As** any user, **I want** the theme I pick to stay picked, **so that** Spine looks the same on every device and in every place that shows it.

Decision: [D-236](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** the user menu, **when** I pick "Light", "Dark" or "System", **then** the app switches at once and my choice is saved to my account (`themePreference`).
- **Given** I picked "Dark" on one device, **when** I sign in on another, **then** Spine opens in dark — the saved choice wins over what that browser last used.
- **Given** "System", **when** my operating system switches between light and dark, **then** Spine follows without a reload.
- **Given** saving fails, **when** the error returns, **then** a toast says "Couldn't save your theme. It's used on this device until you sign in again." and the theme still applies here.
- **Given** Settings › Your account, **when** it opens, **then** there's no separate Appearance pane: the user menu is the one place to choose a theme.
- **Given** the theme buttons in the user menu, **when** a screen reader or tooltip reads them, **then** they're named "Light", "Dark" and "Follow system", and the chosen one is pressed.

**Implementation notes**
- Supersedes the Appearance tab in US-AUTH-06/US-AUTH-07. The app layout applies `GET /users/me`'s `themePreference` with `next-themes` once per sign-in; the user menu calls `PUT /users/me/preferences`.
- The note on Settings › Branding (US-SET-09) now reads "Each person still chooses light or dark mode from their user menu.".

### US-AUTH-17 · See where I'm signed in and sign out elsewhere
**Feature:** F-AUTH-06 · **Priority:** P2 · **Phase:** Refinements (before Phase 10) · **Screens:** `SettingsSecurity`, `SignOutOtherDevicesConfirm`
**As** any user, **I want** to see every device signed in to my account, **so that** I can sign out a lost phone or a shared computer.

Decision: [D-236](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** Settings › Your account › Password & security, **when** it opens, **then** "Where you're signed in" lists each session: device and browser ("Chrome on macOS", "Spine app on iPhone"), the place it signed in from (IP address), "Last active <time ago>", and "This device" on the current one, most recent first.
- **Given** another session's row, **when** I press "Sign out", **then** it asks "Sign out <device>? It'll need to sign in again." and, confirmed, ends that session (web or phone) and says so in a toast.
- **Given** more than one session, **when** I press "Sign out of other devices", **then** it asks first, ends every session but this one, and the toast says how many.
- **Given** I change my password here, **when** I look below the fields, **then** "Sign out of my other devices" is ticked; with it ticked, success signs out every other session (`revokeOtherSessions`) and the toast says "Password changed. Your other devices are signed out."; unticked, "Password changed.".

**Implementation notes**
- API: `GET /users/me/sessions`, `DELETE /users/me/sessions/:id`, `POST /users/me/sessions/sign-out-others` — the caller's own sessions only. Device names come from the session's `user_agent`; the phone app sends a recognisable user agent.

### US-AUTH-18 · Change my email safely
**Feature:** F-AUTH-06 · **Priority:** P2 · **Phase:** Refinements (before Phase 10) · **Screens:** `ChangeEmailDialog`, `EmailChangedNotice`
**As** any user, **I want** changing my sign-in email to need my password and to be told about, **so that** someone at my unlocked computer can't take over my account.

Decision: [D-236](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** Settings › Your account › Profile, **when** I look at Email, **then** it's shown with "Change email" rather than as an open field.
- **Given** "Change email", **when** the dialog opens, **then** it asks for "New email" and "Current password", and "Change email" is pressed only when both are filled.
- **Given** a wrong password, **when** I press "Change email", **then** Current password says "That password isn't right." and nothing changes.
- **Given** an email another account uses, **when** I press "Change email", **then** New email says "Another account uses that email." and nothing changes.
- **Given** it succeeds, **when** the dialog closes, **then** a toast says "Your sign-in email is now <new>.", and the old address gets an email "Your Spine sign-in email changed" naming the new one, when and from which device — and saying to contact an Owner if it wasn't them.

**Implementation notes**
- API: `PUT /users/me/email { newEmail, currentPassword }` (400 wrong password, 409 taken); `PUT /users/me` no longer accepts `email`. New `email_kind` `email_changed`, sent to the old address.

### US-AUTH-19 · My account looks after the details
**Feature:** F-AUTH-06 · **Priority:** P2 · **Phase:** Refinements (before Phase 10) · **Screens:** `SettingsAccountProfile`, `SettingsAccountNotifications`, `UserMenuRefined`
**As** any user, **I want** my account settings to be clear and finished, **so that** I don't wonder what's saved or what a default means.

Decision: [D-236](../prd/12-decisions.md), [D-222](../prd/12-decisions.md), [D-223](../prd/12-decisions.md)

**Acceptance criteria**
- **Given** I've uploaded a photo, **when** the user menu and the sidebar show me, **then** they show my photo (initials only without one).
- **Given** a photo, **when** I open Profile, **then** "Change photo" and "Remove photo" are offered; Remove asks first and returns to initials everywhere.
- **Given** Profile's name, **when** nothing has changed, **then** "Save" is off; after saving, a toast says "Profile updated." (US-OPS-38) instead of a message on the page.
- **Given** Notifications › Meeting reminders, **when** I haven't chosen one, **then** the first option reads "Business default · <n> min", using the Owner's setting.
- **Given** the daily digest, **when** it shows the time, **then** it names the time zone ("Times are in Asia/Kolkata, the business's time zone.").
- **Given** the user menu, **when** it opens, **then** each item has its icon from the standard menu icons with no extra spacing (D-222): Settings, Set up Spine (Owners), Sign out.

**Implementation notes**
- `GET /users/me` gains `orgDefaults: { meetingReminderLeadMinutes, timeZone }` and the photo is read from `image` everywhere the person is shown.
