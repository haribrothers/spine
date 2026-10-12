# 15 · Users, teams & permissions

Who can use Spine and what they can do: an Owner-only area with real pages for users (invite, deactivate, promote, demote, transfer primary ownership) and Teams (named groups of Staff with a privilege matrix). Owner and Field are fixed roles; Staff access comes from the union of their Teams' grants. The full capability list is in 07-security.

**Screens:** `TeamUsers` (P1), `UserActionsMenu` (P2), `DemoteOwnerConfirm` (P2), `DeactivateUserConfirm` (P2), `TransferPrimaryOwnerDialog` (P2), `TeamTeams` (P1), `CreateTeamDialog` (P1), `TeamMembers` (P1), `TeamPrivileges` (P1), `TeamPrivilegesExpanded` (P1), `PromoteOwnerConfirm` (P2), `EmailInvite` (P2), `DashboardFieldRedesign` (P1), `DashboardStaffRedesign` (P1)
**Depends on:** 02 Sign-in (accepting invitations), 07-security (capability list), every module (enforcement).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-TEAM-01 | Users and invitations | P1 | 0 | `TeamUsers`, `DeactivateUserConfirm` |
| F-TEAM-02 | Owners and the Primary Owner | P1 | 0 | `UserActionsMenu`, `DemoteOwnerConfirm`, `TransferPrimaryOwnerDialog` |
| F-TEAM-03 | Teams and the privilege matrix | P1 | 0 | `TeamTeams`, `CreateTeamDialog`, `TeamMembers`, `TeamPrivileges`, `TeamPrivilegesExpanded` |
| F-TEAM-04 | People and access fixes | P2 | 6 | `TeamUsers`, `PromoteOwnerConfirm`, `EmailInvite` |
| F-TEAM-05 | Users you can manage from: the shared list layout, Teams and access on each person, invites with Teams, Staff ↔ Field, and safer actions | P2 | Refinements | `TeamUsersRefined`, `TeamUsersDark`, `TeamInvites`, `InvitePeopleDialog`, `ManageTeamsDialog`, `UserAccessDrawer`, `ChangeRoleConfirm` |
| F-TEAM-06 | Set a Staff or Field member's password: an Owner sets it from Users, the person is signed out and emailed, and chooses their own at next sign-in; no Owner's password is set this way | P2 | Refinements | `TeamUsersPasswordMenu`, `ChangeMemberPasswordDialog`, `ChangeMemberPasswordDone`, `PrimaryOwnerNoPassword`, `ChooseOwnPassword`, `ChooseOwnPasswordMobile` |
| F-TEAM-07 | Teams you can manage from: the shared list layout, create from or duplicate a Team, a Team page with members you add and remove safely, permissions you review before saving with what members can open, and every change in the audit log | P2 | Refinements | `TeamsListRefined`, `TeamsListDark`, `CreateTeamDialog`, `DeleteTeamConfirm`, `TeamPageMembers`, `AddTeamMembersDialog`, `RemoveTeamMemberConfirm`, `TeamPagePermissions`, `SavePermissionsConfirm`, `TeamPageHistory` |

## User stories

### US-TEAM-01 · See everyone with access in one place
**Feature:** F-TEAM-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `TeamUsers`
**As** an owner, **I want** a Users page under its own Team section of the sidebar, **so that** managing people feels proportionate and has a real URL.

Legacy: S-10.18

**Acceptance criteria**
- **Given** I'm an Owner, **when** I open the sidebar, **then** a "Team" section shows "Users" and "Teams" linking to `/team/users` and `/team/teams`.
- **Given** `/team/users`, **when** it loads, **then** I see each member's avatar, name, email, role ("Owner", "Staff", "Field"), a "Primary Owner" badge where it applies, and "Deactivated" for deactivated members.
- **Given** a Staff or Field user, **when** they open the sidebar, **then** the Team section is absent and the routes return the no-access page.
- **Given** the page fails to load, **when** the error returns, **then** I see "Could not load users.".

**Implementation notes**
- API: `GET /org/members`, `GET /org/invitations`. The invitations list has no role guard today; US-OPS-20 makes it Owner-only.
- UI: `team/users/users-explorer.tsx`, `user-row.tsx`.

### US-TEAM-02 · Invite a teammate with a role
**Feature:** F-TEAM-01 · **Priority:** P1 · **Phase:** 0 · **Screens:** `TeamUsers`, `EmailInvite`
**As** an owner, **I want** to invite someone by email as Staff or Field, **so that** my team can work.

Legacy: S-10.2

**Acceptance criteria**
- **Given** "Invite a teammate" ("They'll receive an email invite to join this organisation."), **when** I enter an email, choose "Staff" or "Field" and press "Send invite", **then** the invite is listed under "Pending invites" ("Invited but haven't joined yet.") as "Pending".
- **Given** an invite, **when** it's sent, **then** the person receives an invitation email with a link to accept.
- **Given** someone tries to invite with role Owner through the API, **when** the request is made, **then** it's rejected with 400 (D-020).
- **Given** the email already belongs to a member, **when** I invite it, **then** I'm told they're already a member.

**Implementation notes**
- API: `POST /org/invitations` (Owner).

### US-TEAM-03 · Resend or cancel a pending invite
**Feature:** F-TEAM-01 · **Priority:** P2 · **Phase:** 0 · **Screens:** `TeamUsers`
**As** an owner, **I want** to resend or cancel an invite, **so that** lost emails and mistakes are easy to fix.

**Acceptance criteria**
- **Given** a pending invite, **when** I press "Resend", **then** a new email is sent and the expiry restarts.
- **Given** a pending invite, **when** I press "Cancel", **then** it's removed and its link stops working.
- **Given** an expired invite, **when** it's listed, **then** it shows "Expired" with "Resend".
- **Given** resending fails, **when** the error returns, **then** I see "Could not resend invite.".

**Implementation notes**
- API: `POST /org/invitations/:id/resend`, `DELETE /org/invitations/:id`.

### US-TEAM-04 · Deactivate a user without losing their history
**Feature:** F-TEAM-01 · **Priority:** P2 · **Phase:** 0 · **Screens:** `DeactivateUserConfirm`
**As** an owner, **I want** to remove someone's access but keep everything they did, **so that** records stay intact.

Legacy: S-10.3

**Acceptance criteria**
- **Given** an active member other than the Primary Owner, **when** I press "Deactivate", **then** "Deactivate <name>?" explains they lose access immediately and their records and history are kept.
- **Given** I confirm, **when** it succeeds, **then** they show "Deactivated", their sessions stop working for this organisation, and their name still appears on documents they created.
- **Given** a deactivated member, **when** they try to log in, **then** they can't reach any page of the organisation.
- **Given** it fails, **when** the error returns, **then** I see "Could not deactivate user.".

**Implementation notes**
- API: `PUT /org/members/:id/deactivate` (Owner).
- Data: `member.is_active`, `deactivated_at` (never deletes `user` or history).

### US-TEAM-05 · Reactivate a user
**Feature:** F-TEAM-01 · **Priority:** P3 · **Phase:** 0 · **Screens:** `TeamUsers`
**As** an owner, **I want** to give a returning person their access back, **so that** they don't need a new account.

**Acceptance criteria**
- **Given** a deactivated member, **when** I press "Reactivate", **then** they're active with their previous role and Teams.
- **Given** they log in, **when** it succeeds, **then** they reach the dashboard.
- **Given** it fails, **when** the error returns, **then** I see "Could not reactivate user.".

**Implementation notes**
- API: `PUT /org/members/:id/reactivate`.

### US-TEAM-06 · Promote a staff member to Owner
**Feature:** F-TEAM-02 · **Priority:** P2 · **Phase:** 0 · **Screens:** `UserActionsMenu`
**As** an owner, **I want** to make a trusted staff member an Owner, **so that** we share full administrative responsibility.

Legacy: S-10.15

**Acceptance criteria**
- **Given** a Staff member's "More actions" menu, **when** I open it, **then** it offers "Promote to Owner".
- **Given** I promote them, **when** it succeeds, **then** their role shows "Owner" and they have every capability regardless of Teams.
- **Given** a Field member, **when** I open their menu, **then** "Promote to Owner" isn't offered (only Staff can be promoted).
- **Given** it fails, **when** the error returns, **then** I see "Could not promote user.".

**Implementation notes**
- API: `PUT /org/members/:id/promote` (Owner). Confirmation step is US-TEAM-16.

### US-TEAM-07 · Demote an owner back to staff
**Feature:** F-TEAM-02 · **Priority:** P2 · **Phase:** 0 · **Screens:** `DemoteOwnerConfirm`
**As** an owner, **I want** to change another owner back to Staff, **so that** access can be reduced when roles change.

**Acceptance criteria**
- **Given** an Owner who isn't the Primary Owner, **when** I choose "Demote to Staff", **then** "Demote <name> to Staff?" explains they'll keep only what their Teams grant.
- **Given** I confirm, **when** it succeeds, **then** their role shows "Staff".
- **Given** the Primary Owner, **when** anyone opens their menu, **then** "Demote to Staff" isn't offered and the API refuses it.

**Implementation notes**
- API: `PUT /org/members/:id/demote`.

### US-TEAM-08 · Transfer primary ownership deliberately
**Feature:** F-TEAM-02 · **Priority:** P2 · **Phase:** 0 · **Screens:** `TransferPrimaryOwnerDialog`
**As** the Primary Owner, **I want** my super-admin status protected and only transferable by me, **so that** the instance always has one clear administrator.

Legacy: S-10.16

**Acceptance criteria**
- **Given** I'm the Primary Owner, **when** I choose "Transfer primary ownership…" on my row, **then** "Transfer primary ownership" asks me to "Select an owner" from existing Owners and press "Transfer".
- **Given** I transfer, **when** it succeeds, **then** the chosen Owner shows "Primary Owner" and I remain an Owner.
- **Given** no other Owners exist, **when** I open the dialog, **then** I'm told to promote someone first.
- **Given** concurrent transfers, **when** both commit, **then** exactly one Primary Owner exists (partial unique index).

**Implementation notes**
- API: `POST /org/members/transfer-primary-owner` (Primary Owner only).
- Row controls on the Primary Owner's row are US-TEAM-17 (Phase 6).

### US-TEAM-09 · Create and rename Teams
**Feature:** F-TEAM-03 · **Priority:** P1 · **Phase:** 0 · **Screens:** `TeamTeams`, `CreateTeamDialog`
**As** an owner, **I want** named Teams, **so that** I group people the way my business is organised.

Legacy: S-10.13

**Acceptance criteria**
- **Given** `/team/teams` ("Group Staff members and configure what each group can do."), **when** it loads, **then** I see each Team with its member count and "General Staff" marked "Default".
- **Given** "Create team", **when** I enter "Team name" (placeholder "e.g. Site Crew A") and press "Create", **then** the Team is listed with no members and no grants.
- **Given** a Team's page, **when** I change "Team name" and save, **then** it's renamed; the default Team shows "The default team's name can't be changed.".
- **Given** creation fails, **when** the error returns, **then** I see "Could not create team.".

**Implementation notes**
- API: `GET/POST /org/teams`, `PUT /org/teams/:id` (Owner).
- Data: `teams` (seeded "General Staff").

### US-TEAM-10 · Put staff members on Teams
**Feature:** F-TEAM-03 · **Priority:** P1 · **Phase:** 0 · **Screens:** `TeamMembers`
**As** an owner, **I want** to add and remove Staff on a Team, **so that** they get that Team's access.

**Acceptance criteria**
- **Given** a Team's "Members" tab ("Members of this team."), **when** I use "Add a staff member" ("Select a staff member…"), **then** the person is added and gains the Team's grants on their next request.
- **Given** every Staff member is already on the Team, **when** I open the picker, **then** it says "Every Staff member is already on this team".
- **Given** I remove someone, **when** it saves, **then** they lose any capability only this Team gave them.
- **Given** Owners and Field users, **when** I open the picker, **then** they aren't offered.

**Implementation notes**
- API: `PUT /org/teams/:id/members`.
- Data: `team_memberships`.

### US-TEAM-11 · Choose exactly what a Team can do
**Feature:** F-TEAM-03 · **Priority:** P1 · **Phase:** 0 · **Screens:** `TeamPrivileges`, `TeamPrivilegesExpanded`
**As** an owner, **I want** a privilege matrix per Team, **so that** each group gets the access it needs and no more.

Legacy: S-10.14

**Acceptance criteria**
- **Given** a Team's "Privileges" tab, **when** it opens, **then** capabilities are grouped ("Reports & Ledger", "Manage Contacts", "Manage Catalogue", "Manage Leads", "Manage Activities", "Manage Quotes", "Manage Invoices", "Manage Payments", "Manage Credit Notes", "Manage Expenses", "Manage Expense Categories", "Manage Vendor Bills", "Manage Vendor Payments", "Manage Jobs", "Manage Meetings"), each collapsed with a "grant all" switch.
- **Given** I expand a group, **when** it opens, **then** each capability shows its label, a one-line description and its own switch.
- **Given** I toggle a switch, **when** it saves, **then** the API enforces it on the members' next request without signing them out.
- **Given** "Manage users, teams, permissions, org settings, tax rules", **when** I look for it, **then** it isn't in the matrix — it's always Owner-only.
- **Given** saving fails, **when** the error returns, **then** I see "Could not update privileges." and the switch reverts.

**Implementation notes**
- API: `PUT /org/teams/:id/privileges`.
- Data: `team_privileges`; list = `CAPABILITIES` (one source of truth with enforcement).

### US-TEAM-12 · Delete a Team
**Feature:** F-TEAM-03 · **Priority:** P3 · **Phase:** 0 · **Screens:** `TeamTeams`
**As** an owner, **I want** to delete a Team I no longer use, **so that** the list stays clean.

**Acceptance criteria**
- **Given** a non-default Team, **when** I delete it and confirm "Delete <team name>?", **then** it's removed and its members lose its grants.
- **Given** the default Team, **when** I try to delete it, **then** I'm told "The default team can't be deleted".
- **Given** only one Team exists, **when** I try to delete it, **then** I'm told "An org needs at least one team".

**Implementation notes**
- API: `DELETE /org/teams/:id`.

### US-TEAM-13 · Give staff on several Teams the union of their grants
**Feature:** F-TEAM-03 · **Priority:** P1 · **Phase:** 0 · **Screens:** `TeamPrivileges`
**As** an owner, **I want** a person on two Teams to get everything either Team grants, **so that** access is predictable.

**Acceptance criteria**
- **Given** Sam is on "Accounts" (grants `invoices.issue`) and "Sales" (doesn't), **when** Sam issues an invoice, **then** it's allowed.
- **Given** Sam leaves "Accounts", **when** Sam next issues an invoice, **then** it's refused.
- **Given** Sam is on no Team, **when** Sam opens Spine, **then** Sam can read but not create or change records.
- **Given** the web app, **when** Sam's capabilities load, **then** buttons match what the API allows.

**Implementation notes**
- API: `GET /org/members/me/capabilities` (`getEffectiveCapabilities`).

### US-TEAM-14 · Keep Field access fixed
**Feature:** F-TEAM-03 · **Priority:** P1 · **Phase:** 0 · **Screens:** `TeamUsers`
**As** an owner, **I want** Field users' access fixed and narrow, **so that** I can't accidentally expose money to every phone.

**Acceptance criteria**
- **Given** a Field user, **when** I open a Team's member picker, **then** they can't be added (Teams are Staff-only).
- **Given** a Field user, **when** they request invoices, payments, receivables, payables or any report, **then** they get 403.
- **Given** a Field user, **when** they submit or edit their own expense, add photos or notes, complete a milestone or accept a quote in person, **then** it's allowed.
- **Given** a Field user, **when** they try any of those on someone else's expense, **then** it's refused.

**Implementation notes**
- `FIELD_OWN_CAPABILITIES`, `FIELD_ALWAYS_CAPABILITIES` (D-019).

### US-TEAM-15 · Use the business name everywhere the organisation is named
**Feature:** F-TEAM-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `EmailInvite`, `TeamUsers`
**As** an owner, **I want** invitations and system text to use my business name, **so that** people know who invited them.

Finding: C2

**Acceptance criteria**
- **Given** the business profile name is "Riverstone Builders", **when** an invitation email is sent, **then** it says "Alex Morgan invited you to join Riverstone Builders as staff.".
- **Given** I change the business name in Settings, **when** it saves, **then** the organisation's name updates too.
- **Given** an existing install where they differ, **when** it upgrades, **then** a migration copies the business name into the organisation name.

**Implementation notes**
- Data: keep `organization.name` in sync with `settings.business_profile.name`.

### US-TEAM-16 · Confirm before making someone an owner
**Feature:** F-TEAM-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `PromoteOwnerConfirm`
**As** an owner, **I want** to confirm before granting full access, **so that** a mis-click can't hand someone everything.

Finding: C20 · Decision: D-059

**Acceptance criteria**
- **Given** I choose "Promote to Owner", **when** the menu closes, **then** "Make <name> an owner?" explains "Owners have full access to everything in <Business> — every record and report, plus Users, Teams and Settings. Team permissions no longer apply to <name>. Any owner can change them back to Staff later." with "Cancel" and "Make owner".
- **Given** I press "Cancel", **when** the dialog closes, **then** nothing changes.
- **Given** I press "Make owner", **when** it succeeds, **then** their role shows "Owner".
- **Given** the confirm button, **when** it renders, **then** it's primary, not danger (D-058).

**Implementation notes**
- UI: `user-row.tsx` adds an `AlertDialog` before calling `PUT /org/members/:id/promote`.

### US-TEAM-17 · Protect the Primary Owner's row
**Feature:** F-TEAM-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `TeamUsers`
**As** the Primary Owner, **I want** no remove or demote controls on my own row, **so that** the page matches the rule that nobody can remove me.

Findings: C17, C18

**Acceptance criteria**
- **Given** the Primary Owner's row, **when** any Owner views it, **then** it shows no "Deactivate" button and its menu offers only "Transfer primary ownership…" (to the Primary Owner) or nothing (to others).
- **Given** a direct API call to deactivate the Primary Owner, **when** it's sent, **then** it returns 400.
- **Given** the Users page, **when** it renders, **then** "Users" and "Everyone with access to this organisation." appear once, as the page heading, not repeated as a section heading.

**Implementation notes**
- UI: `user-row.tsx`, `users-explorer.tsx`.

### US-TEAM-18 · Show each person only the sections they can open
**Feature:** F-TEAM-04 · **Priority:** P1 · **Phase:** 6 · **Screens:** `DashboardFieldRedesign`, `DashboardStaffRedesign`, `NoAccess`
**As** a field or staff member, **I want** the sidebar to list only what I can open, **so that** I never click into a page that refuses me.

Review finding: Stage 5 #30

**Acceptance criteria**
- **Given** a Field user on the web, **when** the sidebar renders, **then** it shows "OVERVIEW" › Dashboard and "WORK" › Jobs, Meetings, Expenses only — no Invoices, Credit Notes, Payments, Receivables, Vendor Bills, Payables, Reports, Team or Settings.
- **Given** a Staff user without `reports.view_receivables`, **when** the sidebar renders, **then** "Receivables" is hidden; the same applies to Payables (`reports.view_payables`) and Reports (no report capability at all).
- **Given** a Staff user, **when** the sidebar renders, **then** the Team section is hidden.
- **Given** a user types a hidden page's URL, **when** it loads, **then** the no-access page shows (US-OPS-12).

**Implementation notes**
- Screens: the trimmed sidebar is drawn on `DashboardFieldRedesign` (Phase 7); this story ships the sidebar filter alone in Phase 6, on today's dashboard.
- UI: `apps/web/src/lib/nav-sections.tsx` filters items with `useCapabilities()` and role; each nav item declares its required capability or role.
- The nav filter is a convenience; the server checks stay authoritative (07-security).

### US-TEAM-19 · See everyone at a glance on the list layout
**Feature:** F-TEAM-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `TeamUsersRefined`, `TeamUsersDark`
**As** an owner, **I want** Users to work like every other list, **so that** I can find a person and see how they stand without reading the whole page.

Decision: D-210, D-222, D-232

**Acceptance criteria**
- **Given** Users, **when** it opens, **then** the header has "Invite people"; tabs "Active", "Deactivated" and "Invites" (with counts) sit under it; below them the cards, the filter bar (Role — "All roles", "Owner", "Staff", "Field" — on the left; "Updated just now" and Refresh on the right) and the search bar (name or email, with Columns). Tab, role, card and search are kept in the address.
- **Given** the cards, **when** I look, **then** they read People (owners · staff · field), Staff without a Team (presses to show only them; warning when not zero) and Pending invites (with how many expired, opening the Invites tab).
- **Given** a row, **when** it shows, **then** it has the avatar, name and email with "You", "Primary Owner", "Demo" and "Deactivated" badges where they apply, the role, the Teams (US-TEAM-20), "Last active" ("2 hours ago", "3 Oct", or "Never signed in") and "Joined" in the business's date format.
- **Given** a row's menu, **when** I open it, **then** each item has its icon (D-222) and only appears where it applies: What they can open, Manage Teams (Staff), Change to Field / Change to Staff (US-TEAM-22), Promote to Owner (Staff), Demote to Staff (an Owner other than the Primary Owner and me), Transfer primary ownership (my own row, as Primary Owner), Deactivate or Reactivate.

**Implementation notes**
- API: for an Owner, `GET /org/members` rows gain `teams` (`[{ id, name }]`), `lastActiveAt` (the newest session's last use) and `isDemo`; other members get the rows as today.

### US-TEAM-20 · See and fix each person's Teams and access
**Feature:** F-TEAM-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ManageTeamsDialog`, `UserAccessDrawer`
**As** an owner, **I want** to see each Staff member's Teams and what they can open, and change their Teams from Users, **so that** nobody joins and finds they can't do anything.

Decision: D-232

**Acceptance criteria**
- **Given** a Staff member's row, **when** it shows, **then** their Teams are listed as chips (opening the Team); with none it reads "No Team — can't open anything" in the warning colour. Owners read "Everything"; Field reads "Field access".
- **Given** Manage Teams, **when** the dialog opens, **then** it lists every Team with a tick for those they're on and each Team's member count; saving updates their Teams at once and the toast says what changed ("Sarah Mendes is on General Staff and Accounts").
- **Given** "What they can open", **when** the drawer opens, **then** it shows their role, Teams, the sections of Spine they can open (as the sidebar would show them) and how many permissions they have of each group, with "Edit on <Team>" links; for an Owner it says "Owners can open everything", for Field "Field access is fixed".

**Implementation notes**
- API: `PUT /org/members/:id/teams { teamIds }` (Owner; Staff only, else 400 "Only Staff are on Teams."); `GET /org/members/:id/access` → `{ role, teams, capabilities }` (Owner) — the same effective list the API enforces.

### US-TEAM-21 · Invite several people, onto their Teams
**Feature:** F-TEAM-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `InvitePeopleDialog`, `TeamInvites`
**As** an owner, **I want** to invite a few people at once and put new Staff straight onto their Teams, **so that** they can work the moment they join.

Decision: D-020, D-232

**Acceptance criteria**
- **Given** "Invite people", **when** the dialog opens, **then** it asks for emails (one or more, separated by commas, spaces or new lines; up to 20), the role ("Staff" or "Field") and, for Staff, the Teams they'll join (General Staff ticked by default); "Send invites (3)" sends them all.
- **Given** some emails can't be invited, **when** I send, **then** the others are sent and the dialog lists which weren't and why ("already a member", "already invited — resend it instead", "not an email address").
- **Given** a Staff invite with Teams, **when** it's accepted, **then** the new member is on those Teams.
- **Given** the Invites tab, **when** it shows, **then** each invite has the email, role, Teams, "Invited by <name> · 3 Oct", and "Expires in 5 days" or "Expired"; its menu (with icons) offers Copy invite link, Resend and Cancel invite (asks first, as today).
- **Given** Copy invite link, **when** I press it, **then** the link is copied and the toast says "Only <email> can use it, signed in with that address."

**Implementation notes**
- API: `POST /org/invitations` also takes `{ emails: string[], role, teamIds? }` → `{ invited: [{ id, email }], skipped: [{ email, reason }] }` (`{ email, role }` still works); `GET /org/invitations` rows gain `inviterName`, `createdAt`, `teams` and `acceptUrl`.
- Data: `invitation_teams` (`invitation_id` → invitation, cascade; `team_id` → teams, cascade), applied when the invitation is accepted.

### US-TEAM-22 · Change someone between Staff and Field
**Feature:** F-TEAM-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ChangeRoleConfirm`
**As** an owner, **I want** to move a person between Staff and Field, **so that** a promotion from the site to the office doesn't mean a new account.

Decision: D-232

**Acceptance criteria**
- **Given** a Field member's menu, **when** I choose "Change to Staff", **then** "Change Marcus Webb to Staff?" says they'll have their Teams' access instead of Field access and asks which Teams to put them on (General Staff ticked); confirming changes the role and Teams together.
- **Given** a Staff member's menu, **when** I choose "Change to Field", **then** the confirm says they'll only see the jobs they're assigned to, without money, and they'll come off their Teams (named); confirming changes it.
- **Given** an Owner, **when** the menu shows, **then** there's no Change to Field (an Owner is demoted to Staff first); Owner is never set this way.
- **Given** either change, **when** it's done, **then** the toast says it, it's in the audit log as a role change, and the person's next request uses the new role.

**Implementation notes**
- API: `PUT /org/members/:id/role { role: "staff" | "field", teamIds? }` (Owner); only Staff ↔ Field (else 400 "Only Staff and Field can be changed this way."); to Field removes their Team memberships.

### US-TEAM-23 · Act on people safely
**Feature:** F-TEAM-05 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `TeamUsersRefined`
**As** an owner, **I want** people actions to ask first and say what happened, **so that** access never changes by accident.

Decision: D-218, D-223, D-232

**Acceptance criteria**
- **Given** my own row, **when** it shows, **then** it's marked "You" and offers no Deactivate; the API refuses it ("You can't deactivate yourself.").
- **Given** Reactivate, **when** I choose it, **then** "Reactivate <name>?" says they get their previous role and Teams back and can sign in again.
- **Given** any people action (deactivate, reactivate, promote, demote, change role, Teams, invite, resend, cancel), **when** it's done, **then** a toast says what happened (D-223) and a failure says what to do next above the list.
- **Given** the demo's people, **when** they're listed, **then** they're marked "Demo" and the Deactivate confirm notes they go when the demo data is deleted.

**Implementation notes**
- API: `PUT /org/members/:id/deactivate` refuses the caller's own member (400).

### US-TEAM-24 · Set a Staff or Field member's password
**Feature:** F-TEAM-06 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `TeamUsersPasswordMenu`, `ChangeMemberPasswordDialog`, `ChangeMemberPasswordDone`, `PrimaryOwnerNoPassword`, `ChooseOwnPassword`, `ChooseOwnPasswordMobile`
**As** an owner, **I want** to set a new password for someone on my Staff or Field team, **so that** a person locked out can get back to work today — without anyone being able to take over an Owner's account.

Decision: D-233

**Acceptance criteria**
- **Given** an active Staff or Field member's row, **when** I open its menu, **then** it has "Change password" (with its icon); an Owner's row — mine, another Owner's or the Primary Owner's — never has it, and the Primary Owner's menu says "Only <name> can change their own password, from Profile."
- **Given** the dialog, **when** it opens, **then** it suggests a strong password (shown, with Copy and Hide), offers "Generate another" or a typed one, shows the strength meter and checklist used at sign-up (US-AUTH-15), and says what happens: they're signed out everywhere, we email them that an Owner changed it (never the password), and I give them the password myself.
- **Given** "Change password", **when** it's done, **then** their sessions on web and phone end at once, the email goes (or is logged as not sent, US-SET-27), the audit log has "password set by <owner>" on the person (never the password), and the toast says "<name>'s password changed".
- **Given** the password I set, **when** they next sign in with it, web or phone, **then** they must choose their own before anything else ("Choose your own password" with the same checklist); the one I set can't be reused, and until they choose, every other request is refused.
- **Given** the API, **when** anyone asks to set the password of an Owner (the Primary Owner above all), themselves, someone in another business, or a deactivated member, **then** it refuses (403/400) whatever the screen shows.

**Implementation notes**
- API: `PUT /org/members/:id/password { newPassword }` (Owner; target Staff or Field, active, not the caller) — hashes as sign-in does, revokes the user's sessions, sets `user.must_change_password`, sends `password_set_by_owner` email, audits `password_set`. Server enforces the 8-character minimum and common list (US-AUTH-15).
- Data: `user.must_change_password boolean default false`.
- While `must_change_password` is set, a global guard answers 403 `{ error: "PASSWORD_CHANGE_REQUIRED" }` for everything but `PUT /org/members/me/password { newPassword }` (no current password — the session proves it; refuses the given one with "That's the password you were given. Choose a different one."; ends their other sessions), `GET /org/members/me` (gains `mustChangePassword` and `passwordSetBy { name, at }`) and Better Auth's own routes (sign-out); choosing clears the flag, and so does a reset by email link. Web sends them to `/choose-password`; the field app to its own screen.

### US-TEAM-25 · See every Team at a glance on the list layout
**Feature:** F-TEAM-07 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `TeamsListRefined`, `TeamsListDark`, `DeleteTeamConfirm`
**As** an owner, **I want** Teams to work like every other list, **so that** I can see what each Team allows and who is on it without opening each one.

Decision: D-210, D-222, D-234

**Acceptance criteria**
- **Given** Teams, **when** it opens, **then** the header has "Create Team"; below it the cards Teams (count), Staff on no Team (opens Users filtered to them; warning when not zero) and Staff on several Teams; then search (Team name or description) with Columns. The search is kept in the address.
- **Given** a row, **when** it shows, **then** it has the Team's name with "Default" and "Demo" badges and its description; its members as avatars with a count ("4 people", or "No one yet"); "Opens 9 of 16 sections" (as members' sidebars would show them); and "38 of 105 permissions".
- **Given** a row's menu, **when** I open it, **then** each item has its icon (D-222): Open, Rename, Duplicate and Delete; Delete isn't offered on the default Team or the only Team.
- **Given** Delete, **when** I choose it, **then** "Delete <Team>?" names how many people lose what it allowed and who'd be left on no Team ("Kavya Iyer will be on no Team — they can't open anything"); confirming deletes it and the toast says so (D-218, D-223).

**Implementation notes**
- API: `GET /org/teams` rows gain `description`, `isDemo`, `members` (`[{ memberId, name }]`) and `granted` (the capabilities it grants).

### US-TEAM-26 · Create a Team from another, or duplicate one
**Feature:** F-TEAM-07 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `CreateTeamDialog`
**As** an owner, **I want** to start a Team from one I already have, **so that** a similar Team doesn't mean switching 100 permissions on by hand.

Decision: D-234

**Acceptance criteria**
- **Given** "Create Team", **when** the dialog opens, **then** it asks for the name, an optional description ("What this Team is for") and "Start from": "Nothing allowed" or any Team (its permissions are copied, not its members); creating opens the new Team's Permissions with a toast ("<Team> created — check what it allows").
- **Given** a row's Duplicate, **when** I choose it, **then** the same dialog opens with "<Team> (copy)" and that Team chosen in "Start from".
- **Given** a name another Team has, **when** I create or rename, **then** it says "There's already a Team called <name>." under the field.
- **Given** Rename (from the list or the Team page), **when** I save, **then** the name and description change and the toast says so; the default Team's name stays, but its description can change.

**Implementation notes**
- Data: `teams.description text` (nullable, up to 200 characters).
- API: `POST /org/teams { name, description?, copyFromTeamId? }`; `PUT /org/teams/:id { name?, description? }`; a duplicate name is 409 with that message.

### US-TEAM-27 · Manage a Team's members safely
**Feature:** F-TEAM-07 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `TeamPageMembers`, `AddTeamMembersDialog`, `RemoveTeamMemberConfirm`
**As** an owner, **I want** a Team's page to show who's on it and change that safely, **so that** nobody loses access by accident.

Decision: D-218, D-223, D-234

**Acceptance criteria**
- **Given** a Team's page, **when** it opens, **then** the header shows its name, description, "Default"/"Demo" badges and a menu (Rename, Duplicate, Delete — with icons), and tabs Members, Permissions and History (a count on Members), kept in the address.
- **Given** Members, **when** I add, **then** "Add people" lets me tick several Staff not on this Team (with their current Teams beside them) and adds them at once; the toast names them.
- **Given** a member's row, **when** it shows, **then** it has their name and email, their other Teams, when they were last active, and a menu: What they can open (US-TEAM-20) and Remove from <Team>.
- **Given** Remove, **when** I choose it, **then** it asks first — and if this is their only Team, warns "<name> will be on no Team — they can't open anything"; confirming removes them and the toast says so.
- **Given** Field and Owners, **when** I add people, **then** they're not offered (only Staff are on Teams), and a note says so.

### US-TEAM-28 · Review permissions before saving
**Feature:** F-TEAM-07 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `TeamPagePermissions`, `SavePermissionsConfirm`
**As** an owner, **I want** to change a Team's permissions as a draft and see what they add up to, **so that** a mis-click never changes what people can do.

Decision: D-218, D-234

**Acceptance criteria**
- **Given** Permissions, **when** I switch something, **then** nothing is saved yet: the switch is marked "Changed", a bar sticks to the bottom ("5 changes · Discard · Save changes"), and leaving the page with unsaved changes asks first.
- **Given** a group, **when** it shows, **then** it reads "4 of 6" with its "toggle all" switch; "Expand all" / "Collapse all", a search over names and descriptions, and "Show changed only" sit above the list.
- **Given** a change, **when** I make it, **then** the panel "What members will open" beside the list shows the sections of Spine members will see (as their sidebar would), marking ones the draft adds or takes away.
- **Given** Save changes, **when** I press it, **then** "Save <n> changes to <Team>?" lists what turns on and off — including ones turned on or off with them (US-BANK-12) — and that it applies to its <n> people at their next request; confirming saves them in one request and the toast says so.

### US-TEAM-29 · See a Team's history
**Feature:** F-TEAM-07 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `TeamPageHistory`
**As** an owner, **I want** to see who changed a Team and how, **so that** I can tell why someone can or can't do something.

Decision: D-064, D-234

**Acceptance criteria**
- **Given** any change to a Team — created (and from which Team), renamed or described, members added or removed, permissions turned on or off, deleted — **when** it's saved, **then** it's in the audit log as record type "Team" with who and when, and the changes named (permissions by their labels).
- **Given** the History tab, **when** it opens, **then** it lists those entries newest first ("Priya Raman turned on Reconcile accounts and View bank balances · 12 Oct, 10:42"), with "Open in audit log" for the full log filtered to this Team.

**Implementation notes**
- API: `GET /org/teams/:id/history` → `[{ at, actorName, action, changes }]`, newest first (Owner); `/org/audit-log` takes `entityId`. Audit actions on entity type `team`: `created`, `updated`, `members_changed`, `privileges_changed`, `deleted`.
